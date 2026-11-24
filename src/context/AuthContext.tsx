import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/resources'
import { TOKEN_STORAGE_KEY, setUnauthorizedHandler } from '@/api/client'
import { runSignOutCleanups } from '@/lib/session-cleanup'
import { refreshTokenIfDue, revokeSessionOnServer } from '@/api/session'
import { refreshOfflineCounts, startOfflineSync, syncNow } from '@/offline/engine'
import type { AuthUser, LoginResponse } from '@/types'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  loginWithOtp: (employeeCode: string, otp: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

const USER_STORAGE_KEY = 'uktex_employee_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = React.useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  })
  const [isLoading, setIsLoading] = React.useState(false)

  /**
   * Drops everything held in memory for whoever was signed in: the query cache (cached manager status, notifications,
   * documents, salary, chat, selfies, ...), pending mutations and per-user blobs/object URLs registered in
   * lib/session-cleanup. The cache keys are not user-scoped, so without this the next person to sign in on the same
   * tab would be served the previous person's data while it is still fresh.
   */
  const forgetUserData = React.useCallback(() => {
    void queryClient.cancelQueries()
    queryClient.clear()
    runSignOutCleanups()
  }, [queryClient])

  const signIn = React.useCallback(
    async (request: () => Promise<LoginResponse>) => {
      setIsLoading(true)
      try {
        const res = await request()
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
        const nextUser: AuthUser = { role: res.role, employeeId: res.employeeId, name: res.name }
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser))
        // Whatever an earlier session left behind (e.g. one ended by a 401 on the sign-in page) must not reach this one.
        forgetUserData()
        setUser(nextUser)
      } finally {
        setIsLoading(false)
      }
    },
    [forgetUserData],
  )

  const login = React.useCallback(
    (identifier: string, password: string) => signIn(() => authApi.login(identifier, password)),
    [signIn],
  )
  const loginWithOtp = React.useCallback(
    (employeeCode: string, otp: string) => signIn(() => authApi.loginWithOtp(employeeCode, otp)),
    [signIn],
  )

  /** Every sign-out goes through here: the button, the resignation/deactivation guard and a 401 from the server. */
  const endSession = React.useCallback(
    (revoke: boolean) => {
      // The sign-in lasts until the employee signs out (owner 2026-11-24): signing out ends it on the server too, so the
      // token cannot be used again. Not after a 401: the server already ended it.
      if (revoke) revokeSessionOnServer(localStorage.getItem(TOKEN_STORAGE_KEY))
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      localStorage.removeItem(USER_STORAGE_KEY)
      forgetUserData()
      setUser(null)
    },
    [forgetUserData],
  )
  const logout = React.useCallback(() => endSession(true), [endSession])

  // The offline queue (owner 2026-11-24): requests saved on this device while offline are sent automatically once the
  // browser is back online / the tab is back in view. Started once; each sign-in shows (and sends) only its own items.
  React.useEffect(() => startOfflineSync(queryClient), [queryClient])
  React.useEffect(() => {
    void refreshOfflineCounts()
    if (user) void syncNow(true)
  }, [user])

  // Stay signed in: renew the 180-day sign-in when it is getting old (or is an old 7-day token), when the app opens,
  // when the tab comes back into view and when the browser is back online. api/session.ts.
  React.useEffect(() => {
    if (!user) return
    void refreshTokenIfDue()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshTokenIfDue()
    }
    const onOnline = () => void refreshTokenIfDue()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [user])

  // A 401 means the server no longer accepts this session: sign out fully (not just drop the token), so a stale stored
  // user cannot reopen protected pages and nothing cached outlives the session. A 401 with no session at all (a wrong
  // password on the sign-in page) changes nothing here. The interceptor then redirects to sign-in as before.
  React.useEffect(
    () =>
      setUnauthorizedHandler(() => {
        if (localStorage.getItem(TOKEN_STORAGE_KEY) === null && localStorage.getItem(USER_STORAGE_KEY) === null) return
        endSession(false)
      }),
    [endSession],
  )

  return <AuthContext.Provider value={{ user, isLoading, login, loginWithOtp, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

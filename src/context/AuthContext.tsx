import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/resources'
import { TOKEN_STORAGE_KEY, setUnauthorizedHandler } from '@/api/client'
import { runSignOutCleanups } from '@/lib/session-cleanup'
import { SESSION_COOKIE_FLAG, refreshTokenIfDue, restoreBrowserSession, revokeSessionOnServer } from '@/api/session'
import { refreshOfflineCounts, startOfflineSync, syncNow } from '@/offline/engine'
import { playSignOut, stopSpeaking, transitionPlaying } from '@/components/transitions/auth-transitions'
import type { AuthUser, LoginResponse } from '@/types'
import { ACCOUNT_STATUS_KEY } from '@/hooks/useAccountStatus'
import { accountStatusOf } from '@/lib/inactive-account'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  /** Signs in; resolves with who is now signed in (the sign-in page greets them by name). */
  login: (identifier: string, password: string) => Promise<AuthUser>
  loginWithOtp: (employeeCode: string, otp: string) => Promise<AuthUser>
  /**
   * The employee's own sign-out (a button): plays the short walk-out-of-the-door farewell and ends the session behind it
   * (owner 2026-11-25). A forced sign-out (resignation / deactivation) passes `{ silent: true }` and ends it at once,
   * as a 401 from the server always does. Any other argument (e.g. a click event) counts as the employee's own.
   */
  logout: (options?: unknown) => void
  /** True while a browser that lost its stored token is being signed back in from its session cookie (on load). */
  isRestoring: boolean
  /** True when the current sign-in was restored that way (the sign-in page then goes straight to the dashboard). */
  restored: boolean
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
  // No token stored: maybe the browser lost it while the session is still open; ask the server first (owner 2026-11-25).
  const [isRestoring, setIsRestoring] = React.useState(() => !localStorage.getItem(TOKEN_STORAGE_KEY))
  const [restored, setRestored] = React.useState(false)

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
        // The password sign-in says whether the HRMS account is active (2026-11-25): an inactive one is covered at once
        // (components/layout/InactiveAccountGate.tsx); GET /auth/me keeps asking after that.
        const status = accountStatusOf(res)
        if (status) queryClient.setQueryData([...ACCOUNT_STATUS_KEY, String(res.employeeId)], status)
        setUser(nextUser)
        setRestored(false)
        localStorage.setItem(SESSION_COOKIE_FLAG, '1') // the sign-in reply set the session cookie
        return nextUser
      } finally {
        setIsLoading(false)
      }
    },
    [forgetUserData, queryClient],
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
      localStorage.removeItem(SESSION_COOKIE_FLAG)
      forgetUserData()
      setUser(null)
      setRestored(false)
    },
    [forgetUserData],
  )
  const logout = React.useCallback(
    (options?: unknown) => {
      const silent = !!options && typeof options === 'object' && (options as { silent?: unknown }).silent === true
      if (silent) {
        endSession(true)
        return
      }
      if (transitionPlaying('sign-out')) return // already on its way out: a second click changes nothing
      stopSpeaking()
      playSignOut(() => endSession(true))
    },
    [endSession],
  )

  // Signed back in from the browser's HttpOnly session cookie when the stored token is gone (owner 2026-11-25): the
  // employee stays signed in until they sign out, even when the browser cleared this site's storage. Once, on load.
  React.useEffect(() => {
    if (!isRestoring) return
    let alive = true
    void restoreBrowserSession().then((res) => {
      if (!alive) return
      if (res) {
        localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
        const nextUser: AuthUser = { role: res.role as AuthUser['role'], employeeId: String(res.employeeId), name: res.name }
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser))
        const status = accountStatusOf(res)
        if (status) queryClient.setQueryData([...ACCOUNT_STATUS_KEY, String(res.employeeId)], status)
        setUser(nextUser)
        setRestored(true)
        localStorage.setItem(SESSION_COOKIE_FLAG, '1')
      } else if (localStorage.getItem(USER_STORAGE_KEY)) {
        // a stored user with no token and no saved session: nobody is signed in
        localStorage.removeItem(USER_STORAGE_KEY)
        setUser(null)
      }
      setIsRestoring(false)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Every tab of the web app is the same sign-in (owner 2026-11-25): signing out in one signs out the others, and a
  // sign-in in another tab shows here too, instead of tabs undoing each other.
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return
      if (e.key === TOKEN_STORAGE_KEY && e.newValue === null) {
        forgetUserData()
        setUser(null)
        setRestored(false)
      } else if (e.key === USER_STORAGE_KEY && e.newValue) {
        try {
          const next = JSON.parse(e.newValue) as AuthUser
          setUser((prev) => {
            if (prev && String(prev.employeeId) !== String(next.employeeId)) forgetUserData()
            return next
          })
        } catch {
          /* not ours */
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [forgetUserData])

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
    // Signed in before the browser session cookie existed: renew once now to get it (owner 2026-11-25).
    void refreshTokenIfDue(!localStorage.getItem(SESSION_COOKIE_FLAG))
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginWithOtp, logout, isRestoring, restored }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

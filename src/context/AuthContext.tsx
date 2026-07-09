import * as React from 'react'
import { authApi } from '@/api/resources'
import { TOKEN_STORAGE_KEY } from '@/api/client'
import type { AuthUser } from '@/types'

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

const USER_STORAGE_KEY = 'uktex_employee_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  })
  const [isLoading, setIsLoading] = React.useState(false)

  const login = React.useCallback(async (identifier: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await authApi.login(identifier, password)
      localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
      const nextUser: AuthUser = { role: res.role, employeeId: res.employeeId, name: res.name }
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = React.useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(USER_STORAGE_KEY)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/**
 * When to renew the employee's sign-in (owner 2026-11-24, same rules as the mobile app's lib/tokenClaims.ts). The server
 * issues a sign-in that lasts 180 days (backend/api/employee_sessions.py) and renews it on POST /auth/refresh, so an
 * employee stays signed in until they sign out (or HR / the server ends the session). Pure: tested in token-claims.test.ts.
 */

/** Renew when less than this is left (the server gives 180 days): about every 10 days of use. */
export const RENEW_WHEN_LEFT_MS = 170 * 24 * 3600 * 1000

export interface TokenClaims {
  exp?: number
  kind?: string
  role?: string
  employeeId?: number | string
  name?: string
}

function base64UrlDecode(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  // UTF-8 safe (a name with non-ASCII letters)
  try {
    return decodeURIComponent(Array.from(binary, (ch) => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
  } catch {
    return binary
  }
}

/** The claims of a JWT (not verified: only the server can do that), or null when it is not one. */
export function readClaims(token: string | null | undefined): TokenClaims | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const claims: unknown = JSON.parse(base64UrlDecode(parts[1]))
    return claims && typeof claims === 'object' ? (claims as TokenClaims) : null
  } catch {
    return null
  }
}

/** Whether an employee token should be renewed now. A token from before sessions existed (no `kind`) is renewed at once. */
export function renewalDue(token: string | null | undefined, now = Date.now()): boolean {
  const claims = readClaims(token)
  if (!claims || claims.role !== 'employee') return false
  if (claims.kind !== 'employee_session') return true
  if (typeof claims.exp !== 'number') return true
  return claims.exp * 1000 - now < RENEW_WHEN_LEFT_MS
}

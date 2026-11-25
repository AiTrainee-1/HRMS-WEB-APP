import axios from 'axios'
import { API_BASE_URL, TOKEN_STORAGE_KEY, apiClient } from '@/api/client'
import { renewalDue } from '@/lib/token-claims'

/**
 * Keeping the employee signed in until they sign out (owner 2026-11-24, as in the mobile app's lib/tokenRefresh.ts).
 * The server's sign-in lasts 180 days and is renewed on POST /auth/refresh; AuthProvider calls refreshTokenIfDue when
 * the app opens, when the tab comes back into view and when the browser is back online.
 *
 * An older server without /auth/refresh answers 404: nothing changes, and it is not asked again until the next load.
 * A 401 means the session was ended (signed out elsewhere, HR): the API client signs out, as for any request.
 */
let unsupported = false
let inFlight: Promise<void> | null = null

/** Renews the stored sign-in when it is due. Never throws; does nothing offline or on an older server. */
/**
 * Set once this browser holds the server's HttpOnly session cookie (a sign-in, a restore or a renewal since
 * 2026-11-25). Page scripts cannot see that cookie, so this flag is how the app knows; a browser signed in before
 * the cookie existed renews once to get it (AuthContext).
 */
export const SESSION_COOKIE_FLAG = 'uktex_session_cookie_v1'

/** Renews the stored sign-in when it is due (or at once with `force`). Never throws; does nothing offline or on an older server. */
export function refreshTokenIfDue(force = false): Promise<void> {
  if (unsupported) return Promise.resolve()
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (!token || (!force && !renewalDue(token))) return
      // withCredentials: the server renews the browser's HttpOnly session cookie too (owner 2026-11-25)
      const res = await apiClient.post<{ token?: string }>('/auth/refresh', {}, { timeout: 10_000, skipOfflineDetection: true, withCredentials: true })
      const fresh = res.data?.token
      // Store it only if nobody signed out / in meanwhile.
      if (typeof fresh === 'string' && fresh && localStorage.getItem(TOKEN_STORAGE_KEY) === token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, fresh)
        localStorage.setItem(SESSION_COOKIE_FLAG, '1')
      }
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 404 || status === 405) unsupported = true
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/**
 * Ends this sign-in on the server too (best effort, before the browser forgets the token), so the token cannot be
 * used again. Sent outside apiClient: a 401 here (already ended) must not start a second sign-out or a redirect.
 */
export function revokeSessionOnServer(token: string | null): void {
  if (!token) return
  void axios
    // withCredentials: the server also deletes the browser's session cookie
    .post(`${API_BASE_URL}/auth/logout`, {}, { timeout: 4000, withCredentials: true, headers: { Authorization: `Bearer ${token}` } })
    .catch(() => {
      /* offline or already ended: the browser forgets it anyway */
    })
}

/** The reply of a sign-in (and of POST /auth/session/restore). */
export interface RestoredSession {
  token: string
  role: string
  employeeId: string | number
  name: string
  accountStatus?: string
  employeeStatus?: string
}

/**
 * Signs this browser back in from its HttpOnly session cookie (owner 2026-11-25): the server set it at sign-in
 * (password or OTP), so a page that lost its stored token (Safari's 7-day storage limit, a link opened inside WhatsApp,
 * a cleaner app) does not have to ask for the password or a new code again. Same session: one ended by logout or by HR
 * does not come back. Sent outside apiClient (a 401 here only means "no saved sign-in"). null when there is none or the
 * server cannot be reached.
 */
export async function restoreBrowserSession(): Promise<RestoredSession | null> {
  try {
    const res = await axios.post<RestoredSession>(`${API_BASE_URL}/auth/session/restore`, {}, { timeout: 5000, withCredentials: true })
    return res.data && typeof res.data.token === 'string' && res.data.token ? res.data : null
  } catch {
    return null
  }
}

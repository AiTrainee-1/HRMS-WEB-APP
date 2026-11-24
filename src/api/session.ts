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
export function refreshTokenIfDue(): Promise<void> {
  if (unsupported) return Promise.resolve()
  if (inFlight) return inFlight
  inFlight = (async () => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY)
      if (!renewalDue(token)) return
      const res = await apiClient.post<{ token?: string }>('/auth/refresh', {}, { timeout: 10_000, skipOfflineDetection: true })
      const fresh = res.data?.token
      // Store it only if nobody signed out / in meanwhile.
      if (typeof fresh === 'string' && fresh && localStorage.getItem(TOKEN_STORAGE_KEY) === token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, fresh)
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
    .post(`${API_BASE_URL}/auth/logout`, {}, { timeout: 4000, headers: { Authorization: `Bearer ${token}` } })
    .catch(() => {
      /* offline or already ended: the browser forgets it anyway */
    })
}

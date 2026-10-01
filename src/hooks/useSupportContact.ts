import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/api/client'
import {
  parseSupportContact,
  readCachedSupportContact,
  writeCachedSupportContact,
  type SupportContact,
} from '@/lib/support-contact'

export const SUPPORT_CONTACT_QUERY_KEY = ['support-contact'] as const

async function fetchSupportContact(): Promise<SupportContact> {
  // Public endpoint: no Bearer token, and nothing here may sign the user out. A failure to fetch it says nothing
  // about the server being down (it must not raise the "can't reach the server" banner that itself shows this).
  const raw = await apiRequest<unknown>({ method: 'GET', url: '/support-contact', isPublic: true, skipOfflineDetection: true })
  const contact = parseSupportContact(raw)
  // Not the contract (e.g. an HTML error page from a proxy): throw so the copy already held is kept, not replaced.
  if (!contact) throw new Error('Unexpected response from /support-contact')
  writeCachedSupportContact(contact)
  return contact
}

/**
 * HR / software-support contact details (Settings -> HR Contact). Works on signed-out pages. The copy kept on this
 * device is used at once, refreshed in the background, and kept when a refresh fails, so the numbers are still
 * there when the server is down. `data` is undefined only when nothing has ever been fetched on this device.
 */
export function useSupportContact() {
  return useQuery({
    queryKey: SUPPORT_CONTACT_QUERY_KEY,
    queryFn: fetchSupportContact,
    initialData: () => readCachedSupportContact() ?? undefined,
    // The device copy is only a starting point: treat it as stale so the first mount of a page load refreshes it.
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    // A dead server must not be hammered; the next mount / window focus tries again.
    retry: false,
  })
}

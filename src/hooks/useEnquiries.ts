import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enquiriesApi } from '@/api/enquiries'
import { useAuth } from '@/context/AuthContext'
import { queuedRequests } from '@/offline/queued-requests'

export const ENQUIRIES_KEY = 'enquiries'

/** My enquiries to HR, newest first; asked again every minute while the page is open (HR may reply meanwhile). */
export function useMyEnquiries() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [ENQUIRIES_KEY, user?.employeeId],
    queryFn: enquiriesApi.list,
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })
}

/** Raise a new enquiry; the list is asked again once it is in. */
export function useRaiseEnquiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { category: string; subject: string; message: string }) =>
      // Works offline too (owner 2026-11-24): the queued marker (isQueued) when it was saved on this device.
      queuedRequests.enquiry<unknown>({ category: input.category, subject: input.subject.trim(), message: input.message.trim() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ENQUIRIES_KEY] }),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { remindersApi } from '@/api/approvals-reminders'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { retryTransient } from '@/hooks/retry'
import { normalizePendingRequests, readRemindResult, type PendingRequests } from '@/lib/pending-reminders'

export const MY_PENDING_KEY = ['my-pending-requests'] as const

/**
 * The employee's own requests still waiting for an answer (GET /my/pending-requests), validated by
 * lib/pending-reminders.ts. `dataUpdatedAt` is when the list arrived: the reminder countdown runs from the server's own
 * figure from then on, so a PC with a wrong clock still shows the right wait.
 */
export function useMyPendingRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...MY_PENDING_KEY, user?.employeeId],
    queryFn: async (): Promise<PendingRequests> => {
      const data = normalizePendingRequests(await remindersApi.myPending())
      if (!data) throw new ApiError('The server sent an answer this page could not read.', 200)
      return data
    },
    enabled: !!user,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: retryTransient,
  })
}

/** "Remind Department Head / HR" for one request. The server answers with its own sentence and the request as it is now. */
export function useRemindApprover() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ module, id }: { module: string; id: number }) => readRemindResult(await remindersApi.remind(module, id)),
    onSettled: () => qc.invalidateQueries({ queryKey: MY_PENDING_KEY }),
  })
}

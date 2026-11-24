import { useMutation, useQueryClient } from '@tanstack/react-query'
import { withdrawApi } from '@/api/withdraw'
import { CL_ELIGIBILITY_KEY, CL_LIST_KEY } from '@/hooks/useCasualLeave'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import type { WithdrawModule } from '@/lib/withdraw'

/**
 * Withdraw one of my own waiting Leave / Permission / Casual Leave requests (owner 2026-11-24). Whatever the answer,
 * the lists that show it are asked again: a refusal (409, decided meanwhile) means the card on screen is out of date.
 */
export function useWithdrawRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ module, id }: { module: WithdrawModule; id: number }) => withdrawApi.withdraw(module, id),
    onSettled: (_data, _err, { module }) => {
      if (module === 'leave') qc.invalidateQueries({ queryKey: ['leave-requests'] })
      if (module === 'permission') {
        qc.invalidateQueries({ queryKey: ['permissions'] })
        qc.invalidateQueries({ queryKey: ['shift-stats'] })
      }
      if (module === 'casual_leave') {
        qc.invalidateQueries({ queryKey: [CL_LIST_KEY] })
        qc.invalidateQueries({ queryKey: [CL_ELIGIBILITY_KEY] })
      }
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
    },
  })
}

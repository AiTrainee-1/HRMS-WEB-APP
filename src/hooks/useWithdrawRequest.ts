import { useMutation, useQueryClient } from '@tanstack/react-query'
import { withdrawApi } from '@/api/withdraw'
import { MY_ADVANCES_KEY } from '@/hooks/useAdvances'
import { CL_ELIGIBILITY_KEY, CL_LIST_KEY } from '@/hooks/useCasualLeave'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import type { WithdrawModule } from '@/lib/withdraw'

/**
 * Withdraw one of my own waiting Leave / Permission / Casual Leave requests (owner 2026-11-24) or Salary Advance / Term
 * Loan applications (2026-11-26). Whatever the answer, the lists that show it are asked again: a refusal (409, decided
 * meanwhile) means the card on screen is out of date.
 */
export function useWithdrawRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ module, id }: { module: WithdrawModule; id: number }) => withdrawApi.withdraw(module, id),
    onSettled: (_data, err, { module, id }) => {
      if (module === 'leave') qc.invalidateQueries({ queryKey: ['leave-requests'] })
      if (module === 'permission') {
        qc.invalidateQueries({ queryKey: ['permissions'] })
        qc.invalidateQueries({ queryKey: ['shift-stats'] })
      }
      if (module === 'casual_leave') {
        qc.invalidateQueries({ queryKey: [CL_LIST_KEY] })
        qc.invalidateQueries({ queryKey: [CL_ELIGIBILITY_KEY] })
      }
      if (module === 'advance') {
        // The list, the eligibility (one Salary Advance a month / a Term Loan still waiting) and the Dashboard's check all
        // sit under this prefix. A deleted application's own detail query is not asked again (it would 404 while its
        // dialog closes); a refused one (409, decided meanwhile) is, so its details show the new status.
        qc.invalidateQueries({
          queryKey: MY_ADVANCES_KEY,
          predicate: (q) => !!err || q.queryKey[2] !== 'one' || q.queryKey[3] !== id,
        })
      }
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { compensationApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { normalizeMyClaims, type ClaimBody } from '@/lib/compensation-claims'
import { COMPENSATION_QUERY_KEY } from './useCompensation'
import { retryTransient } from './retry'

export const COMPENSATION_CLAIMS_KEY = 'compensation-claims'

/**
 * GET /employee/compensation/claims: the employee's own claims (any kind, raised by them or by HR), newest first. Only
 * asked for when the server offers self-claims (`canClaim`): an older backend has no such route. A reply that is not a
 * list is an ERROR, never "no claims".
 */
export function useMyCompensationClaims(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [COMPENSATION_CLAIMS_KEY, user?.employeeId ?? null],
    queryFn: async () => {
      const list = normalizeMyClaims(await compensationApi.claims())
      if (!list) throw new ApiError('The server sent an answer this page could not read.', 200)
      return list
    },
    enabled: enabled && !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: retryTransient,
  })
}

/** After any claim change: the 90-day list (claim states, balance), the year timeline and the claims list. */
function useInvalidateCompensation() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: [COMPENSATION_QUERY_KEY] })
    void qc.invalidateQueries({ queryKey: ['pay', 'compensation-history'] })
    void qc.invalidateQueries({ queryKey: [COMPENSATION_CLAIMS_KEY] })
  }
}

/** POST /employee/compensation/claims. */
export function useClaimCompensation() {
  const invalidate = useInvalidateCompensation()
  return useMutation({
    mutationFn: (body: ClaimBody) => compensationApi.claim(body),
    // A refusal (already claimed, too old ...) also means what is on screen is out of date: read it again either way.
    onSettled: invalidate,
  })
}

/** POST /employee/compensation/use. */
export function useSpendBalance() {
  const invalidate = useInvalidateCompensation()
  return useMutation({
    mutationFn: (body: { date: string; shifts: number; reason: string }) => compensationApi.useBalance(body),
    onSettled: invalidate,
  })
}

/** DELETE /employee/compensation/claims/<id>. */
export function useWithdrawClaim() {
  const invalidate = useInvalidateCompensation()
  return useMutation({
    mutationFn: (id: number | string) => compensationApi.withdrawClaim(id),
    onSettled: invalidate,
  })
}

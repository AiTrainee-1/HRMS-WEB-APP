import { useQuery } from '@tanstack/react-query'
import { payCompensationApi } from '@/api/pay-compensation'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { normalizeHistory, type CompensationHistory } from '@/lib/compensation-history'
import { retryTransient } from './retry'

/**
 * GET /my/compensation-history?year=: every compensation of the year (detected, given by HR, announced for everybody),
 * the balance and the overtime pay each month's salary slip paid. Staff only: a production employee gets
 * `isStaff: false` and a message. A reply that is not the contract is an ERROR, never "nothing".
 */
export function useCompensationHistory(year: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pay', 'compensation-history', user?.employeeId ?? null, year],
    queryFn: async (): Promise<CompensationHistory> => {
      const data = normalizeHistory(await payCompensationApi.history(year))
      if (!data) throw new ApiError('The server sent an answer this page could not read.', 200)
      return data
    },
    enabled: !!user,
    staleTime: 30_000,
    retry: retryTransient,
    placeholderData: (previous) => previous,
  })
}

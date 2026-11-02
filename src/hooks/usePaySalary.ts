import { useQuery } from '@tanstack/react-query'
import { paySalaryApi, type PaySlipListItem } from '@/api/pay-salary'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { normalizeInsights, normalizePeriod, type SalaryInsights, type SalaryPeriod } from '@/lib/salary-insights'
import { retryTransient } from './retry'

const UNREADABLE = 'The server sent an answer this page could not read.'

/**
 * GET /my/salary-insights?year=: allocated vs earned vs payable for every pay period of the year, and the year's totals.
 * `year` null = the server's default (the latest year with slips). A reply that is not the contract is an ERROR (Try
 * again), never an empty year; a refusal (4xx) is not retried, so the page leaves the skeleton at once.
 */
export function useSalaryInsights(year: number | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pay', 'salary-insights', user?.employeeId ?? null, year],
    queryFn: async (): Promise<SalaryInsights> => {
      const data = normalizeInsights(await paySalaryApi.insights(year))
      if (!data) throw new ApiError(UNREADABLE, 200)
      return data
    },
    enabled: !!user,
    staleTime: 60_000,
    retry: retryTransient,
    placeholderData: (previous) => previous,
  })
}

/** GET /my/salary-slips/<id>/breakdown: one slip as a waterfall, every line explained. */
export function useSalaryBreakdown(id: string | undefined) {
  return useQuery({
    queryKey: ['pay', 'salary-breakdown', id ?? null],
    queryFn: async (): Promise<SalaryPeriod> => {
      const data = normalizePeriod(await paySalaryApi.breakdown(id!))
      if (!data) throw new ApiError(UNREADABLE, 200)
      return data
    },
    enabled: !!id,
    staleTime: 60_000,
    retry: retryTransient,
  })
}

/** GET /my/salary-slips: every slip, the list shown when the insights cannot load. */
export function usePaySlips(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pay', 'salary-slips', user?.employeeId ?? null],
    queryFn: async (): Promise<PaySlipListItem[]> => {
      const data = await paySalaryApi.slips()
      // Anything but a list is an error, never "no slips": a failed load must not read as "payroll not generated".
      if (!Array.isArray(data)) throw new ApiError(UNREADABLE, 200)
      return data as PaySlipListItem[]
    },
    enabled: !!user && enabled,
    staleTime: 60_000,
    retry: retryTransient,
  })
}

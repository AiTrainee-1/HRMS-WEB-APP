import { useQuery } from '@tanstack/react-query'
import { myAnalyticsApi } from '@/api/my-analytics'
import { useAuth } from '@/context/AuthContext'
import { retryTransient } from '@/hooks/retry'

export const MY_INSIGHTS_KEY = ['my-analytics'] as const

/**
 * The Dashboard's "My Insights" (owner 2026-11-25; the mobile app's hooks/useMyInsights.ts): GET /my/analytics?months=N,
 * the employee's own counts month by month. A reply that is not one is an error (Try again), never "no data". Past
 * months do not move and the current one only changes with a punch, so it is fresh for 5 minutes and never polls.
 */
export function useMyInsights(months = 6) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...MY_INSIGHTS_KEY, user?.employeeId ?? null, months],
    queryFn: () => myAnalyticsApi.insights(months),
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: retryTransient,
  })
}

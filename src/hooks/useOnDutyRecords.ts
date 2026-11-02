import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { onDutyRecordsApi } from '@/api/approvals-onduty'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { retryTransient } from '@/hooks/retry'
import { monthKey, type CalMonth } from '@/lib/month-switch'
import { normalizeJourney, normalizeOnDutyPage, type OnDutyRecordsPage } from '@/lib/onduty-records'

export const ON_DUTY_RECORDS_KEY = ['on-duty-records'] as const

const unreadable = () => new ApiError('The server sent an answer this page could not read.', 200)

/**
 * Every On-Duty request the employee made (GET /on-duty-sessions/mine), newest first, 30 at a time.
 * `month` (the month switcher): asks the server for that month only (`?month=YYYY-MM`); each month is its own cached
 * list. A server that applied it echoes the month on each page (`page.month`); an older one ignores it and pages through
 * everything - the caller then loads pages until the month is covered (lib/onduty-records monthCovered).
 * `poll: false` = no 60-second refresh (a one-off lookup).
 */
export function useOnDutyRecords(enabled = true, opts: { month?: CalMonth | null; poll?: boolean } = {}) {
  const { user } = useAuth()
  const key = opts.month ? monthKey(opts.month) : null
  return useInfiniteQuery({
    queryKey: key ? [...ON_DUTY_RECORDS_KEY, user?.employeeId, key] : [...ON_DUTY_RECORDS_KEY, user?.employeeId],
    queryFn: async ({ pageParam }): Promise<OnDutyRecordsPage> => {
      const page = normalizeOnDutyPage(await onDutyRecordsApi.mine(pageParam, 30, key ?? undefined), pageParam)
      if (!page) throw unreadable()
      return page
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: enabled && !!user,
    refetchInterval: opts.poll === false ? false : 60_000,
    refetchIntervalInBackground: false,
    retry: retryTransient,
  })
}

/** The recorded route of one day (GET /tracking/journeys/<id>); only fetched while the route dialog is open. */
export function useJourney(id: number | null) {
  return useQuery({
    queryKey: ['on-duty-journey', id],
    queryFn: async () => {
      const journey = normalizeJourney(await onDutyRecordsApi.journey(id as number))
      if (!journey) throw unreadable()
      return journey
    },
    enabled: id !== null,
    staleTime: 60_000,
    retry: retryTransient,
  })
}

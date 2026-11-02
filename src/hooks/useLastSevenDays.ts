import { useQuery } from '@tanstack/react-query'
import { attendanceApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { retryTransient } from '@/hooks/retry'
import { lastSevenDays, previousMonthNeeded, type PreviousMonthState, type StripCell } from '@/lib/last-seven-days'
import type { AttendanceDay } from '@/types'

/**
 * The Dashboard's "Last 7 days" cells. `records` is this month's attendance (already loaded by useTodayAttendance).
 * From the 1st to the 6th the strip reaches into last month, so last month is asked for too, with the SAME key and
 * function as the Attendance page (['attendance', employeeId, month, year]), so paging the calendar back costs nothing.
 * It is not polled: a past month only changes when HR corrects it, and five minutes is fresh enough for a dashboard.
 */
export function useLastSevenDays(now: Date, records: AttendanceDay[]): StripCell<AttendanceDay>[] {
  const { user } = useAuth()
  const prev = previousMonthNeeded(now)
  const query = useQuery({
    queryKey: ['attendance', user?.employeeId, prev?.month, prev?.year],
    queryFn: () => attendanceApi.monthly(user!.employeeId, prev!.month, prev!.year),
    enabled: !!user && prev != null,
    staleTime: 5 * 60_000,
    retry: retryTransient,
  })
  let previous: PreviousMonthState<AttendanceDay>
  if (!prev) previous = { status: 'idle' }
  else if (query.data) previous = { status: 'ready', records: query.data.records ?? [] }
  else if (query.isError || !user) previous = { status: 'error' }
  else previous = { status: 'loading' }
  return lastSevenDays(now, records, previous)
}

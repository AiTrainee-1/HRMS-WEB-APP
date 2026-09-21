import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { attendanceApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'

/**
 * This month's attendance plus today's record. Shares its query key with the
 * Attendance page and Dashboard, so the top-bar punch pill, the dashboard and
 * the calendar all read one cached request instead of three.
 */
export function useMonthAttendance(month: number, year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['attendance', user?.employeeId, month, year],
    queryFn: () => attendanceApi.monthly(user!.employeeId, month, year),
    enabled: !!user,
    refetchInterval: 60_000,
  })
}

export function useTodayAttendance() {
  const now = new Date()
  const query = useMonthAttendance(now.getMonth() + 1, now.getFullYear())
  const todayStr = format(now, 'yyyy-MM-dd')
  const today = query.data?.records.find((r) => r.date === todayStr) ?? null
  const punches = today?.punches ?? []
  const last = punches.length ? punches[punches.length - 1] : null
  return { ...query, today, punches, last, isIn: last?.type === 'IN' }
}

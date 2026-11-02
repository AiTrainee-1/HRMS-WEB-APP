import { useQuery } from '@tanstack/react-query'
import { attendanceApi, missingPunchApi, shiftApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { monthKey, type CalMonth } from '@/lib/month-switch'
import { parseClock } from '@/lib/punch-time-picker'
import type { ShiftAssignment } from '@/types'

// Data for the Missing Punch page and its form.

/** Every Missing Punch request of the employee (the server sends up to 300, newest first): the four views and the "you
 *  already asked for this day" reminder both read this one list. */
export function useMissingPunchRequests() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['missing-punch', user?.employeeId, 'all'],
    queryFn: () => missingPunchApi.list(user!.employeeId),
    enabled: !!user,
  })
}

/** One month's Missing Punch requests, by PUNCH date (GET /missing-punch-requests?month=&year=): complete even for a
 *  month older than the latest 300 (the month switcher, 2026-11-02; the mobile app asks the same). */
export function useMissingPunchMonth(month: CalMonth) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['missing-punch', user?.employeeId, 'month', monthKey(month)],
    queryFn: () => missingPunchApi.list(user!.employeeId, undefined, month.month, month.year),
    enabled: !!user,
  })
}

export type DayPunch = { minutes: number; type: 'IN' | 'OUT' }

/** The punches already recorded on `date` (YYYY-MM-DD), from the same monthly attendance query the Attendance page uses
 *  (same key, so it is often already cached). */
export function useDayPunches(date: string, enabled: boolean) {
  const { user } = useAuth()
  const [y, m] = date.split('-').map(Number)
  const ok = enabled && !!user && Number.isFinite(y) && Number.isFinite(m) && y > 2000
  const q = useQuery({
    queryKey: ['attendance', user?.employeeId, m, y],
    queryFn: () => attendanceApi.monthly(user!.employeeId, m, y),
    enabled: ok,
  })
  const record = q.data?.records?.find((r) => r.date === date)
  const punches: DayPunch[] = (record?.punches ?? [])
    .map((p) => ({ minutes: parseClock(p.time), type: p.type }))
    .filter((p): p is DayPunch => p.minutes != null)
    .sort((a, b) => a.minutes - b.minutes)
  const state: DayPunch[] | 'loading' | 'error' = q.isPending && ok ? 'loading' : q.isError && !q.data ? 'error' : punches
  return state
}

// `/shift-assignments` is the assignment history; the current one is the newest still running (same rule as
// hooks/useMyShiftSummary.ts and the mobile app's useShift.ts).
function currentAssignment(list: ShiftAssignment[]): ShiftAssignment | null {
  if (!list.length) return null
  const today = new Date().toISOString().slice(0, 10)
  const active = list.filter((a) => !a.effectiveTo || a.effectiveTo >= today)
  const pool = active.length ? active : list
  return [...pool].sort((a, b) => String(b.effectiveFrom ?? '').localeCompare(String(a.effectiveFrom ?? '')) || b.id - a.id)[0]
}

/** The employee's shift start / end from the assignment (the fallback when Casual Leave's shift halves are not there). */
export function useAssignedShiftTimes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['shift-assignments', user?.employeeId],
    queryFn: async () => {
      const a = currentAssignment(await shiftApi.assignments(user!.employeeId))
      if (!a) return null
      return {
        name: a.shiftName ?? null,
        startTime: a.customStartTime ?? a.startTime ?? null,
        endTime: a.customEndTime ?? a.endTime ?? null,
      }
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
}

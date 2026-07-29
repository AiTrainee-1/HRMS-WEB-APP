import { useQuery } from '@tanstack/react-query'
import { attendanceApi, casualLeaveApi, shiftApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import type { AssignedShift, MyShiftSummary, ShiftAssignment } from '@/types'

// `/shift-assignments` returns assignment *history* (an array), each entry
// pairing an employee with a shift template plus optional per-employee
// overrides (customStartTime/customEndTime/saturdayOff). Pick the most
// recent still-active assignment — same logic as the mobile app's
// useShift.ts, ported 1:1 so both apps agree on which assignment is "current".
function pickCurrentAssignment(list: ShiftAssignment[]): ShiftAssignment | null {
  if (!list.length) return null
  const today = new Date().toISOString().slice(0, 10)
  const active = list.filter((a) => !a.effectiveTo || a.effectiveTo >= today)
  const pool = active.length ? active : list
  return [...pool].sort((a, b) => {
    const cmp = String(b.effectiveFrom ?? '').localeCompare(String(a.effectiveFrom ?? ''))
    return cmp !== 0 ? cmp : b.id - a.id
  })[0]
}

function normalizeShift(list: ShiftAssignment[]): AssignedShift | null {
  const assignment = pickCurrentAssignment(list)
  if (!assignment) return null
  return {
    name: assignment.shiftName ?? 'General Shift',
    startTime: assignment.customStartTime ?? assignment.startTime ?? '—',
    endTime: assignment.customEndTime ?? assignment.endTime ?? '—',
    gracePeriodMinutes: assignment.gracePeriodMinutes ?? 0,
  }
}

/**
 * There's no consolidated /my-shift-summary endpoint on the backend (it 404s
 * every time), so this merges the calls that actually exist client-side:
 * shift/late/deduction stats, this month's approved Casual Leave count, and
 * the employee's current shift assignment.
 */
export function useMyShiftSummary(month: number, year: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-shift-summary', month, year, user?.employeeId],
    queryFn: async (): Promise<MyShiftSummary> => {
      const [stats, approvedCl, assignments] = await Promise.all([
        attendanceApi.shiftStats(month, year),
        casualLeaveApi.list('', 'approved', month, year),
        shiftApi.assignments(user!.employeeId),
      ])
      // shiftDeductions / salaryDeductionAmount / totalEffectiveShifts come
      // back as strings (Decimal fields serialized with str() on the
      // backend) — Number() them so the `number` types here are actually
      // true at runtime, not just at compile time (matters once something
      // calls .toLocaleString()/.toFixed() on them, as MyShift.tsx now does).
      return {
        assignedShift: normalizeShift(assignments),
        lateCount: stats.totalLateCount,
        halfShiftCount: stats.halfShiftDays,
        casualLeaveApprovals: approvedCl.length,
        totalWorkingShifts: Number(stats.totalEffectiveShifts),
        absentCount: stats.absentDays,
        dailyLogs: stats.dailyLogs,
        deductions: stats.summary
          ? {
              permissionsUsed: stats.summary.permissionsUsed,
              permissionOverageCount: stats.summary.permissionOverageCount,
              billableLateCount: stats.summary.billableLateCount,
              shiftDeductions: Number(stats.summary.shiftDeductions),
              salaryDeductionAmount: Number(stats.summary.salaryDeductionAmount),
            }
          : null,
      }
    },
    enabled: !!user,
  })
}

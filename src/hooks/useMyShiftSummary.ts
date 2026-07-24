import { useQuery } from '@tanstack/react-query'
import { attendanceApi, casualLeaveApi } from '@/api/resources'
import type { MyShiftSummary } from '@/types'

/**
 * There's no consolidated /my-shift-summary endpoint on the backend (it 404s
 * every time), so this merges the two calls that actually exist client-side:
 * shift/late/deduction stats + this month's approved Casual Leave count.
 */
export function useMyShiftSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['my-shift-summary', month, year],
    queryFn: async (): Promise<MyShiftSummary> => {
      const [stats, approvedCl] = await Promise.all([
        attendanceApi.shiftStats(month, year),
        casualLeaveApi.list('', 'approved', month, year),
      ])
      // shiftDeductions / salaryDeductionAmount / totalEffectiveShifts come
      // back as strings (Decimal fields serialized with str() on the
      // backend) — Number() them so the `number` types here are actually
      // true at runtime, not just at compile time (matters once something
      // calls .toLocaleString()/.toFixed() on them, as MyShift.tsx now does).
      return {
        assignedShift: null,
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
  })
}

import { useQuery } from '@tanstack/react-query'
import { attendanceApi, casualLeaveApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import type { MyShiftSummary } from '@/types'

/**
 * Prefers the consolidated /my-shift-summary endpoint; falls back to a 3-call
 * client-side merge if that endpoint isn't deployed yet (404), per the blueprint's
 * "ship now, swap later" guidance.
 */
export function useMyShiftSummary(month: number, year: number) {
  return useQuery({
    queryKey: ['my-shift-summary', month, year],
    queryFn: async (): Promise<MyShiftSummary> => {
      try {
        return await attendanceApi.myShiftSummary(month, year)
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 404) throw err
        const [stats, approvedCl] = await Promise.all([
          attendanceApi.shiftStats(month, year),
          casualLeaveApi.list('', 'approved', month, year),
        ])
        return {
          assignedShift: null,
          lateCount: stats.totalLateCount,
          halfShiftCount: stats.halfShiftDays,
          casualLeaveApprovals: approvedCl.length,
          totalWorkingShifts: stats.totalEffectiveShifts,
          absentCount: stats.absentDays,
          dailyLogs: stats.dailyLogs,
        }
      }
    },
  })
}

import { earlyOutShown, lateInShown, shiftPolicyOf } from '@/lib/attendance-flags'
import type { DeductionPreview, EmployeeShiftStats } from '@/types'

// The monthly late-deduction preview (GET /attendance/employee-shift-stats).
// One normalization and one set of fallbacks, shared by My Shift and the
// Permission page so the two can never disagree about a number.

/** Decimal fields arrive as strings; everything else passes through untouched.
 * The company policy (when the backend sends one) rides along for resolveDeductionPool. */
export function toDeductionPreview(stats: EmployeeShiftStats): DeductionPreview | null {
  const s = stats.summary
  if (!s) return null
  return {
    ...s,
    shiftDeductions: Number(s.shiftDeductions) || 0,
    salaryDeductionAmount: Number(s.salaryDeductionAmount) || 0,
    isProduction: stats.employmentType === 'production',
    policy: shiftPolicyOf(stats),
  }
}

export interface DeductionPool {
  /** Occurrences per month that cost nothing. */
  freeAllowance: number
  /** Approved permissions per month that are Allowed; later ones are Overdue / Excess. */
  permissionCap: number
  /** Late-ins / early-outs / excess permissions, or null when there is nothing trustworthy to break down. */
  breakdown: { lateIn: number; earlyOut: number; excess: number } | null
  /** False when the company has switched that detection off, so its wording is hidden. */
  showLateIn: boolean
  showEarlyOut: boolean
}

export function resolveDeductionPool(d: DeductionPreview, monthlyLimit?: number): DeductionPool {
  // Production has its own separate policy (the backend still prices it against
  // a flat 3) and never gets a Late-In / Early-Out split, so ignore those keys.
  const staffPool = !d.isProduction
  const { lateInCount, earlyOutCount, excessPermissionCount } = d
  return {
    // policy first, then the summary's own copy, then the historical default of 3
    freeAllowance: staffPool ? (d.policy?.freeAllowance ?? d.freeAllowance ?? 3) : 3,
    permissionCap: d.policy?.permissionMonthlyCap ?? d.permissionMonthlyCap ?? monthlyLimit ?? 3,
    breakdown:
      staffPool && lateInCount != null && earlyOutCount != null && excessPermissionCount != null
        ? { lateIn: lateInCount, earlyOut: earlyOutCount, excess: excessPermissionCount }
        : null,
    showLateIn: lateInShown(d.policy),
    showEarlyOut: earlyOutShown(d.policy),
  }
}

import type { CasualLeaveEligibility } from '@/types'

/**
 * Whether the employee can apply for casual leave right now. With per-month verdicts (the previous month while the
 * grace days are open, then the current month) any eligible month is enough; an older backend sends none, and then the
 * overall `eligible` flag decides on its own. The Casual Leave page and the Attendance page both read it from here, so
 * their badges cannot disagree.
 */
export function isCasualLeaveEligible(e: CasualLeaveEligibility): boolean {
  return e.months && e.months.length > 0 ? e.months.some((m) => m.eligible) : e.eligible
}

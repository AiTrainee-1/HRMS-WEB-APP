import { apiRequest } from './client'
import {
  readAdvanceEligibility,
  readPendingRequests,
  readSalaryPeriods,
  type AdvanceEligibilityLite,
  type PendingRequestLite,
  type SalaryPeriodLite,
} from '@/lib/home-attention'

// The Dashboard's extra sources (added with the mobile app's Home round, 2026-10-31). Every one is "background": a failure
// must never raise the app-wide "can't reach the server" banner (skipOfflineDetection) and the Dashboard simply leaves the
// section out. Replies are read defensively in lib/home-attention.ts; a reply that is not the contract (an older server's
// 404 page, a proxy page) throws, so the query is in error and the section renders nothing.

function orThrow<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`Unexpected reply from ${what}`)
  return value
}

export const homeApi = {
  /** The employee's own requests still waiting for an answer (backend mobile_reminder_views.py::my_pending_requests). */
  pendingRequests: async (): Promise<PendingRequestLite[]> =>
    orThrow(
      readPendingRequests(await apiRequest<unknown>({ method: 'GET', url: '/my/pending-requests', skipOfflineDetection: true })),
      '/my/pending-requests',
    ),

  /** Whether the Salary Advance / Term Loan window is open for this employee (mobile_settlement_views.py). */
  advanceEligibility: async (): Promise<AdvanceEligibilityLite> =>
    orThrow(
      readAdvanceEligibility(await apiRequest<unknown>({ method: 'GET', url: '/my/advances/eligibility', skipOfflineDetection: true })),
      '/my/advances/eligibility',
    ),

  /** The pay periods of the newest year with a slip (mobile_pay_views.py::my_salary_insights; read-only on payroll). */
  salaryPeriods: async (): Promise<SalaryPeriodLite[]> =>
    orThrow(
      readSalaryPeriods(await apiRequest<unknown>({ method: 'GET', url: '/my/salary-insights', skipOfflineDetection: true })),
      '/my/salary-insights',
    ),
}

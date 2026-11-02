import { apiRequest } from './client'

// Salary pages (2026-10-31, mobile pages round). Employee token only, the employee's own data, READ-ONLY
// (backend api/mobile_pay_views.py + mobile_pay.py). Replies are returned unvalidated: hooks/usePaySalary.ts reads them
// with lib/salary-insights.ts, so a reply that is not the contract becomes an error with Try again, never a blank page.

/** A slip as GET /my/salary-slips lists it (salary_slip_views.slip_json): the fields the fallback list reads. */
export interface PaySlipListItem {
  id: number | string
  month: number
  year: number
  weekNumber?: number | null
  payCycle?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  slipNumber?: string | null
  netSalary?: number | string | null
  grossSalary?: number | string | null
  emailedAt?: string | null
}

export const paySalaryApi = {
  /** GET /my/salary-insights?year= (no year = the latest year with slips). */
  insights: (year: number | null) =>
    apiRequest<unknown>({ method: 'GET', url: '/my/salary-insights', params: year ? { year } : undefined }),
  /** GET /my/salary-slips/<id>/breakdown: one slip as a waterfall, every line explained (404 when not your own). */
  breakdown: (id: string | number) => apiRequest<unknown>({ method: 'GET', url: `/my/salary-slips/${id}/breakdown` }),
  /** GET /my/salary-slips: every slip (the list shown when the insights cannot load). */
  slips: () => apiRequest<unknown>({ method: 'GET', url: '/my/salary-slips' }),
  /** GET /salary-slips/<id>/pdf (self-scoped), as a blob: the file is only served through this authenticated route. */
  pdf: (id: string | number) => apiRequest<Blob>({ method: 'GET', url: `/salary-slips/${id}/pdf`, responseType: 'blob' }),
}

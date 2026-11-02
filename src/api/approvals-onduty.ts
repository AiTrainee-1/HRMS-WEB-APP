import { apiRequest } from './client'

// ---- The employee's own On-Duty history and the route of one day ----
// Returned unvalidated: lib/onduty-records.ts reads them.
export const onDutyRecordsApi = {
  /** Every On-Duty request the employee made, newest first (backend/api/mobile_requests_views.py::my_on_duty_sessions).
   *  `counts` cover ALL of them, not only this page. `month` ("YYYY-MM", the month switcher, 2026-11-02): only that
   *  month's requests, paging and counts included, and the reply echoes `month`; an older server ignores it. */
  mine: (page = 1, pageSize = 30, month?: string) =>
    apiRequest<unknown>({ method: 'GET', url: '/on-duty-sessions/mine', params: month ? { page, pageSize, month } : { page, pageSize } }),
  /** The recorded route of a day (geo_tracking/views.py::journey_detail): an employee reads their OWN journeys only. */
  journey: (id: number) => apiRequest<unknown>({ method: 'GET', url: `/tracking/journeys/${id}` }),
}

import { apiRequest } from './client'

// The Compensation year timeline (2026-10-31, mobile pages round): GET /my/compensation-history?year=, staff only (a
// production employee gets `isStaff: false` and a message). Read-only. Returned unvalidated: hooks/usePayCompensation.ts
// reads it with lib/compensation-history.ts. The 90-day list (/employee/compensation) stays in api/resources.ts.
export const payCompensationApi = {
  history: (year: number | null) =>
    apiRequest<unknown>({ method: 'GET', url: '/my/compensation-history', params: year ? { year } : undefined }),
}

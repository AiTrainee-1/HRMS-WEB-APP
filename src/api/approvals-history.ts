import { apiRequest } from './client'

// ---- A Department Head's request history (backend/api/mobile_approvals_views.py) ----
// Returned unvalidated: lib/approvals-history.ts reads them (an older backend has no such routes: 404, and the page
// falls back to GET /manager/pending-requests). Decisions still go through the unchanged managerApi.update*Status calls.
export const approvalsHistoryApi = {
  /** { categories: [{ key, workflow, label, pending, approved, rejected }], total } - only the categories this head sees. */
  summary: () => apiRequest<unknown>({ method: 'GET', url: '/manager/requests/summary' }),
  /** One page of one category's Pending / Approved / Rejected list; `search` matches the employee's name or code. */
  list: (params: { category: string; status: string; search?: string; page?: number; pageSize?: number }) =>
    apiRequest<unknown>({
      method: 'GET',
      url: '/manager/requests',
      params: {
        category: params.category,
        status: params.status,
        search: params.search || undefined,
        page: params.page ?? 1,
        page_size: params.pageSize ?? 20,
      },
    }),
  /**
   * A selfie taken with an On-Duty punch (n = 1 or 2). Served only through this authenticated route (the employee, their
   * own Department Head and branch HR may open it), so it is fetched as a blob: a plain <img src> carries no token.
   */
  onDutyPhoto: (verificationId: number, n: 1 | 2) =>
    apiRequest<Blob>({
      method: 'GET',
      url: `/on-duty-punch-verifications/${verificationId}/photo`,
      params: { n },
      responseType: 'blob',
      skipOfflineDetection: true,
    }),
}

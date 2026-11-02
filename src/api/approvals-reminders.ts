import { apiRequest } from './client'

// ---- My Requests + "remind the approver" (backend/api/mobile_reminder_views.py) ----
// Returned unvalidated: lib/pending-reminders.ts reads them. A reminder is allowed once per request every 24 hours; a
// second one comes back 429 with `code: "too_soon"`, `retryAfterSeconds` and a user-ready `error` (ApiError.message).
export const remindersApi = {
  /** The signed-in employee's own requests still waiting for an answer, plus HR's attendance changes of the last 30 days. */
  myPending: () => apiRequest<unknown>({ method: 'GET', url: '/my/pending-requests' }),
  /** Remind whoever has to act on this request now (the Department Head by phone push, or HR on its Requests hub). */
  remind: (module: string, id: number) =>
    apiRequest<unknown>({ method: 'POST', url: `/my/pending-requests/${encodeURIComponent(module)}/${id}/remind` }),
}

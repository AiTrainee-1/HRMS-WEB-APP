import { apiRequest, ApiError } from './client'
import { buildPunchForm, type PunchBody } from '@/lib/onduty-photos'
import type { ClaimBody } from '@/lib/compensation-claims'
import type { PlaceBody } from '@/lib/birthday-compensation'
import type {
  AttendanceMonthResponse,
  CasualLeaveEligibility,
  CasualLeaveRequest,
  ChatChannel,
  ChatMessage,
  Employee,
  EmployeeDocument,
  EmployeeShiftStats,
  GeoPunchPrecheckResult,
  GeoPunchResult,
  GeoPunchStatus,
  HalfDaySlot,
  OnDutyPunchResult,
  OnDutySession,
  OnDutyStartResult,
  OnDutyStatusResponse,
  Holiday,
  IdCardData,
  LeaveRequest,
  LeaveType,
  LiveFeedItem,
  LoginResponse,
  ManagerFlags,
  MissingPunchRequest,
  MissingPunchSlot,
  Notification,
  OutpassRequest,
  PendingRequestsResponse,
  PermissionRequest,
  PermissionWireType,
  RequestStatus,
  Resignation,
  SalarySlip,
  SalarySlipDetail,
  ShiftAssignment,
  TeaBreakStatus,
} from '@/types'

// ---- Auth ----
// Which sign-in methods HR has switched on (WhatsApp Control -> OTP, SMS Control -> OTP Switches). WhatsApp codes and
// SMS codes are switched on separately: read them with purposeCodes() (lib/otp-channel.ts), never the keys directly.
export interface LoginOptions {
  otpLogin: boolean
  otpReset: boolean
  // A new employee must confirm a one-time code (SMS or WhatsApp) before choosing a first password.
  otpActivate: boolean
  passwordLogin: boolean
  // The ways a code can be sent right now, per purpose, WhatsApp first: e.g. { login: ['whatsapp', 'sms'],
  // reset: ['sms'], activate: [] }. Absent on a server from before WhatsApp and SMS codes were independent.
  otpChannels?: Partial<Record<'login' | 'reset' | 'activate', string[]>>
  // Each available channel's name and code length: { whatsapp: { name: 'WhatsApp', codeLength: 6 }, ... }.
  channels?: Partial<Record<string, { name?: string; codeLength?: number }>>
  // For older apps: the first available channel, 'sms' | 'whatsapp'. Absent on an older server, so read it with
  // normalizeChannel() (lib/otp-channel.ts): unknown means "a code", never a guess.
  otpChannel?: string | null
  // How many digits `otpChannel`'s code has: 4 for 'sms', 6 for 'whatsapp'. Absent on an older server: read it
  // with otpLength() (lib/otp-channel.ts), which falls back on the channel.
  codeLength?: number | null
}

export interface OtpRequestResult {
  message: string
  maskedPhone: string
  expiresInSeconds: number
  resendAfterSeconds: number
  // The channel this code really went out on ('sms' | 'whatsapp'). Absent on an older server.
  channel?: string
  // Digits in the code that went out (4 by SMS, 6 on WhatsApp). Absent on an older server.
  codeLength?: number
  // The other channels that could send a code for this purpose right now ("Send by SMS instead"). Absent on an older server.
  otherChannels?: string[]
}

export const authApi = {
  // Which sign-in methods the server has switched on (code by SMS or WhatsApp, password).
  loginOptions: () => apiRequest<LoginOptions>({ method: 'GET', url: '/auth/login-options' }),
  // Sends a code (6 digits on WhatsApp, 4 by SMS) to the mobile number registered for this employee code: by
  // `channel` when given, else by the first way HR has switched on for this purpose. Only pass a channel to a server
  // that listed `otpChannels` (requestChannel() in lib/otp-channel.ts); one switched off meanwhile is refused with
  // 400 channel_unavailable (channelUnavailable()). skipOfflineDetection: a 502 ("couldn't send") or 503 ("SMS
  // temporarily unavailable") from this call is the message carrier having a problem, not the server being down, so it
  // must not raise the app-wide "server unavailable" banner; the form shows the server's own sentence instead.
  requestOtp: (employeeCode: string, purpose: 'login' | 'reset' | 'activate', channel?: 'whatsapp' | 'sms') =>
    apiRequest<OtpRequestResult>({
      method: 'POST',
      url: '/auth/otp/request',
      data: channel ? { employeeCode, purpose, channel } : { employeeCode, purpose },
      skipOfflineDetection: true,
    }),
  loginWithOtp: (employeeCode: string, otp: string) =>
    // withCredentials: the server keeps the session in an HttpOnly cookie for this browser (owner 2026-11-25)
    apiRequest<LoginResponse>({ method: 'POST', url: '/auth/otp/login', data: { employeeCode, otp }, isPublic: true, withCredentials: true }),
  resetPasswordWithOtp: (employeeCode: string, otp: string, password: string) =>
    apiRequest<{ message: string }>({
      method: 'POST',
      url: '/auth/otp/reset-password',
      data: { employeeCode, otp, password },
    }),
  // First-time password for a new employee, after confirming the code (SMS or WhatsApp).
  activateWithOtp: (employeeCode: string, otp: string, password: string) =>
    apiRequest<{ message: string }>({
      method: 'POST',
      url: '/auth/otp/activate',
      data: { employeeCode, otp, password },
    }),
  // Public (2026-11-25, as in the mobile app): no token is sent, and its 401 (a wrong password / unknown code, worded by
  // lib/login-errors.ts) is a refused attempt, never the end of a session already signed in on this browser.
  login: (identifier: string, password: string) =>
    apiRequest<LoginResponse>({ method: 'POST', url: '/auth/employee-login', data: { identifier, password }, isPublic: true, withCredentials: true }),
  setPassword: (identifier: string, password: string) =>
    apiRequest<{ success: boolean }>({ method: 'POST', url: '/auth/set-password', data: { identifier, password } }),
  me: () => apiRequest<{ role: string; employeeId: string; name: string }>({ method: 'GET', url: '/auth/me' }),
}

// ---- Dashboard ----
export const dashboardApi = {
  // Self-scoped to the calling employee's own punches only (server-side,
  // since this session's mobile-app work) — no company-wide variant exists
  // on this endpoint anymore.
  liveFeed: (limit = 20) => apiRequest<{ items: LiveFeedItem[] }>({ method: 'GET', url: '/attendance/live-feed', params: { limit } }),
}

// ---- Shift ----
export const shiftApi = {
  // Self-scoped for an employee token regardless of the employeeId param
  // (server ignores it and substitutes the caller's own id) — same endpoint
  // the mobile app's useShift.ts hook uses.
  assignments: (employeeId: string) =>
    apiRequest<ShiftAssignment[]>({ method: 'GET', url: '/shift-assignments', params: { employeeId } }),
}

// ---- Employee / Profile ----
export const employeeApi = {
  get: (id: string) => apiRequest<Employee>({ method: 'GET', url: `/employees/${id}` }),
  // No self-service photo upload: PATCH /employees/:id is HR-only on the
  // backend (views.py::employee_detail) and /my/profile doesn't exist.
}

// ---- Attendance ----
export const attendanceApi = {
  monthly: (employeeId: string, month: number, year: number) =>
    apiRequest<AttendanceMonthResponse>({ method: 'GET', url: `/attendance/employee/${employeeId}`, params: { month, year } }),
  shiftStats: (month: number, year: number) =>
    apiRequest<EmployeeShiftStats>({ method: 'GET', url: '/attendance/employee-shift-stats', params: { month, year } }),
  syncStatus: () =>
    apiRequest<{ pendingSync: boolean }>({ method: 'GET', url: '/attendance/sync-status' }),
}

// ---- Geo Attendance ----
// Two-step flow: `check` first (no photos) — auto-accepts if inside the
// branch geofence, otherwise reports the distance without creating any
// record. Only when the employee is genuinely outside does the UI prompt
// for two photos and call `request`, which creates a pending approval.
export const geoAttendanceApi = {
  precheck: (params: { latitude: number; longitude: number }) =>
    apiRequest<GeoPunchPrecheckResult>({ method: 'GET', url: '/attendance/geo-punch/precheck', params }),
  punch: (body: { latitude: number; longitude: number; accuracy?: number; isMocked?: boolean }) =>
    apiRequest<GeoPunchResult>({ method: 'POST', url: '/attendance/geo-punch', data: body }),
  status: (date?: string) =>
    apiRequest<GeoPunchStatus>({ method: 'GET', url: '/attendance/geo-punch/status', params: date ? { date } : undefined }),
}

// On-Duty is a session, not a one-shot request (see backend
// geo_attendance_views.py): start it with a destination, then capture each
// of the day's punches with a selfie + GPS, and mark it Done at the end.
export const onDutyApi = {
  status: () => apiRequest<OnDutyStatusResponse>({ method: 'GET', url: '/on-duty-sessions/status' }),
  start: (destination: string) =>
    apiRequest<OnDutyStartResult>({ method: 'POST', url: '/on-duty-sessions/request', data: { destination } }),
  complete: () => apiRequest<OnDutySession>({ method: 'POST', url: '/on-duty-sessions/complete' }),
  // `photo` is the first (or only) selfie; `photo2` is the second, sent when HR's policy asks for two
  // (status.requiredPhotos, see lib/onduty-photos.ts). The multipart body is built there, where it is tested.
  punch: (body: PunchBody) =>
    apiRequest<OnDutyPunchResult>({
      method: 'POST', url: '/on-duty-sessions/punch', data: buildPunchForm(body),
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// ---- Leave ----
export const leaveApi = {
  list: (employeeId: string, status?: RequestStatus) =>
    apiRequest<LeaveRequest[]>({ method: 'GET', url: '/leave-requests', params: { employeeId, status } }),
  types: () => apiRequest<LeaveType[]>({ method: 'GET', url: '/leave-types' }),
  apply: (body: {
    employeeId: string; startDate: string; endDate: string; type: string; reason: string
    isHalfDay?: boolean; halfDaySlot?: HalfDaySlot
  }) => apiRequest<LeaveRequest>({ method: 'POST', url: '/leave-requests', data: body }),
}

// ---- Permissions ----
export const permissionApi = {
  list: (employeeId: string, status?: RequestStatus) =>
    apiRequest<PermissionRequest[]>({ method: 'GET', url: '/permissions', params: { employeeId, status } }),
  // `type` is required and must be the LEGACY spelling (see PERMISSION_TYPES in
  // lib/permissions.ts): an older backend rejects the new labels, the new one
  // accepts both. permissionTime is the arrival / leaving / step-out time; the
  // new backend also uses it to infer the type. No durationMinutes — every
  // permission is a fixed 60 minutes and the server ignores a client value.
  // A 409 means the same type is already requested for that day.
  apply: (body: {
    employeeId: string; date: string; permissionTime: string; reason: string; type: PermissionWireType
  }) => apiRequest<PermissionRequest>({ method: 'POST', url: '/permissions', data: body }),
}

// ---- Missing Punch ----
export const missingPunchApi = {
  list: (employeeId: string, status?: string, month?: number, year?: number) =>
    apiRequest<MissingPunchRequest[]>({ method: 'GET', url: '/missing-punch-requests', params: { employeeId, status, month, year } }),
  apply: (body: { employeeId: string; date: string; punchTime: string; punchSlot: MissingPunchSlot; reason: string }) =>
    apiRequest<MissingPunchRequest>({ method: 'POST', url: '/missing-punch-requests', data: body }),
}

// ---- Casual Leave ----
export const casualLeaveApi = {
  list: (employeeId: string, status?: RequestStatus, month?: number, year?: number) =>
    apiRequest<CasualLeaveRequest[]>({ method: 'GET', url: '/casual-leaves', params: { employeeId, status, month, year } }),
  // Self-service endpoint, self-scoped for an employee token (added this
  // session alongside the mobile app's CL card — the old /casual-leaves/eligibility
  // is HR-only and bulk-shaped, and always 403s for an employee token).
  // Still swallow a genuine network error to null so the page just skips
  // the pre-emptive banner instead of erroring.
  eligibility: async (): Promise<CasualLeaveEligibility | null> => {
    try {
      return await apiRequest<CasualLeaveEligibility>({ method: 'GET', url: '/casual-leaves/my-eligibility' })
    } catch (err) {
      if (err instanceof ApiError) return null
      throw err
    }
  },
  apply: (body: { employeeId: string; date: string; reason: string }) =>
    apiRequest<CasualLeaveRequest>({ method: 'POST', url: '/casual-leaves', data: body }),
}

// ---- Outpass ----
// GET/POST both self-scope to the logged-in employee token server-side
// (backend/api/outpass_request_views.py) -no employeeId needed on either call.
export const outpassApi = {
  list: () => apiRequest<OutpassRequest[]>({ method: 'GET', url: '/outpass-requests' }),
  apply: (body: { destination: string; reason: string }) =>
    apiRequest<OutpassRequest>({ method: 'POST', url: '/outpass-requests', data: body }),
  // The "Generate Return QR" button on an already-exited Outpass card -see
  // backend/api/outpass_request_views.py::generate_return_qr.
  generateReturnQr: (id: string) =>
    apiRequest<OutpassRequest>({ method: 'POST', url: `/outpass-requests/${id}/generate-return-qr` }),
}

// ---- Tea Break ----
// A permanent, no-approval, per-employee QR -see backend/api/tea_break_views.py.
// Both self-scope to the logged-in employee token server-side, same as Outpass above.
export const teaBreakApi = {
  qrToken: () => apiRequest<{ qrToken: string }>({ method: 'GET', url: '/tea-break/qr-token' }),
  // `month` ("YYYY-MM", the month switcher, 2026-11-02): `recent` is then every break of that month and the reply echoes
  // `month`; an older server ignores it and sends the latest 10 (backend/api/tea_break_views.py::tea_break_my_status).
  myStatus: (month?: string) =>
    apiRequest<TeaBreakStatus>({ method: 'GET', url: '/tea-break/my-status', params: month ? { month } : undefined }),
}

// ---- Notifications ----
export const notificationApi = {
  list: () => apiRequest<Notification[]>({ method: 'GET', url: '/notifications' }),
  // Answers with the updated row (with its `target` since 2026-11-02); typed loosely, an older server's reply may differ.
  markRead: (id: string) => apiRequest<Partial<Notification> | null>({ method: 'PATCH', url: `/notifications/${id}/read` }),
  markAllRead: () => apiRequest<{ updated: number }>({ method: 'PATCH', url: '/notifications/mark-all-read' }),
}

// ---- Salary ----
// No PDF-generation endpoint exists on the backend yet (see docs/MOBILE_APP_V2_SPEC.md §3.5) —
// intentionally no pdfUrl() helper here; SalaryDetail.tsx surfaces that directly to the user.
export const salaryApi = {
  list: () => apiRequest<SalarySlip[]>({ method: 'GET', url: '/my/salary-slips' }),
  detail: (id: string) => apiRequest<SalarySlipDetail>({ method: 'GET', url: `/salary-slips/${id}` }),
  // Same endpoint the Mobile App already downloads/shares from successfully
  // (backend/api/company_documents_views.py::salary_slip_pdf, @require_auth,
  // self-scoped to the employee's own slip) — blob, since the file is only
  // ever served through this authenticated route, same as documentsApi.fetchFile.
  pdf: (id: string) => apiRequest<Blob>({ method: 'GET', url: `/salary-slips/${id}/pdf`, responseType: 'blob' }),
}

// ---- Documents ----
// Files are only ever served through the authenticated /employee-documents/:id/file
// endpoint (backend never exposes raw media URLs — see backend/api/employee_documents_views.py),
// so viewing/downloading needs a blob fetch (carries the Bearer token via the request
// interceptor in client.ts) rather than a plain <a href>, which wouldn't carry it.
export const documentsApi = {
  list: () => apiRequest<EmployeeDocument[]>({ method: 'GET', url: '/my/documents' }),
  fetchFile: (id: number) =>
    apiRequest<Blob>({ method: 'GET', url: `/employee-documents/${id}/file`, responseType: 'blob' }),
}

// ---- ID Card ----
export const idCardApi = {
  get: (employeeId: string) => apiRequest<IdCardData>({ method: 'GET', url: '/idcard', params: { employeeId } }),
  settings: () => apiRequest<IdCardData['template']>({ method: 'GET', url: '/idcard-settings' }),
}

// ---- Holidays ----
export const holidayApi = {
  list: (year: number) => apiRequest<Holiday[]>({ method: 'GET', url: '/holidays', params: { year } }),
}

// ---- Loan & Advance ----
// The employee's own Salary Advance / Term Loan applications live in api/pay-advances.ts (GET /my/advances ...).

// ---- Resignation ----
export const resignationApi = {
  get: () => apiRequest<Resignation | null>({ method: 'GET', url: '/my/resignation' }),
  submit: (body: {
    reason: string
    lastWorkingDate: string
    surveyQ1Answer?: string
    surveyQ2Answer?: string
    surveyQ3Answer?: string
  }) => apiRequest<Resignation>({ method: 'POST', url: '/my/resignation', data: body }),
}

// ---- Approval workflows ----
// The pipelines HR configured (Approval Workflow Control), for any signed-in user. Ancillary: it only explains a
// request's path and warns that a request type is switched off, so a failure must not read as "server unreachable".
// Returned unvalidated: hooks/useApprovalSummary.ts parses it (an older backend has no such route).
export const approvalApi = {
  summary: () => apiRequest<unknown>({ method: 'GET', url: '/approval-summary', skipOfflineDetection: true }),
}

// ---- Manager / Approvals ----
// A decision the approval pipeline does not allow (not this role's turn, role not in the pipeline, workflow off)
// comes back 400/403 with a user-ready `error` and a `code`; apiRequest surfaces `error` as ApiError.message.
export const managerApi = {
  me: () => apiRequest<ManagerFlags>({ method: 'GET', url: '/manager/me' }),
  pendingRequests: () => apiRequest<PendingRequestsResponse>({ method: 'GET', url: '/manager/pending-requests' }),
  updateLeaveStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/leave-requests/${id}/status`, data: { status, comment } }),
  updatePermissionStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/permissions/${id}/status`, data: { status, comment } }),
  updateAttendanceStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/attendance-requests/${id}/status`, data: { status, comment } }),
  updateCasualLeaveStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/casual-leaves/${id}/status`, data: { status, comment } }),
  // This endpoint alone expects { action: 'approve'|'reject' } rather than the
  // { status: 'approved'|'rejected' } shape every other manager endpoint takes —
  // translate here so the generic dispatch in Approvals.tsx can stay uniform.
  updateResignationAction: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({
      method: 'PATCH',
      url: `/manager/resignations/${id}/action`,
      data: { action: status === 'approved' ? 'approve' : 'reject', comment },
    }),
  // The Department Head's decision on an On-Duty session, at whichever step of
  // its approval pipeline this role holds: approving passes it on or finishes it,
  // rejection voids the punches captured under it.
  updateOnDutyStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/on-duty-sessions/${id}/status`, data: { status, comment } }),
  // The Department Head's decision on a Missing Punch (see missing_punch_views.py):
  // approving passes it to the next step of the pipeline, or adds the punch when
  // this is the last one.
  updateMissingPunchStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/missing-punch-requests/${id}/status`, data: { status, comment } }),
  updateOutpassStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/outpass-requests/${id}/status`, data: { status, comment } }),
  // The Department Head's decision on a compensation claim of any kind (Sunday / holiday work, late-in allowance, extra
  // hours, an older birthday credit, a day off from the balance), raised by HR or by the employee (holiday_work_views.py +
  // compensation_claims.py): approving credits the balance once / applies the allowance / takes the day off from the
  // balance; rejecting changes nothing else and is final. The reply says `credited` and (newer backend) an `effect`
  // sentence. A refusal (403 APPROVE_COMPENSATION_DISABLED, 403 not in your approval scope, 400 already decided, 409 the
  // day cannot take it any more, e.g. payroll locked) comes back with a user-ready `error`, surfaced as ApiError.message.
  updateHolidayWorkStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/holiday-work/${id}/status`, data: { status, comment } }),
  // The Department Head's step on a Birthday Compensation placement (2026-11-25, birthday_compensation_views.py): the
  // head decides first, then HR; an approval answers the use still `pending` with `statusKey` "pending_hr" and
  // `approval.waitingFor` ["hr"]. A rejection needs its reason (400 remark_required). Refusals: 403
  // APPROVE_COMPENSATION_DISABLED / outside the head's scope, 409 withdrawn, 409 use_refused (the day cannot take it).
  updateBirthdayCompensationStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/birthday-compensation/${id}/status`, data: { status, comment } }),
}

// ---- Compensation (staff only) ----
// Returned unvalidated: hooks/useCompensation.ts parses it with lib/compensation.ts (an older backend has no such route,
// and a proxy can answer with an HTML page).
// Self-claims (2026-11-19, lib/compensation-claims.ts): only offered when GET /employee/compensation says `canClaim`
// (an older backend has none of the four routes below). Every one goes to the employee's Department Head. A refusal
// comes back 400/403/409 {error, code} (not_eligible, too_old, not_staff, already_claimed, switched_off, no_hod) with a
// sentence for people, surfaced as ApiError.message.
export const compensationApi = {
  mine: () => apiRequest<unknown>({ method: 'GET', url: '/employee/compensation' }),
  /** The employee's own claims, newest first. */
  claims: (params?: { status?: string; kind?: string }) =>
    apiRequest<unknown>({ method: 'GET', url: '/employee/compensation/claims', params }),
  /** Claim a Sunday / holiday worked, a late-in allowance, extra hours or a worked birthday. 201 = the new claim. */
  claim: (body: ClaimBody) => apiRequest<unknown>({ method: 'POST', url: '/employee/compensation/claims', data: body }),
  /** Withdraw a claim that is still waiting. */
  withdrawClaim: (id: number | string) => apiRequest<unknown>({ method: 'DELETE', url: `/employee/compensation/claims/${id}` }),
  /** Ask to use the balance as a day off: {date, shifts (0.25 .. 1.00), reason}. 201 = the new claim (kind use_balance). */
  useBalance: (body: { date: string; shifts: number; reason: string }) =>
    apiRequest<unknown>({ method: 'POST', url: '/employee/compensation/use', data: body }),
}

// ---- Birthday Compensation on a chosen date (staff only, 2026-11-25) ----
// Returned unvalidated: hooks/useBirthdayCompensation.ts parses them with lib/birthday-compensation.ts (an older backend
// has none of these routes: 404). A refusal comes back {error, code} (not_eligible, not_yet, lapsed, nothing_left,
// date_not_allowed, locked, already_placed, switched_off, no_hod, not_pending ...) with a sentence for people, surfaced
// as ApiError.message.
export const birthdayCompensationApi = {
  /** The signed-in employee's Birthday Compensation for the birthday of `year` (default: this year's). */
  entitlement: (year?: number) =>
    apiRequest<unknown>({ method: 'GET', url: '/employee/compensation/birthday', params: year ? { year } : undefined }),
  /** Every placement, newest first: {items, total, isStaff}. */
  uses: (status?: 'all' | 'pending' | 'approved' | 'rejected' | 'withdrawn') =>
    apiRequest<unknown>({ method: 'GET', url: '/employee/compensation/birthday/uses', params: status ? { status } : undefined }),
  /** Place it: {useDate, portion: full | first_half | second_half, reason?}. 201 = the new use. */
  place: (body: PlaceBody) => apiRequest<unknown>({ method: 'POST', url: '/employee/compensation/birthday/uses', data: body }),
  /** Withdraw a waiting placement the employee made: 200 = the use, withdrawn. */
  withdraw: (id: number | string) => apiRequest<unknown>({ method: 'DELETE', url: `/employee/compensation/birthday/uses/${id}` }),
}

// ---- Department Head assignment (every employee) ----
// Returned unvalidated: hooks/useHod.ts parses it with lib/hod.ts.
export const hodApi = {
  mine: () => apiRequest<unknown>({ method: 'GET', url: '/employee/hod' }),
}

// ---- Chat ----
export const chatApi = {
  channels: () => apiRequest<ChatChannel[]>({ method: 'GET', url: '/chat/channels' }),
  messages: (channelId: string, params?: { before?: string; after?: string; limit?: number }) =>
    apiRequest<ChatMessage[]>({ method: 'GET', url: `/chat/channels/${channelId}/messages`, params }),
  send: (channelId: string, text: string, replyToId?: string) =>
    apiRequest<ChatMessage>({ method: 'POST', url: `/chat/channels/${channelId}/messages`, data: { text, reply_to_id: replyToId } }),
  react: (messageId: string, emoji: string) =>
    apiRequest({ method: 'POST', url: `/chat/messages/${messageId}/reactions`, data: { emoji } }),
  unreact: (messageId: string, emoji: string) =>
    apiRequest({ method: 'DELETE', url: `/chat/messages/${messageId}/reactions`, data: { emoji } }),
}

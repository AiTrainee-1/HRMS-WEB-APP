import { apiRequest, ApiError } from './client'
import type {
  Advance,
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
export interface LoginOptions {
  otpLogin: boolean
  otpReset: boolean
  // A new employee must confirm a WhatsApp code before choosing a first password.
  otpActivate: boolean
  passwordLogin: boolean
}

export interface OtpRequestResult {
  message: string
  maskedPhone: string
  expiresInSeconds: number
  resendAfterSeconds: number
}

export const authApi = {
  // Which sign-in methods the server has switched on (WhatsApp OTP, password).
  loginOptions: () => apiRequest<LoginOptions>({ method: 'GET', url: '/auth/login-options' }),
  // Sends a 6-digit code to the WhatsApp number registered for this employee code.
  requestOtp: (employeeCode: string, purpose: 'login' | 'reset' | 'activate') =>
    apiRequest<OtpRequestResult>({ method: 'POST', url: '/auth/otp/request', data: { employeeCode, purpose } }),
  loginWithOtp: (employeeCode: string, otp: string) =>
    apiRequest<LoginResponse>({ method: 'POST', url: '/auth/otp/login', data: { employeeCode, otp } }),
  resetPasswordWithOtp: (employeeCode: string, otp: string, password: string) =>
    apiRequest<{ message: string }>({
      method: 'POST',
      url: '/auth/otp/reset-password',
      data: { employeeCode, otp, password },
    }),
  // First-time password for a new employee, after confirming the WhatsApp code.
  activateWithOtp: (employeeCode: string, otp: string, password: string) =>
    apiRequest<{ message: string }>({
      method: 'POST',
      url: '/auth/otp/activate',
      data: { employeeCode, otp, password },
    }),
  login: (identifier: string, password: string) =>
    apiRequest<LoginResponse>({ method: 'POST', url: '/auth/employee-login', data: { identifier, password } }),
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
  punch: (body: {
    latitude: number; longitude: number; accuracy?: number; isMocked?: boolean
    photo: Blob; punchNumber?: number
  }) => {
    const form = new FormData()
    form.append('latitude', String(body.latitude))
    form.append('longitude', String(body.longitude))
    if (body.accuracy != null) form.append('accuracy', String(body.accuracy))
    form.append('isMocked', String(!!body.isMocked))
    if (body.punchNumber != null) form.append('punchNumber', String(body.punchNumber))
    form.append('photo', body.photo, 'selfie.jpg')
    return apiRequest<OnDutyPunchResult>({
      method: 'POST', url: '/on-duty-sessions/punch', data: form,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
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
  myStatus: () => apiRequest<TeaBreakStatus>({ method: 'GET', url: '/tea-break/my-status' }),
}

// ---- Notifications ----
export const notificationApi = {
  list: () => apiRequest<Notification[]>({ method: 'GET', url: '/notifications' }),
  markRead: (id: string) => apiRequest<{ success: boolean }>({ method: 'PATCH', url: `/notifications/${id}/read` }),
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

// ---- Settlement / Advances ----
// There is no dedicated "/settlement" endpoint — advances are the actual
// settlement/loan mechanism, self-scoped automatically for an employee token.
export const settlementApi = {
  list: (employeeId: string) => apiRequest<Advance[]>({ method: 'GET', url: '/advances', params: { employeeId } }),
}

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

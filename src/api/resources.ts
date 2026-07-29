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
  OnDutyRequestResult,
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
  PendingRequestsResponse,
  PermissionRequest,
  RequestStatus,
  Resignation,
  SalarySlip,
  SalarySlipDetail,
  ShiftAssignment,
} from '@/types'

// ---- Auth ----
export const authApi = {
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
  updatePhoto: (file: File) => {
    const form = new FormData()
    form.append('photo', file)
    return apiRequest<Employee>({ method: 'PATCH', url: '/my/profile', data: form, headers: { 'Content-Type': 'multipart/form-data' } })
  },
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

export const onDutyApi = {
  request: (body: {
    latitude: number; longitude: number; accuracy?: number; isMocked?: boolean
    reason: string; photo1: Blob; photo2: Blob
  }) => {
    const form = new FormData()
    form.append('latitude', String(body.latitude))
    form.append('longitude', String(body.longitude))
    if (body.accuracy != null) form.append('accuracy', String(body.accuracy))
    form.append('isMocked', String(!!body.isMocked))
    form.append('reason', body.reason)
    form.append('photo1', body.photo1, 'photo1.jpg')
    form.append('photo2', body.photo2, 'photo2.jpg')
    return apiRequest<OnDutyRequestResult>({
      method: 'POST', url: '/attendance/on-duty/request', data: form,
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ---- Leave ----
export const leaveApi = {
  list: (employeeId: string, status?: RequestStatus) =>
    apiRequest<LeaveRequest[]>({ method: 'GET', url: '/leave-requests', params: { employeeId, status } }),
  types: () => apiRequest<LeaveType[]>({ method: 'GET', url: '/leave-types' }),
  apply: (body: { employeeId: string; startDate: string; endDate: string; type: string; reason: string }) =>
    apiRequest<LeaveRequest>({ method: 'POST', url: '/leave-requests', data: body }),
}

// ---- Permissions ----
export const permissionApi = {
  list: (employeeId: string, status?: RequestStatus) =>
    apiRequest<PermissionRequest[]>({ method: 'GET', url: '/permissions', params: { employeeId, status } }),
  apply: (body: { employeeId: string; date: string; permissionTime: string; reason: string }) =>
    apiRequest<PermissionRequest>({ method: 'POST', url: '/permissions', data: body }),
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

// ---- Manager / Approvals ----
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
  updateShiftStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/shift-assignments/${id}/status`, data: { status, comment } }),
  // Department Head stage only — approving here forwards to HR for final
  // sign-off (see missing_punch_views.py), it does not finalize the request.
  updateMissingPunchStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/missing-punch-requests/${id}/status`, data: { status, comment } }),
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

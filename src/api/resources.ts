import { apiRequest, ApiError } from './client'
import type {
  Advance,
  AttendanceMonthResponse,
  CasualLeaveEligibility,
  CasualLeaveRequest,
  ChatChannel,
  ChatMessage,
  Employee,
  EmployeeShiftStats,
  Holiday,
  IdCardData,
  LeaveRequest,
  LeaveType,
  LiveFeedItem,
  LoginResponse,
  ManagerFlags,
  MobileHomeSummary,
  MyShiftSummary,
  Notification,
  PendingRequestsResponse,
  PermissionRequest,
  RequestStatus,
  Resignation,
  SalarySlip,
  SalarySlipDetail,
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
  mobileHomeSummary: () => apiRequest<MobileHomeSummary>({ method: 'GET', url: '/dashboard/mobile-home-summary' }),
  liveFeed: (limit = 20) => apiRequest<{ items: LiveFeedItem[] }>({ method: 'GET', url: '/attendance/live-feed', params: { limit } }),
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
  myShiftSummary: (month: number, year: number) =>
    apiRequest<MyShiftSummary>({ method: 'GET', url: '/my-shift-summary', params: { month, year } }),
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

// ---- Casual Leave ----
export const casualLeaveApi = {
  list: (employeeId: string, status?: RequestStatus, month?: number, year?: number) =>
    apiRequest<CasualLeaveRequest[]>({ method: 'GET', url: '/casual-leaves', params: { employeeId, status, month, year } }),
  // This endpoint is HR-only on the backend today — an employee token gets a
  // 403. Swallow that quietly (return null = "eligibility unknown") so the
  // page just skips the pre-emptive banner instead of erroring; the actual
  // eligibility rule is still enforced server-side on submit either way.
  eligibility: async (employeeId: string): Promise<CasualLeaveEligibility | null> => {
    try {
      return await apiRequest<CasualLeaveEligibility>({ method: 'GET', url: '/casual-leaves/eligibility', params: { employeeId } })
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) return null
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
}

// ---- Salary ----
// No PDF-generation endpoint exists on the backend yet (see docs/MOBILE_APP_V2_SPEC.md §3.5) —
// intentionally no pdfUrl() helper here; SalaryDetail.tsx surfaces that directly to the user.
export const salaryApi = {
  list: () => apiRequest<SalarySlip[]>({ method: 'GET', url: '/my/salary-slips' }),
  detail: (id: string) => apiRequest<SalarySlipDetail>({ method: 'GET', url: `/salary-slips/${id}` }),
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
  updateResignationAction: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/resignations/${id}/action`, data: { status, comment } }),
  updateShiftStatus: (id: string, status: RequestStatus, comment?: string) =>
    apiRequest({ method: 'PATCH', url: `/manager/shift-assignments/${id}/status`, data: { status, comment } }),
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

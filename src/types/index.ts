export type RequestStatus = 'pending' | 'approved' | 'rejected'

export interface AuthUser {
  role: 'employee'
  employeeId: string
  name: string
}

export interface LoginResponse extends AuthUser {
  token: string
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  departmentName: string
  designationTitle: string
  phone: string
  email: string
  joinDate: string
  photoUrl?: string
  gender?: string
  dateOfBirth?: string
  bloodGroup?: string
  emergencyContact?: string
  fatherName?: string
  motherName?: string
  employmentType?: string
  role?: string
  status?: string
  bankName?: string
  bankAccount?: string
  bankIfsc?: string
  pfNumber?: string
  esiNumber?: string
  uanNumber?: string
  address?: string
}

export interface LeaveType {
  id: string
  name: string
}

export interface LeaveRequest {
  id: string
  employeeId: string
  type: string
  startDate: string
  endDate: string
  totalDays: number
  status: RequestStatus
  reason: string
  hrComment?: string
  createdAt: string
}

export interface PermissionRequest {
  id: string
  employeeId: string
  date: string
  permissionTime: string
  reason: string
  status: RequestStatus
  createdAt: string
  // Only ever populated by the backend on POST (create) responses — GET list
  // items always send these as null, so compute the monthly count client-side.
  monthlyUsed?: number | null
  monthlyLimit?: number
}

export interface CasualLeaveRequest {
  id: string
  employeeId: string
  date: string
  reason: string
  status: RequestStatus
  createdAt: string
}

export interface CasualLeaveEligibility {
  eligible: boolean
  reason?: string
}

export interface Notification {
  id: string
  employeeId: string
  type: string
  message: string
  isRead: boolean
  createdAt: string
}

export interface SalarySlip {
  id: string
  employeeId: string
  month: number
  year: number
  netSalary: number
  grossSalary: number
  generatedAt: string
  emailedAt?: string | null
}

export interface EmployeeDocument {
  id: number
  employeeId: number
  category: string
  categoryLabel: string
  originalFilename: string
  uploadedBy: string | null
  uploadedAt: string | null
  fileUrl: string
}

export interface SalarySlipDetail extends SalarySlip {
  basic: number
  hra: number
  allowances: number
  incentives: number
  bonuses: number
  otAmount: number
  pfDeduction: number
  esiDeduction: number
  advanceDeduction: number
  otherDeductions: number
  totalDeductions: number
  workingDays: number
  presentDays: number
  absentDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  lateDays: number
}

export interface AttendanceDay {
  date: string
  // 'no_record' is a frontend-only sentinel for calendar cells with no API
  // entry at all (shouldn't normally happen — the backend returns one row
  // per calendar day, including 'future' for days after today).
  status: 'present' | 'half_shift' | 'absent' | 'on_leave' | 'holiday' | 'future' | 'no_record'
  firstPunch?: string | null
  lastPunch?: string | null
  totalPunches?: number
  leaveType?: string | null
  source?: string | null
}

export interface AttendanceMonthResponse {
  records: AttendanceDay[]
  summary: {
    present: number
    absent: number
    onLeave: number
    // The backend always reports 0 here today — late detection isn't wired
    // into this particular endpoint's summary. Don't rely on this number.
    late: number
    // Not reliably populated by the backend either — Attendance.tsx falls
    // back to counting 'half_shift' records client-side when absent.
    halfShift?: number
  }
}

export interface ShiftDailyLog {
  date: string
  status: string
  firstPunch?: string | null
  lastPunch?: string | null
  totalPunches?: number
  isHalfShift?: boolean
  lateMorning?: boolean
  lateReturn?: boolean
}

export interface EmployeeShiftStats {
  totalLateCount: number
  halfShiftDays: number
  totalEffectiveShifts: number
  absentDays: number
  // null until a MonthlyShiftSummary row exists for this employee/month
  summary: {
    shiftDeductions: number
    salaryDeductionAmount: number
    billableLateCount: number
    permissionsUsed: number
    permissionOverageCount: number
  } | null
  dailyLogs: ShiftDailyLog[]
}

export interface AssignedShift {
  name: string
  startTime: string
  endTime: string
  gracePeriodMinutes: number
}

export interface MyShiftSummary {
  assignedShift: AssignedShift | null
  lateCount: number
  halfShiftCount: number
  casualLeaveApprovals: number
  totalWorkingShifts: number
  absentCount: number
  dailyLogs: ShiftDailyLog[]
  // null until a MonthlyShiftSummary row exists for this employee/month —
  // same deduction math HR sees on the Report Log "Late Summary" tab.
  deductions: {
    permissionsUsed: number
    permissionOverageCount: number
    billableLateCount: number
    shiftDeductions: number
    salaryDeductionAmount: number
  } | null
}

export interface IdCardCompany {
  name: string
  address: string
  logo?: string
  signature?: string
}

export interface IdCardTemplate {
  primaryColor: string
  secondaryColor: string
  textColor: string
  fontFamily: string
  backgroundStyle: string
  logoPosition: string
  cornerStyle: string
  showQrOnBack: boolean
  footerText?: string
}

export interface IdCardData {
  id: string
  code: string
  name: string
  designation: string
  department: string
  employmentType: string
  photoUrl?: string
  bloodGroup?: string
  dateOfBirth?: string
  emergencyContact?: string
  address?: string
  phone?: string
  email?: string
  joinDate?: string
  status?: string
  company: IdCardCompany
  template: IdCardTemplate
}

export interface Holiday {
  id: string
  name: string
  date: string
  holidayType: 'national' | 'regional' | 'company'
  branchName?: string | null
  departmentName?: string | null
  isRecurring?: boolean
  description?: string
}

// One row per advance/loan — the backend has no single "final settlement"
// concept, it's a list of Advance records (self-scoped to the caller).
export interface Advance {
  id: string
  advanceType: string
  amount: number
  purpose?: string
  status: string
  approvedAt?: string | null
  disbursedAt?: string | null
  emiAmount: number
  totalRepaid: number
  outstanding: number
  createdAt: string
}

export interface ManagerFlags {
  isManager: boolean
  canApproveLeaves?: boolean
  canApprovePermissions?: boolean
  canApproveAttendance?: boolean
  canApproveCasualLeave?: boolean
  canApproveResignations?: boolean
  canApproveShifts?: boolean
  pendingApprovalsCount: number
}

// leaveRequests/permissions get a nested `employee{}` object added by the
// backend; the other three categories (casualLeaves, attendanceRequests,
// resignations) carry their employee fields flat on the item itself instead.
// Do not assume a uniform shape across categories — see Approvals.tsx.
interface WithNestedEmployee {
  employee: { id: string; name: string; employeeCode: string; department?: string; designation?: string }
}

export interface PendingLeaveRequest extends LeaveRequest, WithNestedEmployee {}
export interface PendingPermissionRequest extends PermissionRequest, WithNestedEmployee {}

export interface PendingCasualLeaveRequest extends CasualLeaveRequest {
  employeeName: string
  employeeCode: string
  department?: string | null
}
export interface PendingAttendanceRequest {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  department?: string | null
  date: string
  reason: string
  status: RequestStatus
  createdAt: string
}
export interface PendingResignation {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentName?: string | null
  reason: string
  lastWorkingDate: string | null
  status: RequestStatus
  createdAt: string
}

export interface PendingShiftApproval {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  department?: string | null
  shiftName?: string | null
  effectiveFrom?: string | null
  status: RequestStatus
  createdAt: string
}

export interface PendingRequestsResponse {
  leaveRequests: PendingLeaveRequest[]
  permissions: PendingPermissionRequest[]
  resignations: PendingResignation[]
  attendanceRequests: PendingAttendanceRequest[]
  casualLeaves: PendingCasualLeaveRequest[]
  shiftApprovals: PendingShiftApproval[]
  totalPending: number
}

export interface Resignation {
  id: string
  reason: string
  lastWorkingDate: string | null
  status: RequestStatus
  deptHeadName?: string | null
  deptHeadStatus?: string | null
  deptHeadComment?: string | null
  deptHeadApprovedAt?: string | null
  hrComment?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  rejectedBy?: string | null
  surveyQ1Answer?: string | null
  surveyQ2Answer?: string | null
  surveyQ3Answer?: string | null
  createdAt: string
}

export interface ChatChannel {
  id: string
  type: 'company' | 'department'
  departmentId?: string
  departmentName?: string
}

export interface ChatReaction {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface ChatMessage {
  id: string
  senderId: string
  senderName: string
  text: string
  replyTo: { id: string; senderName: string; text: string } | null
  reactions: ChatReaction[]
  createdAt: string
}

export interface MobileHomeSummary {
  date: string
  presentToday: number
  absentToday: number
  onLeaveToday: number
  pendingRequestsCount: number
}

export interface LiveFeedItem {
  employeeName: string
  department: string
  event: 'in' | 'out'
  time: string
  date: string
}

// ---- Geo Attendance (Office Geo Punch + On-Duty) ----

/** Read-only status check shown BEFORE the employee commits to punching —
 * lets the app say "You are inside/outside the allowed company radius"
 * ahead of the actual punch action. */
export interface GeoPunchPrecheckResult {
  insideRadius: boolean
  distanceM: number
  radiusM: number
  branchName: string
  nextPunchNumber: number | null
  nextPunchType: 'IN' | 'OUT' | null
  message: string
}

export interface GeoPunchResult {
  status: 'accepted' | 'already_recorded' | 'rejected'
  punchNumber: number | null
  punchType: 'IN' | 'OUT' | null
  distanceM: number
  radiusM?: number
  message?: string
  date?: string
  time?: string
}

export interface OnDutyRequestResult {
  status: 'pending_hod_approval'
  requestId: number
  punchNumber: number | null
  punchType: 'IN' | 'OUT' | null
}

export interface GeoPunchLogEntry {
  punchTime: string
  punchType: 'IN' | 'OUT'
  source: string
  sourceLabel: string
}

export interface OnDutyRequestSummary {
  id: number
  punchDate: string
  punchTime: string
  punchType: 'IN' | 'OUT'
  reason: string
  status: 'pending_hod' | 'pending_hr' | 'approved' | 'rejected'
  hodReviewedBy: string | null
  hodReviewComment: string | null
  hodReviewedAt: string | null
  hrReviewedBy: string | null
  hrReviewComment: string | null
  hrReviewedAt: string | null
  createdAt: string | null
}

export interface GeoPunchStatus {
  date: string
  punches: GeoPunchLogEntry[]
  onDutyRequests: OnDutyRequestSummary[]
  nextPunchNumber: number | null
  nextPunchType: 'IN' | 'OUT' | null
}

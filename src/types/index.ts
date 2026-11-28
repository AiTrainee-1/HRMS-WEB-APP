export type RequestStatus = 'pending' | 'approved' | 'rejected'

// ---- Approval workflow (backend/api/approval_workflow.py) ----
// HR configures, per kind of request, who approves it and in what order (Approval Workflow Control): 1-2 steps, each
// held by the Department Head, HR, or either of them. GET /approval-summary describes those pipelines and every
// request of such a kind carries its own `approval` progress block. Both are absent on an older backend, so screens
// read them through lib/approval.ts, which falls back to the old behaviour.
export type ApprovalRole = 'hod' | 'hr'
export type ApprovalWorkflowKey =
  | 'leave' | 'permission' | 'casual_leave' | 'missing_punch' | 'on_duty' | 'on_duty_punch'
  | 'attendance_correction' | 'outpass' | 'request' | 'resignation' | 'advance' | 'holiday_work'
  // Birthday Compensation placed on a chosen date (2026-11-25): Employee or HR -> HOD -> HR, fixed.
  | 'birthday_compensation'
export type ApprovalStepState = 'approved' | 'skipped' | 'pending' | 'waiting' | 'rejected'

export interface ApprovalStep {
  roles: ApprovalRole[]
  /** An optional step is skipped when the next step's role decides first; the last step is always mandatory. */
  mandatory: boolean
  /** The server's short label ("HOD" | "HR" | "HOD or HR"); employee-facing wording goes through lib/approval.ts. */
  label: string
}

export interface ApprovalProgressStep extends ApprovalStep {
  index: number
  /** 'pending' is the step the request is at now, 'waiting' a later one. */
  state: ApprovalStepState
  by?: string | null
  at?: string | null
  comment?: string | null
  decidedBy?: ApprovalRole
}

export interface ApprovalProgress {
  workflow: string
  label: string
  enabled: boolean
  steps: ApprovalProgressStep[]
  /** Index of the step the request is at while it is pending, else null. */
  currentStep: number | null
  waitingFor: ApprovalRole[]
  /** Whether that role could approve or reject it right now under the pipeline (not counting who the individual HOD is). */
  canAct: Record<ApprovalRole, boolean>
  /** canAct plus a rejection allowed out of turn (a resignation's HR). */
  canReject?: Record<ApprovalRole, boolean>
}

/** One entry of GET /approval-summary (also `approvalWorkflows` on /manager/me and /manager/pending-requests). */
export interface ApprovalSummaryItem {
  label: string
  /** false: HR has switched the workflow off, so NEW requests are refused (waiting ones can still be decided). */
  enabled: boolean
  requestedBy: 'Employee' | 'HR'
  steps: ApprovalStep[]
  /** "Employee → HOD → HR" */
  path: string
}

export type ApprovalSummary = Partial<Record<ApprovalWorkflowKey, ApprovalSummaryItem>>

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
  branchName?: string
  branchAddress?: string
  branchLat?: number
  branchLng?: number
}

export interface LeaveType {
  id: string
  name: string
}

export type HalfDaySlot = 'morning' | 'afternoon'

export interface LeaveRequest {
  id: string
  employeeId: string
  type: string
  startDate: string
  endDate: string
  totalDays: number
  /** Half-day leave: always a single day, totalDays 0.5 (backend models.py::LeaveRequest). */
  isHalfDay?: boolean
  halfDaySlot?: HalfDaySlot | null
  status: RequestStatus
  reason: string
  hrComment?: string
  createdAt: string
  /** Where the request stands in its approval pipeline; absent on an older backend (see lib/approval.ts). */
  approval?: ApprovalProgress | null
}

// The 3 permission types (backend models/leave.py::EmployeePermission). Each is
// exactly 60 minutes. `PermissionTypeKey` is the canonical slug; the wire type
// is the legacy spelling this app SENDS on POST /permissions, because an older
// backend rejects anything else while the new one accepts both spellings.
export type PermissionTypeKey = 'morning_late_in' | 'evening_early_out' | 'middle_permission'
export type PermissionWireType = 'Late In' | 'Early Out' | 'Short Leave'
// Position among the employee's approved permissions that calendar month:
// the first N (monthlyLimit) are within_cap ("Allowed"), later ones are excess.
export type PermissionCapStatus = 'within_cap' | 'excess' | 'not_applicable'

export interface PermissionRequest {
  id: string
  employeeId: string
  date: string
  permissionTime: string
  reason: string
  status: RequestStatus
  createdAt: string
  // Legacy spelling ("Late In" / "Early Out" / "Short Leave"), or null for a
  // request saved untyped by an older web build. Never show it raw: go
  // through lib/permissions.ts. typeKey/typeLabel/capStatus/statusLabel are
  // new and absent on an older backend, so all of them stay optional.
  type?: string | null
  typeKey?: PermissionTypeKey | null
  typeLabel?: string | null
  durationMinutes?: number | null
  capStatus?: PermissionCapStatus
  statusLabel?: string
  // Only ever populated by the backend on POST (create) responses — GET list
  // items always send these as null, so compute the monthly count client-side.
  monthlyUsed?: number | null
  // HR-configured monthly cap (default 3): permissions past it are Overdue / Excess.
  monthlyLimit?: number
  // DEPRECATED: the per-day / per-week caps no longer exist (one monthly cap
  // replaced them; the backend now just echoes monthlyLimit). Nothing reads these.
  dailyLimit?: number
  weeklyLimit?: number
  approval?: ApprovalProgress | null
}

export interface CasualLeaveRequest {
  id: string
  employeeId: string
  date: string
  reason: string
  status: RequestStatus
  createdAt: string
  approval?: ApprovalProgress | null
}

// See backend/api/outpass_request_views.py::_outpass_request_json. The final
// approval (whoever the pipeline makes it) sets approvedAt/expiresAt -expiresAt is always
// exactly approvedAt + 60 minutes, computed server-side so the client never
// has to guess the window.
export type OutpassSource = 'manual' | 'on_duty'
export type OutpassScanStatus =
  | 'not_applicable' | 'pending_exit' | 'exited' | 'expired_unscanned'
  // The return/re-entry leg -see backend/api/outpass_request_views.py::_outpass_scan_status.
  | 'pending_return' | 'return_expired' | 'completed'

export interface OutpassRequest {
  id: string
  employeeId: string
  destination: string
  reason: string
  status: RequestStatus
  source: OutpassSource
  approverRole?: 'hr' | 'dept_head' | 'system' | null
  approvedBy?: string | null
  reviewComment?: string | null
  approvedAt?: string | null
  expiresAt?: string | null
  createdAt: string
  // Gate Scanner fields -see backend/api/gate_scanner_views.py. qrToken is
  // only present while the pass is actually presentable at a gate.
  qrToken?: string | null
  exitGateName?: string | null
  exitedAt?: string | null
  // Return/re-entry leg -returnQrToken only appears once the employee has
  // requested it (see outpassApi.generateReturnQr in api/resources.ts) AND
  // it hasn't expired/been superseded by a newer one yet.
  entryGateName?: string | null
  enteredAt?: string | null
  returnQrToken?: string | null
  returnQrExpiresAt?: string | null
  canGenerateReturnQr?: boolean
  scanStatus?: OutpassScanStatus
  /** null for a pass raised by an On-Duty approval: it has no pipeline of its own. */
  approval?: ApprovalProgress | null
}

// See backend/api/tea_break_views.py. A permanent, no-approval, per-employee
// QR -unlike OutpassRequest's per-request approval flow, this just
// identifies WHO is scanning; the server toggles OUT/IN by itself based on
// whether an open break already exists.
export type TeaBreakRemark = 'overtime' | 'on_time' | 'in_progress' | 'not_returned'

export interface TeaBreakLogItem {
  id: string
  outGateName: string | null
  outAt: string
  inGateName: string | null
  inAt: string | null
  takenMinutes: number
  remark: TeaBreakRemark
}

export interface TeaBreakStatus {
  onBreak: boolean
  outAt: string | null
  allowedMinutes: number
  recent: TeaBreakLogItem[]
  /** "YYYY-MM" when the server applied `?month=` (then `recent` is that whole month); absent from an older server. */
  month?: string | null
}

export type MissingPunchStatus = 'pending_hod' | 'pending_hr' | 'approved' | 'rejected'

// Which of the day's (up to) 4 punches this request represents — purely
// descriptive (see backend models.py::MissingPunchRequest for why this is
// never the source of truth for real P1-P4 identity). Maps onto punchType:
// morning_in/lunch_in -> IN, lunch_out/evening_out -> OUT.
export type MissingPunchSlot = 'morning_in' | 'lunch_out' | 'lunch_in' | 'evening_out'

export interface MissingPunchRequest {
  id: string
  employeeId: string
  date: string
  punchTime: string
  punchType: 'IN' | 'OUT'
  punchSlot?: MissingPunchSlot | null
  reason: string
  status: MissingPunchStatus
  hodReviewedBy?: string | null
  hodReviewComment?: string | null
  hrReviewedBy?: string | null
  hrReviewComment?: string | null
  createdAt: string
  approval?: ApprovalProgress | null
}

/** One month an employee can still request casual leave in (see CasualLeaveEligibility.months). */
export interface CasualLeaveMonthEligibility {
  /** 'YYYY-MM' */
  month: string
  /** 'September 2026' */
  label: string
  eligible: boolean
  reason: string | null
  /** 2026-11-02: what of the yearly balance is left ("full" = a whole day or more). Absent on an older server. */
  left?: 'full' | 'one_half' | 'nothing' | string | null
  /** 2026-11-02: "yearly_balance" (any Casual Leave while the year's balance lasts) or "one_per_month" (the old rule). */
  rule?: 'yearly_balance' | 'one_per_month' | string | null
  /** 2026-11-02: the yearly days still free (null under the old rule). */
  remaining?: number | null
}

/**
 * The Casual Leave yearly balance (owner 2026-11-02): 12 days a calendar year, a half day counts 0.5, used any time while
 * the balance lasts; waiting requests hold their days, a rejected one gives them back; unused days lapse on 31 December
 * and a fresh 12 start on 1 January. Everyone started fresh at 12 on the cut-over day (2026-11-02): Casual Leave dated
 * before it is never counted. Sent by GET /casual-leaves/my-eligibility (`balance`) and GET /casual-leaves/history.
 */
export interface CasualLeaveBalance {
  /** The yearly entitlement (12). */
  total: number
  /** Approved days that count. */
  used: number
  /** Days held by requests still waiting (also a Casual Leave HR proposed on an attendance edit). */
  pending: number
  /** total - used - pending (never below 0): what can still be asked for. */
  remaining: number
  year: number
  /** 'YYYY-MM-DD': the first day of the year that counts (the cut-over in its own year, else 1 January); null = no
   * balance is kept for this year (it is wholly before the cut-over). */
  since: string | null
  /** 'YYYY-12-31' */
  endsOn: string
  /** 'YYYY-MM-DD': the day the yearly balance started for everyone. */
  cutOver: string
  /** False for a year wholly before the cut-over. */
  tracked: boolean
}

export interface CasualLeaveEligibility {
  eligible: boolean
  reason?: string
  year?: number
  yearlyEntitlement?: number
  usedThisYear?: number
  remainingThisYear?: number
  /**
   * The previous month while the grace days are open, then the current month, each with its own verdict. Absent on an
   * older backend: then `eligible` decides on its own.
   */
  months?: CasualLeaveMonthEligibility[]
  /** 2026-11-02: the yearly balance. Absent on an older server. */
  balance?: CasualLeaveBalance | null
  /** 2026-11-02: which rule today's requests follow. */
  rule?: 'yearly_balance' | 'one_per_month' | string | null
}

export interface Notification {
  id: string
  employeeId: string
  type: string
  /** The headline of a notification made from a WhatsApp message ("Request Approved"); empty on the older one-liners. */
  title?: string
  message: string
  isRead: boolean
  createdAt: string
  /**
   * What the notification is about, for its View button (GET /notifications, 2026-11-02). Absent on an older server
   * (the page falls back to the type-based link in lib/notifications.ts); null when there is nothing to open. Read it
   * through lib/notification-target.ts (`normalizeTarget`), never directly: the server's fields are not trusted as-is.
   */
  target?: NotificationTargetPayload | null
}

/** The kinds of page a notification can open (the server's `target.kind`). */
export type NotificationTargetKind =
  | 'leave'
  | 'casual_leave'
  | 'permission'
  | 'missing_punch'
  | 'outpass'
  | 'on_duty'
  | 'geo_punch'
  | 'attendance'
  | 'salary_slip'
  | 'documents'
  | 'id_card'
  | 'compensation'
  | 'advance'
  | 'resignation'
  | 'chat'
  | 'approvals'
  | 'my_requests'
  | 'request'
  | 'shift'
  | 'holidays'
  | 'profile'

/** A notification's `target` as the server sends it. */
export interface NotificationTargetPayload {
  kind: NotificationTargetKind | string
  /** The row it is about (leave request id, outpass id, On-Duty session id, salary slip id, advance id ...) when known. */
  id?: number | string | null
  /** "YYYY-MM-DD" for day events (late / absent / missing punch alerts, attendance edits). */
  date?: string | null
  /** approver = the reader must act on it (a Department Head) -> Approvals. */
  role?: 'self' | 'approver' | string | null
  /** For role "approver": the Approvals category (leave, permission, casual_leave, attendance, missing_punch ...). */
  category?: string | null
  /** The button's words: "View leave request", "Open approvals". */
  label?: string | null
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

export interface AttendancePunch {
  time: string
  type: 'IN' | 'OUT'
  source: string
  sourceLabel: string
}

// Late Detection / Permission flags carried by every per-day attendance object
// (attendance history records[] and shift-stats dailyLogs[]). Read them through
// lib/attendance-flags.ts, which applies the old-key fallbacks in one place.
export interface DayLateFlags {
  // Morning Late-In: first punch after the day's (permission-adjusted) shift start + grace.
  isLate?: boolean
  // Evening Early-Out: last punch before shift end - grace. Only ever true while
  // the company has that check switched on; absent on an older backend.
  isEarlyOut?: boolean
  // Why the day was flagged late, when the backend says (e.g. "arrived 09:40, deadline 09:15").
  lateReason?: string | null
  // An Allowed (within the monthly cap) Morning Late-In / Evening Early-Out
  // permission shifted that edge by 60 minutes today.
  morningPermissionApplied?: boolean
  eveningPermissionApplied?: boolean
  // Approved but Overdue / Excess: it did NOT shift the edge and counts as a late occurrence.
  morningPermissionExcess?: boolean
  eveningPermissionExcess?: boolean
  // An approved Middle One-Hour Permission covers today (moves nothing).
  middlePermissionToday?: boolean
  // DEPRECATED mirrors of the applied flags above (all an older backend sends;
  // the new one still mirrors them). Used only as a fallback, never preferred.
  // On an older backend they were an auto-detected punch-timing zone, and the
  // *WithRequest twins said whether an approved request also covered that edge.
  permissionMorning?: boolean
  permissionMorningWithRequest?: boolean
  permissionAfternoon?: boolean
  permissionAfternoonWithRequest?: boolean
  permissionDeparture?: boolean
  permissionDepartureWithRequest?: boolean
  // Compensation overhaul: what compensation shaped the day (null = nothing). All three are absent on an older
  // backend, so read them through lib/attendance-flags.ts (getCompensationMarker, compensationLine). The kind is one of
  // 'ot_allowance' | 'window_late_in' | 'window_early_out' | 'birthday' | 'relaxation' today, but stays a plain string:
  // a kind this app has never seen is drawn generically, never rejected.
  compensationKind?: string | null
  // The allowance minutes the arrival used (ot_allowance); 0 for the other kinds.
  compensationMinutes?: number | null
  // One plain sentence from the server explaining the marker.
  compensationNote?: string | null
  // 2026-11-26: TODAY's day is still open (the shift is running, so the server's Present / 1 shift is provisional and
  // judged again after the shift's end + grace). Absent on an older server; read through lib/day-progress.ts.
  inProgress?: boolean | null
  // When that day is judged again (ISO datetime with offset), or null.
  provisionalUntil?: string | null
}

// ── HR attendance edits (owner 2026-11-02) ──
// Every change HR proposes on the Attendance Edit page goes to the Department Head and then HR; the day's LATEST edit
// (waiting or decided) rides on the employee's attendance month as `records[].hrEdit` (null when HR never edited the
// day; absent on an older server). A "Revert to automatic" makes it disappear. Read it through lib/hr-edit.ts
// (`hrEditOf`), which checks the shape. Same names as the HR portal's payroll-insights.ts.
export type HrEditStatus = 'waiting_hod' | 'waiting_hr' | 'applied' | 'rejected'
export type HrEditOption = 'worked' | 'compensation' | 'not_worked' | 'permission' | 'late' | 'casual_leave' | 'on_duty'
export type HrEditSide = { label: string; shifts: number | null }
export type HrEdit = {
  requestId: number
  /** One of HrEditStatus today; a status added later stays a plain string (shown with the server's stageLabel). */
  status: HrEditStatus | (string & {})
  /** The server's sentence: "Waiting for HR (Department Head Suresh Raj approved on 02 Nov 2026)". */
  stageLabel: string
  from: HrEditSide
  to: HrEditSide
  option: HrEditOption | (string & {})
  type: string
  /** "Permission · Morning Late-In", "Mark as Late", "Casual Leave · First half", "On-Duty", "Present". */
  typeLabel: string
  reason: string | null
  comment: string | null
  raisedBy: string | null
  raisedAt: string | null
  decidedBy: string | null
  decidedAt: string | null
}

export interface AttendanceDay extends DayLateFlags {
  date: string
  /** The day's latest HR attendance edit (2026-11-02); null = none; absent on an older server. */
  hrEdit?: HrEdit | null
  // 'no_record' is a frontend-only sentinel for calendar cells with no API
  // entry at all (shouldn't normally happen — the backend returns one row
  // per calendar day, including 'future' for days after today).
  status: 'present' | 'half_shift' | 'absent' | 'on_leave' | 'holiday' | 'future' | 'no_record'
  // Both sourced from the canonical attendance engine (compute_month_records).
  // A day is Half Day when it has a punch in only one of the two halves
  // (Half-Day Detection); Late-In/Early-Out are judged separately, so a Half
  // Day can also be late — the same way HRMS's own Attendance Search shows
  // them as independent flags.
  isHalfShift?: boolean
  // HR announced this day as a Compensation Day (festival/special day) -
  // Late/Permission penalties are exempted, but Full/Half Shift is still
  // judged from real punches, never auto-granted.
  isCompensationDay?: boolean
  firstPunch?: string | null
  lastPunch?: string | null
  totalPunches?: number
  punches?: AttendancePunch[]
  leaveType?: string | null
  source?: string | null
}

export interface AttendanceMonthResponse {
  records: AttendanceDay[]
  summary: {
    present: number
    absent: number
    onLeave: number
    late: number
    halfShift: number
  }
}

export interface ShiftDailyLog extends DayLateFlags {
  date: string
  status: string
  firstPunch?: string | null
  lastPunch?: string | null
  totalPunches?: number
  isHalfShift?: boolean
  lateMorning?: boolean
  lateAfternoon?: boolean
  lateReturn?: boolean
  isCompensationDay?: boolean
}

// The monthly late-deduction preview. All of the "new" keys are optional: an
// older backend only sends the first five. shiftDeductions and
// salaryDeductionAmount are Decimal fields serialized as strings on the wire;
// lib/deductions.ts converts them, so they are numbers everywhere past it.
export interface ShiftDeductionSummary {
  shiftDeductions: number
  salaryDeductionAmount: number
  // Occurrences beyond the free allowance — the ones that cost a shift deduction.
  billableLateCount: number
  // Despite the name: how much of the FREE allowance is used (capped at it).
  permissionsUsed: number
  permissionOverageCount: number
  // The one monthly pool: Morning Late-Ins + Evening Early-Outs + Excess permissions.
  lateInCount?: number
  earlyOutCount?: number
  excessPermissionCount?: number
  // Occurrences per month that are free (default 3) and the Allowed-permission cap (default 3).
  freeAllowance?: number
  permissionMonthlyCap?: number
}

// The company-wide rules the shift-stats days were judged by (top-level `policy`
// of GET /attendance/employee-shift-stats). Absent on an older backend, and every
// field is optional: read it through lib/attendance-flags.ts (shiftPolicyOf and
// the helpers next to it), which supplies the "undefined means enabled" and
// "no time known" fallbacks.
export interface ShiftPolicy {
  morningLateInEnabled?: boolean
  eveningEarlyOutEnabled?: boolean
  // "HH:MM". Evening half = any punch at/after halfDaySecondHalfStart. Both halves = Full Day, one = Half Day.
  // halfDayFirstHalfEnd is the OLD fixed cut-off for the morning half (an older backend still decides by it).
  halfDayFirstHalfEnd?: string
  halfDaySecondHalfStart?: string
  // The arrival timeline of the current backend, measured from each shift's own start + grace: Late up to
  // lateWindowMinutes, an approved Late-In permission excuses a further permissionWindowMinutes, then arrivalExtraMinutes
  // more still count as the morning half (the day earning 1 - arrivalQuarterDeduction shift); later is the second half.
  lateWindowMinutes?: number
  permissionWindowMinutes?: number
  arrivalExtraMinutes?: number
  arrivalQuarterDeduction?: number
  permissionMonthlyCap?: number
  freeAllowance?: number
  permissionDurationMinutes?: number
}

export interface EmployeeShiftStats {
  // 'staff' | 'production'. Production keeps its own separate late policy, so
  // the staff pool breakdown must not be shown for it.
  employmentType?: string
  policy?: ShiftPolicy | null
  totalLateCount: number
  halfShiftDays: number
  totalEffectiveShifts: number
  absentDays: number
  // null until a MonthlyShiftSummary row exists for this employee/month
  summary: ShiftDeductionSummary | null
  dailyLogs: ShiftDailyLog[]
}

export interface AssignedShift {
  name: string
  startTime: string
  endTime: string
  gracePeriodMinutes: number
}

// Raw shape of one row from GET /shift-assignments — an assignment *history*
// entry pairing an employee with a shift template plus optional per-employee
// overrides. useMyShiftSummary.ts picks the current one and normalizes it
// into an AssignedShift.
export interface ShiftAssignment {
  id: number
  shiftId: number | null
  shiftName: string | null
  shiftType: string | null
  startTime: string | null
  endTime: string | null
  gracePeriodMinutes: number | null
  customStartTime?: string | null
  customEndTime?: string | null
  saturdayOff: boolean
  effectiveFrom: string | null
  effectiveTo: string | null
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
  deductions: DeductionPreview | null
  // Company rules behind the days above; null on an older backend. Already
  // reduced to what applies to this employee (see shiftPolicyOf).
  policy: ShiftPolicy | null
}

// ShiftDeductionSummary with its Decimal strings turned into real numbers
// (see lib/deductions.ts) plus whether the employee is on the Production
// policy, which has no Late-In / Early-Out / Excess-permission breakdown.
export interface DeductionPreview extends ShiftDeductionSummary {
  isProduction?: boolean
  // Preferred over the freeAllowance / permissionMonthlyCap copies in the summary.
  policy?: ShiftPolicy | null
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

export interface ManagerFlags {
  isManager: boolean
  canApproveLeaves?: boolean
  canApprovePermissions?: boolean
  canApproveAttendance?: boolean
  canApproveCasualLeave?: boolean
  canApproveResignations?: boolean
  canApproveOnDuty?: boolean
  canApproveMissingPunch?: boolean
  /** Compensation claims of every kind (raised by HR or by the employee; the Department Head approves), and Birthday
   * Compensation placements (2026-11-25; the head first, then HR). Absent on an older backend. */
  canApproveCompensation?: boolean
  /** Already inside pendingApprovalsCount. */
  pendingCompensationCount?: number
  /** Birthday Compensation placements waiting for this head (2026-11-25). Already inside pendingApprovalsCount. */
  pendingBirthdayCompensationCount?: number
  pendingApprovalsCount: number
  /** The pipelines in force, same shape as GET /approval-summary; absent on an older backend. */
  approvalWorkflows?: ApprovalSummary
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
export interface PendingOutpassRequest extends OutpassRequest, WithNestedEmployee {}

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
  approval?: ApprovalProgress | null
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
  approval?: ApprovalProgress | null
}

export type PendingOnDutySession = OnDutySession

/**
 * A compensation claim waiting for the Department Head (backend holiday_work_views.py::claim_json, workflow
 * `holiday_work`). Since 2026-11-19 the one claim table holds every kind (`kind`: holiday_work | ot_allowance | ot_shift
 * | birthday | use_balance) and the employee may raise their own (`raisedByRole` "employee"); before that HR raised every
 * claim and every claim was Sunday / holiday work, which is what a missing `kind` / `raisedByRole` still means. Fields are
 * flat like the other HR-style categories; everything but `id` may be absent, so lib/holiday-work.ts reads them defensively.
 */
export interface PendingHolidayWorkClaim {
  /** holiday_work | ot_allowance | ot_shift | birthday | use_balance; absent on an older backend (= holiday_work). */
  kind?: string | null
  /** The server's name for the kind ("Late-in allowance"). */
  kindLabel?: string | null
  /** employee | hr; absent on an older backend (= hr). */
  raisedByRole?: string | null
  /** ot_allowance: the allowance minutes. */
  minutes?: number | string | null
  /** ot_allowance / ot_shift: the overtime the claim is about. */
  overtime?: { date?: string | null; shiftEnd?: string | null; lastPunch?: string | null; extraMinutes?: number | null } | null
  /** use_balance: the day the employee takes off (YYYY-MM-DD). */
  useDate?: string | null
  id: number | string
  employeeId?: number | string
  employeeCode?: string
  employeeName?: string
  department?: string | null
  designation?: string | null
  branch?: string | null
  /** YYYY-MM-DD, the day the claim is about (the Sunday / holiday worked, the OT day, the birthday, the day off). */
  workDate: string
  dayKind?: 'sunday' | 'holiday' | string
  holidayName?: string | null
  /** 0.25 | 0.5 | 0.75 | 1 */
  shifts?: number | string
  reason?: string | null
  status?: RequestStatus
  /** Who raised it: the HR user, or (raisedByRole "employee") the employee. */
  requestedBy?: string | null
  createdAt?: string | null
  hodName?: string | null
  approval?: ApprovalProgress | null
}

export interface PendingMissingPunchRequest {
  id: string
  employeeId: string
  employeeCode: string
  employeeName: string
  department?: string | null
  date: string
  punchTime: string
  punchType: 'IN' | 'OUT'
  punchSlot?: MissingPunchSlot | null
  reason: string
  status: MissingPunchStatus
  createdAt: string
  approval?: ApprovalProgress | null
}

export interface PendingRequestsResponse {
  leaveRequests: PendingLeaveRequest[]
  permissions: PendingPermissionRequest[]
  resignations: PendingResignation[]
  attendanceRequests: PendingAttendanceRequest[]
  casualLeaves: PendingCasualLeaveRequest[]
  /** Absent on an older backend; empty when the head's "approve compensation" switch is off. */
  holidayWorkClaims?: PendingHolidayWorkClaim[]
  /** Birthday Compensation placements this head can decide now (2026-11-25; read by lib/birthday-compensation.ts
   * parseUse). Absent on an older backend; empty when the "approve compensation" switch is off. */
  birthdayCompensationUses?: Record<string, unknown>[]
  onDutySessions: PendingOnDutySession[]
  missingPunchRequests: PendingMissingPunchRequest[]
  outpassRequests: PendingOutpassRequest[]
  totalPending: number
  /** The pipelines in force, refreshed with every poll; absent on an older backend. */
  approvalWorkflows?: ApprovalSummary
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
  approval?: ApprovalProgress | null
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

export interface GeoPunchLogEntry {
  punchTime: string
  punchType: 'IN' | 'OUT'
  source: string
  sourceLabel: string
}

// ---- On-Duty sessions (backend/api/geo_attendance_views.py) ----
// A day of off-site work: the employee starts a session with a destination
// and can punch straight away (the approval pipeline decides it in the background). Each
// punch is a selfie + GPS "verification" that only becomes attendance once
// HR approves both the session and the punch.
export type OnDutySessionStatus = 'pending_hod' | 'pending_hr' | 'active' | 'completed' | 'rejected'

export interface OnDutySession {
  id: number
  employeeId: number
  employeeCode: string
  employeeName: string
  department: string | null
  destination: string
  branchId: number | null
  branchName: string | null
  /** Employee-facing: a still-provisional session reads as "active". */
  status: OnDutySessionStatus
  /** Always the real database status. */
  approvalStatus: OnDutySessionStatus
  isProvisional: boolean
  pendingPunchCount: number
  employeeEndedAt: string | null
  hodReviewedBy: string | null
  hodReviewComment: string | null
  hodReviewedAt: string | null
  hrReviewedBy: string | null
  hrReviewComment: string | null
  hrReviewedAt: string | null
  startedAt: string | null
  completedAt: string | null
  completedBy: string | null
  completionReason: string | null
  createdAt: string | null
  approval?: ApprovalProgress | null
}

/** One of the day's 4 punch slots: IN/OUT/IN/OUT by position. */
export interface PunchSlot {
  punchNumber: number
  punchType: 'IN' | 'OUT'
  /** 'available' | 'recorded' (biometric/geo) | 'pending' | 'approved' */
  status: string
  available: boolean
}

export interface OnDutyPunchVerification {
  id: number
  sessionId: number
  sessionStatus: OnDutySessionStatus
  sessionApproved: boolean
  sessionDestination: string
  punchDate: string
  punchTime: string
  punchType: 'IN' | 'OUT'
  punchNumber: number
  latitude: number
  longitude: number
  accuracyM: number | null
  isMocked: boolean
  hasPhoto: boolean
  /** Whether the punch also has a second photo (the two-photo policy). Absent on an older server. */
  hasPhoto2?: boolean
  status: 'pending' | 'approved' | 'rejected' | string
  hrReviewedBy: string | null
  hrReviewComment: string | null
  hrReviewedAt: string | null
  createdAt: string | null
}

export interface OnDutyStatusResponse {
  session: OnDutySession | null
  punchVerifications: OnDutyPunchVerification[]
  punchSlots?: PunchSlot[]
  /**
   * How many selfies a punch takes (HR's policy): 1 or 2. Absent on an older server, which only ever took one: read it
   * with requiredPhotoCount() (lib/onduty-photos.ts), never directly.
   */
  requiredPhotos?: 1 | 2
}

export interface OnDutyStartResult {
  status: string
  approvalStatus: OnDutySessionStatus
  isProvisional: boolean
  canPunch: boolean
  sessionId: number
  session: OnDutySession
  message: string
}

export interface OnDutyPunchResult {
  status: 'pending_hr_approval'
  verificationId: number
  punchNumber: number
  punchType: 'IN' | 'OUT'
  sessionEnded: boolean
  punchSlots: PunchSlot[]
}

export interface GeoPunchStatus {
  date: string
  punches: GeoPunchLogEntry[]
  onDutySession: OnDutySession | null
  nextPunchNumber: number | null
  nextPunchType: 'IN' | 'OUT' | null
  punchSlots: PunchSlot[]
}

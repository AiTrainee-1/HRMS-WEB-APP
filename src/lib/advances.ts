// Salary Advance and Term Loan (the Loan & Advance page): the rules the page shows, in ONE place. Pure, unit-tested in
// advances.test.ts (`npm test`). Twin of the mobile app's src/lib/settlement.ts.
//
// The server decides everything (backend api/mobile_settlement_views.py): when applications are open (a Salary Advance
// only on the days Settings names - the 21st and 22nd by default - a Term Loan on any day; factory date, the server
// answers 400 window_closed outside), the limits (a Salary Advance: a % of the salary EARNED from the 1st to a day of the
// month, `salaryAdvance.earned`; a Term Loan: a % of the monthly salary, `termLoan.limit`), every Term Loan rule
// (`termLoan.code`: staff only, months of service, one at a time, once a year, not in the month of a rejection, limit
// below the minimum), the months (1 to `termLoan.maxMonths`, 6 by default), the whole-rupee EMI, and what was approved.
// Since 2026-11-27 the rules come from Settings (`salaryAdvance.rules`, `termLoan.rules`); since 2026-11-28 the reply
// also says the method (`method`: under "automation" HR reviews first, then it is under review for approval, and a
// Salary Advance may be approved rounded to the nearest ₹500), whether this employee can apply at all (`applyAvailable`:
// not a production employee) and, per application, where it stands (`reviewLabel`, `canWithdraw`, `approvedMore`).
// Numbers come from the server's reply; the defaults here are only a fallback. This file reads those answers
// defensively, words them, and gives the forms a LIVE preview that matches what the server will store.

import type { ApprovalProgress } from '../types/index.ts'
import { normalizeAmountStory, type AmountStory } from './advance-story.ts'
import { formatINR } from './money.ts'

export type AdvanceType = 'general' | 'term'
export type AdvanceStatus = 'pending' | 'approved' | 'rejected' | 'closed'
export type ScheduleState = 'planned' | 'due' | 'upcoming' | 'deducted'

export const TYPE_LABEL: Record<AdvanceType, string> = { general: 'Salary Advance', term: 'Term Loan' }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3))

/** "November 2026", or "Nov 2026" when short. "" for a missing month. */
export function monthLabel(month: number | null | undefined, year: number | null | undefined, short = false): string {
  if (!month || !year || month < 1 || month > 12) return ''
  const name = MONTHS[month - 1]
  return `${short ? name.slice(0, 3) : name} ${year}`
}

export function nextMonth(month: number, year: number): [number, number] {
  return month === 12 ? [1, year + 1] : [month + 1, year]
}

/** Whole rupees, Indian grouping: "₹1,25,000". */
export function rupees(value: number | null | undefined): string {
  return formatINR(value ?? 0)
}

// ---- the amount box ---------------------------------------------------------------------------------------------

/** What the amount box shows while typing: digits only, grouped the Indian way ("125000" -> "1,25,000"). */
export function formatAmountInput(text: string): string {
  const digits = text.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '').slice(0, 9)
  return digits ? formatINR(Number(digits), { symbol: false, decimals: 0 }) : ''
}

/** The number in the amount box ("1,25,000" -> 125000); NaN when it is empty. */
export function amountOf(text: string): number {
  const digits = text.replace(/[^0-9]/g, '')
  return digits ? Number(digits) : NaN
}

// ---- reading the replies ----------------------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strOrNull = (v: unknown): string | null => str(v) || null
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
const num0 = (v: unknown): number => num(v) ?? 0

export interface WindowInfo {
  isOpen: boolean
  opensOn: string
  /** '' for a form that is open every day (a Term Loan since 2026-11-25). */
  closesOn: string
  nextOpensOn: string
  daysUntilOpen: number
  /** 0 for a form that is open every day. */
  daysLeft: number
  message: string
  /** Open every day, no dates (a Term Loan since 2026-11-25; false on an older server). */
  alwaysOpen: boolean
  /** The days of the month the window runs (21 and 22 for a Salary Advance since 2026-11-26), when the server says. */
  opensOnDay: number | null
  closesOnDay: number | null
}

/** Each form's own window (GET /my/advances/eligibility `windows`, 2026-11-25). */
export interface WindowsInfo {
  general: WindowInfo
  term: WindowInfo
}

export interface ScheduleRow {
  month: number
  year: number
  /** "Nov 2026" */
  label: string
  amount: number
  /** planned = not approved yet (an estimate); deducted = taken from a salary; due = this month or earlier, not yet
   *  deducted (payroll has not run); upcoming = a later month. */
  state: ScheduleState
}

export type TimelineKind = 'applied' | 'approved' | 'rejected' | 'waiting' | 'deducted' | 'closed'

export interface AdvanceEvent {
  kind: TimelineKind
  at: string | null
  title: string
  text: string
  by: string | null
  comment: string | null
}

/** One decision on an application (`history[]`, newest first): approved, rejected, or reopened by HR. */
export interface AdvanceDecisionRow {
  action: 'approved' | 'rejected' | 'reopened'
  requestedAmount: number | null
  approvedAmount: number | null
  startMonth: number | null
  startYear: number | null
  remark: string | null
  by: string | null
  at: string | null
}

/** Where a waiting application stands (2026-11-28): with HR (HR can still change it, it can be deleted), or under review
 *  (HR forwarded it for approval in the Automation Method; the steps after HR are not shown, owner's choice). */
export type ReviewStatus = 'with_hr' | 'under_review'

export interface MyAdvance {
  id: number
  advanceType: AdvanceType
  typeLabel: string
  status: AdvanceStatus
  statusLabel: string
  /** "With HR" / "Under review" while it waits (null once decided, or on an older server). */
  reviewLabel: string | null
  reviewStatus: ReviewStatus | null
  /** Waiting and forwarded beyond HR: it can no longer be deleted. */
  inWorkflow: boolean
  /** The employee may delete it now: waiting, raised by them, still with HR (an older server: waiting and theirs). */
  canWithdraw: boolean
  /** The APPROVED amount once approved (what is paid and deducted); the asked amount while it waits. */
  amount: number
  requestedAmount: number
  approvedAmount: number | null
  /** Approved for less than asked. */
  approvedLess: boolean
  /** Approved for MORE than asked: a Salary Advance rounded up to the nearest ₹500 within the limit (2026-11-27). */
  approvedMore: boolean
  /** The remark on the decision (the reason of a rejection, or why a different amount); '' on an older server. */
  decisionRemark: string | null
  decidedAt: string | null
  /** Every decision, newest first (more than one when HR reopened it). */
  history: AdvanceDecisionRow[]
  /** The 1st-20th figures the Salary Advance limit was taken from when applied (null for a Term Loan / none kept). */
  earnings: EarnedBasis | null
  /** A Term Loan's limit when applied (2026-11-27). */
  termLimit: number | null
  purpose: string | null
  emiAmount: number
  repaymentMonths: number | null
  repaymentStartMonth: number | null
  repaymentStartYear: number | null
  totalRepaid: number
  outstanding: number
  /** Still owed: the outstanding of an approved advance, 0 for anything else. */
  balanceDue: number
  deductedTotal: number
  /** "October 2026" or "November 2026 to January 2027" */
  deductionLabel: string
  schedule: ScheduleRow[]
  scheduleIsEstimate: boolean
  nextDeduction: ScheduleRow | null
  timeline: AdvanceEvent[]
  approvedBy: string | null
  approvedAt: string | null
  createdAt: string | null
  appliedBy: 'hr' | 'employee'
  salaryAtRequest: number | null
  notes: string | null
  approval: ApprovalProgress | null
  /** How the amount was decided (2026-11-28, lib/advance-story.ts); null / absent on an older server. */
  amountStory?: AmountStory | null
}

const STATES: ScheduleState[] = ['planned', 'due', 'upcoming', 'deducted']
const STATUSES: AdvanceStatus[] = ['pending', 'approved', 'rejected', 'closed']
const KINDS: TimelineKind[] = ['applied', 'approved', 'rejected', 'waiting', 'deducted', 'closed']

function readSchedule(raw: unknown): ScheduleRow | null {
  if (!isObject(raw)) return null
  const month = num(raw.month)
  const year = num(raw.year)
  if (month == null || year == null) return null
  const state = str(raw.state) as ScheduleState
  return {
    month,
    year,
    label: str(raw.label) || monthLabel(month, year, true),
    amount: num0(raw.amount),
    state: STATES.includes(state) ? state : 'upcoming',
  }
}

function readEvent(raw: unknown): AdvanceEvent | null {
  if (!isObject(raw)) return null
  const kind = str(raw.kind) as TimelineKind
  if (!KINDS.includes(kind)) return null
  return {
    kind,
    at: strOrNull(raw.at),
    title: str(raw.title),
    text: str(raw.text),
    by: strOrNull(raw.by),
    comment: strOrNull(raw.comment),
  }
}

const DECISIONS: AdvanceDecisionRow['action'][] = ['approved', 'rejected', 'reopened']

function readDecision(raw: unknown): AdvanceDecisionRow | null {
  if (!isObject(raw)) return null
  const action = str(raw.action) as AdvanceDecisionRow['action']
  if (!DECISIONS.includes(action)) return null
  return {
    action,
    requestedAmount: num(raw.requestedAmount),
    approvedAmount: num(raw.approvedAmount),
    startMonth: num(raw.startMonth),
    startYear: num(raw.startYear),
    remark: strOrNull(raw.remark),
    by: strOrNull(raw.by),
    at: strOrNull(raw.at),
  }
}

/** One application of GET /my/advances (or the POST reply), or null when it is not one. */
export function normalizeAdvance(raw: unknown): MyAdvance | null {
  if (!isObject(raw)) return null
  const id = num(raw.id)
  if (id == null) return null
  const type: AdvanceType = raw.advanceType === 'term' ? 'term' : 'general'
  const statusRaw = str(raw.status) as AdvanceStatus
  const status: AdvanceStatus = STATUSES.includes(statusRaw) ? statusRaw : 'pending'
  const amount = num0(raw.amount)
  const schedule = (Array.isArray(raw.schedule) ? raw.schedule : []).map(readSchedule).filter((s): s is ScheduleRow => s !== null)
  const pending = status === 'pending'
  const decided = status === 'approved' || status === 'closed'
  const requestedAmount = num(raw.requestedAmount) ?? amount
  const approvedAmount = num(raw.approvedAmount) ?? (decided ? amount : null)
  const appliedBy: MyAdvance['appliedBy'] = raw.appliedBy === 'employee' ? 'employee' : 'hr'
  const review = str(raw.reviewStatus)
  const reviewStatus: ReviewStatus | null = pending && (review === 'with_hr' || review === 'under_review') ? review : null
  const inWorkflow = pending && (raw.inWorkflow === true || reviewStatus === 'under_review')
  return {
    id,
    advanceType: type,
    typeLabel: str(raw.typeLabel) || TYPE_LABEL[type],
    status,
    statusLabel: str(raw.statusLabel),
    reviewLabel: pending ? strOrNull(raw.reviewLabel) : null,
    reviewStatus,
    inWorkflow,
    // The server's answer when it sends one (never for a decided application); an older server: waiting and raised by
    // the employee (it still refuses a forwarded one with 409 in_workflow).
    canWithdraw: typeof raw.canWithdraw === 'boolean' ? raw.canWithdraw && pending : pending && appliedBy === 'employee' && !inWorkflow,
    amount,
    requestedAmount,
    approvedAmount,
    approvedLess:
      typeof raw.approvedLess === 'boolean' ? raw.approvedLess : decided && approvedAmount != null && approvedAmount < requestedAmount,
    approvedMore:
      typeof raw.approvedMore === 'boolean' ? raw.approvedMore : decided && approvedAmount != null && approvedAmount > requestedAmount,
    decisionRemark: strOrNull(raw.decisionRemark),
    decidedAt: strOrNull(raw.decidedAt),
    history: (Array.isArray(raw.history) ? raw.history : []).map(readDecision).filter((d): d is AdvanceDecisionRow => d !== null),
    earnings: normalizeEarned(raw.earnings),
    termLimit: num(raw.termLimit),
    purpose: strOrNull(raw.purpose),
    emiAmount: num0(raw.emiAmount),
    repaymentMonths: num(raw.repaymentMonths),
    repaymentStartMonth: num(raw.repaymentStartMonth),
    repaymentStartYear: num(raw.repaymentStartYear),
    totalRepaid: num0(raw.totalRepaid),
    outstanding: num0(raw.outstanding),
    balanceDue: num(raw.balanceDue) ?? (status === 'approved' ? num0(raw.outstanding) : 0),
    deductedTotal: num(raw.deductedTotal) ?? num0(raw.totalRepaid),
    deductionLabel: str(raw.deductionLabel),
    schedule,
    scheduleIsEstimate: raw.scheduleIsEstimate === true,
    nextDeduction: readSchedule(raw.nextDeduction),
    timeline: (Array.isArray(raw.timeline) ? raw.timeline : []).map(readEvent).filter((e): e is AdvanceEvent => e !== null),
    approvedBy: strOrNull(raw.approvedBy),
    approvedAt: strOrNull(raw.approvedAt),
    createdAt: strOrNull(raw.createdAt),
    appliedBy,
    salaryAtRequest: num(raw.salaryAtRequest),
    notes: strOrNull(raw.notes),
    approval: isObject(raw.approval) ? (raw.approval as unknown as ApprovalProgress) : null,
    amountStory: normalizeAmountStory(raw.amountStory),
  }
}

/** The reply of GET /my/advances, or null when it is not a list (a malformed reply is an error, never "nothing"). */
export function normalizeAdvances(raw: unknown): MyAdvance[] | null {
  if (!Array.isArray(raw)) return null
  return raw.map(normalizeAdvance).filter((a): a is MyAdvance => a !== null)
}

/**
 * What the Salary Advance limit is taken from (2026-11-26, `salaryAdvance.earned`): the salary earned from the 1st to
 * the 20th of the month, priced like the staff payroll. `final` false = the 20th is not over yet, so it is earned so far.
 */
export interface EarnedBasis {
  month: number | null
  year: number | null
  /** The last day counted (20). */
  throughDay: number
  /** "2026-11-20" */
  through: string
  /** The monthly fixed salary. */
  fixedSalary: number | null
  dailyRate: number | null
  companyDays: number | null
  /** The working days the salary pays for. The current server: the paid days (present shifts + paid holidays, the same
   *  as `paidDays`); a server before `presentShifts` existed: the present shifts alone. */
  workingDays: number | null
  /** Present shifts 1st-20th (a Half Day counts 0.5); null on an older server. */
  presentShifts: number | null
  /** Paid holidays 1st-20th (company holidays, days HR marked Holiday); null on an older server. */
  holidayDays: number | null
  /** Present shifts + paid holidays. */
  paidDays: number | null
  earnedAmount: number
  percent: number
  limit: number
  final: boolean
}

/** The Term Loan's service rule (2026-11-26, `termLoan.service`): 6 completed months from the joining date. */
export interface TermLoanService {
  eligible: boolean
  joinDate: string | null
  serviceMonths: number | null
  requiredMonths: number
  eligibleFrom: string | null
  /** The server's sentence when not eligible yet. */
  reason: string | null
}

/** The Salary Advance rules of Settings (`salaryAdvance.rules`, 2026-11-27). */
export interface SalaryAdvanceRules {
  percent: number | null
  windowFromDay: number | null
  windowToDay: number | null
  earnedThroughDay: number | null
  perMonth: number | null
  rejectedAllowsReapply: boolean | null
  /** "the 21st and 22nd of each month" */
  windowText: string | null
}

/** The Term Loan rules of Settings (`termLoan.rules`, 2026-11-27). */
export interface TermLoanRules {
  limitPercent: number | null
  /** The % actually used (capped at 100 unless Settings allows above the salary). */
  effectivePercent: number | null
  maxMonths: number | null
  absoluteMaxMonths: number | null
  minAmount: number | null
  perYear: number | null
  minServiceMonths: number | null
  reapplyNextMonth: boolean | null
  oneOpenAtATime: boolean | null
  staffOnly: boolean
}

/** Why a Term Loan cannot be applied for (`termLoan.code`, 2026-11-27/28). Null when it can, or when the account / the
 *  switched-off workflow blocks both forms (then only `reason` says why). */
export type TermLoanCode =
  | 'staff_only'
  | 'no_salary'
  | 'service'
  | 'pending'
  | 'active'
  | 'yearly'
  | 'rejected_this_month'
  | 'below_minimum'

const TERM_CODES: TermLoanCode[] = ['staff_only', 'no_salary', 'service', 'pending', 'active', 'yearly', 'rejected_this_month', 'below_minimum']

/** How HR handles applications (2026-11-28): "normal" = HR decides; "automation" = HR reviews first, then it is under
 *  review for approval (a Salary Advance may be rounded to the nearest ₹500 within the limit). An older server: normal. */
export type AdvanceMethod = 'normal' | 'automation'

export interface AdvanceEligibility {
  today: string
  /** The Salary Advance window (on an older server: the one window both forms shared). */
  window: WindowInfo
  /** Each form's own window (2026-11-25), or null on an older server. Read through salaryAdvanceWindow / termLoanWindow. */
  windows: WindowsInfo | null
  method: AdvanceMethod
  /** False for an employee who cannot apply at all (a production employee: no monthly salary, Term Loans are staff only):
   *  the page then shows the history only, with `applyUnavailableReason`. True on an older server. */
  applyAvailable: boolean
  applyUnavailableReason: string | null
  workflowEnabled: boolean
  workflowMessage: string | null
  employeeActive: boolean
  monthlySalary: number | null
  salaryAdvance: {
    canApply: boolean
    reason: string | null
    percent: number
    limit: number | null
    deductionMonth: number
    deductionYear: number
    deductionLabel: string
    existing: { id: number; status: string; amount: number } | null
    /** "earned_1_to_20" since 2026-11-26 (absent on an older server). */
    limitBasis?: string | null
    /** What the limit is taken from; null after the window / without a salary / on an older server. */
    earned?: EarnedBasis | null
    /** The rules of Settings (2026-11-27); null on an older server. */
    rules?: SalaryAdvanceRules | null
  }
  termLoan: {
    canApply: boolean
    reason: string | null
    minMonths: number
    /** The most months to repay in (Settings, 6 by default, never above 12). */
    maxMonths: number
    minAmount: number
    maxAmount: number | null
    firstDeductionMonth: number
    firstDeductionYear: number
    firstDeductionLabel: string
    /** The Term Loan still waiting (always sent). */
    pending: { id: number; amount: number } | null
    activeCount: number
    /** The months-of-service rule (2026-11-26); null on an older server. */
    service?: TermLoanService | null
    /** The most this employee may ask for (a % of the monthly salary, 2026-11-27); null without a salary / older server. */
    limit?: number | null
    limitPercent?: number | null
    monthlySalary?: number | null
    approvedThisYear?: number | null
    perYear?: number | null
    /** The Term Loan waiting or being repaid (only when Settings allows one at a time). */
    open?: { id: number; status: string; amount: number } | null
    rejectedThisMonth?: boolean
    /** "2026-12-01": when a blocked Term Loan can be asked for again (service / yearly / rejected_this_month). */
    nextEligibleOn?: string | null
    code?: TermLoanCode | null
    /** The rules of Settings (2026-11-27); null on an older server. */
    rules?: TermLoanRules | null
  }
  rules: string[]
  approvalPath: string
}

/** One window of the eligibility reply (`window`, `windows.general`, `windows.term`). */
function normalizeWindow(w: Record<string, unknown>): WindowInfo {
  return {
    isOpen: w.isOpen === true,
    opensOn: str(w.opensOn),
    closesOn: str(w.closesOn),
    nextOpensOn: str(w.nextOpensOn),
    daysUntilOpen: num0(w.daysUntilOpen),
    daysLeft: num0(w.daysLeft),
    message: str(w.message),
    alwaysOpen: w.alwaysOpen === true,
    opensOnDay: num(w.opensOnDay),
    closesOnDay: num(w.closesOnDay),
  }
}

/** `salaryAdvance.earned` (2026-11-26), or null when it is missing or not readable. */
export function normalizeEarned(raw: unknown): EarnedBasis | null {
  if (!isObject(raw)) return null
  const earnedAmount = num(raw.earnedAmount) ?? num(raw.workingSalary)
  const limit = num(raw.limit)
  if (earnedAmount == null || limit == null) return null
  return {
    month: num(raw.month),
    year: num(raw.year),
    throughDay: num(raw.throughDay) ?? 20,
    through: str(raw.through),
    fixedSalary: num(raw.fixedSalary),
    dailyRate: num(raw.dailyRate),
    companyDays: num(raw.companyDays),
    workingDays: num(raw.workingDays),
    presentShifts: num(raw.presentShifts),
    holidayDays: num(raw.holidayDays),
    paidDays: num(raw.paidDays),
    earnedAmount,
    percent: num(raw.percent) ?? 50,
    limit,
    final: raw.final === true,
  }
}

/** `termLoan.service` (2026-11-26), or null when it is missing. */
export function normalizeService(raw: unknown): TermLoanService | null {
  if (!isObject(raw) || typeof raw.eligible !== 'boolean') return null
  return {
    eligible: raw.eligible,
    joinDate: strOrNull(raw.joinDate),
    serviceMonths: num(raw.serviceMonths),
    requiredMonths: num(raw.requiredMonths) ?? 6,
    eligibleFrom: strOrNull(raw.eligibleFrom),
    reason: strOrNull(raw.reason),
  }
}

const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

/** `salaryAdvance.rules` (2026-11-27), or null when it is missing. */
export function normalizeSalaryAdvanceRules(raw: unknown): SalaryAdvanceRules | null {
  if (!isObject(raw)) return null
  return {
    percent: num(raw.percent),
    windowFromDay: num(raw.windowFromDay),
    windowToDay: num(raw.windowToDay),
    earnedThroughDay: num(raw.earnedThroughDay),
    perMonth: num(raw.perMonth),
    rejectedAllowsReapply: boolOrNull(raw.rejectedAllowsReapply),
    windowText: strOrNull(raw.windowText),
  }
}

/** `termLoan.rules` (2026-11-27), or null when it is missing. */
export function normalizeTermLoanRules(raw: unknown): TermLoanRules | null {
  if (!isObject(raw)) return null
  return {
    limitPercent: num(raw.limitPercent),
    effectivePercent: num(raw.effectivePercent),
    maxMonths: num(raw.maxMonths),
    absoluteMaxMonths: num(raw.absoluteMaxMonths),
    minAmount: num(raw.minAmount),
    perYear: num(raw.perYear),
    minServiceMonths: num(raw.minServiceMonths),
    reapplyNextMonth: boolOrNull(raw.reapplyNextMonth),
    oneOpenAtATime: boolOrNull(raw.oneOpenAtATime),
    staffOnly: raw.staffOnly === true,
  }
}

/** The most months a Term Loan can be repaid in, whatever a server says (Settings allows 1 to 12). */
export const ABSOLUTE_MAX_MONTHS = 12
/** The Term Loan's months when the server does not say (the Settings default since 2026-11-27; it was 12 before). */
const DEFAULT_MAX_MONTHS = 6

/** The reply of GET /my/advances/eligibility, or null when it is not one. */
export function normalizeEligibility(raw: unknown): AdvanceEligibility | null {
  if (!isObject(raw) || !isObject(raw.window) || !isObject(raw.salaryAdvance) || !isObject(raw.termLoan)) return null
  const ws = isObject(raw.windows) && isObject(raw.windows.general) && isObject(raw.windows.term) ? raw.windows : null
  const g = raw.salaryAdvance
  const t = raw.termLoan
  const today = str(raw.today)
  const [ty, tm] = /^(\d{4})-(\d{2})/.exec(today)?.slice(1).map(Number) ?? [0, 0]
  const [nm, ny] = tm ? nextMonth(tm, ty) : [0, 0]
  const existing = isObject(g.existing) && num(g.existing.id) != null
    ? { id: num0(g.existing.id), status: str(g.existing.status), amount: num0(g.existing.amount) }
    : null
  const pending = isObject(t.pending) && num(t.pending.id) != null ? { id: num0(t.pending.id), amount: num0(t.pending.amount) } : null
  const open = isObject(t.open) && num(t.open.id) != null
    ? { id: num0(t.open.id), status: str(t.open.status), amount: num0(t.open.amount) }
    : null
  const saRules = normalizeSalaryAdvanceRules(g.rules)
  const tlRules = normalizeTermLoanRules(t.rules)
  const minMonths = Math.max(1, num(t.minMonths) ?? 1)
  const maxMonths = Math.min(ABSOLUTE_MAX_MONTHS, Math.max(minMonths, num(t.maxMonths) ?? tlRules?.maxMonths ?? DEFAULT_MAX_MONTHS))
  const code = str(t.code) as TermLoanCode
  return {
    today,
    window: normalizeWindow(raw.window),
    windows: ws
      ? { general: normalizeWindow(ws.general as Record<string, unknown>), term: normalizeWindow(ws.term as Record<string, unknown>) }
      : null,
    method: raw.method === 'automation' ? 'automation' : 'normal',
    applyAvailable: raw.applyAvailable !== false,
    applyUnavailableReason: raw.applyAvailable === false ? strOrNull(raw.applyUnavailableReason) : null,
    workflowEnabled: raw.workflowEnabled !== false,
    workflowMessage: strOrNull(raw.workflowMessage),
    employeeActive: raw.employeeActive !== false,
    monthlySalary: num(raw.monthlySalary),
    salaryAdvance: {
      canApply: g.canApply === true,
      reason: strOrNull(g.reason),
      percent: num(g.percent) ?? saRules?.percent ?? 50,
      limit: num(g.limit),
      deductionMonth: num(g.deductionMonth) ?? tm,
      deductionYear: num(g.deductionYear) ?? ty,
      deductionLabel: str(g.deductionLabel) || monthLabel(num(g.deductionMonth) ?? tm, num(g.deductionYear) ?? ty),
      existing,
      limitBasis: strOrNull(g.limitBasis),
      earned: normalizeEarned(g.earned),
      rules: saRules,
    },
    termLoan: {
      canApply: t.canApply === true,
      reason: strOrNull(t.reason),
      minMonths,
      maxMonths,
      minAmount: num(t.minAmount) ?? tlRules?.minAmount ?? 1000,
      maxAmount: num(t.maxAmount),
      firstDeductionMonth: num(t.firstDeductionMonth) ?? nm,
      firstDeductionYear: num(t.firstDeductionYear) ?? ny,
      firstDeductionLabel:
        str(t.firstDeductionLabel) || monthLabel(num(t.firstDeductionMonth) ?? nm, num(t.firstDeductionYear) ?? ny),
      pending,
      activeCount: num0(t.activeCount),
      service: normalizeService(t.service),
      limit: num(t.limit),
      limitPercent: num(t.limitPercent) ?? tlRules?.effectivePercent ?? null,
      monthlySalary: num(t.monthlySalary),
      approvedThisYear: num(t.approvedThisYear),
      perYear: num(t.perYear) ?? tlRules?.perYear ?? null,
      open,
      rejectedThisMonth: t.rejectedThisMonth === true,
      nextEligibleOn: strOrNull(t.nextEligibleOn),
      code: TERM_CODES.includes(code) ? code : null,
      rules: tlRules,
    },
    rules: (Array.isArray(raw.rules) ? raw.rules : []).map(str).filter((r) => r !== ''),
    approvalPath: str(raw.approvalPath),
  }
}

// ---- the application window -------------------------------------------------------------------------------------

/** "20 Nov" from "2026-11-20" (never shifted by time zone). */
export function dayMonth(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return ''
  return `${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]}`
}

/** "1st", "2nd", "3rd", "11th", "21st", "22nd". */
export function ordinal(n: number): string {
  const mod100 = n % 100
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'
  return `${n}${suffix}`
}

/** The Salary Advance window's first and last day of the month: Settings' days (`salaryAdvance.rules`, 2026-11-27), else
 *  the window's `opensOnDay` / `closesOnDay`, else the days of its dates, else the 21st and 22nd (the default). */
export function salaryAdvanceDays(
  w: WindowInfo | null | undefined,
  rules?: Pick<SalaryAdvanceRules, 'windowFromDay' | 'windowToDay'> | null,
): { from: number; to: number } {
  const from = rules?.windowFromDay ?? w?.opensOnDay ?? dayOf(w?.opensOn) ?? DEFAULT_OPENS_ON_DAY
  const to = Math.max(from, rules?.windowToDay ?? w?.closesOnDay ?? dayOf(w?.closesOn) ?? DEFAULT_CLOSES_ON_DAY)
  return { from, to }
}

/** "the 21st and 22nd" (two days), "the 20th to the 22nd" (more), "the 21st" (one). */
export function salaryAdvanceDaysText(
  w: WindowInfo | null | undefined,
  rules?: Pick<SalaryAdvanceRules, 'windowFromDay' | 'windowToDay'> | null,
): string {
  const { from, to } = salaryAdvanceDays(w, rules)
  if (to === from) return `the ${ordinal(from)}`
  if (to === from + 1) return `the ${ordinal(from)} and ${ordinal(to)}`
  return `the ${ordinal(from)} to the ${ordinal(to)}`
}

/** "Salary Advance: apply on the 21st and 22nd of each month." */
export function salaryAdvanceRuleText(
  w: WindowInfo | null | undefined,
  rules?: Pick<SalaryAdvanceRules, 'windowFromDay' | 'windowToDay'> | null,
): string {
  return `Salary Advance: apply on ${salaryAdvanceDaysText(w, rules)} of each month.`
}

/** What the window helpers need from the eligibility reply. */
export type WindowSource = Pick<AdvanceEligibility, 'window'> & { windows?: Partial<WindowsInfo> | null }

/** The Salary Advance window: `windows.general`, else (an older server) the one shared `window`. */
export function salaryAdvanceWindow(e: WindowSource): WindowInfo {
  return e.windows?.general ?? e.window
}

/**
 * The Term Loan window, or null when a Term Loan can be applied for on any day (the current server: `windows.term` is
 * `alwaysOpen`). An older server has one window for both forms, so that window applies.
 */
export function termLoanWindow(e: WindowSource): WindowInfo | null {
  const term = e.windows?.term
  if (term) return term.alwaysOpen ? null : term
  return e.window
}

/** The headline of the window banner: "Open now: 2 days left", "Opens on 20 Dec: in 25 days", "Open now: last day
 *  today", "Open every day". */
export function windowHeadline(w: WindowInfo | null | undefined): string {
  if (!w) return ''
  if (w.alwaysOpen) return 'Open every day'
  if (w.isOpen) {
    if (w.daysLeft <= 1) return 'Open now: last day today'
    return `Open now: ${w.daysLeft} days left`
  }
  const when = w.daysUntilOpen === 1 ? 'tomorrow' : `in ${w.daysUntilOpen} days`
  return `Opens on ${dayMonth(w.opensOn)}: ${when}`
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

/** The short line on a form's card / tab: "Open · 2 days left", "Last day today", "Opens 20 Dec · in 25 days",
 *  "Any day". `open` false = the form cannot be sent today because of its window. */
export function windowChip(w: WindowInfo | null | undefined): { open: boolean; text: string } {
  if (!w || w.alwaysOpen) return { open: true, text: 'Any day' }
  if (w.isOpen) return { open: true, text: w.daysLeft <= 1 ? 'Last day today' : `Open · ${w.daysLeft} days left` }
  const when = w.daysUntilOpen === 1 ? 'tomorrow' : `in ${w.daysUntilOpen} days`
  return { open: false, text: `Opens ${dayMonth(w.opensOn)} · ${when}` }
}

/** "Opens on 20 Dec" for a closed window (a disabled button), '' otherwise. */
export function opensOnText(w: WindowInfo | null | undefined): string {
  return w && !w.alwaysOpen && !w.isOpen && dayMonth(w.opensOn) ? `Opens on ${dayMonth(w.opensOn)}` : ''
}

function dayOf(iso: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  return m ? Number(m[3]) : null
}

/** The Salary Advance days when the server does not say (owner 2026-11-26: the 21st and 22nd; was the 20th-22nd). */
const DEFAULT_OPENS_ON_DAY = 21
const DEFAULT_CLOSES_ON_DAY = 22

/** Days in the month of a "YYYY-MM-DD" (30 when it is not a date). */
export function daysInMonthOf(iso: string | null | undefined): number {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? ''))
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate() : 30
}

export interface WindowStrip {
  /** The month's last day (the strip runs 1 .. lastDay). */
  lastDay: number
  /** The open days, as day numbers and as % positions along the strip. */
  fromDay: number
  toDay: number
  startPct: number
  endPct: number
  /** Today's position, 0-100 (kept on the strip). */
  todayPct: number
}

/** The banner's strip of today's month with the window's days lit (the 21st and 22nd for a Salary Advance; an older
 *  server's 20th to the month end), or null for a form with no window. */
export function windowStrip(w: WindowInfo | null | undefined, today: string | null | undefined): WindowStrip | null {
  if (!w || w.alwaysOpen) return null
  const lastDay = daysInMonthOf(today)
  const fromDay = Math.min(lastDay, w.opensOnDay ?? dayOf(w.opensOn) ?? DEFAULT_OPENS_ON_DAY)
  const toDay = Math.min(lastDay, Math.max(fromDay, w.closesOnDay ?? dayOf(w.closesOn) ?? lastDay))
  const span = Math.max(1, lastDay - 1)
  const pct = (d: number) => clamp01((d - 1) / span) * 100
  return { lastDay, fromDay, toDay, startPct: pct(fromDay), endPct: pct(toDay), todayPct: pct(dayOf(today) ?? 1) }
}

/** How far through the waiting period or the open period we are, 0-1, for a progress bar. */
export function windowProgress(w: WindowInfo | null | undefined): number {
  if (!w) return 0
  if (w.alwaysOpen) return 1
  const from = w.opensOnDay ?? dayOf(w.opensOn) ?? DEFAULT_OPENS_ON_DAY
  const to = w.closesOnDay ?? dayOf(w.closesOn) ?? 30
  const openDays = Math.max(1, to - from + 1)
  if (w.isOpen) return clamp01((openDays - w.daysLeft + 1) / openDays)
  const waitDays = Math.max(1, 31 - openDays)
  return clamp01((waitDays - w.daysUntilOpen + 1) / waitDays)
}

/** The instant the window changes (closes at the end of `closesOn`, or opens at the start of `opensOn`), factory time
 *  (IST, +05:30). NaN when the dates are missing or the form is open every day. */
export function windowDeadline(w: WindowInfo): number {
  if (w.alwaysOpen) return NaN
  const day = w.isOpen ? w.closesOn : w.opensOn
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return NaN
  const start = Date.parse(`${day}T00:00:00+05:30`)
  return w.isOpen ? start + 24 * 3600 * 1000 : start
}

/** "3 days 4 hours", "5 hours 12 minutes", "12 minutes", "less than a minute" until `target`; '' once passed. */
export function countdownText(nowMs: number, targetMs: number): string {
  if (!Number.isFinite(targetMs) || !Number.isFinite(nowMs)) return ''
  const left = targetMs - nowMs
  if (left <= 0) return ''
  const minutes = Math.floor(left / 60000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (days > 0) return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day')
  if (hours > 0) return mins > 0 ? `${plural(hours, 'hour')} ${plural(mins, 'minute')}` : plural(hours, 'hour')
  if (mins > 0) return plural(mins, 'minute')
  return 'less than a minute'
}

// ---- Salary Advance ---------------------------------------------------------------------------------------------

export type MeterState = 'empty' | 'ok' | 'near' | 'over'

/** The limit meter (50% of the salary earned 1st-20th): how much of the limit the typed amount uses. `near` from 85%, `over` above the limit. */
export function limitMeter(amount: number, limit: number | null | undefined): { ratio: number; state: MeterState; left: number } {
  if (!limit || limit <= 0) return { ratio: 0, state: 'empty', left: 0 }
  if (!Number.isFinite(amount) || amount <= 0) return { ratio: 0, state: 'empty', left: limit }
  const ratio = amount / limit
  return {
    ratio: Math.min(ratio, 1),
    state: ratio > 1 ? 'over' : ratio >= 0.85 ? 'near' : 'ok',
    left: Math.max(0, limit - amount),
  }
}

export const MIN_PURPOSE = 3
export const MAX_PURPOSE = 300
/** The largest amount the server takes at all (mobile_settlement_views.MAX_AMOUNT). */
export const MAX_AMOUNT = 99_99_999

/** What the Salary Advance rules need from the eligibility reply. */
export type SalaryAdvanceSource = Pick<AdvanceEligibility, 'window'> & {
  windows?: Partial<WindowsInfo> | null
  salaryAdvance: Pick<AdvanceEligibility['salaryAdvance'], 'percent' | 'earned' | 'rules'>
}

/** The last day of the month whose earned salary the limit is taken from: Settings (`rules.earnedThroughDay`), else the
 *  reply's `earned.throughDay`, else the 20th. */
export function salaryAdvanceThroughDay(e: SalaryAdvanceSource | null | undefined): number {
  return e?.salaryAdvance.rules?.earnedThroughDay ?? e?.salaryAdvance.earned?.throughDay ?? 20
}

/** The Salary Advance %: Settings, else the reply's `percent`, else 50. */
export function salaryAdvancePercent(e: SalaryAdvanceSource | null | undefined): number {
  return e?.salaryAdvance.rules?.percent ?? e?.salaryAdvance.percent ?? 50
}

/** "the 21st and 22nd": the Salary Advance days from Settings, else the window. */
export function salaryAdvanceDaysOf(e: SalaryAdvanceSource | null | undefined): string {
  return salaryAdvanceDaysText(e ? salaryAdvanceWindow(e) : null, e?.salaryAdvance.rules)
}

/** "50% of the salary you earned from the 1st to the 20th" (the Salary Advance limit, in words, from Settings). */
export function salaryAdvanceBasisText(e: SalaryAdvanceSource | null | undefined): string {
  return `${salaryAdvancePercent(e)}% of the salary you earned from the 1st to the ${ordinal(salaryAdvanceThroughDay(e))}`
}

/**
 * The message under the Salary Advance amount, or null when it can be sent. Same rules and wording as the server's
 * over_limit (2026-11-26): "The most you can ask for is ₹X (50% of the ₹Y you earned from the 1st to the 20th)."
 * `earned` = the salary earned 1st-20th (`salaryAdvance.earned.earnedAmount`); without it only the limit is named.
 */
export function salaryAdvanceProblem(
  text: string,
  limit: number | null | undefined,
  earned: number | null | undefined,
  percent = 50,
  throughDay = 20,
): string | null {
  const amount = amountOf(text)
  if (!Number.isFinite(amount)) return 'Enter the amount.'
  if (amount <= 0) return 'The amount must be more than ₹0.'
  if (amount > MAX_AMOUNT) return `The amount cannot be more than ${rupees(MAX_AMOUNT)}.`
  if (limit != null && amount > limit) {
    const basis = earned != null ? ` (${percent}% of the ${rupees(earned)} you earned from the 1st to the ${ordinal(throughDay)})` : ''
    return `The most you can ask for is ${rupees(limit)}${basis}.`
  }
  return null
}

/** "18", "18.5", "18.25" (days or shifts, no trailing zeros). */
export function daysText(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

export interface EarnedFigure {
  key: 'earned' | 'days' | 'salary' | 'limit'
  label: string
  value: string
  hint: string | null
}

export interface EarnedView {
  /** "Earned from the 1st to the 20th of November 2026" / "Earned so far (the 1st to the 20th of November 2026)" */
  title: string
  /** When the 20th is not over yet: it is the salary earned so far. */
  note: string | null
  figures: EarnedFigure[]
}

/** "15.5 present + 1 holiday" / "present shifts": what the working days are made of. The current server says it
 *  (`presentShifts` + `holidayDays`); an older one sent the present shifts as `workingDays` and the paid days apart. */
export function workingDaysHint(earned: Pick<EarnedBasis, 'workingDays' | 'presentShifts' | 'holidayDays' | 'paidDays'>): string {
  if (earned.presentShifts != null) {
    const holidays = earned.holidayDays ?? Math.max(0, (earned.paidDays ?? earned.presentShifts) - earned.presentShifts)
    if (holidays > 0) return `${daysText(earned.presentShifts)} present + ${daysText(holidays)} ${holidays === 1 ? 'holiday' : 'holidays'}`
    return 'present shifts'
  }
  const paidMore = earned.workingDays != null && earned.paidDays != null && earned.paidDays > earned.workingDays
  return `present shifts${paidMore ? `; ${daysText(earned.paidDays!)} paid with holidays` : ''}`
}

/**
 * What the Salary Advance limit is taken from, as the form shows it (2026-11-26): the salary earned from the 1st to the
 * 20th, the working days (present shifts + paid holidays), the monthly salary, and the limit. Null without `earned`
 * (after the window, no salary, or an older server).
 */
export function earnedBasisView(earned: EarnedBasis | null | undefined, monthlySalary?: number | null): EarnedView | null {
  if (!earned) return null
  const through = ordinal(earned.throughDay)
  const month = monthLabel(earned.month, earned.year)
  const span = `the 1st to the ${through}${month ? ` of ${month}` : ''}`
  const salary = earned.fixedSalary ?? monthlySalary ?? null
  const figures: EarnedFigure[] = [
    {
      key: 'earned',
      label: earned.final ? `Earned 1st–${through}` : `Earned so far (1st–${through})`,
      value: rupees(earned.earnedAmount),
      hint: null,
    },
  ]
  // The current server: workingDays = the paid days (present shifts + paid holidays), split in presentShifts / holidayDays.
  const days = earned.presentShifts != null ? (earned.paidDays ?? earned.workingDays) : earned.workingDays
  if (days != null) {
    figures.push({ key: 'days', label: 'Working days', value: daysText(days), hint: workingDaysHint(earned) })
  }
  if (salary != null) figures.push({ key: 'salary', label: 'Monthly salary', value: rupees(salary), hint: null })
  figures.push({ key: 'limit', label: `${earned.percent}% limit`, value: rupees(earned.limit), hint: null })
  return {
    title: earned.final ? `Earned from ${span}` : `Earned so far (${span})`,
    note: earned.final
      ? null
      : `The ${through} is not over yet, so this is the salary you have earned so far. Days still to come earn nothing until they are worked.`,
    figures,
  }
}

/** The message under the purpose, or null. */
export function purposeProblem(text: string): string | null {
  const t = text.trim()
  if (t.length < MIN_PURPOSE) return 'Tell HR briefly what the money is for.'
  if (t.length > MAX_PURPOSE) return `Keep the purpose under ${MAX_PURPOSE} characters.`
  return null
}

// ---- Term Loan --------------------------------------------------------------------------------------------------

export interface PlanItem {
  month: number
  year: number
  label: string
  amount: number
}

/** The monthly EMI: amount / months rounded UP to whole rupees (settlement_views.whole_rupee_emi). */
export function termEmi(amount: number, months: number): number {
  if (!(amount > 0) || !(months > 0)) return 0
  return Math.ceil(amount / months)
}

/** The deductions a Term Loan would make: the EMI each month and a smaller last one that absorbs the rest, from the
 *  first deduction month. Twin of the server's schedule (mobile_settlement_views.schedule_plan). */
export function termPlan(amount: number, months: number, startMonth: number, startYear: number): PlanItem[] {
  const emi = termEmi(amount, months)
  if (!emi || !startMonth || !startYear) return []
  const out: PlanItem[] = []
  let remaining = amount
  let m = startMonth
  let y = startYear
  for (let i = 0; i < months && remaining > 0; i += 1) {
    const pay = Math.min(emi, remaining)
    out.push({ month: m, year: y, label: monthLabel(m, y, true), amount: pay })
    remaining -= pay
    ;[m, y] = nextMonth(m, y)
  }
  return out
}

/** "3 EMIs of ₹3,334 (last ₹3,332), Nov 2026 to Jan 2027". */
export function planSummary(plan: readonly PlanItem[]): string {
  if (plan.length === 0) return ''
  const first = plan[0]
  const last = plan[plan.length - 1]
  if (plan.length === 1) return `1 deduction of ${rupees(first.amount)} in ${monthLabel(first.month, first.year)}`
  const tail = last.amount !== first.amount ? ` (last ${rupees(last.amount)})` : ''
  return `${plan.length} EMIs of ${rupees(first.amount)}${tail}, ${first.label} to ${last.label}`
}

/**
 * The message under the Term Loan amount, or null when it can be sent. Same rules, order and wording as the server
 * (2026-11-27): more than ₹0, at most ₹99,99,999, at least the minimum ("A Term Loan starts from ₹1,000."), at most the
 * limit ("The most you can ask for is ₹26,000 (100% of your monthly salary of ₹26,000)."). `limit` null (no salary /
 * an older server) = no limit check here; the server still has the last word.
 */
export function termAmountProblem(
  text: string,
  minAmount: number,
  limit?: number | null,
  limitPercent?: number | null,
  monthlySalary?: number | null,
): string | null {
  const amount = amountOf(text)
  if (!Number.isFinite(amount)) return 'Enter the amount.'
  if (amount <= 0) return 'The amount must be more than ₹0.'
  if (amount > MAX_AMOUNT) return `The amount cannot be more than ${rupees(MAX_AMOUNT)}.`
  if (amount < minAmount) return `A Term Loan starts from ${rupees(minAmount)}.`
  if (limit != null && amount > limit) {
    const basis =
      limitPercent != null && monthlySalary != null ? ` (${limitPercent}% of your monthly salary of ${rupees(monthlySalary)})` : ''
    return `The most you can ask for is ${rupees(limit)}${basis}.`
  }
  return null
}

/** What the Term Loan rules need from the eligibility reply. */
export type TermLoanSource = Pick<AdvanceEligibility['termLoan'], 'minMonths' | 'maxMonths'> &
  Partial<Pick<AdvanceEligibility['termLoan'], 'limit' | 'limitPercent' | 'monthlySalary'>>

/** "Up to ₹26,000 (100% of your monthly salary)", or null when the server sends no limit (no salary, older server). */
export function termLoanLimitText(t: TermLoanSource): string | null {
  if (t.limit == null) return null
  return `Up to ${rupees(t.limit)}${t.limitPercent != null ? ` (${t.limitPercent}% of your monthly salary)` : ''}`
}

/** The months a Term Loan can be repaid in: 1 .. maxMonths (Settings, 6 by default, never above 12). */
export function termMonthChoices(t: Pick<TermLoanSource, 'minMonths' | 'maxMonths'>): number[] {
  const min = Math.max(1, t.minMonths)
  const max = Math.min(ABSOLUTE_MAX_MONTHS, Math.max(min, t.maxMonths))
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
}

/** The months the form starts on: 6, or fewer when Settings allows fewer. */
export function defaultTermMonths(t: Pick<TermLoanSource, 'minMonths' | 'maxMonths'>): number {
  const choices = termMonthChoices(t)
  return Math.max(choices[0], Math.min(DEFAULT_MAX_MONTHS, choices[choices.length - 1]))
}

/** What a blocked Term Loan offers next (by `termLoan.code`). */
export type TermLoanAction =
  | { kind: 'date'; text: string }
  /** Open that application's details (`id`): the one still waiting, or the one being repaid. */
  | { kind: 'open'; id: number; text: string }

export interface TermLoanBlock {
  /** The Term Loan form is not offered at all: applying is not available to this employee (`applyAvailable` false), or
   *  Term Loans are for staff only (`code` "staff_only"). */
  hidden: boolean
  /** Why it cannot be applied for now: the server's own sentence; null when it can. */
  reason: string | null
  action: TermLoanAction | null
  /** Show the months-of-service bar: only when the service rule is what blocks it (`code` "service"); a server before
   *  codes existed: whenever the service rule is not met. */
  showService: boolean
}

/**
 * Why a Term Loan cannot be applied for, and what to do next (shared app behaviour, 2026-11-28). The message is always
 * the server's `reason`; the next step follows `code`:
 *   service / yearly / rejected_this_month -> "You can apply again from 1 December 2026" (`nextEligibleOn`)
 *   pending                                -> open the request still waiting (`pending.id`)
 *   active                                 -> open the loan being repaid (`open.id`)
 *   no_salary / below_minimum / none       -> the reason only
 *   staff_only                             -> the form is not offered at all
 */
export function termLoanBlock(e: { applyAvailable?: boolean; termLoan: AdvanceEligibility['termLoan'] }): TermLoanBlock {
  const t = e.termLoan
  const hidden = e.applyAvailable === false || t.code === 'staff_only'
  if (t.canApply) return { hidden, reason: null, action: null, showService: false }
  const reason = t.reason ?? 'You cannot apply for a Term Loan right now.'
  const legacy = t.rules == null && t.code == null
  const showService = t.code === 'service' || (legacy && t.service?.eligible === false)
  let action: TermLoanAction | null = null
  if (t.code === 'service' || t.code === 'yearly' || t.code === 'rejected_this_month') {
    const from = longDate(t.nextEligibleOn ?? (t.code === 'service' ? t.service?.eligibleFrom : null))
    if (from) action = { kind: 'date', text: `You can apply again from ${from}` }
  } else if (t.code === 'pending') {
    const id = t.pending?.id ?? (t.open?.status === 'pending' ? t.open.id : null)
    if (id != null) action = { kind: 'open', id, text: 'See your waiting request' }
  } else if (t.code === 'active') {
    if (t.open?.id != null) action = { kind: 'open', id: t.open.id, text: 'See the loan being repaid' }
  }
  return { hidden, reason, action, showService }
}

/** The forms this employee may use (Salary Advance first): none when applying is not available to them; no Term Loan
 *  for a production employee (staff only). Whether each one can be sent TODAY is `canApply`. */
export function applyForms(e: { applyAvailable?: boolean; termLoan: AdvanceEligibility['termLoan'] }): AdvanceType[] {
  if (e.applyAvailable === false) return []
  return termLoanBlock(e).hidden ? ['general'] : ['general', 'term']
}

/** "1 December 2026" from "2026-12-01" (never shifted by time zone); '' when it is not a date. */
export function longDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return ''
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

export interface ServiceView {
  /** The server's sentence (why not yet). */
  reason: string
  /** "5/6 months of service", or null without a joining date. */
  progress: string | null
  /** 0-1 for a bar, or null without a joining date. */
  ratio: number | null
  /** "Eligible from 1 December 2026", or null. */
  eligibleFrom: string | null
}

/** The months of service a Term Loan needs: the employee's `service.requiredMonths` (0 is kept), else Settings, else 6. */
export function termLoanServiceMonths(e: { termLoan: Pick<AdvanceEligibility['termLoan'], 'service' | 'rules'> } | null | undefined): number {
  return e?.termLoan.service?.requiredMonths ?? e?.termLoan.rules?.minServiceMonths ?? 6
}

/**
 * The Term Loan's 6-month service rule (2026-11-26) when it is NOT met yet: the server's reason, how far along
 * ("5/6 months of service") and from when; null once eligible or on an older server (no `service`).
 */
export function termLoanServiceView(service: TermLoanService | null | undefined): ServiceView | null {
  if (!service || service.eligible) return null
  const required = service.requiredMonths
  const months = service.serviceMonths
  const from = longDate(service.eligibleFrom)
  const progress = months != null ? `${Math.max(0, Math.min(months, required))}/${required} months of service` : null
  return {
    reason: service.reason ?? `A Term Loan needs ${required} months of service.`,
    progress,
    ratio: months != null && required > 0 ? clamp01(months / required) : null,
    eligibleFrom: from ? `Eligible from ${from}` : null,
  }
}

// ---- records ----------------------------------------------------------------------------------------------------

export type TypeFilter = 'all' | AdvanceType

export const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'Both' },
  { key: 'general', label: 'Salary Advance' },
  { key: 'term', label: 'Term Loan' },
]

export function filterByType<T extends { advanceType: string }>(rows: readonly T[], type: TypeFilter): T[] {
  return type === 'all' ? [...rows] : rows.filter((r) => r.advanceType === type)
}

export function typeCounts(rows: readonly { advanceType: string }[]): Record<TypeFilter, number> {
  const counts: Record<TypeFilter, number> = { all: rows.length, general: 0, term: 0 }
  for (const r of rows) if (r.advanceType === 'general' || r.advanceType === 'term') counts[r.advanceType] += 1
  return counts
}

/** Where a waiting application stands, in words: "With HR" / "Under review" (2026-11-28), else the server's status
 *  label, else "Waiting for HR" (an older server). Null once it is decided. Never the steps after HR (owner's choice). */
export function reviewText(r: { status: string; reviewLabel?: string | null; statusLabel?: string | null }): string | null {
  if (r.status !== 'pending') return null
  return r.reviewLabel?.trim() || r.statusLabel?.trim() || 'Waiting for HR'
}

/** The words on a record's status pill. Waiting: "With HR" / "Under review" (reviewText). An approved advance not yet
 *  deducted reads "Approved"; once something has been deducted "Repaying". */
export function statusText(r: { status: string; deductedTotal?: number; reviewLabel?: string | null; statusLabel?: string | null }): string {
  switch (r.status) {
    case 'pending':
      return reviewText(r) ?? 'Waiting for HR'
    case 'rejected':
      return 'Rejected'
    case 'closed':
      return 'Fully repaid'
    default:
      return (r.deductedTotal ?? 0) > 0 ? 'Repaying' : 'Approved'
  }
}

type AmountsOf = Pick<MyAdvance, 'status' | 'requestedAmount' | 'approvedAmount' | 'amount' | 'approvedLess' | 'approvedMore'>

/** The approved amount in words (shared app behaviour): "Approved ₹8,000 of ₹10,000 asked", "Approved ₹5,000 (rounded up
 *  from ₹4,800 asked)" (a Salary Advance rounded to the nearest ₹500), "Approved ₹5,000". Null until approved. */
export function approvedAmountText(a: AmountsOf): string | null {
  if (a.status !== 'approved' && a.status !== 'closed') return null
  const approved = rupees(a.approvedAmount ?? a.amount)
  if (a.approvedLess) return `Approved ${approved} of ${rupees(a.requestedAmount)} asked`
  if (a.approvedMore) return `Approved ${approved} (rounded up from ${rupees(a.requestedAmount)} asked)`
  return `Approved ${approved}`
}

/** The small line under an approved amount that differs from the ask: "of ₹10,000 asked" / "rounded up from ₹4,800
 *  asked"; null when it is the amount asked (or not approved). */
export function askedNote(a: AmountsOf): string | null {
  if (a.status !== 'approved' && a.status !== 'closed') return null
  if (a.approvedLess) return `of ${rupees(a.requestedAmount)} asked`
  if (a.approvedMore) return `rounded up from ${rupees(a.requestedAmount)} asked`
  return null
}

/** The remark on a decided application: `decisionRemark` (since 2026-11-20), else `notes` (where it was kept before);
 *  null while it waits or when there is none. */
export function decisionRemarkOf(a: Pick<MyAdvance, 'status' | 'decisionRemark' | 'notes'>): string | null {
  if (a.status === 'pending') return null
  return a.decisionRemark?.trim() || a.notes?.trim() || null
}

/** "Reason: …" on a rejected application, "Remark: …" on an approved one; null without a remark. */
export function remarkLine(a: Pick<MyAdvance, 'status' | 'decisionRemark' | 'notes'>): string | null {
  const remark = decisionRemarkOf(a)
  if (!remark) return null
  return `${a.status === 'rejected' ? 'Reason' : 'Remark'}: ${remark}`
}

/** The line next to "Delete request" on a waiting application's details; null once it is decided. */
export function deleteRowText(a: Pick<MyAdvance, 'status' | 'canWithdraw' | 'inWorkflow' | 'appliedBy'>): string | null {
  if (a.status !== 'pending') return null
  if (a.canWithdraw) return 'Still with HR, so you can delete this request.'
  if (a.inWorkflow) return 'It is under review, so it can no longer be deleted. Please contact HR if something needs to change.'
  if (a.appliedBy === 'hr') return 'HR recorded this request, so only HR can change it.'
  return null
}

/** Who decides, in one sentence: "HR approves every application." / (automation) "HR reviews every application first;
 *  then it is under review for approval." */
export function reviewSentence(method: AdvanceMethod): string {
  return method === 'automation'
    ? 'HR reviews every application first; then it is under review for approval.'
    : 'HR approves every application.'
}

/** What may change before approval, said before sending. Under the Automation Method never "a smaller amount": the
 *  approved amount may differ, and a Salary Advance is rounded to the nearest ₹500 within the limit. */
export function approvalNoteText(method: AdvanceMethod, kind: AdvanceType): string {
  if (method === 'automation') {
    return kind === 'general'
      ? 'The approved amount may differ from what you ask for: a Salary Advance is rounded to the nearest ₹500 within your limit.'
      : 'The approved amount, the months or the month deductions start may differ from what you ask for.'
  }
  return 'HR may approve a smaller amount or change the month deductions start.'
}

/** "Your limit was 50% of the ₹16,500 you earned from the 1st to the 20th of November 2026 (16.5 working days):
 *  ₹8,250." for a Salary Advance with kept figures; a Term Loan's limit when applied; '' otherwise. */
export function limitWhenAppliedText(a: Pick<MyAdvance, 'advanceType' | 'earnings' | 'termLimit' | 'salaryAtRequest'>): string {
  if (a.advanceType === 'term') return a.termLimit != null ? `Your Term Loan limit when you applied: ${rupees(a.termLimit)}.` : ''
  const e = a.earnings
  if (e) {
    const when = monthLabel(e.month, e.year)
    const paid = e.presentShifts != null ? (e.paidDays ?? e.workingDays) : e.workingDays
    const days = paid != null ? ` (${daysText(paid)} working days)` : ''
    return `Your limit was ${e.percent}% of the ${rupees(e.earnedAmount)} you earned from the 1st to the ${ordinal(e.throughDay)}${
      when ? ` of ${when}` : ''
    }${days}: ${rupees(e.limit)}.`
  }
  if (a.salaryAtRequest != null) return `Your monthly salary when you applied: ${rupees(a.salaryAtRequest)}.`
  return ''
}

/** One decision as the details list it: "Approved ₹8,000", "Rejected", "Reopened by HR". */
export function decisionTitle(d: Pick<AdvanceDecisionRow, 'action' | 'approvedAmount'>): string {
  if (d.action === 'approved') return d.approvedAmount != null ? `Approved ${rupees(d.approvedAmount)}` : 'Approved'
  if (d.action === 'rejected') return 'Rejected'
  return 'Reopened by HR'
}

/** A server field an application refusal points at (`field`), so its sentence sits next to that input. */
export type ApplyField = 'amount' | 'purpose' | 'repaymentMonths' | 'advanceType'
const APPLY_FIELDS: ApplyField[] = ['amount', 'purpose', 'repaymentMonths', 'advanceType']

export interface ApplyRefusal {
  /** The server's own sentence, or a plain fallback. */
  text: string
  code: string | null
  /** Which input it is about (shown next to it), or null for the whole application. */
  field: ApplyField | null
  /** Go back to the form and ask the eligibility again (the server answered: the rules or the employee's state changed,
   *  e.g. 409 duplicate / active / yearly, 400 window_closed / over_limit, 403 service). False when nothing answered or
   *  the server failed, so "Send" can simply be tried again. */
  toForm: boolean
}

/** Reads a refused POST /my/advances ({error, code, field?}) for the form. */
export function applyRefusal(err: { status?: number; message?: string; data?: unknown } | null | undefined): ApplyRefusal {
  const raw = err?.data
  const data: Record<string, unknown> = isObject(raw) ? raw : {}
  const status = err?.status
  if (status === undefined) {
    return { text: 'Could not send your application. Check your connection and try again.', code: null, field: null, toForm: false }
  }
  const field = str(data.field) as ApplyField
  const text = str(data.error) || str(data.message) || str(err?.message) || 'Your application could not be sent. Please try again.'
  return {
    text,
    code: strOrNull(data.code),
    field: APPLY_FIELDS.includes(field) ? field : null,
    toForm: status < 500,
  }
}

/** The figures at the top: still owed (approved only: a pending or rejected application owes nothing), repaid so far,
 *  how many wait for HR and how many are being repaid. */
export function recordTotals(rows: readonly { status: string; balanceDue?: number; deductedTotal?: number }[]): {
  owed: number
  repaid: number
  waiting: number
  active: number
} {
  let owed = 0
  let repaid = 0
  let waiting = 0
  let active = 0
  for (const r of rows) {
    if (r.status === 'approved') {
      owed += r.balanceDue ?? 0
      active += 1
    }
    if (r.status === 'pending') waiting += 1
    repaid += r.deductedTotal ?? 0
  }
  return { owed: round2(owed), repaid: round2(repaid), waiting, active }
}

/** How much of the approved amount is repaid, 0-1, for the progress ring. */
export function repaidRatio(approved: number, deducted: number): number {
  if (!(approved > 0)) return 0
  return clamp01(deducted / approved)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface ScheduleLook {
  /** The words for the row's state. */
  stateLabel: string
  tone: 'emerald' | 'amber' | 'sapphire' | 'slate'
  /** This month's deduction (or an overdue one payroll has not run yet): the timeline dot breathes. */
  current: boolean
}

/** How a repayment row is drawn: deducted / this month / upcoming / planned. */
export function scheduleLook(row: Pick<ScheduleRow, 'state'>): ScheduleLook {
  switch (row.state) {
    case 'deducted':
      return { stateLabel: 'Deducted', tone: 'emerald', current: false }
    case 'due':
      return { stateLabel: 'This month', tone: 'amber', current: true }
    case 'planned':
      return { stateLabel: 'Planned (until it is decided)', tone: 'slate', current: false }
    default:
      return { stateLabel: 'Upcoming', tone: 'sapphire', current: false }
  }
}

/** "Deducted from Nov 2026 salary", "To be deducted from Dec 2026 salary". */
export function scheduleTitle(row: Pick<ScheduleRow, 'state' | 'label'>): string {
  return row.state === 'deducted' ? `Deducted from ${row.label} salary` : `${row.label} salary`
}

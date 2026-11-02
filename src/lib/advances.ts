// Salary Advance and Term Loan (Advances & Settlement page): the rules the page shows, in ONE place. Pure, unit-tested in
// advances.test.ts (`npm test`). Twin of the mobile app's src/lib/settlement.ts.
//
// The server decides everything (backend api/mobile_settlement_views.py): when applications are open (from the 20th of
// the month to its last day, factory date), the 60% limit of the monthly fixed salary, the 1-12 month Term Loan, the
// whole-rupee EMI, and what HR approved. This file reads those answers defensively, words them, and gives the forms a LIVE
// preview that matches what the server will store, so an employee sees the same EMI and months before and after sending.

import type { ApprovalProgress } from '../types/index.ts'
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
  closesOn: string
  nextOpensOn: string
  daysUntilOpen: number
  daysLeft: number
  message: string
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

export interface MyAdvance {
  id: number
  advanceType: AdvanceType
  typeLabel: string
  status: AdvanceStatus
  statusLabel: string
  /** The APPROVED amount once HR approved it (what is paid and deducted); the asked amount while it waits. */
  amount: number
  requestedAmount: number
  approvedAmount: number | null
  approvedLess: boolean
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
  return {
    id,
    advanceType: type,
    typeLabel: str(raw.typeLabel) || TYPE_LABEL[type],
    status,
    statusLabel: str(raw.statusLabel),
    amount,
    requestedAmount: num(raw.requestedAmount) ?? amount,
    approvedAmount: num(raw.approvedAmount),
    approvedLess: raw.approvedLess === true,
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
    appliedBy: raw.appliedBy === 'employee' ? 'employee' : 'hr',
    salaryAtRequest: num(raw.salaryAtRequest),
    notes: strOrNull(raw.notes),
    approval: isObject(raw.approval) ? (raw.approval as unknown as ApprovalProgress) : null,
  }
}

/** The reply of GET /my/advances, or null when it is not a list (a malformed reply is an error, never "nothing"). */
export function normalizeAdvances(raw: unknown): MyAdvance[] | null {
  if (!Array.isArray(raw)) return null
  return raw.map(normalizeAdvance).filter((a): a is MyAdvance => a !== null)
}

export interface AdvanceEligibility {
  today: string
  window: WindowInfo
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
  }
  termLoan: {
    canApply: boolean
    reason: string | null
    minMonths: number
    maxMonths: number
    minAmount: number
    maxAmount: number | null
    firstDeductionMonth: number
    firstDeductionYear: number
    firstDeductionLabel: string
    pending: { id: number; amount: number } | null
    activeCount: number
  }
  rules: string[]
  approvalPath: string
}

/** The reply of GET /my/advances/eligibility, or null when it is not one. */
export function normalizeEligibility(raw: unknown): AdvanceEligibility | null {
  if (!isObject(raw) || !isObject(raw.window) || !isObject(raw.salaryAdvance) || !isObject(raw.termLoan)) return null
  const w = raw.window
  const g = raw.salaryAdvance
  const t = raw.termLoan
  const today = str(raw.today)
  const [ty, tm] = /^(\d{4})-(\d{2})/.exec(today)?.slice(1).map(Number) ?? [0, 0]
  const [nm, ny] = tm ? nextMonth(tm, ty) : [0, 0]
  const existing = isObject(g.existing) && num(g.existing.id) != null
    ? { id: num0(g.existing.id), status: str(g.existing.status), amount: num0(g.existing.amount) }
    : null
  const pending = isObject(t.pending) && num(t.pending.id) != null ? { id: num0(t.pending.id), amount: num0(t.pending.amount) } : null
  return {
    today,
    window: {
      isOpen: w.isOpen === true,
      opensOn: str(w.opensOn),
      closesOn: str(w.closesOn),
      nextOpensOn: str(w.nextOpensOn),
      daysUntilOpen: num0(w.daysUntilOpen),
      daysLeft: num0(w.daysLeft),
      message: str(w.message),
    },
    workflowEnabled: raw.workflowEnabled !== false,
    workflowMessage: strOrNull(raw.workflowMessage),
    employeeActive: raw.employeeActive !== false,
    monthlySalary: num(raw.monthlySalary),
    salaryAdvance: {
      canApply: g.canApply === true,
      reason: strOrNull(g.reason),
      percent: num(g.percent) ?? 60,
      limit: num(g.limit),
      deductionMonth: num(g.deductionMonth) ?? tm,
      deductionYear: num(g.deductionYear) ?? ty,
      deductionLabel: str(g.deductionLabel) || monthLabel(num(g.deductionMonth) ?? tm, num(g.deductionYear) ?? ty),
      existing,
    },
    termLoan: {
      canApply: t.canApply === true,
      reason: strOrNull(t.reason),
      minMonths: num(t.minMonths) ?? 1,
      maxMonths: num(t.maxMonths) ?? 12,
      minAmount: num(t.minAmount) ?? 1000,
      maxAmount: num(t.maxAmount),
      firstDeductionMonth: num(t.firstDeductionMonth) ?? nm,
      firstDeductionYear: num(t.firstDeductionYear) ?? ny,
      firstDeductionLabel:
        str(t.firstDeductionLabel) || monthLabel(num(t.firstDeductionMonth) ?? nm, num(t.firstDeductionYear) ?? ny),
      pending,
      activeCount: num0(t.activeCount),
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

/** The headline of the window banner: "Open now: 6 days left", "Opens on 20 Nov: in 5 days", "Open now: last day today". */
export function windowHeadline(w: WindowInfo | null | undefined): string {
  if (!w) return ''
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

/** How far through the waiting period (1st -> 20th) or the open period (20th -> month end) we are, 0-1, for the bar. */
export function windowProgress(w: WindowInfo | null | undefined): number {
  if (!w) return 0
  const end = /^(\d{4})-(\d{2})-(\d{2})/.exec(w.closesOn)
  const lastDay = end ? Number(end[3]) : 30
  const openDays = Math.max(1, lastDay - 19)
  if (w.isOpen) return clamp01((openDays - w.daysLeft + 1) / openDays)
  return clamp01((19 - w.daysUntilOpen + 1) / 19)
}

/** The instant the window changes (closes at the end of `closesOn`, or opens at the start of `opensOn`), factory time
 *  (IST, +05:30). NaN when the dates are missing. */
export function windowDeadline(w: WindowInfo): number {
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

/** The 60% meter: how much of the limit the typed amount uses. `near` from 85%, `over` above the limit. */
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

/** The message under the Salary Advance amount, or null when it can be sent. Same rules and wording as the server. */
export function salaryAdvanceProblem(text: string, limit: number | null | undefined, salary: number | null | undefined, percent = 60): string | null {
  const amount = amountOf(text)
  if (!Number.isFinite(amount)) return 'Enter the amount.'
  if (amount <= 0) return 'The amount must be more than ₹0.'
  if (limit != null && amount > limit) {
    return `The most you can ask for is ${rupees(limit)}${salary ? ` (${percent}% of your monthly salary of ${rupees(salary)})` : ''}.`
  }
  return null
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

/** The message under the Term Loan amount, or null when it can be sent. */
export function termAmountProblem(text: string, minAmount: number, maxAmount?: number | null): string | null {
  const amount = amountOf(text)
  if (!Number.isFinite(amount)) return 'Enter the amount.'
  if (amount < minAmount) return `A Term Loan starts from ${rupees(minAmount)}.`
  if (maxAmount && amount > maxAmount) return `The amount cannot be more than ${rupees(maxAmount)}.`
  return null
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

/** The words on a record's status pill. An approved advance not yet deducted reads "Approved"; once something has been
 *  deducted "Repaying". */
export function statusText(r: { status: string; deductedTotal?: number }): string {
  switch (r.status) {
    case 'pending':
      return 'Waiting for HR'
    case 'rejected':
      return 'Rejected'
    case 'closed':
      return 'Fully repaid'
    default:
      return (r.deductedTotal ?? 0) > 0 ? 'Repaying' : 'Approved'
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
      return { stateLabel: 'Planned (until HR decides)', tone: 'slate', current: false }
    default:
      return { stateLabel: 'Upcoming', tone: 'sapphire', current: false }
  }
}

/** "Deducted from Nov 2026 salary", "To be deducted from Dec 2026 salary". */
export function scheduleTitle(row: Pick<ScheduleRow, 'state' | 'label'>): string {
  return row.state === 'deducted' ? `Deducted from ${row.label} salary` : `${row.label} salary`
}

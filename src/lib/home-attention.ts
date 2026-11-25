// Dashboard: the "Needs your attention" card, the "Last salary" card, the month snapshot and the small date rules the
// Dashboard uses. Pure (no React, no network), tested in home-attention.test.ts. A port of the mobile app's
// src/lib/homeAttention.ts + outpassOpen.ts so both apps word the same things the same way.
//
// Every row comes from an answer another page already relies on; the Dashboard only words it:
//   gate pass open     GET /outpass-requests                 -> Outpass & Tea Break (/employee/outpass)
//   On-Duty running    GET /attendance/geo-punch/status      -> Geo Punch / On-Duty (/employee/attendance-request)
//   pending requests   GET /my/pending-requests              -> My Department Head, requests tab
//   advances open      GET /my/advances/eligibility          -> Advances & Settlement (/employee/settlement)
//   Casual Leave left  GET /casual-leaves/my-eligibility     -> Casual Leave (staff only, last week of the month)
//   last salary        GET /my/salary-insights               -> Salary Slips
// A source that failed or is still loading simply gives no row: the Dashboard never shows an error for these extras.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

// ── dates ─────────────────────────────────────────────────────────────────────

/** A "yyyy-MM-dd" date as local midnight (new Date("yyyy-MM-dd") would read it as UTC midnight). null when not a date. */
export function parseLocalDate(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** "yyyy-MM-dd" of a local date. */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "yyyy-MM" of a local date. */
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Whole calendar days from today to `value` ("yyyy-MM-dd"); 0 for today or a past day; null when not a date. */
export function calendarDaysUntil(value: string | null | undefined, now: Date): number | null {
  const target = parseLocalDate(value)
  if (!target) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Math.round absorbs the hour a daylight-saving change adds or removes.
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000))
}

/** "Today" / "Tomorrow" / "In 5 days". */
export function inDaysText(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

/** Days left in the month after today (0 on the last day). */
export function daysLeftInMonth(now: Date): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return last - now.getDate()
}

/** "3:30 PM" in this computer's time, from an ISO date-time. '' for a missing or bad value. */
export function clockText(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ── the open gate pass ───────────────────────────────────────────────────────

export interface OpenPassInput {
  id: number | string
  status: string
  approvedAt?: string | null
  expiresAt?: string | null
  exitedAt?: string | null
  enteredAt?: string | null
  /** Not on every server: without it the pass has no return countdown. */
  expectedReturnAt?: string | null
  createdAt: string
}

export type OpenPassKind = 'out' | 'ready'

function ms(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

/** 'out' = through the gate and not back yet; 'ready' = approved, unused, exit window still open; null = not open. */
export function openKind(p: OpenPassInput, nowMs: number): OpenPassKind | null {
  if (p.status !== 'approved') return null
  if (p.exitedAt && !p.enteredAt) return 'out'
  if (p.exitedAt) return null
  const exp = ms(p.expiresAt)
  return exp != null && exp > nowMs ? 'ready' : null
}

/** The pass to show, or null when nothing is open. An "out" pass wins over a "ready" one; within a kind the newest. */
export function pickOpenPass<T extends OpenPassInput>(items: readonly T[] | null | undefined, nowMs: number): T | null {
  let best: { item: T; rank: number; at: number } | null = null
  for (const item of items ?? []) {
    const kind = openKind(item, nowMs)
    if (!kind) continue
    const rank = kind === 'out' ? 2 : 1
    const at = ms(kind === 'out' ? item.exitedAt : item.approvedAt) ?? ms(item.createdAt) ?? 0
    if (!best || rank > best.rank || (rank === best.rank && at > best.at)) best = { item, rank, at }
  }
  return best?.item ?? null
}

export type OpenPassClock =
  | { kind: 'out'; elapsedMs: number; returnInMs: number | null; overdue: boolean; progress: number | null }
  | { kind: 'ready'; exitWindowMs: number; progress: number }

const EXIT_WINDOW_MS = 60 * 60 * 1000

export function openPassClock(p: OpenPassInput, nowMs: number): OpenPassClock | null {
  const kind = openKind(p, nowMs)
  if (kind === 'out') {
    const out = ms(p.exitedAt) ?? nowMs
    const back = ms(p.expectedReturnAt)
    const elapsedMs = Math.max(0, nowMs - out)
    if (back == null || back <= out) return { kind, elapsedMs, returnInMs: null, overdue: false, progress: null }
    const returnInMs = back - nowMs
    return { kind, elapsedMs, returnInMs, overdue: returnInMs < 0, progress: Math.min(1, Math.max(0, elapsedMs / (back - out))) }
  }
  if (kind === 'ready') {
    const exp = ms(p.expiresAt) ?? nowMs
    const exitWindowMs = Math.max(0, exp - nowMs)
    return { kind, exitWindowMs, progress: Math.min(1, Math.max(0, 1 - exitWindowMs / EXIT_WINDOW_MS)) }
  }
  return null
}

/** "1 h 05 min", "12 min", "45 s": a stretch of time in plain words. */
export function formatSpan(spanMs: number): string {
  const total = Math.max(0, Math.floor(Math.abs(spanMs) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m > 0) return `${m} min`
  return `${s} s`
}

/** "mm:ss" (or "h:mm:ss") for a ticking countdown. */
export function formatTicker(spanMs: number): string {
  const total = Math.max(0, Math.floor(Math.abs(spanMs) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

// ── the attention rows ───────────────────────────────────────────────────────

/** Sets the colour of the row. urgent = rose, active = sapphire, waiting = amber, money = emerald, leave = violet. */
export type AttentionTone = 'urgent' | 'active' | 'waiting' | 'money' | 'leave'
export type AttentionKey = 'outpass' | 'onDuty' | 'pending' | 'advance' | 'casualLeave'

export interface AttentionItem {
  key: AttentionKey
  tone: AttentionTone
  title: string
  detail: string
  /** Where a click goes (an app route). */
  href: string
  /** What a screen reader says for the whole row. */
  a11y: string
  /** Lower comes first. */
  rank: number
  /** 0..1 for a small progress bar (the gate pass), or null for none. */
  progress: number | null
}

const RANK: Record<AttentionKey, number> = { outpass: 0, onDuty: 1, pending: 2, advance: 3, casualLeave: 4 }

/** Routes the rows open. The requests tab lives on the My Department Head page. */
export const ATTENTION_HREF: Record<AttentionKey, string> = {
  outpass: '/employee/outpass',
  onDuty: '/employee/attendance-request',
  pending: '/employee/hod?tab=requests',
  advance: '/employee/settlement',
  casualLeave: '/employee/casual-leave',
}

function item(fields: Omit<AttentionItem, 'a11y' | 'rank' | 'href' | 'progress'> & { a11y?: string; progress?: number | null }): AttentionItem {
  return {
    ...fields,
    href: ATTENTION_HREF[fields.key],
    rank: RANK[fields.key],
    progress: fields.progress ?? null,
    a11y: fields.a11y ?? `${fields.title}. ${fields.detail}`,
  }
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

/** The open gate pass as a row, worded for this moment (the card re-asks every second for its live timer). */
export function outpassAttention(pass: OpenPassInput | null | undefined, nowMs: number): AttentionItem | null {
  if (!pass) return null
  const clock = openPassClock(pass, nowMs)
  if (!clock) return null
  if (clock.kind === 'ready') {
    return item({
      key: 'outpass',
      tone: 'active',
      title: 'Gate pass ready',
      detail: `Show the QR at the gate: ${formatTicker(clock.exitWindowMs)} left to go out`,
      a11y: `Gate pass ready. Show the QR at the gate within ${formatSpan(clock.exitWindowMs)}.`,
      progress: clock.progress,
    })
  }
  if (clock.returnInMs == null) {
    return item({ key: 'outpass', tone: 'active', title: 'Out on a gate pass', detail: `Out for ${formatSpan(clock.elapsedMs)}` })
  }
  const back = clockText(pass.expectedReturnAt)
  if (clock.overdue) {
    return item({
      key: 'outpass',
      tone: 'urgent',
      title: 'Return time passed',
      detail: `You were due back at ${back}: late by ${formatTicker(-clock.returnInMs)}`,
      a11y: `Return time passed. You were due back at ${back}, ${formatSpan(-clock.returnInMs)} ago.`,
      progress: 1,
    })
  }
  return item({
    key: 'outpass',
    tone: 'active',
    title: 'Out on a gate pass',
    detail: `Back by ${back}: ${formatTicker(clock.returnInMs)} left`,
    a11y: `Out on a gate pass. Back by ${back}, ${formatSpan(clock.returnInMs)} left.`,
    progress: clock.progress,
  })
}

export interface OnDutyLike {
  status: string
  destination?: string | null
  isProvisional?: boolean
  startedAt?: string | null
}

/** A running On-Duty session (submitted or approved, not ended), or null. */
export function onDutyAttention(session: OnDutyLike | null | undefined): AttentionItem | null {
  if (!session) return null
  if (!['active', 'pending_hod', 'pending_hr'].includes(session.status)) return null
  const parts: string[] = []
  const where = (session.destination ?? '').trim()
  if (where) parts.push(where)
  const started = clockText(session.startedAt)
  if (started) parts.push(`started ${started}`)
  if (session.isProvisional || session.status === 'pending_hod' || session.status === 'pending_hr') parts.push('waiting for approval')
  return item({
    key: 'onDuty',
    tone: 'active',
    title: 'On-Duty in progress',
    detail: parts.length ? capitalise(parts.join(' · ')) : 'Open it to add your punches',
  })
}

// The reply of GET /my/pending-requests, read defensively (only what the Dashboard needs).
export interface PendingRequestLite {
  module: string
  moduleLabel: string
  title: string
  stage: string
  submittedAt: string | null
}

export function readPendingRequests(raw: unknown): PendingRequestLite[] | null {
  if (!isObject(raw) || !Array.isArray(raw.items)) return null
  const out: PendingRequestLite[] = []
  for (const r of raw.items) {
    if (!isObject(r)) continue
    const module = str(r.module)
    if (!module) continue
    out.push({
      module,
      moduleLabel: str(r.moduleLabel) || 'Request',
      title: str(r.title),
      stage: str(r.stage) || 'Waiting for a decision',
      submittedAt: str(r.submittedAt) || null,
    })
  }
  return out
}

/** "Sent just now" / "Waiting 12 min" / "Waiting 3 h" / "Waiting 2 days". '' for a missing or bad date. */
export function waitedText(submittedAt: string | null | undefined, nowMs: number): string {
  if (!submittedAt) return ''
  const t = new Date(submittedAt).getTime()
  if (Number.isNaN(t)) return ''
  const minutes = Math.max(0, Math.floor((nowMs - t) / 60000))
  if (minutes < 60) return minutes < 2 ? 'Sent just now' : `Waiting ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Waiting ${hours} h`
  const days = Math.floor(hours / 24)
  return `Waiting ${days} day${days === 1 ? '' : 's'}`
}

function stamp(iso: string | null | undefined): number {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
}

/** Requests still waiting for an answer, or null when there are none. */
export function pendingRequestsAttention(items: readonly PendingRequestLite[] | null | undefined, nowMs: number): AttentionItem | null {
  const list = items ?? []
  if (list.length === 0) return null
  const n = list.length
  let detail: string
  if (n === 1) {
    detail = `${list[0].moduleLabel}: ${list[0].stage}`
  } else {
    const oldest = [...list].sort((a, b) => stamp(a.submittedAt) - stamp(b.submittedAt))[0]
    const since = waitedText(oldest.submittedAt, nowMs)
    detail = since ? `Oldest: ${oldest.moduleLabel}, ${since.charAt(0).toLowerCase()}${since.slice(1)}` : 'See where each one stands'
  }
  return item({
    key: 'pending',
    tone: 'waiting',
    title: n === 1 ? '1 request waiting for an answer' : `${n} requests waiting for an answer`,
    detail,
  })
}

// The reply of GET /my/advances/eligibility (only what the Dashboard needs).
export interface AdvanceEligibilityLite {
  /** The Salary Advance window (`windows.general`), else (an older server) the one window both forms shared. */
  window: { isOpen: boolean; closesOn: string; daysLeft: number }
  /** Each form has its own window (2026-11-25): a Salary Advance the 20th to the 22nd, a Term Loan any day. */
  separate: boolean
  workflowEnabled: boolean
  employeeActive: boolean
  salaryAdvance: boolean
  termLoan: boolean
}

export function readAdvanceEligibility(raw: unknown): AdvanceEligibilityLite | null {
  if (!isObject(raw) || !isObject(raw.window)) return null
  const general = isObject(raw.windows) && isObject(raw.windows.general) ? raw.windows.general : null
  const w = general ?? raw.window
  return {
    window: { isOpen: w.isOpen === true, closesOn: str(w.closesOn), daysLeft: num(w.daysLeft) ?? 0 },
    separate: general !== null,
    workflowEnabled: raw.workflowEnabled !== false,
    employeeActive: raw.employeeActive !== false,
    salaryAdvance: isObject(raw.salaryAdvance) && raw.salaryAdvance.canApply === true,
    termLoan: isObject(raw.termLoan) && raw.termLoan.canApply === true,
  }
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "20 Nov" from "2026-11-20" (never shifted by time zone). '' when not a date. */
export function dayMonth(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m) return ''
  return `${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]}`
}

/**
 * "Salary Advance applications are open" while its window is open AND this employee can apply; else null. Owner
 * 2026-11-25: a Salary Advance only from the 20th to the 22nd, a Term Loan on any day - so the Term Loan, always open, is
 * never news on the Dashboard and only the Salary Advance's 3 days are ("Open until 22 Nov"). An older server (no
 * `windows`) had one window, the 20th to the month end, for both forms: "Advance & loan applications are open".
 */
export function advanceAttention(e: AdvanceEligibilityLite | null | undefined): AttentionItem | null {
  if (!e?.window.isOpen) return null
  if (!e.workflowEnabled || !e.employeeActive) return null
  const loan = e.termLoan && !e.separate
  if (!e.salaryAdvance && !loan) return null
  const what = e.salaryAdvance && loan ? 'Advance & loan applications' : e.salaryAdvance ? 'Salary Advance applications' : 'Term Loan applications'
  const until = dayMonth(e.window.closesOn)
  const detail = e.window.daysLeft <= 1 ? 'Open today only: last day' : until ? `Open until ${until}` : `Open for ${e.window.daysLeft} more days`
  return item({ key: 'advance', tone: 'money', title: `${what} are open`, detail })
}

/** One month of GET /casual-leaves/my-eligibility. `left` is absent on an older server; `rule` / `remaining` too (2026-11-02). */
export interface CLMonthLike {
  month: string
  label?: string
  eligible: boolean
  left?: 'full' | 'one_half' | 'nothing' | string | null
  rule?: 'yearly_balance' | 'one_per_month' | string | null
  remaining?: number | null
}

/** How many days before the month ends the Dashboard starts pointing at unused Casual Leave. */
export const CL_REMIND_DAYS = 7

/** 1 -> "1 day", 0.5 -> "½ day", 2.5 -> "2½ days". */
function clDaysText(days: number): string {
  const whole = Math.floor(days)
  const num = days - whole >= 0.5 ? (whole ? `${whole}½` : '½') : String(whole)
  return `${num} ${days > 0 && days <= 1 ? 'day' : 'days'}`
}

/**
 * Unused Casual Leave, only for staff (the caller checks) and only in a month's last week.
 *   Old rule (one per month): this month's Casual Leave still unused -> "October's Casual Leave not used yet".
 *   Yearly balance (2026-11-02): unused days carry over month to month, so nothing is lost at a month's end; only in the
 *   last week of December (they lapse on 31 Dec) -> "Your 2026 Casual Leave lapses soon · 3 days left".
 */
export function casualLeaveAttention(months: readonly CLMonthLike[] | null | undefined, now: Date): AttentionItem | null {
  const left = daysLeftInMonth(now)
  if (left >= CL_REMIND_DAYS) return null
  const m = (months ?? []).find((x) => x.month === monthKeyOf(now))
  if (!m || !m.eligible) return null
  if (m.rule === 'yearly_balance') {
    const remaining = typeof m.remaining === 'number' && Number.isFinite(m.remaining) ? m.remaining : 0
    if (now.getMonth() !== 11 || remaining <= 0) return null
    const when = left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${left} days`
    return item({
      key: 'casualLeave',
      tone: 'leave',
      title: `Your ${now.getFullYear()} Casual Leave lapses soon`,
      detail: `${clDaysText(remaining)} left · unused days lapse on 31 Dec (${when})`,
    })
  }
  // An older server sends no `left`: an eligible month there means nothing was taken yet.
  const remaining = m.left === 'one_half' ? 'one_half' : m.left === 'nothing' ? 'nothing' : 'full'
  if (remaining === 'nothing') return null
  const name = (m.label || '').split(' ')[0] || 'This month'
  const what = remaining === 'full' ? '1 day' : 'Half a day'
  const ends = left === 0 ? 'the month ends today' : left === 1 ? 'the month ends tomorrow' : `the month ends in ${left} days`
  return item({ key: 'casualLeave', tone: 'leave', title: `${name}'s Casual Leave not used yet`, detail: `${what} left · ${ends}` })
}

/** The rows in the order they are shown (the most time-critical first). */
export function sortAttention(items: readonly (AttentionItem | null | undefined)[]): AttentionItem[] {
  return items.filter((i): i is AttentionItem => !!i).sort((a, b) => a.rank - b.rank)
}

// ── the "Last salary" card ───────────────────────────────────────────────────

export interface SalaryPeriodLite {
  slipId: number
  year: number
  month: number
  periodLabel: string
  /** null = production pay (no fixed salary to compare with). */
  allocated: number | null
  earnedGross: number
  attendanceLoss: number | null
  lateDeduction: number | null
  netPayable: number
  hrChanged: boolean
  end: string
}

function readPeriod(raw: unknown): SalaryPeriodLite | null {
  if (!isObject(raw)) return null
  const slipId = num(raw.slipId)
  if (slipId == null) return null
  const p = isObject(raw.period) ? raw.period : {}
  const label = str(p.label) || 'Pay period'
  const cycle = str(p.cycleLabel)
  const payroll = isObject(raw.payroll) ? raw.payroll : null
  const hrChanged = payroll
    ? typeof payroll.hrChanged === 'boolean'
      ? payroll.hrChanged
      : (num(payroll.bonus) ?? 0) !== 0 || (num(payroll.deductionChange) ?? 0) !== 0
    : false
  return {
    slipId,
    year: num(raw.year) ?? 0,
    month: num(raw.month) ?? 0,
    periodLabel: cycle ? `${label} · ${cycle}` : label,
    allocated: num(raw.allocated),
    earnedGross: num(raw.earnedGross) ?? 0,
    attendanceLoss: num(raw.attendanceLoss),
    lateDeduction: num(raw.lateDeduction),
    netPayable: num(raw.netPayable) ?? 0,
    hrChanged,
    end: str(p.end),
  }
}

/** The pay periods of GET /my/salary-insights, or null when the reply is not one (an older server's 404 page). */
export function readSalaryPeriods(raw: unknown): SalaryPeriodLite[] | null {
  if (!isObject(raw) || !Array.isArray(raw.periods)) return null
  return raw.periods.map(readPeriod).filter((p): p is SalaryPeriodLite => p !== null)
}

export interface LastSalary {
  slipId: number
  periodLabel: string
  net: number
  /** What attendance cost (null = nothing to show as an amount). */
  lossAmount: number | null
  /** 'loss' = an amount was lost; 'none' = nothing lost; 'neutral' = cannot be worked out (production, no late cut). */
  lossKind: 'loss' | 'none' | 'neutral'
  /** 'attendance' or 'late' (production pay only shows a late deduction). */
  lossLabel: 'attendance' | 'late'
  /** earned / allocated, 0..1, for the paid-vs-allocated bar; null without an allocated salary. */
  paidRatio: number | null
  allocated: number | null
  earned: number
  hrChanged: boolean
}

/** The newest pay period (by year, month, then period end), or null when there is no slip yet. */
export function lastSalary(periods: readonly SalaryPeriodLite[] | null | undefined): LastSalary | null {
  const list = [...(periods ?? [])]
  if (!list.length) return null
  list.sort((a, b) => a.year - b.year || a.month - b.month || a.end.localeCompare(b.end) || a.slipId - b.slipId)
  const p = list[list.length - 1]
  let lossAmount: number | null = null
  let lossKind: LastSalary['lossKind'] = 'neutral'
  let lossLabel: LastSalary['lossLabel'] = 'attendance'
  if (p.allocated != null) {
    const loss = p.attendanceLoss ?? 0
    if (loss > 0) {
      lossAmount = loss
      lossKind = 'loss'
    } else {
      lossKind = 'none'
    }
  } else if (p.lateDeduction && p.lateDeduction > 0) {
    lossAmount = p.lateDeduction
    lossKind = 'loss'
    lossLabel = 'late'
  }
  const ratio = p.allocated && p.allocated > 0 ? p.earnedGross / p.allocated : null
  return {
    slipId: p.slipId,
    periodLabel: p.periodLabel,
    net: p.netPayable,
    lossAmount,
    lossKind,
    lossLabel,
    paidRatio: ratio == null || !Number.isFinite(ratio) ? null : Math.max(0, Math.min(1, ratio)),
    allocated: p.allocated,
    earned: p.earnedGross,
    hrChanged: p.hrChanged,
  }
}

// ── the month snapshot ───────────────────────────────────────────────────────

export interface DayLite {
  date: string
  status: string
}

export interface MonthSnapshot {
  /** Days so far this month that were working days (not holidays, not future). */
  workingDays: number
  /** Present days, a half day counting 0.5. */
  presentDays: number
  halfDays: number
  absentDays: number
  leaveDays: number
  /** presentDays / workingDays as a whole percent; null with no working day yet. */
  attendancePercent: number | null
}

/** This month so far, from the month's attendance records (one per day) and today's "yyyy-MM-dd". */
export function monthSnapshot(records: readonly DayLite[] | null | undefined, todayKey: string): MonthSnapshot {
  let workingDays = 0
  let present = 0
  let half = 0
  let absent = 0
  let leave = 0
  for (const r of records ?? []) {
    if (r.date > todayKey || r.status === 'future' || r.status === 'holiday' || r.status === 'no_record') continue
    workingDays += 1
    if (r.status === 'present') present += 1
    else if (r.status === 'half_shift') half += 1
    else if (r.status === 'absent') absent += 1
    else if (r.status === 'on_leave') leave += 1
  }
  const presentDays = present + half * 0.5
  return {
    workingDays,
    presentDays,
    halfDays: half,
    absentDays: absent,
    leaveDays: leave,
    attendancePercent: workingDays ? Math.round((presentDays / workingDays) * 100) : null,
  }
}

/** 21 -> "21", 21.5 -> "21.5": day counts with a half. */
export function dayCountText(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 2) / 2
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

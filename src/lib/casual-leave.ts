// Casual Leave (CL): the rules the app shows, kept pure so they are tested once (casual-leave.test.ts). Mirrors the
// mobile app's src/lib/casualLeave.ts so both apps word Casual Leave the same way.
//
// Owner 2026-10-31: the month's one Casual Leave is EITHER one full day OR two half-days (first / second half of the
// shift) on any dates of that month; both halves may even be the same date. A pending or approved full day blocks the
// halves and the other way round; the same date cannot hold the same half twice. The server decides
// (backend api/casual_leave_views.py); this only reads back what it said and words it for the employee.
//
// Owner 2026-11-02: a YEARLY BALANCE replaced that for every date from the cut-over (2 Nov 2026): 12 days a calendar
// year, a half day counts 0.5, any number of Casual Leave in a month while the balance lasts; waiting requests hold their
// days, a rejected one gives them back; unused days lapse on 31 December and a fresh 12 start on 1 January. Everyone
// started fresh at 12 on the cut-over day (Casual Leave dated earlier is never counted and kept the old rule). On one
// date: never the same half twice, never a full day over a half. The server sends `balance`, `rule`, `monthsUsage` and,
// per month, `rule` / `remaining` / `usedFullDates`; an older server sends none of them and the old wording stays.

import type { CasualLeaveBalance, CasualLeaveEligibility } from '../types/index.ts'

/**
 * Whether the employee can apply for casual leave right now. With per-month verdicts (the previous month while the
 * grace days are open, then the current month) any eligible month is enough; an older backend sends none, and then the
 * overall `eligible` flag decides on its own. The Casual Leave page and the Attendance page both read it from here, so
 * their badges cannot disagree.
 */
export function isCasualLeaveEligible(e: CasualLeaveEligibility): boolean {
  return e.months && e.months.length > 0 ? e.months.some((m) => m.eligible) : e.eligible
}

export type CLPortion = 'full' | 'first_half' | 'second_half'
export type CLStatus = 'pending' | 'approved' | 'rejected'
/** What of a month's Casual Leave is left, as GET /casual-leaves/my-eligibility says it. */
export type CLLeft = 'full' | 'one_half' | 'nothing'

export const CL_PORTIONS: readonly CLPortion[] = ['full', 'first_half', 'second_half']

export const PORTION_LABEL: Record<CLPortion, string> = {
  full: 'Full day',
  first_half: 'First half',
  second_half: 'Second half',
}

/** The words on a request card / list row. */
export const PORTION_LONG: Record<CLPortion, string> = {
  full: 'Full day',
  first_half: 'Half day (first half)',
  second_half: 'Half day (second half)',
}

export const PORTION_DAYS: Record<CLPortion, number> = { full: 1, first_half: 0.5, second_half: 0.5 }

export function asPortion(value: unknown): CLPortion {
  return value === 'first_half' || value === 'second_half' ? value : 'full'
}

export function asStatus(value: unknown): CLStatus {
  const s = String(value ?? '').toLowerCase()
  return s === 'approved' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending'
}

/** 1 -> "1 day", 0.5 -> "½ day", 1.5 -> "1½ days", 0 -> "0 days". */
export function daysText(days: number): string {
  const whole = Math.floor(days)
  const half = days - whole >= 0.5
  const num = half ? (whole ? `${whole}½` : '½') : String(whole)
  return `${num} ${days > 0 && days <= 1 ? 'day' : 'days'}`
}

/** "13:00" -> "1:00 PM"; anything else unchanged. */
export function clock12(hhmm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''))
  if (!m) return String(hhmm ?? '')
  const h = Number(m[1])
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${suffix}`
}

export type ShiftHalves = {
  name?: string | null
  start: string
  end: string
  firstHalfEnd: string
  secondHalfStart: string
}

/** What each choice means in clock time, when the shift is known: "9:00 AM - 1:00 PM off, paid. Come in for ...". */
export function portionMeaning(portion: CLPortion, shift: ShiftHalves | null | undefined): string {
  if (!shift) {
    if (portion === 'full') return 'The whole day off, paid.'
    if (portion === 'first_half') return 'The morning half off, paid. Work the second half as usual.'
    return 'The afternoon half off, paid. Work the first half as usual.'
  }
  const start = clock12(shift.start)
  const end = clock12(shift.end)
  if (portion === 'full') return `The whole shift off (${start} - ${end}), paid.`
  if (portion === 'first_half') {
    return `${start} - ${clock12(shift.firstHalfEnd)} off, paid. Come in for the second half from ${clock12(shift.secondHalfStart)}.`
  }
  return `${clock12(shift.secondHalfStart)} - ${end} off, paid. Work the first half from ${start}.`
}

// ─── One month, as the server reports it ───

export type CLPart = { id?: number | string; date: string; portion: CLPortion; status: CLStatus }

/** "yearly_balance" (2026-11-02, any Casual Leave while the year's balance lasts) or "one_per_month" (the old rule). */
export type CLRule = 'yearly_balance' | 'one_per_month'

export type CLMonth = {
  /** 'yyyy-MM' */
  month: string
  label: string
  eligible: boolean
  reason: string | null
  /** Old rule: what of the month is left. Yearly rule: what of the YEAR's balance is left ("full" = a day or more). */
  left: CLLeft
  /** The pending / approved requests of the month. */
  usedParts: CLPart[]
  /** Which half of which date is already asked for (yearly rule: also a Casual Leave HR proposed that still waits). */
  usedHalves: { date: string; portion: CLPortion }[]
  /** 2026-11-02; absent on an older server (then the old rule). */
  rule?: CLRule | null
  /** Yearly rule: the days of the year's balance still free. */
  remaining?: number | null
  /** Yearly rule: the dates already taken as a full day (nothing more fits on them). */
  usedFullDates?: string[]
}

export type CLBalance = CasualLeaveBalance

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)

/** The `balance` block of GET /casual-leaves/my-eligibility (or /history), checked; null when absent (older server). */
export function readBalance(raw: unknown): CLBalance | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const total = num(r.total)
  const remaining = num(r.remaining)
  const year = num(r.year)
  if (total == null || remaining == null || year == null) return null
  return {
    total,
    used: num(r.used) ?? 0,
    pending: num(r.pending) ?? 0,
    remaining,
    year,
    since: isDate(r.since) ? r.since.slice(0, 10) : null,
    endsOn: isDate(r.endsOn) ? r.endsOn.slice(0, 10) : `${year}-12-31`,
    cutOver: isDate(r.cutOver) ? r.cutOver.slice(0, 10) : '',
    tracked: r.tracked !== false,
  }
}

export function asRule(value: unknown): CLRule | null {
  return value === 'yearly_balance' || value === 'one_per_month' ? value : null
}

/** Whether the yearly balance is what the employee should see (a newer server, a year with a balance kept). */
export function isYearlyBalance(e: { balance?: CLBalance | null; rule?: string | null } | null | undefined): e is { balance: CLBalance; rule?: string | null } {
  return !!e?.balance && e.balance.tracked && e.rule !== 'one_per_month'
}

/** 'yyyy-MM' of a date in the device's time. */
export const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-10-05" -> "5 Oct". */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]}`
}

/** "2026-10-05" -> "Mon, 5 Oct 2026" (read without time-zone shifts). */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
  return `${day}, ${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]} ${m[1]}`
}

export type MonthCardState = {
  tone: 'open' | 'half' | 'used' | 'closed'
  title: string
  detail: string
}

function partText(p: CLPart): string {
  const what = p.portion === 'full' ? 'Full day' : PORTION_LABEL[p.portion]
  return `${what} on ${shortDate(p.date)} (${p.status === 'approved' ? 'approved' : 'waiting'})`
}

/** This month's Casual Leave in a title and a sentence, for the Leave page card and the Casual Leave page. */
export function monthCardState(month: CLMonth | undefined, fallback?: { eligible?: boolean; reason?: string | null }): MonthCardState {
  if (!month) {
    // an older server: only the single `eligible` flag is known
    if (fallback?.eligible === false) {
      return { tone: 'closed', title: 'Not available', detail: fallback.reason || 'Casual Leave is not available this month.' }
    }
    return { tone: 'open', title: 'Available this month', detail: 'One day of Casual Leave a month.' }
  }
  const parts = month.usedParts
  if (month.left === 'full' && month.eligible) {
    return { tone: 'open', title: 'Full day available', detail: 'Take one full day, or two half-days, this month.' }
  }
  if (month.left === 'one_half' && month.eligible) {
    return {
      tone: 'half',
      title: 'One half-day left',
      detail: parts.length ? `${parts.map(partText).join(' · ')}. You can still take one half-day.` : 'You can still take one half-day.',
    }
  }
  if (parts.length) {
    return { tone: 'used', title: 'Used this month', detail: parts.map(partText).join(' · ') }
  }
  return { tone: 'closed', title: 'Not available', detail: month.reason || 'Casual Leave is not available this month.' }
}

// ─── The yearly balance (2026-11-02) ───

/** 11 -> "11", 10.5 -> "10½", 0.5 -> "½", 0 -> "0". */
export function halfNum(n: number): string {
  const r = Math.round(n * 2) / 2
  const whole = Math.floor(r)
  return r - whole >= 0.5 ? (whole ? `${whole}½` : '½') : String(whole)
}

/** "11 of 12 CL left in 2026". */
export function balanceHeadline(b: Pick<CLBalance, 'remaining' | 'total' | 'year'>): string {
  return `${halfNum(b.remaining)} of ${halfNum(b.total)} CL left in ${b.year}`
}

/** "11 of 12 CL left in 2026 · resets on 1 Jan" (unused days lapse on 31 December; a fresh 12 start on 1 January). */
export function balanceLine(b: Pick<CLBalance, 'remaining' | 'total' | 'year'>): string {
  return `${balanceHeadline(b)} · resets on 1 Jan`
}

/** "1 day taken · ½ day waiting for approval" (only what is there); "Nothing taken yet" for a fresh balance. */
export function balanceBreakdown(b: Pick<CLBalance, 'used' | 'pending'>): string {
  const parts = [b.used > 0 ? `${daysText(b.used)} taken` : null, b.pending > 0 ? `${daysText(b.pending)} waiting for approval` : null].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Nothing taken yet'
}

/** "2 Nov 2026" when the balance did not start on 1 January (the cut-over year), else null. */
export function balanceSinceDate(b: Pick<CLBalance, 'since' | 'year'>): string | null {
  if (!b.since || b.since <= `${b.year}-01-01`) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(b.since)
  return m ? `${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]} ${m[1]}` : null
}

/** "Counted from 2 Nov 2026" (see balanceSinceDate), else null. */
export function balanceSinceText(b: Pick<CLBalance, 'since' | 'year'>): string | null {
  const d = balanceSinceDate(b)
  return d ? `Counted from ${d}` : null
}

/**
 * The balance card (Casual Leave page, Leave page card) under the yearly rule: how much is left in the year and what can
 * be taken. `month` = this month's answer from the server (its `eligible` / `reason` say whether anything else stops the
 * employee, e.g. under six months of service); `fallback` = the overall answer when the server sends no months.
 */
export function balanceCardState(
  b: CLBalance,
  month: CLMonth | undefined,
  fallback?: { eligible?: boolean; reason?: string | null },
): MonthCardState {
  const eligible = month ? month.eligible : fallback?.eligible !== false
  const reason = (month ? month.reason : fallback?.reason) || null
  const waiting = b.pending > 0 ? ` ${daysText(b.pending)} ${b.pending <= 1 ? 'is' : 'are'} waiting for approval.` : ''
  if (b.remaining <= 0) {
    return {
      tone: 'used',
      title: `No CL left in ${b.year}`,
      detail: `All ${halfNum(b.total)} days of ${b.year} are taken or waiting for approval. A fresh ${halfNum(b.total)} start on 1 Jan.`,
    }
  }
  if (!eligible) {
    return { tone: 'closed', title: 'Not available', detail: reason || 'Casual Leave is not available to you right now.' }
  }
  if (b.remaining < 1) {
    return {
      tone: 'half',
      title: balanceHeadline(b),
      detail: `Only a half-day is left this year.${waiting} A fresh ${halfNum(b.total)} start on 1 Jan.`,
    }
  }
  return {
    tone: 'open',
    title: balanceHeadline(b),
    detail: `Take a full day or a half-day on any date while it lasts.${waiting} Unused days lapse on 31 Dec; a fresh ${halfNum(b.total)} start on 1 Jan.`,
  }
}

/** The page's state card: the yearly balance when the server keeps one, else this month (the old one-per-month rule). */
export function clCardState(
  e: { balance?: CLBalance | null; rule?: string | null; months?: CLMonth[]; eligible: boolean; reason?: string | null },
  today: Date,
): MonthCardState {
  const month = thisMonthOf(e.months, today)
  return isYearlyBalance(e) ? balanceCardState(e.balance, month, { eligible: e.eligible, reason: e.reason }) : monthCardState(month, { eligible: e.eligible, reason: e.reason })
}

/** The month of the server's list for this device's month (else its last one, the newest open month). */
export function thisMonthOf(months: readonly CLMonth[] | undefined, today: Date): CLMonth | undefined {
  if (!months?.length) return undefined
  return months.find((m) => m.month === monthKeyOf(today)) ?? months[months.length - 1]
}

/** The month of the server's list a date belongs to (undefined when it is not one the employee may pick now). */
export function monthOfDate(months: readonly CLMonth[] | undefined, date: string): CLMonth | undefined {
  return months?.find((m) => m.month === date.slice(0, 7))
}

/** Why a picked date's month cannot take Casual Leave, or null (also null without per-month answers). */
export function monthBlock(months: readonly CLMonth[] | undefined, date: string): string | null {
  const m = monthOfDate(months, date)
  if (!m || (m.eligible && m.left !== 'nothing')) return null
  if (m.reason) return m.reason
  return m.rule === 'yearly_balance' ? `No Casual Leave left for ${m.month.slice(0, 4)}.` : `Casual Leave for ${m.label} is already used.`
}

/** The date the apply form starts on: today when this month is still open, else the first day of an open month. */
export function defaultApplyDate(today: Date, months: readonly CLMonth[] | undefined): string {
  const t = `${monthKeyOf(today)}-${String(today.getDate()).padStart(2, '0')}`
  if (!months?.length || !monthBlock(months, t)) return t
  const open = months.find((m) => m.eligible && m.left !== 'nothing')
  return open ? `${open.month}-01` : t
}

export type PortionChoice = { enabled: boolean; why: string | null }

/** Which of Full day / First half / Second half may be asked for on `date`, and why not. With no month from the server
 *  (an older one) everything is offered and the server answers on Submit. */
export function portionChoices(month: CLMonth | undefined, date: string): Record<CLPortion, PortionChoice> {
  const open: PortionChoice = { enabled: true, why: null }
  if (!month) return { full: open, first_half: open, second_half: open }
  const yearly = month.rule === 'yearly_balance'
  if (!month.eligible || month.left === 'nothing') {
    const why = month.reason || (yearly ? `No Casual Leave left for ${month.month.slice(0, 4)}.` : `Casual Leave for ${month.label} is used.`)
    const shut: PortionChoice = { enabled: false, why }
    return { full: shut, first_half: shut, second_half: shut }
  }
  if (yearly) {
    // The yearly balance (2026-11-02): any date while the balance lasts. On one date never the same half twice and never
    // a full day over a half (or anything over a full day); a full day needs a whole day left.
    const day = shortDate(date)
    if ((month.usedFullDates ?? []).includes(date)) {
      const full: PortionChoice = { enabled: false, why: `${day} is already a full day of Casual Leave. Choose another date.` }
      return { full, first_half: full, second_half: full }
    }
    const taken = (portion: CLPortion) => month.usedHalves.some((h) => h.date === date && h.portion === portion)
    const halfLeft = month.left === 'one_half' || (month.remaining != null && month.remaining < 1)
    const half = (portion: CLPortion): PortionChoice =>
      taken(portion) ? { enabled: false, why: `The ${portion === 'first_half' ? 'first' : 'second'} half of ${day} is already asked for.` } : open
    return {
      full: taken('first_half') || taken('second_half')
        ? { enabled: false, why: `Half of ${day} is already asked for, so a full day cannot be added. Choose the other half or another date.` }
        : halfLeft
          ? { enabled: false, why: `Only half a day of Casual Leave is left for ${month.month.slice(0, 4)}.` }
          : open,
      first_half: half('first_half'),
      second_half: half('second_half'),
    }
  }
  if (month.left === 'full') return { full: open, first_half: open, second_half: open }
  const taken = (portion: CLPortion) => month.usedHalves.some((h) => h.date === date && h.portion === portion)
  const half = (portion: CLPortion): PortionChoice =>
    taken(portion)
      ? { enabled: false, why: `The ${portion === 'first_half' ? 'first' : 'second'} half of ${shortDate(date)} is already asked for.` }
      : open
  return {
    full: { enabled: false, why: 'Half a day is already used this month, so only one half-day is left.' },
    first_half: half('first_half'),
    second_half: half('second_half'),
  }
}

/** The choice the form starts on: the first one allowed. */
export function firstAllowed(choices: Record<CLPortion, PortionChoice>): CLPortion | null {
  return CL_PORTIONS.find((p) => choices[p].enabled) ?? null
}

// ─── A year of Casual Leave ───

/** Who put a Casual Leave there: the employee (or HR on the Casual Leave page), or an HR attendance edit (2026-11-02). */
export type CLSource = 'employee' | 'hr_edit'

export type CLRow = {
  id: number | string
  date: string
  portion: CLPortion
  status: CLStatus
  /** "hr_edit" = given / proposed by HR on the Attendance Edit page (shown "by HR"). Absent = the employee's own. */
  source?: CLSource
}

export type DialSlot = { portion: CLPortion; status: Exclude<CLStatus, 'rejected'>; date: string } | null

export type YearMonth = {
  /** 1-12 */
  month: number
  short: string
  /** Pending and approved requests of the month, by date (rejected ones are not leave). */
  parts: CLRow[]
  approvedDays: number
  waitingDays: number
  /** approvedDays + waitingDays. */
  days: number
  /** 'many' (the yearly balance, 2026-11-02): more than one day in the month. */
  shape: 'none' | 'full' | 'one_half' | 'two_halves' | 'many'
  /** The two halves of the month's dial: a full day fills both, each half-day one, in date order. A month with more than
   * one day: the whole dial (approved left, waiting right when both). */
  slots: [DialSlot, DialSlot]
  /** Any of it given / proposed by HR (an attendance edit). */
  byHr: boolean
}

const idNum = (id: number | string) => (typeof id === 'number' ? id : Number(id) || 0)
const byDate = (a: CLRow, b: CLRow) => a.date.localeCompare(b.date) || idNum(a.id) - idNum(b.id)

/** The 12 months of `year`: what was taken (or is waiting) in each, for the year view. */
export function yearMonths(rows: readonly CLRow[], year: number): YearMonth[] {
  const out: YearMonth[] = []
  for (let month = 1; month <= 12; month++) {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`
    const parts = rows.filter((r) => r.status !== 'rejected' && r.date.startsWith(prefix)).sort(byDate)
    const slot = (r: CLRow | undefined): DialSlot =>
      r ? { portion: r.portion, status: r.status === 'approved' ? 'approved' : 'pending', date: r.date } : null
    const full = parts.find((p) => p.portion === 'full')
    const halves = parts.filter((p) => p.portion !== 'full')
    // Under the yearly balance a month may hold any number of days (no cap at one any more).
    const sum = (status: CLStatus) => parts.filter((p) => p.status === status).reduce((n, p) => n + PORTION_DAYS[p.portion], 0)
    const approvedDays = sum('approved')
    const waitingDays = sum('pending')
    const days = approvedDays + waitingDays
    let slots: [DialSlot, DialSlot]
    let shape: YearMonth['shape']
    if (days > 1) {
      shape = 'many'
      const first = parts[0].date
      slots =
        approvedDays > 0 && waitingDays > 0
          ? [{ portion: 'first_half', status: 'approved', date: first }, { portion: 'second_half', status: 'pending', date: first }]
          : [{ portion: 'full', status: approvedDays > 0 ? 'approved' : 'pending', date: first }, { portion: 'full', status: approvedDays > 0 ? 'approved' : 'pending', date: first }]
    } else {
      shape = full ? 'full' : halves.length >= 2 ? 'two_halves' : halves.length === 1 ? 'one_half' : 'none'
      slots = full ? [slot(full), slot(full)] : [slot(halves[0]), slot(halves[1])]
    }
    out.push({
      month,
      short: MONTH_SHORT[month - 1],
      parts,
      approvedDays,
      waitingDays,
      days,
      shape,
      slots,
      byHr: parts.some((p) => p.source === 'hr_edit'),
    })
  }
  return out
}

/** The two halves of a dial in words, for its accessible name: "full day, approved", "half day on 2 Mar, waiting ...". */
export function dialWords(m: Pick<YearMonth, 'shape' | 'slots'> & Partial<Pick<YearMonth, 'approvedDays' | 'waitingDays' | 'byHr'>>): string {
  if (m.shape === 'none') return 'no Casual Leave'
  const hr = m.byHr ? ' (some given by HR)' : ''
  if (m.shape === 'many') {
    const a = m.approvedDays ?? 0
    const w = m.waitingDays ?? 0
    return [a > 0 ? `${daysText(a)} approved` : null, w > 0 ? `${daysText(w)} waiting for approval` : null].filter(Boolean).join(', ') + hr
  }
  const s = (d: DialSlot) => (d?.status === 'approved' ? 'approved' : 'waiting for approval')
  if (m.shape === 'full') return `full day, ${s(m.slots[0])}${hr}`
  return (
    m.slots
      .filter((d): d is NonNullable<DialSlot> => !!d)
      .map((d) => `half day on ${shortDate(d.date)}, ${s(d)}`)
      .join('; ') + hr
  )
}

/** The words under a month tile: "Full day", "½ day", "2 halves", "2½ days". */
export function monthShapeText(m: Pick<YearMonth, 'shape' | 'days'>): string {
  switch (m.shape) {
    case 'none':
      return '—'
    case 'full':
      return 'Full day'
    case 'one_half':
      return '½ day'
    case 'two_halves':
      return '2 halves'
    default:
      return daysText(m.days)
  }
}

// ─── monthsUsage (2026-11-02): the year month by month as the server counts it ───

export type CLUsagePart = {
  id: number | string
  /** "casual_leave" (a Casual Leave request) or "attendance_correction" (a Casual Leave HR proposed that still waits). */
  requestKind: string
  date: string
  portion: CLPortion
  days: number
  status: Exclude<CLStatus, 'rejected'>
  source: CLSource
  /** False for a date before the cut-over (never deducted from the balance). */
  counted: boolean
}

export type CLMonthUsage = {
  /** 'yyyy-MM' */
  month: string
  label: string
  used: number
  pending: number
  beforeCutOver: number
  rule: CLRule | null
  parts: CLUsagePart[]
}

const asSource = (v: unknown): CLSource => (v === 'hr_edit' ? 'hr_edit' : 'employee')

/** `monthsUsage` of GET /casual-leaves/my-eligibility, checked; null when absent (older server). */
export function readMonthsUsage(raw: unknown): CLMonthUsage[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object' && typeof (m as Record<string, unknown>).month === 'string')
    .map((m) => ({
      month: m.month as string,
      label: str(m.label) ?? (m.month as string),
      used: num(m.used) ?? 0,
      pending: num(m.pending) ?? 0,
      beforeCutOver: num(m.beforeCutOver) ?? 0,
      rule: asRule(m.rule),
      parts: (Array.isArray(m.parts) ? m.parts : [])
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && isDate((p as Record<string, unknown>).date))
        .map((p) => {
          const portion = asPortion(p.portion)
          return {
            id: (p.id as number | string | undefined) ?? '',
            requestKind: str(p.requestKind) ?? 'casual_leave',
            date: (p.date as string).slice(0, 10),
            portion,
            days: num(p.days) ?? PORTION_DAYS[portion],
            status: asStatus(p.status) === 'approved' ? 'approved' : 'pending',
            source: asSource(p.source),
            counted: p.counted !== false,
          }
        }),
    }))
}

/** The id a usage part has in the page's rows: a Casual Leave request keeps its own; an HR proposal gets its own space. */
export function usagePartId(p: Pick<CLUsagePart, 'id' | 'requestKind'>): string {
  return p.requestKind === 'attendance_correction' ? `hr-edit-${p.id}` : String(p.id)
}

/**
 * The rows the year view draws. For the year the server counted (`usage`), its parts (approved and waiting, including a
 * Casual Leave HR proposed on an attendance edit that is not a request yet) plus the employee's rejected requests of
 * that year; every other year comes from the request list alone. A list row lends its `source` to its usage part.
 */
export function mergeUsageRows(list: readonly CLRow[], usage: readonly CLMonthUsage[] | null | undefined): CLRow[] {
  if (!usage?.length) return [...list]
  const years = new Set(usage.map((m) => m.month.slice(0, 4)))
  const sourceOf = new Map(list.map((r) => [String(r.id), r.source]))
  const fromUsage: CLRow[] = usage.flatMap((m) =>
    m.parts.map((p) => {
      const id = usagePartId(p)
      const source = p.source === 'hr_edit' ? 'hr_edit' : (sourceOf.get(id) ?? 'employee')
      return { id, date: p.date, portion: p.portion, status: p.status, source }
    }),
  )
  const otherRows = list.filter((r) => !years.has(r.date.slice(0, 4)) || r.status === 'rejected')
  return [...fromUsage, ...otherRows]
}

// ─── Balance history (GET /casual-leaves/history, 2026-11-02) ───

export type CLHistoryKind = 'opening' | 'approved' | 'pending' | 'rejected' | 'lapsed'

export type CLHistoryEntry = {
  kind: CLHistoryKind | string
  /** 'YYYY-MM-DD': the day it happened. */
  on: string | null
  /** 'YYYY-MM-DD': the Casual Leave day (null for the opening / lapse lines). */
  date: string | null
  portion: CLPortion | null
  portionLabel: string | null
  days: number | null
  change: number | null
  balanceBefore: number | null
  balanceAfter: number | null
  source: CLSource | null
  /** The server's own sentence: "12 → 11 on 05 Nov: Casual Leave approved (Full day, 05 Nov 2026)". */
  text: string
}

export type CLHistory = { year: number; total: number; balance: CLBalance | null; entries: CLHistoryEntry[] }

/** GET /casual-leaves/history, checked. */
export function readHistory(raw: unknown): CLHistory | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const year = num(r.year)
  if (year == null) return null
  const entries = (Array.isArray(r.entries) ? r.entries : [])
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object' && typeof (e as Record<string, unknown>).kind === 'string')
    .map((e) => ({
      kind: e.kind as string,
      on: isDate(e.on) ? e.on.slice(0, 10) : null,
      date: isDate(e.date) ? e.date.slice(0, 10) : null,
      portion: e.portion == null ? null : asPortion(e.portion),
      portionLabel: str(e.portionLabel),
      days: num(e.days),
      change: num(e.change),
      balanceBefore: num(e.balanceBefore),
      balanceAfter: num(e.balanceAfter),
      source: e.source == null ? null : asSource(e.source),
      text: str(e.text) ?? '',
    }))
  return { year, total: num(r.total) ?? 12, balance: readBalance(r.balance), entries }
}

export type HistoryRow = {
  key: string
  kind: string
  /** The kit tone of its dot: opening sapphire, approved violet (Casual Leave), waiting amber, rejected slate, lapsed rose. */
  tone: 'sapphire' | 'violet' | 'amber' | 'slate' | 'rose'
  title: string
  detail: string | null
  /** "12 → 11", "+12", "no change". */
  change: string
  /** "5 Nov" (the day it happened). */
  on: string | null
  byHr: boolean
}

/** The history as the page lists it: newest first, each line in plain words with the balance before and after. */
export function historyRows(h: Pick<CLHistory, 'entries' | 'year'>): HistoryRow[] {
  const what = (e: CLHistoryEntry) => {
    const part = e.portion ? PORTION_LABEL[e.portion] : (e.portionLabel ?? 'Casual Leave')
    return e.date ? `${part}, ${longDate(e.date)}` : part
  }
  const move = (e: CLHistoryEntry) =>
    e.balanceBefore != null && e.balanceAfter != null
      ? e.balanceBefore === e.balanceAfter
        ? 'no change'
        : `${halfNum(e.balanceBefore)} → ${halfNum(e.balanceAfter)}`
      : ''
  return h.entries
    .map((e, i): HistoryRow => {
      const byHr = e.source === 'hr_edit'
      const base = { key: `${i}-${e.kind}-${e.on ?? ''}`, kind: e.kind, on: e.on ? shortDate(e.on) : null, byHr }
      switch (e.kind) {
        case 'opening':
          return {
            ...base,
            tone: 'sapphire',
            title: `${halfNum(e.balanceAfter ?? e.change ?? 12)} Casual Leave days for ${h.year}`,
            detail: e.on ? `Counted from ${longDate(e.on)}` : null,
            change: `+${halfNum(e.change ?? e.balanceAfter ?? 12)}`,
          }
        case 'approved':
          return { ...base, tone: 'violet', title: `Approved: ${what(e)}`, detail: byHr ? 'Given by HR (attendance edit)' : null, change: move(e) }
        case 'pending':
          return {
            ...base,
            tone: 'amber',
            title: `Waiting for approval: ${what(e)}`,
            detail: byHr ? 'Proposed by HR (attendance edit); the days are held until it is decided' : 'The days are held until it is decided',
            change: move(e),
          }
        case 'rejected':
          return { ...base, tone: 'slate', title: `Rejected: ${what(e)}`, detail: 'No days used', change: move(e) || 'no change' }
        case 'lapsed':
          return { ...base, tone: 'rose', title: 'Unused days lapsed', detail: 'A fresh balance starts on 1 January', change: move(e) }
        default:
          return { ...base, tone: 'slate', title: e.text || 'Casual Leave', detail: null, change: move(e) }
      }
    })
    .reverse()
}

export type YearTotals = { takenDays: number; waitingDays: number; rejected: number; applications: number; monthsUsed: number }

export function yearTotals(rows: readonly CLRow[], year: number): YearTotals {
  const mine = rows.filter((r) => r.date.startsWith(`${year}-`))
  const months = yearMonths(mine, year)
  return {
    takenDays: months.reduce((n, m) => n + m.approvedDays, 0),
    waitingDays: months.reduce((n, m) => n + m.waitingDays, 0),
    rejected: mine.filter((r) => r.status === 'rejected').length,
    applications: mine.length,
    monthsUsed: months.filter((m) => m.shape !== 'none').length,
  }
}

/** One day cell of the month calendar: which halves of it are Casual Leave and in what state. */
export type DayMark = { first: Exclude<CLStatus, 'rejected'> | null; second: Exclude<CLStatus, 'rejected'> | null }

/** {"2026-10-05": {first, second}} for the pending / approved Casual Leave of the rows. */
export function dayMarks(rows: readonly CLRow[]): Record<string, DayMark> {
  const out: Record<string, DayMark> = {}
  const stronger = (a: DayMark['first'], b: DayMark['first']) => (a === 'approved' || b === 'approved' ? 'approved' : (a ?? b))
  for (const r of rows) {
    if (r.status === 'rejected') continue
    const s = r.status === 'approved' ? 'approved' : 'pending'
    const mark = out[r.date] ?? { first: null, second: null }
    if (r.portion !== 'second_half') mark.first = stronger(mark.first, s)
    if (r.portion !== 'first_half') mark.second = stronger(mark.second, s)
    out[r.date] = mark
  }
  return out
}

/** The weeks of a month for a Sunday-first calendar: each week 7 cells, a day number or null. */
export function monthWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month - 1, 1).getDay()
  const days = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = Array.from({ length: first }, () => null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** The years the year switcher offers: from the first year with a request (or last year) to this year. */
export function yearRange(rows: readonly { date: string }[], thisYear: number): { min: number; max: number } {
  const years = rows.map((r) => Number(r.date.slice(0, 4))).filter((y) => Number.isFinite(y) && y > 2000)
  return { min: Math.min(thisYear - 1, ...years), max: thisYear }
}

/** Why the Casual Leave form cannot be sent yet (the first problem), or null. The date is checked separately. */
export function clFormProblem(f: { portion: CLPortion | null; reason: string }): string | null {
  if (!f.portion) return 'Choose Full day, First half or Second half.'
  if (f.reason.trim().length < 5) return 'Please give a reason (at least 5 letters).'
  if (f.reason.length > 200) return 'The reason is too long (200 letters at most).'
  return null
}

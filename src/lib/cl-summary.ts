// Casual Leave "Balance in detail" (`summary`, owner 2026-11-28; twin of the mobile app's src/lib/clSummary.ts): total
// eligible, used, available, carried forward, allocated this month, the most usable this month, what is usable now after
// approved (and after waiting) requests, the policy in words and the year month by month. Pure, unit-tested in cl-summary.test.ts (`npm test`).
//
// The server reads every figure off the same ledger as the balance (backend api/employee_transparency.py cl_summary, on
// GET /casual-leaves/my-eligibility and GET /casual-leaves/history), so `maxUsableThisMonth` is always the balance's
// `remaining`. This file only reads it defensively and words it. An older server sends no `summary`: null, and the
// page leaves the section out.

import { MONTH_LONG, MONTH_SHORT } from './casual-leave.ts'

export interface CLSummaryMonthRow {
  /** 'YYYY-MM' */
  month: string
  /** "November 2026" */
  label: string
  carriedIn: number
  allocated: number
  used: number
  pending: number
  /** Left at the month's end (with carry forward it moves on: the next month's carriedIn). */
  balance: number
  /** Days of the month that ended unused (no-carry policy only). */
  lapsed: number
}

export interface CLSummary {
  /** Staff only (Casual Leave is for staff). */
  applicable: boolean
  year: number
  /** False before the policy / before the service: every number 0, no months. */
  tracked: boolean
  /** 'YYYY-MM': the month the balance is shown for. */
  asOf: string
  /** "November 2026" */
  monthLabel: string
  /** 'YYYY-MM-DD': the day the balance starts (cut-over / service complete). */
  startsOn: string | null
  cutOver: string | null
  /** monthly_carry | monthly | yearly */
  mode: string
  /** monthly | yearly */
  allocation: string
  perMonth: number | null
  perYear: number | null
  carryForward: boolean
  /** carry | lapse */
  yearEnd: string
  yearEndCap: number | null
  halfDayAllowed: boolean
  /** The policy in one paragraph. */
  policyText: string
  totalEligible: number
  allocatedSoFar: number
  carriedFromLastYear: number
  /** Unused days brought INTO the month shown from earlier months (0 without carry). */
  carriedForward: number
  allocatedThisMonth: number
  usedThisMonth: number
  pendingThisMonth: number
  /** Approved days of the year that count. */
  utilized: number
  /** Days held by waiting requests. */
  pending: number
  /** Days in hand in the month shown after approved and waiting requests. */
  available: number
  /** What may still be asked for with a date this month (= the balance's `remaining`). */
  maxUsableThisMonth: number
  remainingAfterApproved: number
  remainingAfterPending: number
  remainingForYear: number
  lapsed: number
  leftAtYearEnd: number
  /** "For 2026 you get 12 days of Casual Leave (1 day a month). You have used 3.5, ..." */
  personalText: string
  monthRows: CLSummaryMonthRow[]
}

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
const num0 = (v: unknown): number => num(v) ?? 0
const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

function readRow(raw: unknown): CLSummaryMonthRow | null {
  if (!isObject(raw)) return null
  const month = str(raw.month)
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  return {
    month,
    label: str(raw.label) || month,
    carriedIn: num0(raw.carriedIn),
    allocated: num0(raw.allocated),
    used: num0(raw.used),
    pending: num0(raw.pending),
    balance: num0(raw.balance),
    lapsed: num0(raw.lapsed),
  }
}

/** The `summary` block of GET /casual-leaves/my-eligibility (or /history), checked; null when absent (older server). */
export function readClSummary(raw: unknown): CLSummary | null {
  if (!isObject(raw)) return null
  const year = num(raw.year)
  if (year == null) return null
  const asOf = /^\d{4}-\d{2}/.test(str(raw.asOf)) ? str(raw.asOf).slice(0, 7) : `${year}-12`
  return {
    applicable: raw.applicable !== false,
    year,
    tracked: raw.tracked !== false,
    asOf,
    monthLabel: str(raw.monthLabel) || `${MONTH_LONG[Number(asOf.slice(5, 7)) - 1] ?? ''} ${year}`.trim(),
    startsOn: dateOrNull(raw.startsOn),
    cutOver: dateOrNull(raw.cutOver),
    mode: str(raw.mode),
    allocation: str(raw.allocation) || 'monthly',
    perMonth: num(raw.perMonth),
    perYear: num(raw.perYear),
    carryForward: raw.carryForward === true,
    yearEnd: str(raw.yearEnd),
    yearEndCap: num(raw.yearEndCap),
    halfDayAllowed: raw.halfDayAllowed !== false,
    policyText: str(raw.policyText),
    totalEligible: num0(raw.totalEligible),
    allocatedSoFar: num0(raw.allocatedSoFar),
    carriedFromLastYear: num0(raw.carriedFromLastYear),
    carriedForward: num0(raw.carriedForward),
    allocatedThisMonth: num0(raw.allocatedThisMonth),
    usedThisMonth: num0(raw.usedThisMonth),
    pendingThisMonth: num0(raw.pendingThisMonth),
    utilized: num0(raw.utilized),
    pending: num0(raw.pending),
    available: num0(raw.available),
    maxUsableThisMonth: num0(raw.maxUsableThisMonth),
    remainingAfterApproved: num0(raw.remainingAfterApproved),
    remainingAfterPending: num0(raw.remainingAfterPending),
    remainingForYear: num0(raw.remainingForYear),
    lapsed: num0(raw.lapsed),
    leftAtYearEnd: num0(raw.leftAtYearEnd),
    personalText: str(raw.personalText),
    monthRows: (Array.isArray(raw.monthRows) ? raw.monthRows : []).map(readRow).filter((r): r is CLSummaryMonthRow => r !== null),
  }
}

/** Whether the detailed balance is worth showing: the server sent one, it is the employee's (staff), and a balance was
 *  kept for the year (an untracked year is all zeros). */
export function summaryWorthShowing(s: CLSummary | null | undefined): s is CLSummary {
  return !!s && s.applicable && s.tracked
}

/** The summary for the year on screen: the first one given for that year (the history's for the year shown, else the
 *  eligibility's, which is always this year's); null when none is, or when it is not worth showing (summaryWorthShowing). */
export function pickClSummary(year: number, ...candidates: (CLSummary | null | undefined)[]): CLSummary | null {
  const s = candidates.find((c) => c != null && c.year === year) ?? null
  return summaryWorthShowing(s) ? s : null
}

// ---- wording (the same words as the mobile app's src/lib/clSummary.ts) ------------------------------------------

/** A day count the way the Casual Leave screens print it: 7.5 -> "7½", 0.5 -> "½", 3 -> "3"; a count that is not whole
 *  or half (a policy of 1.25 a month) keeps its decimals: "1.25". */
export function clNumber(days: number): string {
  if (!Number.isFinite(days)) return '0'
  const abs = Math.abs(days)
  const whole = Math.floor(abs)
  const rest = Math.round((abs - whole) * 100) / 100
  const out = rest === 0 ? String(whole) : rest === 0.5 ? (whole ? `${whole}½` : '½') : String(Math.round(abs * 100) / 100)
  return days < 0 ? `-${out}` : out
}

/** "7½ days", "1 day", "½ day", "0 days". */
export function clDays(days: number): string {
  return `${clNumber(days)} ${days > 0 && days <= 1 ? 'day' : 'days'}`
}

/** "November" of the summary's month. */
export function summaryMonthName(s: Pick<CLSummary, 'asOf' | 'monthLabel'>): string {
  return MONTH_LONG[Number(s.asOf.slice(5, 7)) - 1] ?? (s.monthLabel.split(' ')[0] || 'this month')
}

export interface SummaryTile {
  key: 'total' | 'used' | 'available' | 'carried' | 'given' | 'usable'
  label: string
  /** "7½" (the unit is in the label's sentence for a screen reader: `spoken`). */
  value: string
  /** "7½ days" */
  spoken: string
  tone: 'primary' | 'used' | 'free' | 'plain'
}

/**
 * The headline figures: the year's total, used, available; carried forward (only when there is some), this month's days
 * (not under a yearly allocation, where nothing comes month by month), and the most that can still be used this month.
 */
export function summaryTiles(s: CLSummary): SummaryTile[] {
  const month = summaryMonthName(s)
  const out: SummaryTile[] = []
  const add = (key: SummaryTile['key'], label: string, value: number, tone: SummaryTile['tone']) =>
    out.push({ key, label, value: clNumber(value), spoken: clDays(value), tone })
  add('total', `Total for ${s.year}`, s.totalEligible, 'primary')
  add('used', 'Used', s.utilized, 'used')
  add('available', 'Available', s.available, 'free')
  if (s.carriedForward > 0) add('carried', 'Carried forward', s.carriedForward, 'plain')
  if (s.mode !== 'yearly' && s.allocation !== 'yearly') add('given', `Given in ${month}`, s.allocatedThisMonth, 'plain')
  add('usable', `Usable in ${month}`, s.maxUsableThisMonth, 'free')
  return out
}

export interface SummaryLine {
  key: 'pending' | 'afterApproved' | 'afterPending' | 'lastYear' | 'lapsed' | 'year'
  label: string
  value: string
}

/**
 * The lines under the figures: waiting days, what is usable now after approved requests and after the waiting ones too
 * (one line when nothing waits: the two are the same; both are about the month shown, not the year), carried in from
 * last year, lapsed days, and what is left for the rest of the year (when it differs). Only lines with something to say.
 */
export function summaryLines(s: CLSummary): SummaryLine[] {
  const out: SummaryLine[] = []
  if (s.pending > 0) out.push({ key: 'pending', label: 'Waiting for approval', value: clDays(s.pending) })
  out.push({ key: 'afterApproved', label: 'Usable now, after approved requests', value: clDays(s.remainingAfterApproved) })
  if (s.pending > 0) {
    out.push({ key: 'afterPending', label: 'Usable now, after approved and waiting requests', value: clDays(s.remainingAfterPending) })
  }
  if (s.carriedFromLastYear > 0) out.push({ key: 'lastYear', label: `Carried in from ${s.year - 1}`, value: clDays(s.carriedFromLastYear) })
  if (s.lapsed > 0) out.push({ key: 'lapsed', label: 'Lapsed (unused in past months)', value: clDays(s.lapsed) })
  if (s.remainingForYear !== s.remainingAfterPending) {
    out.push({ key: 'year', label: `Left for the rest of ${s.year}`, value: clDays(s.remainingForYear) })
  }
  return out
}

export type ClColumnKey = 'carriedIn' | 'allocated' | 'used' | 'pending' | 'balance' | 'lapsed'

export interface ClMonthTable {
  columns: { key: ClColumnKey; label: string }[]
  rows: {
    key: string
    /** "November 2026" */
    label: string
    /** "Nov" */
    short: string
    /** The month the figures are for. */
    current: boolean
    /** One cell per column, in order: "8½", "1", "0". */
    cells: string[]
  }[]
}

/**
 * "Month by month": the months from the start to the month shown. Month | In (carried in, only when the policy carries
 * or some month carried in) | Given | Used | Waiting (only when some month has waiting days) | Left | Lapsed (only when
 * some month lapsed). Null when there are no months.
 */
export function clMonthTable(s: Pick<CLSummary, 'monthRows' | 'carryForward' | 'asOf'>): ClMonthTable | null {
  const rows = s.monthRows
  if (rows.length === 0) return null
  const any = (k: ClColumnKey) => rows.some((r) => r[k] > 0)
  const columns: ClMonthTable['columns'] = []
  if (s.carryForward || any('carriedIn')) columns.push({ key: 'carriedIn', label: 'In' })
  columns.push({ key: 'allocated', label: 'Given' })
  columns.push({ key: 'used', label: 'Used' })
  if (any('pending')) columns.push({ key: 'pending', label: 'Waiting' })
  columns.push({ key: 'balance', label: 'Left' })
  if (any('lapsed')) columns.push({ key: 'lapsed', label: 'Lapsed' })
  return {
    columns,
    rows: rows.map((r) => ({
      key: r.month,
      label: r.label,
      short: MONTH_SHORT[Number(r.month.slice(5, 7)) - 1] ?? r.label,
      current: r.month === s.asOf,
      cells: columns.map((c) => clNumber(r[c.key])),
    })),
  }
}

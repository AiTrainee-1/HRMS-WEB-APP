// A salary slip's Casual Leave (`casualLeave`, owner 2026-11-28): whether Casual Leave was used in the slip's month, the
// days used and paid, what the paid days were paid, and the earned salary split into days worked + paid Casual Leave +
// paid holidays, with the loss of pay (LOP). Pure, unit-tested in slip-casual-leave.test.ts (`npm test`).
//
// The server reads the STORED slip only and never runs payroll (backend api/employee_transparency.py slip_casual_leave,
// on GET /my/salary-slips/<id>/breakdown; a short form on every row of GET /my/salary-slips). Casual Leave pay is PART
// of the earned salary, never added to it. An older slip that does not store its days gives the days with null money and
// a note, which the page shows as it is. A production (per-shift) slip says `applicable` false: nothing is shown.

import { formatINR } from './money.ts'

export interface SlipClDate {
  /** 'YYYY-MM-DD' */
  date: string
  portion: 'full' | 'half'
  days: number
  /** Of them, paid on this slip; null on an older slip. */
  paidDays: number | null
}

export interface SlipCasualLeave {
  /** False on a production / per-shift slip. */
  applicable: boolean
  used: boolean
  daysUsed: number
  paidDays: number | null
  unpaidDays: number | null
  amountPaid: number | null
  dailyRate: number | null
  workedDays: number | null
  workedPay: number | null
  holidayDays: number | null
  holidayPay: number | null
  earnedPay: number | null
  paidDaysTotal: number | null
  companyDays: number | null
  lopDays: number | null
  lopDeduction: number | null
  monthlySalary: number | null
  /** False: the slip does not store its days (older) - money and paid fields are null. */
  fromStoredSlip: boolean
  dates: SlipClDate[]
  /** The server's sentence (why money is missing, or what was paid). */
  note: string
}

/** The short form on a row of GET /my/salary-slips. */
export interface SlipCasualLeaveShort {
  applicable: boolean
  used: boolean
  daysUsed: number
  paidDays: number | null
  amountPaid: number | null
  fromStoredSlip: boolean
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

function readDate(raw: unknown): SlipClDate | null {
  if (!isObject(raw) || typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(raw.date)) return null
  const portion = raw.portion === 'half' ? 'half' : 'full'
  return { date: raw.date.slice(0, 10), portion, days: num(raw.days) ?? (portion === 'half' ? 0.5 : 1), paidDays: num(raw.paidDays) }
}

/** `casualLeave` of GET /my/salary-slips/<id>/breakdown, checked; null when absent (an older server). */
export function readSlipCasualLeave(raw: unknown): SlipCasualLeave | null {
  if (!isObject(raw) || typeof raw.applicable !== 'boolean') return null
  const daysUsed = num(raw.daysUsed) ?? 0
  return {
    applicable: raw.applicable,
    used: typeof raw.used === 'boolean' ? raw.used : daysUsed > 0,
    daysUsed,
    paidDays: num(raw.paidDays),
    unpaidDays: num(raw.unpaidDays),
    amountPaid: num(raw.amountPaid),
    dailyRate: num(raw.dailyRate),
    workedDays: num(raw.workedDays),
    workedPay: num(raw.workedPay),
    holidayDays: num(raw.holidayDays),
    holidayPay: num(raw.holidayPay),
    earnedPay: num(raw.earnedPay),
    paidDaysTotal: num(raw.paidDaysTotal),
    companyDays: num(raw.companyDays),
    lopDays: num(raw.lopDays),
    lopDeduction: num(raw.lopDeduction),
    monthlySalary: num(raw.monthlySalary),
    fromStoredSlip: raw.fromStoredSlip === true,
    dates: (Array.isArray(raw.dates) ? raw.dates : []).map(readDate).filter((d): d is SlipClDate => d !== null),
    note: str(raw.note),
  }
}

/** The short `casualLeave` of a slip list row, checked; null when absent (an older server). */
export function readSlipCasualLeaveShort(raw: unknown): SlipCasualLeaveShort | null {
  if (!isObject(raw) || typeof raw.applicable !== 'boolean') return null
  const daysUsed = num(raw.daysUsed) ?? 0
  return {
    applicable: raw.applicable,
    used: typeof raw.used === 'boolean' ? raw.used : daysUsed > 0,
    daysUsed,
    paidDays: num(raw.paidDays),
    amountPaid: num(raw.amountPaid),
    fromStoredSlip: raw.fromStoredSlip === true,
  }
}

/** {slip id: its short Casual Leave} for the rows of GET /my/salary-slips (rows without one are left out). */
export function clShortBySlip(rows: readonly { id: number | string; casualLeave?: unknown }[] | null | undefined): Map<string, SlipCasualLeaveShort> {
  const out = new Map<string, SlipCasualLeaveShort>()
  for (const r of rows ?? []) {
    const cl = readSlipCasualLeaveShort(r.casualLeave)
    if (cl) out.set(String(r.id), cl)
  }
  return out
}

/// ---- wording (the same words as the mobile app's src/lib/slipCasualLeave.ts) -------------------------------------

/** 1.5 -> "1.5", 22 -> "22" (the slip's own way of writing days). */
function plain(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** "1 day", "1.5 days", "0.5 day". */
export function slipDays(n: number): string {
  return `${plain(n)} ${n > 0 && n <= 1 ? 'day' : 'days'}`
}

/** The slip list row's line when Casual Leave was used: "Casual Leave: 2 days paid · ₹2,000", "Casual Leave: 1.5 of 2
 *  days paid · ₹1,500", "Casual Leave: 1 day used" (an older slip); null when none was used, Casual Leave does not apply
 *  to the slip, or an older server sent nothing. */
export function slipClChip(cl: SlipCasualLeaveShort | SlipCasualLeave | null | undefined): string | null {
  if (!cl || !cl.applicable || !cl.used || !(cl.daysUsed > 0)) return null
  if (cl.paidDays == null) return `Casual Leave: ${slipDays(cl.daysUsed)} used`
  const days = cl.paidDays === cl.daysUsed ? `${slipDays(cl.paidDays)} paid` : `${plain(cl.paidDays)} of ${slipDays(cl.daysUsed)} paid`
  return `Casual Leave: ${days}${cl.amountPaid != null ? ` · ${formatINR(cl.amountPaid)}` : ''}`
}

export interface SlipClFigure {
  key: 'used' | 'paid' | 'unpaid' | 'amount'
  label: string
  value: string
}

export interface SlipClSplitRow {
  key: 'worked' | 'casualLeave' | 'holiday' | 'earned' | 'lop' | 'monthly'
  label: string
  sub: string | null
  value: string
  /** part = a share of the salary earned; total = the salary earned; loss = the loss of pay; reference = the monthly
   *  salary it is all taken from. */
  kind: 'part' | 'total' | 'loss' | 'reference'
}

export interface SlipClDateRow {
  key: string
  /** "Tue, 6 Oct 2026" */
  day: string
  /** "Full day" / "Half day" */
  portion: string
  /** "Paid", "0.5 paid", "Not paid on this slip"; null on an older slip (not known). */
  paid: string | null
  paidTone: 'approved' | 'waiting' | null
}

export interface SlipClView {
  used: boolean
  /** "3 days of Casual Leave in October 2026" / "No Casual Leave in October 2026". */
  headline: string
  /** Days used, paid CL days, not paid on this slip, paid for CL; empty when none was used. */
  figures: SlipClFigure[]
  /** Worked + paid Casual Leave (+ holiday pay) = salary earned, then the loss of pay and the monthly salary; empty when
   *  the slip's money cannot be split (an older slip, or figures that do not add up: the note says why). */
  split: SlipClSplitRow[]
  dates: SlipClDateRow[]
  /** The server's sentence, when there is one to show. */
  note: string | null
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Tue, 6 Oct 2026" from "2026-10-06" (no time-zone shift). */
function dayLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${WEEKDAY[d.getDay()]}, ${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}`
}

function paidText(d: SlipClDate): Pick<SlipClDateRow, 'paid' | 'paidTone'> {
  if (d.paidDays == null) return { paid: null, paidTone: null }
  if (d.paidDays <= 0) return { paid: 'Not paid on this slip', paidTone: 'waiting' }
  if (d.paidDays < d.days) return { paid: `${plain(d.paidDays)} paid`, paidTone: 'waiting' }
  return { paid: 'Paid', paidTone: 'approved' }
}

/** Whether the salary earned can be split: the money of a slip that stores its days and adds up. */
export function slipClSplitKnown(cl: SlipCasualLeave): boolean {
  return cl.fromStoredSlip && cl.workedPay != null && cl.amountPaid != null && cl.earnedPay != null
}

/** The split rows (see SlipClView.split). */
export function slipClSplit(cl: SlipCasualLeave): SlipClSplitRow[] {
  if (!slipClSplitKnown(cl)) return []
  const rate = cl.dailyRate != null ? ` × ${formatINR(cl.dailyRate)}` : ''
  const rows: SlipClSplitRow[] = [
    { key: 'worked', label: 'Earned for days worked', sub: cl.workedDays != null ? slipDays(cl.workedDays) : null, value: formatINR(cl.workedPay), kind: 'part' },
    { key: 'casualLeave', label: 'Paid Casual Leave', sub: cl.paidDays != null ? `${slipDays(cl.paidDays)}${rate}` : null, value: formatINR(cl.amountPaid), kind: 'part' },
  ]
  if ((cl.holidayPay ?? 0) > 0) {
    rows.push({ key: 'holiday', label: 'Holiday pay', sub: cl.holidayDays != null ? slipDays(cl.holidayDays) : null, value: formatINR(cl.holidayPay), kind: 'part' })
  }
  rows.push({
    key: 'earned',
    label: 'Salary earned',
    sub: cl.paidDaysTotal != null ? `${slipDays(cl.paidDaysTotal)} paid${cl.companyDays != null ? ` of ${plain(cl.companyDays)}` : ''}` : null,
    value: `= ${formatINR(cl.earnedPay)}`,
    kind: 'total',
  })
  if (cl.lopDeduction != null) {
    rows.push({
      key: 'lop',
      label: 'Unpaid leave (LOP)',
      sub: cl.lopDays != null ? slipDays(cl.lopDays) : null,
      value: cl.lopDeduction > 0 ? `- ${formatINR(cl.lopDeduction)}` : formatINR(0),
      kind: 'loss',
    })
  }
  if (cl.monthlySalary != null) {
    rows.push({ key: 'monthly', label: 'Monthly salary', sub: 'Before the loss of pay', value: formatINR(cl.monthlySalary), kind: 'reference' })
  }
  return rows
}

/**
 * "Casual Leave this month" on a slip, or null when there is nothing to show (no block from the server, or a slip Casual
 * Leave does not apply to: production / per-shift pay). The server's note when Casual Leave was used (it says the pay is
 * part of the salary earned, not an extra amount, or that an older slip cannot split it out) and when a stored slip's
 * money is missing (its figures do not add up); never its "No Casual Leave in ..." that the headline already says.
 * `period` = the slip's period ("October 2026").
 */
export function slipClView(cl: SlipCasualLeave | null | undefined, period?: string | null): SlipClView | null {
  if (!cl || !cl.applicable) return null
  const used = cl.used && cl.daysUsed > 0
  const figures: SlipClFigure[] = []
  if (used) {
    figures.push({ key: 'used', label: 'Days used', value: plain(cl.daysUsed) })
    if (cl.paidDays != null) figures.push({ key: 'paid', label: 'Paid CL days', value: plain(cl.paidDays) })
    if ((cl.unpaidDays ?? 0) > 0) figures.push({ key: 'unpaid', label: 'Not paid on this slip', value: plain(cl.unpaidDays!) })
    if (cl.amountPaid != null) figures.push({ key: 'amount', label: 'Paid for CL', value: formatINR(cl.amountPaid) })
  }
  const split = slipClSplit(cl)
  return {
    used,
    headline: `${used ? `${slipDays(cl.daysUsed)} of Casual Leave` : 'No Casual Leave'} ${period ? `in ${period}` : 'on this slip'}`,
    figures,
    split,
    dates: cl.dates.map((d) => ({ key: d.date, day: dayLabel(d.date), portion: d.portion === 'half' ? 'Half day' : 'Full day', ...paidText(d) })),
    note: cl.note && (used || (split.length === 0 && cl.fromStoredSlip)) ? cl.note : null,
  }
}

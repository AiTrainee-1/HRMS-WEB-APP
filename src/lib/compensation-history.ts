// The Compensation year timeline in ONE place: pure functions, unit-tested in compensation-history.test.ts
// (`npm test`). Twin of the mobile app's src/lib/compensationHistory.ts.
//
// The server (backend api/mobile_pay_compensation.py, GET /my/compensation-history?year=YYYY, staff only) lists every
// compensation of the year: what the system detected, what HR gave (overtime relaxation / pay, Sunday and holiday work,
// credits on the balance, alternative days, days taken from the balance) and what HR announced for everybody (late-in /
// early-out times, compensation days), plus the overtime pay each month's salary slip paid. This file reads that reply
// defensively and groups it; every figure and sentence is the server's.

import { formatMinutes, formatShifts, isoDateOrNull, type CompensationItem } from './compensation.ts'
import { formatINR } from './money.ts'

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

export type Source = 'hr' | 'automatic' | 'company'
export type SourceFilter = 'all' | Source

/** One item: the 90-day list's item shape (so the same card draws it) plus where it came from. */
export interface HistoryItem extends CompensationItem {
  /** 'YYYY-MM' the item is filed under. */
  month: string | null
  source: Source
  sourceLabel: string
  givenByHr: boolean
}

export interface OtPayMonth {
  month: string
  label: string
  amount: number
  shifts: number | null
  slipId: number | null
}

export interface HistoryBalance {
  shifts: number
  creditedThisYear: number
  takenThisYear: number
  alternativeDaysAvailable: number
}

export interface HistoryTotals {
  items: number
  givenByHr: number
  company: number
  automatic: number
  shiftsGivenByHr: number
  otPay: number
}

export interface CompensationHistory {
  isStaff: boolean
  year: number
  years: number[]
  balance: HistoryBalance | null
  totals: HistoryTotals | null
  otPayByMonth: OtPayMonth[]
  items: HistoryItem[]
  message: string | null
}

const SOURCES: Source[] = ['hr', 'automatic', 'company']

export const SOURCE_LABELS: Record<Source, string> = {
  hr: 'Given by HR',
  automatic: 'Automatic',
  company: 'For everyone',
}

/** The words a status gets when the server sends none ("pending_hod" -> "Pending hod"). */
function prettify(value: string): string {
  const t = value.replace(/[_-]+/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

function readItem(raw: unknown, index: number): HistoryItem | null {
  if (!isObject(raw)) return null
  const kind = str(raw.kind)
  const status = str(raw.status)
  const rawSource = str(raw.source)
  const source: Source = (SOURCES as string[]).includes(rawSource) ? (rawSource as Source) : 'hr'
  const date = isoDateOrNull(raw.date)
  const month = str(raw.month)
  return {
    key: str(raw.key) || `item-${index}`,
    kind,
    group: str(raw.group) || 'other',
    date,
    workDate: isoDateOrNull(raw.workDate),
    month: /^\d{4}-\d{2}$/.test(month) ? month : date ? date.slice(0, 7) : null,
    title: str(raw.title) || prettify(kind) || 'Compensation',
    detail: str(raw.detail),
    status,
    statusLabel: str(raw.statusLabel) || prettify(status),
    shifts: num(raw.shifts),
    minutes: num(raw.minutes),
    minutesUsed: num(raw.minutesUsed),
    used: typeof raw.used === 'boolean' ? raw.used : null,
    legacy: raw.legacy === true,
    time: str(raw.time) || null,
    source,
    sourceLabel: SOURCE_LABELS[source],
    givenByHr: typeof raw.givenByHr === 'boolean' ? raw.givenByHr : source !== 'automatic',
  }
}

function readOtPay(raw: unknown): OtPayMonth | null {
  if (!isObject(raw)) return null
  const month = str(raw.month)
  const amount = num(raw.amount)
  if (!/^\d{4}-\d{2}$/.test(month) || amount == null) return null
  return { month, label: str(raw.label) || monthLabel(month), amount, shifts: num(raw.shifts), slipId: num(raw.slipId) }
}

/** The reply of GET /my/compensation-history, or null when it is not one. */
export function normalizeHistory(raw: unknown): CompensationHistory | null {
  if (!isObject(raw) || !Array.isArray(raw.items)) return null
  const year = num(raw.year)
  if (year == null) return null
  const years = (Array.isArray(raw.years) ? raw.years : []).map(num).filter((y): y is number => y != null)
  if (!years.includes(year)) years.push(year)
  years.sort((a, b) => b - a)
  const b = isObject(raw.balance) ? raw.balance : null
  const t = isObject(raw.totals) ? raw.totals : null
  const seen = new Map<string, number>()
  const items: HistoryItem[] = []
  raw.items.forEach((r, i) => {
    const item = readItem(r, i)
    if (!item) return
    const n = seen.get(item.key) ?? 0
    seen.set(item.key, n + 1)
    items.push(n === 0 ? item : { ...item, key: `${item.key}#${n}` })
  })
  return {
    isStaff: raw.isStaff !== false,
    year,
    years: [...new Set(years)],
    balance: b
      ? {
          shifts: num(b.shifts) ?? 0,
          creditedThisYear: num(b.creditedThisYear) ?? 0,
          takenThisYear: num(b.takenThisYear) ?? 0,
          alternativeDaysAvailable: num(b.alternativeDaysAvailable) ?? 0,
        }
      : null,
    totals: t
      ? {
          items: num(t.items) ?? items.length,
          givenByHr: num(t.givenByHr) ?? 0,
          company: num(t.company) ?? 0,
          automatic: num(t.automatic) ?? 0,
          shiftsGivenByHr: num(t.shiftsGivenByHr) ?? 0,
          otPay: num(t.otPay) ?? 0,
        }
      : null,
    otPayByMonth: (Array.isArray(raw.otPayByMonth) ? raw.otPayByMonth : []).map(readOtPay).filter((r): r is OtPayMonth => r !== null),
    items,
    message: str(raw.message) || null,
  }
}

// ---- grouping ---------------------------------------------------------------------------------------------------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** '2026-03' -> 'March 2026' ('' for anything else). */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return ''
  const name = MONTHS[Number(m[2]) - 1]
  return name ? `${name} ${m[1]}` : ''
}

export function filterBySource<T extends { source: Source }>(items: readonly T[], filter: SourceFilter): T[] {
  return filter === 'all' ? [...items] : items.filter((i) => i.source === filter)
}

export const FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'hr', label: 'Given by HR' },
  { key: 'automatic', label: 'Automatic' },
  { key: 'company', label: 'For everyone' },
]

/** How many items each filter chip would show. */
export function sourceCounts(items: readonly { source: Source }[]): Record<SourceFilter, number> {
  const counts: Record<SourceFilter, number> = { all: items.length, hr: 0, automatic: 0, company: 0 }
  for (const i of items) counts[i.source] += 1
  return counts
}

export interface MonthGroup {
  month: string
  label: string
  items: HistoryItem[]
  /** The overtime pay that month's salary slip paid, when there was some. */
  otPay: OtPayMonth | null
  /** Shifts in the month's items that HR gave (relaxation, pay, Sunday / holiday work approved). */
  hrShifts: number
}

const COUNTED_HR_KINDS = new Set(['ot_shift_relaxation', 'ot_shift_pay'])

/** The items by month, newest month first, each newest first. A month with overtime pay but no item in the current
 *  filter is still listed when the filter shows HR's items (the pay is HR's). */
export function groupByMonth(items: readonly HistoryItem[], otPay: readonly OtPayMonth[], filter: SourceFilter = 'all'): MonthGroup[] {
  const shown = filterBySource(items, filter)
  const withPay = filter === 'all' || filter === 'hr'
  const months = new Set<string>()
  for (const i of shown) if (i.month) months.add(i.month)
  if (withPay) for (const p of otPay) months.add(p.month)
  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => {
      const list = shown
        .filter((i) => i.month === month)
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.key.localeCompare(a.key))
      const hrShifts = list
        .filter((i) => COUNTED_HR_KINDS.has(i.kind) || (i.kind === 'holiday_work' && i.status === 'approved'))
        .reduce((sum, i) => sum + (i.shifts ?? 0), 0)
      return {
        month,
        label: monthLabel(month),
        items: list,
        otPay: (withPay ? otPay.find((p) => p.month === month) : undefined) ?? null,
        hrShifts: Math.round(hrShifts * 100) / 100,
      }
    })
}

/** "Overtime pay in your March 2026 salary: ₹384.62 (0.50 shift)". */
export function otPayLine(p: OtPayMonth): string {
  const shifts = formatShifts(p.shifts)
  return `Overtime pay in your ${p.label} salary: ${formatINR(p.amount)}${shifts ? ` (${shifts})` : ''}`
}

/** The month header's one line: "3 items · 1.50 shifts given by HR · ₹769.24 overtime pay". */
export function monthSummary(g: MonthGroup): string {
  const parts = [`${g.items.length} ${g.items.length === 1 ? 'item' : 'items'}`]
  if (g.hrShifts > 0) parts.push(`${formatShifts(g.hrShifts)} given by HR`)
  if (g.otPay) parts.push(`${formatINR(g.otPay.amount)} overtime pay`)
  return parts.join(' · ')
}

export { formatMinutes, formatShifts }

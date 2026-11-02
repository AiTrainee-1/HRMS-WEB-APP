// What the Salary pages show about money, in ONE place: pure functions, unit-tested in salary-insights.test.ts
// (`npm test`). Twin of the mobile app's src/lib/salaryInsights.ts, worded for the web and using lib/money.ts.
//
// The server is the authority on every figure (backend api/mobile_pay.py): it reads what payroll STORED on each salary
// slip (allocated monthly salary, earned gross, late / permission deductions, PF, ESI, TDS, advance recovery, net pay) and
// never recomputes a payroll. This file only reads that reply defensively and words it:
//   * a missing or wrong-typed field reads as "not sent" (null), never throws;
//   * a figure the server sends as null (production pay has no allocated salary, an older slip has no late split) stays
//     null, and the page prints the server's reason instead of a number;
//   * a malformed reply as a whole is null, which the hook turns into an error state with Try again.

import { formatINR } from './money.ts'

// ---- small readers ----------------------------------------------------------------------------------------------

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

/** 21.25 -> "21.25", 24 -> "24", 0.5 -> "0.5"; "—" for nothing. */
export function plainCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return String(Math.round(value * 100) / 100)
}

// ---- the reply of GET /my/salary-insights and /my/salary-slips/<id>/breakdown ------------------------------------

export type StepOp = 'start' | 'minus' | 'plus' | 'subtotal' | 'total'

export interface SalaryStep {
  key: string
  label: string
  /** null = payroll does not store this figure for this slip (the note says why). */
  amount: number | null
  op: StepOp
  note: string
}

export interface PeriodInfo {
  label: string
  shortLabel: string
  start: string | null
  end: string | null
  cycle: string | null
  cycleLabel: string | null
}

export interface PayrollAfterSlip {
  status: string
  statusLabel: string
  bonus: number
  deductionChange: number
  net: number
  matchesSlip: boolean
  /** HR added a bonus or changed the deductions after the slip was made ("Changed by HR after this slip"). */
  hrChanged: boolean
}

export interface SalaryCounts {
  workingDays: number | null
  paidDays: number | null
  presentDays: number | null
  absentDays: number | null
  paidLeaveDays: number | null
  unpaidLeaveDays: number | null
  halfDays: number | null
  lateMarks: number | null
  lateInDays: number | null
  earlyOutDays: number | null
  freeLateMarks: number | null
  billableLateMarks: number | null
  permissionsApproved: number | null
  permissionsFree: number | null
  permissionsCharged: number | null
  dailyRate: number | null
  totalDays: number | null
  daysWorked: number | null
  totalShifts: number | null
  ratePerShift: number | null
}

export interface SalaryPeriod {
  slipId: number
  slipNumber: string
  /** staff | production | legacy */
  kind: string
  month: number
  year: number
  weekNumber: number | null
  period: PeriodInfo
  hasDetails: boolean
  allocated: number | null
  earnedGross: number
  absentLoss: number | null
  lateDeduction: number | null
  permissionDeduction: number | null
  attendanceLoss: number | null
  otPay: number
  pf: number
  esi: number
  tds: number
  tdsPercent: number | null
  statutory: number
  advance: number
  otherDeductions: number
  totalDeductions: number
  netPayable: number
  counts: SalaryCounts
  /** Why a figure is null: keys allocated | absentLoss | late | permission. */
  notes: Record<string, string>
  steps: SalaryStep[]
  reconciles: boolean
  payroll: PayrollAfterSlip | null
}

export interface YearSummary {
  periods: number
  allocated: number | null
  allocatedPeriods: number
  earnedGross: number
  absentLoss: number | null
  lateDeduction: number | null
  permissionDeduction: number | null
  attendanceLoss: number | null
  otPay: number
  statutory: number
  advance: number
  otherDeductions: number
  totalDeductions: number
  netPayable: number
}

export interface SalaryInsights {
  employmentType: string
  year: number
  years: number[]
  /** Oldest first, as the server sends them. */
  periods: SalaryPeriod[]
  summary: YearSummary
  notes: string[]
}

const STEP_OPS: StepOp[] = ['start', 'minus', 'plus', 'subtotal', 'total']

function readStep(raw: unknown): SalaryStep | null {
  if (!isObject(raw)) return null
  const op = str(raw.op) as StepOp
  if (!STEP_OPS.includes(op)) return null
  return { key: str(raw.key), label: str(raw.label), amount: num(raw.amount), op, note: str(raw.note) }
}

const COUNT_KEYS: (keyof SalaryCounts)[] = [
  'workingDays', 'paidDays', 'presentDays', 'absentDays', 'paidLeaveDays', 'unpaidLeaveDays', 'halfDays', 'lateMarks',
  'lateInDays', 'earlyOutDays', 'freeLateMarks', 'billableLateMarks', 'permissionsApproved', 'permissionsFree',
  'permissionsCharged', 'dailyRate', 'totalDays', 'daysWorked', 'totalShifts', 'ratePerShift',
]

function readCounts(raw: unknown): SalaryCounts {
  const src = isObject(raw) ? raw : {}
  const out = {} as SalaryCounts
  for (const k of COUNT_KEYS) out[k] = num(src[k])
  return out
}

function readPayroll(raw: unknown): PayrollAfterSlip | null {
  if (!isObject(raw)) return null
  return {
    status: str(raw.status),
    statusLabel: str(raw.statusLabel),
    bonus: num0(raw.bonus),
    deductionChange: num0(raw.deductionChange),
    net: num0(raw.net),
    matchesSlip: raw.matchesSlip !== false,
    hrChanged: typeof raw.hrChanged === 'boolean' ? raw.hrChanged : num0(raw.bonus) !== 0 || num0(raw.deductionChange) !== 0,
  }
}

/** One period of the reply, or null when it is not one (no slip id). */
export function normalizePeriod(raw: unknown): SalaryPeriod | null {
  if (!isObject(raw)) return null
  const slipId = num(raw.slipId)
  if (slipId == null) return null
  const p = isObject(raw.period) ? raw.period : {}
  const notes: Record<string, string> = {}
  if (isObject(raw.notes)) {
    for (const [k, v] of Object.entries(raw.notes)) if (str(v)) notes[k] = str(v)
  }
  return {
    slipId,
    slipNumber: str(raw.slipNumber),
    kind: str(raw.kind) || 'staff',
    month: num0(raw.month),
    year: num0(raw.year),
    weekNumber: num(raw.weekNumber),
    period: {
      label: str(p.label),
      shortLabel: str(p.shortLabel) || str(p.label),
      start: str(p.start) || null,
      end: str(p.end) || null,
      cycle: str(p.cycle) || null,
      cycleLabel: str(p.cycleLabel) || null,
    },
    hasDetails: raw.hasDetails === true,
    allocated: num(raw.allocated),
    earnedGross: num0(raw.earnedGross),
    absentLoss: num(raw.absentLoss),
    lateDeduction: num(raw.lateDeduction),
    permissionDeduction: num(raw.permissionDeduction),
    attendanceLoss: num(raw.attendanceLoss),
    otPay: num0(raw.otPay),
    pf: num0(raw.pf),
    esi: num0(raw.esi),
    tds: num0(raw.tds),
    tdsPercent: num(raw.tdsPercent),
    statutory: num0(raw.statutory),
    advance: num0(raw.advance),
    otherDeductions: num0(raw.otherDeductions),
    totalDeductions: num0(raw.totalDeductions),
    netPayable: num0(raw.netPayable),
    counts: readCounts(raw.counts),
    notes,
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map(readStep).filter((s): s is SalaryStep => s !== null),
    reconciles: raw.reconciles !== false,
    payroll: readPayroll(raw.payroll),
  }
}

function readSummary(raw: unknown): YearSummary {
  const s = isObject(raw) ? raw : {}
  return {
    periods: num0(s.periods),
    allocated: num(s.allocated),
    allocatedPeriods: num0(s.allocatedPeriods),
    earnedGross: num0(s.earnedGross),
    absentLoss: num(s.absentLoss),
    lateDeduction: num(s.lateDeduction),
    permissionDeduction: num(s.permissionDeduction),
    attendanceLoss: num(s.attendanceLoss),
    otPay: num0(s.otPay),
    statutory: num0(s.statutory),
    advance: num0(s.advance),
    otherDeductions: num0(s.otherDeductions),
    totalDeductions: num0(s.totalDeductions),
    netPayable: num0(s.netPayable),
  }
}

/** The reply of GET /my/salary-insights, or null when it is not one (an older backend's 404 page, a proxy's page). */
export function normalizeInsights(raw: unknown): SalaryInsights | null {
  if (!isObject(raw) || !Array.isArray(raw.periods)) return null
  const year = num(raw.year)
  if (year == null) return null
  const years = (Array.isArray(raw.years) ? raw.years : []).map(num).filter((y): y is number => y != null)
  if (!years.includes(year)) years.push(year)
  years.sort((a, b) => b - a)
  return {
    employmentType: str(raw.employmentType) || 'staff',
    year,
    years: [...new Set(years)],
    periods: raw.periods.map(normalizePeriod).filter((p): p is SalaryPeriod => p !== null),
    summary: readSummary(raw.summary),
    notes: (Array.isArray(raw.notes) ? raw.notes : []).map(str).filter((n) => n !== ''),
  }
}

// ---- wording ----------------------------------------------------------------------------------------------------

/** Does this employee / period have a fixed monthly salary to compare with? (Production pay is per shift.) */
export function isProductionInsights(i: Pick<SalaryInsights, 'employmentType' | 'periods'>): boolean {
  if (i.employmentType === 'production') return true
  return i.periods.length > 0 && i.periods.every((p) => p.kind === 'production')
}

/** "Weekly pay" for a production period whose server label is "Weekly"; null for a monthly staff slip. */
export function cycleText(p: Pick<SalaryPeriod, 'period'>): string | null {
  const c = p.period.cycleLabel
  if (!c) return null
  return /\bpay$/i.test(c) ? c : `${c} pay`
}

/** The plain-English "what did I lose" line of one period. */
export function lossSentence(p: SalaryPeriod): string {
  const title = p.period.label || 'this period'
  if (p.allocated == null) {
    const head = p.notes.allocated || 'There is no fixed salary to compare with for this pay.'
    return p.lateDeduction
      ? `${head} Late arrivals cost you ${formatINR(p.lateDeduction)} in ${title}.`
      : head
  }
  const loss = p.attendanceLoss ?? 0
  if (loss <= 0) return `You lost nothing to attendance in ${title}.`
  const parts: string[] = []
  if (p.absentLoss) {
    const working = p.counts.workingDays
    const paid = p.counts.paidDays
    const days = working != null && paid != null ? Math.round((working - paid) * 100) / 100 : null
    parts.push(
      days != null && days > 0
        ? `${formatINR(p.absentLoss)} for ${plainCount(days)} ${days === 1 ? 'day' : 'days'} not paid`
        : `${formatINR(p.absentLoss)} for days not paid`,
    )
  }
  if (p.lateDeduction) parts.push(`${formatINR(p.lateDeduction)} late deduction`)
  if (p.permissionDeduction) parts.push(`${formatINR(p.permissionDeduction)} permission deduction`)
  return parts.length ? `You lost ${formatINR(loss)} in ${title}: ${parts.join(', ')}.` : `You lost ${formatINR(loss)} in ${title}.`
}

/** The newest period (the server sends oldest first), or null. */
export function latestPeriod(periods: readonly SalaryPeriod[]): SalaryPeriod | null {
  return periods.length ? periods[periods.length - 1] : null
}

/** Newest first, for the slip list. */
export function periodsNewestFirst(periods: readonly SalaryPeriod[]): SalaryPeriod[] {
  return [...periods].reverse()
}

/** The figure a slip row shows as its loss: what attendance cost (absent + late + permission), else just the late
 *  deduction for a period with no fixed salary; null when there is nothing to say. */
export function periodLoss(p: SalaryPeriod): number | null {
  if (p.attendanceLoss != null) return p.attendanceLoss > 0 ? p.attendanceLoss : 0
  if (p.lateDeduction != null) return p.lateDeduction > 0 ? p.lateDeduction : 0
  return null
}

// ---- the comparison chart ---------------------------------------------------------------------------------------

export interface CompareRow {
  key: string
  slipId: number
  label: string
  /** The whole (allocated salary); for a period with no fixed salary, the earned pay itself. */
  total: number
  /** Earned for attendance. */
  value: number
  net: number
  lost: number | null
  hasAllocated: boolean
}

/** One row per period, oldest first (left-to-right reading of a year): allocated vs earned, with net and loss. */
export function compareRows(periods: readonly SalaryPeriod[]): CompareRow[] {
  return periods.map((p) => ({
    key: String(p.slipId),
    slipId: p.slipId,
    label: p.period.shortLabel || p.period.label || `Slip ${p.slipNumber || p.slipId}`,
    total: p.allocated ?? p.earnedGross,
    value: p.earnedGross,
    net: p.netPayable,
    lost: p.attendanceLoss,
    hasAllocated: p.allocated != null,
  }))
}

// ---- where the money went (the year's totals) -------------------------------------------------------------------

export type MoneyTone = 'emerald' | 'rose' | 'amber' | 'sapphire' | 'violet' | 'slate'

export interface MoneyRow {
  key: string
  label: string
  value: number
  tone: MoneyTone
  hint?: string
}

/** The year's totals as ranked rows: paid to you, lost to attendance (by kind), PF / ESI / tax, advance recovery,
 *  overtime added. Rows with nothing in them are left out; the server's figures only. */
export function moneyWentRows(s: YearSummary): MoneyRow[] {
  const rows: MoneyRow[] = [
    { key: 'net', label: 'Paid to you', value: s.netPayable, tone: 'emerald', hint: 'The final payable of every slip, added up.' },
    { key: 'absent', label: 'Days not paid', value: s.absentLoss ?? 0, tone: 'rose', hint: 'Allocated salary you did not earn because of absent or unpaid days.' },
    { key: 'late', label: 'Late deductions', value: s.lateDeduction ?? 0, tone: 'amber' },
    { key: 'permission', label: 'Permission deductions', value: s.permissionDeduction ?? 0, tone: 'amber' },
    { key: 'statutory', label: 'PF, ESI and income tax', value: s.statutory, tone: 'sapphire', hint: 'Deducted by law; PF is saved for you.' },
    { key: 'advance', label: 'Advance and loan recovery', value: s.advance, tone: 'violet' },
    { key: 'other', label: 'Other deductions', value: s.otherDeductions, tone: 'slate' },
    { key: 'ot', label: 'Overtime pay added', value: s.otPay, tone: 'emerald' },
  ]
  return rows.filter((r) => r.value > 0)
}

// ---- the waterfall ----------------------------------------------------------------------------------------------

/** The kit Waterfall's step shape (components/kit/Waterfall.tsx), kept structural so this file stays pure. */
export interface ChartStep {
  key: string
  label: string
  amount: number
  kind: 'start' | 'add' | 'subtract' | 'total'
  hint?: string
}

const OP_TO_KIND: Record<StepOp, ChartStep['kind']> = {
  start: 'start',
  plus: 'add',
  minus: 'subtract',
  subtotal: 'total',
  total: 'total',
}

/**
 * The server's steps for the kit Waterfall: monthly salary -> minus days not paid -> earned -> plus OT -> minus late ->
 * minus permission -> minus PF / ESI / TDS / advance -> final payable, each with the server's one sentence as its hint.
 * A step the slip does not record (amount null) cannot be drawn: it goes to `missing` with its reason.
 */
export function waterfallFor(steps: readonly SalaryStep[]): { chart: ChartStep[]; missing: SalaryStep[] } {
  const chart: ChartStep[] = []
  const missing: SalaryStep[] = []
  for (const s of steps) {
    if (s.amount == null) {
      missing.push(s)
      continue
    }
    chart.push({
      key: s.key || `${s.op}-${chart.length}`,
      label: s.label || 'Line',
      amount: Math.abs(s.amount),
      kind: OP_TO_KIND[s.op],
      ...(s.note ? { hint: s.note } : {}),
    })
  }
  return { chart, missing }
}

// ---- attendance counts ------------------------------------------------------------------------------------------

export interface CountFact {
  key: string
  label: string
  value: string
  hint?: string
}

/** The attendance figures a slip shows, in plain words; only what the slip recorded. */
export function attendanceFacts(p: Pick<SalaryPeriod, 'kind' | 'counts'>): CountFact[] {
  const c = p.counts
  const out: CountFact[] = []
  const add = (key: string, label: string, value: number | null, hint?: string) => {
    if (value == null) return
    out.push({ key, label, value: plainCount(value), ...(hint ? { hint } : {}) })
  }
  if (p.kind === 'production') {
    add('totalShifts', 'Shifts worked', c.totalShifts)
    add('daysWorked', 'Days worked', c.daysWorked)
    add('totalDays', 'Days in the period', c.totalDays)
    add('absentDays', 'Absent days', c.absentDays)
    if (c.ratePerShift != null) out.push({ key: 'ratePerShift', label: 'Pay a shift', value: formatINR(c.ratePerShift) })
  } else {
    add('workingDays', 'Working days', c.workingDays)
    add('paidDays', 'Days paid', c.paidDays)
    add('presentDays', 'Days present', c.presentDays)
    add('absentDays', 'Absent days', c.absentDays)
    add('paidLeaveDays', 'Paid leave', c.paidLeaveDays)
    add('unpaidLeaveDays', 'Unpaid leave', c.unpaidLeaveDays)
    add('halfDays', 'Half days', c.halfDays)
    if (c.dailyRate != null) out.push({ key: 'dailyRate', label: 'Pay a day', value: formatINR(c.dailyRate) })
  }
  const lateHint =
    c.freeLateMarks != null || c.billableLateMarks != null
      ? `${plainCount(c.freeLateMarks ?? 0)} free, ${plainCount(c.billableLateMarks ?? 0)} charged`
      : undefined
  add('lateMarks', 'Late marks', c.lateMarks, lateHint)
  const permHint =
    c.permissionsFree != null || c.permissionsCharged != null
      ? `${plainCount(c.permissionsFree ?? 0)} free, ${plainCount(c.permissionsCharged ?? 0)} charged`
      : undefined
  add('permissionsApproved', 'Permissions', c.permissionsApproved, permHint)
  return out
}

// ---- the slip list (GET /my/salary-slips, the fallback when the insights cannot load) ---------------------------

/** The part of a slip (GET /my/salary-slips) the list reads. */
export interface SlipLike {
  id: number | string
  month: number
  year: number
  weekNumber?: number | null
  payCycle?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  slipNumber?: string | null
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = MONTHS.map((m) => m.slice(0, 3))
const CYCLE_LABELS: Record<string, string> = { weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly' }

function ymd(iso: string | null | undefined): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** "October 2026", "5 Oct - 11 Oct 2026" (a production period), "Week 2 of October 2026" (an old weekly slip). */
export function slipPeriodLabel(s: SlipLike): string {
  const a = ymd(s.periodStart)
  const b = ymd(s.periodEnd)
  if (a && b) {
    const left = `${a[2]} ${MON[a[1] - 1]}${a[0] !== b[0] ? ` ${a[0]}` : ''}`
    return `${left} - ${b[2]} ${MON[b[1] - 1]} ${b[0]}`
  }
  const month = MONTHS[s.month - 1] ?? String(s.month)
  return s.weekNumber ? `Week ${s.weekNumber} of ${month} ${s.year}` : `${month} ${s.year}`
}

/** "Weekly pay", "Bi-weekly pay", "Monthly pay" for a production slip; null for a staff slip. */
export function slipCycleLabel(s: SlipLike): string | null {
  const c = (s.payCycle ?? '').toLowerCase()
  return CYCLE_LABELS[c] ? `${CYCLE_LABELS[c]} pay` : null
}

/** Newest first: by the period's start for production slips, else by year, month and week. */
export function sortSlipsNewestFirst<T extends SlipLike>(slips: readonly T[]): T[] {
  const key = (s: SlipLike) => {
    const start = ymd(s.periodStart)
    const day = start ? start[2] : 0
    return s.year * 1_000_000 + s.month * 10_000 + day * 100 + (s.weekNumber ?? 0)
  }
  return [...slips].sort((a, b) => key(b) - key(a) || Number(b.id) - Number(a.id))
}

/** A file name for the slip's PDF that never collides between two slips of the same month (weekly production pay). */
export function slipPdfFileName(s: { id: number | string; month?: number | null; year?: number | null; slipNumber?: string | null }): string {
  const fallback = s.year && s.month ? `${s.year}-${String(s.month).padStart(2, '0')}-${s.id}` : String(s.id)
  const base = (s.slipNumber || fallback).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return `salary-slip-${base || s.id}.pdf`
}

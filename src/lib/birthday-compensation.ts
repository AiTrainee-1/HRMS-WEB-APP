// Birthday Compensation on a chosen date (owner 2026-11-25). A birthday NOT worked is still paid birthday leave on the day,
// automatically. A birthday WORKED (present, or even a half day) gives 1.00 day of Birthday Compensation the employee
// places on working days of the BIRTHDAY MONTH: a full day, or a first / second half (the two halves may go on two
// different dates). Each placement is a request the Department Head, THEN HR, approve; HR's approval pays that day (or
// half) like a Casual Leave. A waiting one can be withdrawn; what is not placed by the end of the month lapses. New
// birthday CREDIT claims are no longer possible (old ones stay readable under Claims).
//
// The server (backend/api/birthday_compensation*.py, api-database-reference.md "Compensation - Birthday Compensation on a
// chosen date"):
//   GET    /employee/compensation/birthday?year=     the entitlement: days (total / held / used / available / lapsed),
//                                                    every day of the month with the parts it can take, the uses
//   GET    /employee/compensation/birthday/uses      every placement, newest first ({items, total, isStaff})
//   POST   /employee/compensation/birthday/uses      {useDate, portion: full | first_half | second_half, reason?} -> 201
//   DELETE /employee/compensation/birthday/uses/<id> -> the use, withdrawn
// The Department Head decides with PATCH /manager/birthday-compensation/<id>/status (lib/approvals-items.ts words it).
// Every refusal is {error, code} with a sentence for people, shown as it is.
//
// Defensive like lib/compensation.ts: any field may be missing on an older or newer server, nothing here can throw.
// Pure TypeScript (only other pure lib modules), so Node's test runner runs it: `npm test`.
import { isoDateOrNull } from './compensation.ts'
import { dayText } from './my-requests.ts'
import { humanize } from './strings.ts'
import type { ApprovalProgress } from '../types/index.ts'

// ---- words ----------------------------------------------------------------------------------------------------------

export type Portion = 'full' | 'first_half' | 'second_half'
export const PORTIONS: readonly Portion[] = ['full', 'first_half', 'second_half']

export const PORTION_LABEL: Record<Portion, string> = {
  full: 'Full day',
  first_half: 'First half',
  second_half: 'Second half',
}

/** How much of the 1.00 day each part holds. */
export const PORTION_DAYS: Record<Portion, number> = { full: 1, first_half: 0.5, second_half: 0.5 }

/** "the full day" / "the first half" / "the second half", inside a sentence. */
export const PORTION_PHRASE: Record<Portion, string> = {
  full: 'the full day',
  first_half: 'the first half',
  second_half: 'the second half',
}

export const BDC_REASON_MAX = 500

export function isPortion(value: unknown): value is Portion {
  return typeof value === 'string' && (PORTIONS as readonly string[]).includes(value)
}

/** 1 -> '1.00 day', 0.5 -> '0.50 day', 0 -> '0.00 day', 1.5 -> '1.50 days' (the way the HRMS writes days). */
export function daysText(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  return `${n.toFixed(2)} ${n > 1 ? 'days' : 'day'}`
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** '2026-03-31' -> '31 Mar'; '' for anything else. */
export function shortDay(iso: string | null | undefined): string {
  const d = isoDateOrNull(iso)
  return d ? `${Number(d.slice(8, 10))} ${SHORT_MONTHS[Number(d.slice(5, 7)) - 1]}` : ''
}

/** '2026-03-05' -> 'March 2026'; '' for anything else. */
export function monthOfDay(iso: string | null | undefined): string {
  const d = isoDateOrNull(iso)
  return d ? `${LONG_MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : ''
}

// ---- parsing --------------------------------------------------------------------------------------------------------

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strOrNull = (v: unknown): string | null => str(v) || null
const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
const nonNegative = (v: unknown): number => Math.max(0, num(v) ?? 0)

export interface BdcDays {
  /** 1.00 when the birthday was worked, else 0. */
  total: number
  /** Waiting for a decision. */
  held: number
  /** Approved. */
  used: number
  /** What can still be placed (0 once the month is over). */
  available: number
  /** Never placed (only after the month). */
  lapsed: number
}

/** A placement already on a day of the month. */
export interface BdcPlaced {
  id: number | string | null
  portion: string
  status: string
}

/** One day of the birthday month and what it can take. */
export interface BdcDay {
  date: string
  weekday: string
  /** future | today | absent | on_leave | half_shift | present | holiday | birthday | off_day | not_joined | locked |
   *  casual_leave | compensation | none (anything else is drawn generically) */
  status: string
  label: string
  /** At least one part can be placed on it. */
  selectable: boolean
  /** The parts it can take, in the server's order (a half day: the missed half first, then the full day). */
  portions: Portion[]
  /** The part to start with. */
  suggested: Portion | null
  /** Why it cannot be chosen (or why only halves). */
  reason: string | null
  /** Half days: the half that was worked ('morning' | 'evening'). */
  worked: string | null
  /** The clock times of each half on that day's shift ("08:30-13:00"). */
  halves: { first: string | null; second: string | null } | null
  placed: BdcPlaced[]
}

export interface BdcMonth {
  year: number
  /** 1..12 */
  month: number
  label: string
  /** 'YYYY-MM-DD' first and last day. */
  from: string
  to: string
}

export interface BdcEnabled {
  master: boolean
  birthday: boolean
  workflow: boolean
  canPlace: boolean
}

export interface BdcUse {
  id: number | string
  /** "bdcu-<id>": the key a notification's View link points at. */
  key: string
  employeeName: string
  employeeCode: string
  department: string | null
  /** 'YYYY-MM-DD' of the birthday it is for. */
  birthday: string | null
  /** "Thursday 5 Mar 2026" (the server's words, else ours). */
  birthdayText: string
  useDate: string | null
  useDateText: string
  /** full | first_half | second_half (anything else is drawn generically). */
  portion: string
  portionLabel: string
  days: number | null
  /** pending | approved | rejected | withdrawn */
  status: string
  /** pending (waiting for the Department Head) | pending_hr | approved | rejected | withdrawn */
  statusKey: string
  /** The server's words for where it stands ('' when it sent none). */
  statusLabel: string
  reason: string
  raisedByRole: 'employee' | 'hr' | null
  requestedBy: string | null
  createdAt: string | null
  hodReviewedBy: string | null
  hodReviewComment: string | null
  hrReviewedBy: string | null
  hrReviewComment: string | null
  reviewedBy: string | null
  reviewComment: string | null
  withdrawnAt: string | null
  canWithdraw: boolean
  approval: ApprovalProgress | null
}

export interface BdcEntitlement {
  /** false for a production employee: Birthday Compensation is for staff only. */
  isStaff: boolean
  birthday: string | null
  birthdayText: string | null
  month: BdcMonth | null
  /** available | placed | lapsed | upcoming | paid_leave | credit_claim | off_day | old_rule | not_eligible */
  state: string
  stateLabel: string
  /** The server's sentence about this birthday. */
  message: string | null
  /** The birthday was worked: true / false, null while it is still to come. */
  worked: boolean | null
  days: BdcDays
  windowOpen: boolean
  /** 'YYYY-MM-DD' the unplaced part lapses (the month's last day). */
  lapsesOn: string | null
  canPlace: boolean
  /** Why it cannot be placed (switched off, no Department Head, nothing left ...). */
  placeMessage: string | null
  uses: BdcUse[]
  eligibleDates: BdcDay[]
  /** An open birthday CREDIT claim from before 2026-11-25 (state credit_claim): nothing to place for this birthday. */
  creditClaim: { id: number | string | null; status: string; shifts: number | null; workDate: string | null } | null
  /** "Employee or HR → HOD → HR" */
  approvalPath: string | null
  enabled: BdcEnabled | null
  /** The server's today ('YYYY-MM-DD'). */
  today: string | null
}

function readHalves(raw: unknown): BdcDay['halves'] {
  if (!isObj(raw)) return null
  const first = strOrNull(raw.first)
  const second = strOrNull(raw.second)
  return first || second ? { first, second } : null
}

function readPlaced(raw: unknown): BdcPlaced[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isObj).map((p) => ({
    id: typeof p.id === 'number' || (typeof p.id === 'string' && p.id.trim()) ? (p.id as number | string) : null,
    portion: str(p.portion),
    status: str(p.status),
  }))
}

function readDay(raw: unknown): BdcDay | null {
  if (!isObj(raw)) return null
  const date = isoDateOrNull(raw.date)
  if (!date) return null
  const portions = (Array.isArray(raw.portions) ? raw.portions : []).filter(isPortion)
  const suggested = isPortion(raw.suggested) && portions.includes(raw.suggested) ? raw.suggested : null
  const status = str(raw.status) || 'none'
  return {
    date,
    weekday: str(raw.weekday),
    status,
    label: str(raw.label) || humanize(status),
    // The server's `selectable` is "portions is not empty"; a day with no usable part is never selectable here.
    selectable: portions.length > 0 && raw.selectable !== false,
    portions: [...new Set(portions)],
    suggested,
    reason: strOrNull(raw.reason),
    worked: strOrNull(raw.worked),
    halves: readHalves(raw.halves),
    placed: readPlaced(raw.placed),
  }
}

function readMonth(raw: unknown, birthday: string | null): BdcMonth | null {
  const r = isObj(raw) ? raw : {}
  const year = num(r.year) ?? (birthday ? Number(birthday.slice(0, 4)) : null)
  const month = num(r.month) ?? (birthday ? Number(birthday.slice(5, 7)) : null)
  if (year === null || month === null || month < 1 || month > 12) return null
  const mm = String(month).padStart(2, '0')
  const last = new Date(year, month, 0).getDate()
  return {
    year,
    month,
    label: str(r.label) || `${LONG_MONTHS[month - 1]} ${year}`,
    from: isoDateOrNull(r.from) ?? `${year}-${mm}-01`,
    to: isoDateOrNull(r.to) ?? `${year}-${mm}-${String(last).padStart(2, '0')}`,
  }
}

function readEnabled(raw: unknown): BdcEnabled | null {
  if (!isObj(raw)) return null
  return { master: raw.master === true, birthday: raw.birthday === true, workflow: raw.workflow === true, canPlace: raw.canPlace === true }
}

/** One placement (GET /employee/compensation/birthday/uses, the entitlement's `uses`, the approvals lists), or null. */
export function parseUse(raw: unknown): BdcUse | null {
  if (!isObj(raw)) return null
  const id = typeof raw.id === 'number' || (typeof raw.id === 'string' && raw.id.trim()) ? (raw.id as number | string) : null
  if (id === null) return null
  const employee = isObj(raw.employee) ? raw.employee : {}
  const birthday = isoDateOrNull(raw.birthday)
  const useDate = isoDateOrNull(raw.useDate) ?? isoDateOrNull(raw.date)
  const portion = str(raw.portion)
  const status = str(raw.status) || 'pending'
  const role = str(raw.raisedByRole)
  const raisedByRole = role === 'employee' || role === 'hr' ? role : null
  const approval = isObj(raw.approval) && Array.isArray(raw.approval.steps) ? (raw.approval as unknown as ApprovalProgress) : null
  return {
    id,
    key: `bdcu-${id}`,
    employeeName: str(raw.employeeName) || str(employee.name) || 'Employee',
    employeeCode: str(raw.employeeCode) || str(employee.employeeCode),
    department: strOrNull(raw.department) ?? strOrNull(employee.department),
    birthday,
    birthdayText: str(raw.birthdayText) || (birthday ? dayText(birthday) : ''),
    useDate,
    useDateText: str(raw.useDateText) || (useDate ? dayText(useDate) : ''),
    portion,
    portionLabel: str(raw.portionLabel) || (isPortion(portion) ? PORTION_LABEL[portion] : humanize(portion)),
    days: num(raw.days) ?? (isPortion(portion) ? PORTION_DAYS[portion] : null),
    status,
    statusKey: str(raw.statusKey) || status,
    statusLabel: str(raw.statusLabel),
    reason: str(raw.reason),
    raisedByRole,
    requestedBy: strOrNull(raw.requestedBy),
    createdAt: strOrNull(raw.createdAt),
    hodReviewedBy: strOrNull(raw.hodReviewedBy),
    hodReviewComment: strOrNull(raw.hodReviewComment),
    hrReviewedBy: strOrNull(raw.hrReviewedBy),
    hrReviewComment: strOrNull(raw.hrReviewComment),
    reviewedBy: strOrNull(raw.reviewedBy),
    reviewComment: strOrNull(raw.reviewComment),
    withdrawnAt: strOrNull(raw.withdrawnAt),
    // The server's word when it gives one (never on a decided use); else a waiting one the employee placed.
    canWithdraw:
      typeof raw.canWithdraw === 'boolean' ? raw.canWithdraw && status === 'pending' : status === 'pending' && raisedByRole === 'employee',
    approval,
  }
}

/** Placements in any shape a server may send ([...], {items}, {uses}), unique by id, or null when it is none of them. */
export function normalizeUses(raw: unknown): BdcUse[] | null {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? (Array.isArray(raw.items) ? raw.items : Array.isArray(raw.uses) ? raw.uses : null) : null
  if (!list) return null
  const seen = new Set<string>()
  const out: BdcUse[] = []
  for (const entry of list) {
    const u = parseUse(entry)
    if (!u || seen.has(u.key)) continue
    seen.add(u.key)
    out.push(u)
  }
  return out
}

/**
 * GET /employee/compensation/birthday validated and coerced; null when the answer is not one (an HTML page from a proxy).
 * A production employee's answer (`isStaff: false`) is a valid one with nothing to place.
 */
export function parseEntitlement(raw: unknown): BdcEntitlement | null {
  if (!isObj(raw)) return null
  if (typeof raw.state !== 'string' && typeof raw.isStaff !== 'boolean') return null
  const birthday = isoDateOrNull(raw.birthday)
  const d = isObj(raw.days) ? raw.days : {}
  const claim = isObj(raw.creditClaim) ? raw.creditClaim : null
  const state = str(raw.state) || 'not_eligible'
  return {
    isStaff: raw.isStaff !== false,
    birthday,
    birthdayText: strOrNull(raw.birthdayText) ?? (birthday ? dayText(birthday) : null),
    month: birthday || isObj(raw.month) ? readMonth(raw.month, birthday) : null,
    state,
    stateLabel: str(raw.stateLabel) || humanize(state),
    message: strOrNull(raw.message),
    worked: typeof raw.worked === 'boolean' ? raw.worked : null,
    days: {
      total: nonNegative(d.total),
      held: nonNegative(d.held),
      used: nonNegative(d.used),
      available: nonNegative(d.available),
      lapsed: nonNegative(d.lapsed),
    },
    windowOpen: raw.windowOpen === true,
    lapsesOn: isoDateOrNull(raw.lapsesOn),
    canPlace: raw.canPlace === true,
    placeMessage: strOrNull(raw.placeMessage),
    uses: normalizeUses(raw.uses) ?? [],
    eligibleDates: (Array.isArray(raw.eligibleDates) ? raw.eligibleDates : []).map(readDay).filter((x): x is BdcDay => x !== null),
    creditClaim: claim
      ? {
          id: typeof claim.id === 'number' || typeof claim.id === 'string' ? (claim.id as number | string) : null,
          status: str(claim.status),
          shifts: num(claim.shifts),
          workDate: isoDateOrNull(claim.workDate),
        }
      : null,
    approvalPath: strOrNull(raw.approvalPath),
    enabled: readEnabled(raw.enabled),
    today: isoDateOrNull(raw.today),
  }
}

// ---- the card -------------------------------------------------------------------------------------------------------

export interface StateInfo {
  label: string
  /** Chip tone (index.css). */
  chip: string
  live: boolean
}

const STATE_CHIP: Record<string, string> = {
  available: 'chip-info',
  placed: 'chip-success',
  lapsed: 'chip-muted',
  upcoming: 'chip-info',
  paid_leave: 'chip-success',
  credit_claim: 'chip-violet',
}

/** Where this birthday stands, as a chip: the server's words, a tone per state; a state never seen is neutral. */
export function stateInfo(ent: Pick<BdcEntitlement, 'state' | 'stateLabel' | 'days'>): StateInfo {
  const waiting = ent.state === 'placed' && ent.days.held > 0
  return {
    label: ent.stateLabel || humanize(ent.state) || 'Birthday',
    chip: waiting ? 'chip-warning' : Object.hasOwn(STATE_CHIP, ent.state) ? STATE_CHIP[ent.state] : 'chip-muted',
    live: ent.state === 'available' || waiting,
  }
}

export interface BdcFigure {
  key: 'available' | 'held' | 'used' | 'lapsed'
  label: string
  value: number
  text: string
}

/**
 * The 1.00 day in figures: to place, waiting, approved, and lapsed (only once something lapsed). Empty when the birthday
 * gives nothing to place (not worked, still to come, an old credit claim ...).
 */
export function bdcFigures(ent: Pick<BdcEntitlement, 'days' | 'state'> | null | undefined): BdcFigure[] {
  if (!ent || ent.days.total <= 0) return []
  const rows: BdcFigure[] = [
    { key: 'available', label: 'To place', value: ent.days.available, text: daysText(ent.days.available) },
    { key: 'held', label: 'Waiting', value: ent.days.held, text: daysText(ent.days.held) },
    { key: 'used', label: 'Approved', value: ent.days.used, text: daysText(ent.days.used) },
  ]
  if (ent.days.lapsed > 0 || ent.state === 'lapsed') rows.push({ key: 'lapsed', label: 'Lapsed', value: ent.days.lapsed, text: daysText(ent.days.lapsed) })
  return rows
}

/**
 * One line for the balance: "1.00 day to place by 31 Mar", "0.50 day to place by 31 Mar, 0.50 day waiting for approval",
 * "0.50 day approved, 0.50 day lapsed". Null when there is nothing to say (the birthday gives nothing to place).
 */
export function bdcBalanceText(ent: Pick<BdcEntitlement, 'days' | 'lapsesOn'> | null | undefined): string | null {
  if (!ent || ent.days.total <= 0) return null
  const { available, held, used, lapsed } = ent.days
  const by = shortDay(ent.lapsesOn)
  const parts: string[] = []
  if (available > 0) parts.push(`${daysText(available)} to place${by ? ` by ${by}` : ''}`)
  if (held > 0) parts.push(`${daysText(held)} waiting for approval`)
  if (used > 0) parts.push(`${daysText(used)} approved`)
  if (lapsed > 0) parts.push(`${daysText(lapsed)} lapsed`)
  return parts.length ? parts.join(', ') : null
}

/** Something to place right now: the banner on the other views and the card's button. */
export function bdcReady(ent: Pick<BdcEntitlement, 'canPlace' | 'state' | 'days'> | null | undefined): boolean {
  return !!ent && ent.canPlace && ent.state === 'available' && ent.days.available > 0
}

/** Why the "Choose the day" button is off, in words; null while it can be used. */
export function placeBlocked(ent: BdcEntitlement | null | undefined): string | null {
  if (!ent) return 'Birthday Compensation is not available yet.'
  if (bdcReady(ent)) return null
  if (ent.placeMessage) return ent.placeMessage
  if (ent.state === 'placed') return 'All of your Birthday Compensation is placed. Withdraw a waiting one to place it on another day.'
  if (ent.state === 'lapsed') return `${ent.month?.label ?? 'Your birthday month'} is over: what was not placed has lapsed.`
  return ent.message ?? 'There is no Birthday Compensation to place right now.'
}

// ---- choosing the day -------------------------------------------------------------------------------------------------

export const WEEKDAYS: readonly string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface BdcCell {
  date: string
  /** 1..31 */
  day: number
  /** The server's word on the day (null when it sent none: never selectable). */
  info: BdcDay | null
  selectable: boolean
  birthday: boolean
  today: boolean
  /** Waiting or approved placements on the day. */
  placed: BdcPlaced[]
}

/**
 * The birthday month as a calendar (Sunday first, as the attendance calendar): a blank for each day before the 1st,
 * then every day with what the server said about it. Null without a month (no birthday known).
 */
export function bdcCalendar(ent: Pick<BdcEntitlement, 'month' | 'eligibleDates' | 'birthday' | 'today'> | null | undefined): (BdcCell | null)[] | null {
  const m = ent?.month
  if (!ent || !m) return null
  const byDate = new Map(ent.eligibleDates.map((d) => [d.date, d]))
  const first = new Date(m.year, m.month - 1, 1)
  const last = new Date(m.year, m.month, 0).getDate()
  const mm = String(m.month).padStart(2, '0')
  const cells: (BdcCell | null)[] = Array.from({ length: first.getDay() }, () => null)
  for (let day = 1; day <= last; day++) {
    const date = `${m.year}-${mm}-${String(day).padStart(2, '0')}`
    const info = byDate.get(date) ?? null
    cells.push({
      date,
      day,
      info,
      selectable: !!info?.selectable,
      birthday: date === ent.birthday,
      today: date === ent.today,
      placed: (info?.placed ?? []).filter((p) => p.status === 'pending' || p.status === 'approved'),
    })
  }
  return cells
}

export interface PortionChoice {
  portion: Portion
  label: string
  days: number
  /** "0.50 day · 08:30-13:00": how much and (halves) when. */
  hint: string
  allowed: boolean
  /** Why it cannot be picked; null when it can. */
  why: string | null
}

const halfTaken = (day: BdcDay, portion: Portion) =>
  day.placed.some((p) => (p.status === 'pending' || p.status === 'approved') && (p.portion === 'full' || p.portion === portion || portion === 'full'))

/**
 * The three parts for the picked day: each allowed when the day takes it AND it fits in what is left (0.50 left: halves
 * only), else with the reason. No day picked yet: all off, "Pick a day first".
 */
export function portionChoices(day: BdcDay | null | undefined, available: number): PortionChoice[] {
  return PORTIONS.map((portion) => {
    const days = PORTION_DAYS[portion]
    const time = portion === 'first_half' ? day?.halves?.first : portion === 'second_half' ? day?.halves?.second : null
    const hint = time ? `${daysText(days)} · ${time}` : daysText(days)
    let why: string | null = null
    if (!day) why = 'Pick a day first'
    else if (!day.portions.includes(portion)) {
      const worked = day.worked === 'morning' ? 'first_half' : day.worked === 'evening' ? 'second_half' : null
      why = worked === portion ? 'You worked this half' : halfTaken(day, portion) ? 'Already placed on this day' : 'Not on this day'
    } else if (days > available + 1e-9) why = `Only ${daysText(available)} left`
    return { portion, label: PORTION_LABEL[portion], days, hint, allowed: why === null, why }
  })
}

/** The part to start with on a picked day: the server's suggestion when it is allowed, else the first part that is. */
export function defaultPortion(day: BdcDay | null | undefined, available: number): Portion | null {
  const choices = portionChoices(day, available)
  const ok = (p: Portion | null | undefined) => !!p && choices.some((c) => c.portion === p && c.allowed)
  if (ok(day?.suggested)) return day!.suggested
  return day?.portions.find((p) => ok(p)) ?? null
}

/** What the line under the calendar says about the picked (or tapped) day. */
export function dayLine(day: BdcDay | null | undefined): string | null {
  if (!day) return null
  const head = `${dayText(day.date)} · ${day.label}`
  if (!day.selectable) return `${head}: ${day.reason ?? 'this day cannot be chosen.'}`
  return day.reason ? `${head}. ${day.reason}` : head
}

export interface PlaceForm {
  date: string
  portion: Portion | null
  reason: string
}

/** Why the placement cannot be sent yet (the server checks everything again), or null. */
export function placeProblem(form: PlaceForm, ent: BdcEntitlement | null | undefined): string | null {
  if (!ent || !bdcReady(ent)) return placeBlocked(ent)
  if (!form.date) return `Pick a day of ${ent.month?.label ?? 'your birthday month'}.`
  const day = ent.eligibleDates.find((d) => d.date === form.date)
  if (!day || !day.selectable) return day?.reason ?? 'That day cannot take Birthday Compensation: pick another one.'
  if (!form.portion) return 'Pick a full day, a first half or a second half.'
  const choices = portionChoices(day, ent.days.available)
  const choice = choices.find((c) => c.portion === form.portion)
  if (!choice?.allowed) {
    const ok = choices.filter((c) => c.allowed).map((c) => c.label.toLowerCase())
    return ok.length
      ? `On ${dayText(day.date)} only ${ok.join(' or ')} can be placed.`
      : `${dayText(day.date)} cannot take Birthday Compensation: pick another day.`
  }
  if (form.reason.trim().length > BDC_REASON_MAX) return `The reason can be at most ${BDC_REASON_MAX} characters.`
  return null
}

export interface PlaceBody {
  useDate: string
  portion: Portion
  reason?: string
}

/** The POST body: the reason only when one was written (the server words a default). */
export function placeBody(form: PlaceForm & { portion: Portion }): PlaceBody {
  const reason = form.reason.trim()
  return reason ? { useDate: form.date, portion: form.portion, reason } : { useDate: form.date, portion: form.portion }
}

/** "The first half of Tuesday 3 Mar 2026" for the sent screen. */
export function placedText(form: { date: string; portion: Portion }): string {
  const phrase = PORTION_PHRASE[form.portion]
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} of ${dayText(form.date)}`
}

// ---- a placement in the list ------------------------------------------------------------------------------------------

const USE_STATUS: Record<string, StateInfo> = {
  pending: { label: 'Waiting for your Department Head', chip: 'chip-warning', live: true },
  pending_hr: { label: 'Approved by your Department Head, waiting for HR', chip: 'chip-info', live: true },
  approved: { label: 'Approved', chip: 'chip-success', live: false },
  rejected: { label: 'Not approved', chip: 'chip-danger', live: false },
  withdrawn: { label: 'Withdrawn', chip: 'chip-muted', live: false },
}

/** Where a placement stands: the server's words, a tone per step (the Department Head's step and HR's are told apart). */
export function placementStatusInfo(use: Pick<BdcUse, 'status' | 'statusKey' | 'statusLabel'>): StateInfo {
  const key = Object.hasOwn(USE_STATUS, use.statusKey) ? use.statusKey : use.status
  const known = Object.hasOwn(USE_STATUS, key) ? USE_STATUS[key] : null
  return {
    label: use.statusLabel || known?.label || humanize(use.status) || 'Status unknown',
    chip: known?.chip ?? 'chip-muted',
    live: known?.live ?? false,
  }
}

/** "First half · Tuesday 3 Mar 2026". */
export function placementWhatLine(use: Pick<BdcUse, 'portionLabel' | 'useDateText' | 'useDate'>): string {
  const day = use.useDateText || (use.useDate ? dayText(use.useDate) : '')
  return [use.portionLabel, day].filter(Boolean).join(' · ') || 'Birthday compensation'
}

/** "Placed by you" / "Placed by HR (Meena)" / "Placed by HR"; '' when the server does not say. */
export function placementRaisedText(use: Pick<BdcUse, 'raisedByRole' | 'requestedBy'>): string {
  if (use.raisedByRole === 'employee') return 'Placed by you'
  if (use.raisedByRole === 'hr') return use.requestedBy ? `Placed by HR (${use.requestedBy})` : 'Placed by HR'
  return ''
}

const by = (name: string | null) => (name ? ` (${name})` : '')

/**
 * Who decided, in one line: "Not approved by HR (Meena): Not a working day.", "Approved by your Department Head (Kavya)
 * and HR (Meena).", "Approved by your Department Head (Kavya); HR decides next."; null while it waits for the head or after
 * a withdrawal. The rejecting step is HR's when HR has stamped it, else the Department Head's.
 */
export function placementDecisionLine(
  use: Pick<BdcUse, 'status' | 'statusKey' | 'hodReviewedBy' | 'hodReviewComment' | 'hrReviewedBy' | 'hrReviewComment' | 'reviewComment'>,
): string | null {
  if (use.status === 'rejected') {
    const hr = !!use.hrReviewedBy
    const who = hr ? `HR${by(use.hrReviewedBy)}` : use.hodReviewedBy ? `your Department Head${by(use.hodReviewedBy)}` : ''
    const comment = use.reviewComment ?? (hr ? use.hrReviewComment : use.hodReviewComment)
    const base = who ? `Not approved by ${who}` : 'Not approved'
    return comment ? `${base}: ${comment}` : `${base}.`
  }
  if (use.status === 'approved') {
    const steps = [use.hodReviewedBy ? `your Department Head${by(use.hodReviewedBy)}` : null, use.hrReviewedBy ? `HR${by(use.hrReviewedBy)}` : null]
    const names = steps.filter(Boolean)
    return names.length ? `Approved by ${names.join(' and ')}.` : 'Approved.'
  }
  if (use.status === 'pending' && use.statusKey === 'pending_hr') {
    const note = use.hodReviewComment ? `: ${use.hodReviewComment}` : ''
    return `Approved by your Department Head${by(use.hodReviewedBy)}${note}; HR decides next.`
  }
  return null
}

/** What withdrawing does: "The 0.50 day can be placed again while March 2026 lasts." */
export function withdrawEffectText(use: Pick<BdcUse, 'days' | 'birthday'>): string {
  const month = monthOfDay(use.birthday)
  return `It stops waiting for approval, and the ${daysText(use.days ?? 0)} can be placed again${month ? ` while ${month} lasts` : ''}.`
}

// ---- the Department Head's card -----------------------------------------------------------------------------------------

/** "Birthday compensation · First half" (the type chip on the Approvals card). */
export function placementTypeLabel(use: Pick<BdcUse, 'portionLabel'>): string {
  return use.portionLabel ? `Birthday compensation · ${use.portionLabel}` : 'Birthday compensation'
}

/** The label / value rows of the decision dialog: who placed it, the birthday, the day and the part. */
export function placementFacts(use: BdcUse): [string, string][] {
  const raised =
    use.raisedByRole === 'employee' ? `${use.employeeName} (employee)` : use.raisedByRole === 'hr' ? (use.requestedBy ? `${use.requestedBy} (HR)` : 'HR') : null
  const rows: [string, string | null][] = [
    ['Placed by', raised],
    ['Birthday', use.birthdayText || null],
    ['Placed on', use.useDateText || null],
    ['Part', use.portionLabel ? `${use.portionLabel}${use.days ? ` (${daysText(use.days)})` : ''}` : null],
  ]
  return rows.filter((r): r is [string, string] => !!r[1])
}

/** What approving does, for the head: HR decides last, then the day (or half) is paid like a Casual Leave. */
export function placementApproveText(use: Pick<BdcUse, 'employeeName' | 'portion' | 'useDate' | 'useDateText'>): string {
  const first = use.employeeName.split(/\s+/)[0] || 'the employee'
  const part = isPortion(use.portion) ? PORTION_PHRASE[use.portion].replace(/^the /, '') : 'day'
  const day = shortDay(use.useDate) || use.useDateText
  return `Approving passes it to HR, who decides last. Once HR approves, ${first}'s ${part}${day ? ` on ${day}` : ''} is paid like a Casual Leave (no leave balance is used).`
}

/** Extra context under the request: whose birthday, and that it was worked. */
export function placementNote(use: Pick<BdcUse, 'birthdayText' | 'birthday'>): string {
  const month = monthOfDay(use.birthday)
  const birthday = use.birthdayText || (use.birthday ? dayText(use.birthday) : 'their birthday')
  return `They worked on their birthday (${birthday}), so 1.00 day of Birthday Compensation can be placed on working days of ${month || 'the birthday month'}.`
}

// The Compensation page's logic: GET /employee/compensation (backend/api/employee_compensation_views.py) validated and
// turned into what the screen draws. The Mobile App reads the same endpoint; the wording of every sentence the server
// writes (title, detail, statusLabel, askHr) is the server's, this file only groups, filters, tones and formats.
//
// Defensive on purpose: the deployed app must keep working against an older or newer backend, so nothing is required but
// the answer being an object, an unknown `kind` / `status` / `group` is drawn generically (never rejected, never a
// crash) and a missing key falls back to a neutral value. Pure TypeScript (it imports only other pure lib modules and types),
// so Node's test runner can run it: `npm test`.
import type { MarkerSymbolName } from './attendance-flags.ts'
import { isIsoDate } from './request-window.ts'
import { humanize } from './strings.ts'
import { normalizeContactBlock, type SupportContactBlock } from './contact-block.ts'

// ---- Contract ---------------------------------------------------------------------------------------------------

/** The kinds the backend sends today. `kind` itself stays a string: a new one renders generically. */
export type CompensationKind =
  | 'ot_allowance'
  | 'ot_shift'
  | 'ot_shift_relaxation'
  | 'ot_shift_pay'
  | 'holiday_work'
  | 'redemption'
  | 'window_late_in'
  | 'window_early_out'
  | 'birthday'

export interface CompensationItem {
  /** Unique within the list (made unique here if the server ever repeats one). */
  key: string
  kind: string
  /** 'detected' | 'assigned' | 'company' | 'birthday' | 'balance' today; anything else is listed under "Other". */
  group: string
  /** YYYY-MM-DD the item is filed under (for an assigned OT record: the date it was granted); null when unknown. */
  date: string | null
  /** The day of the extra work / Sunday-holiday work, when it differs from `date`. */
  workDate: string | null
  title: string
  detail: string
  status: string
  /** The server's own words for the status ("Waiting for your Department Head"); '' when it sent none. */
  statusLabel: string
  shifts: number | null
  minutes: number | null
  minutesUsed: number | null
  used: boolean | null
  /** A record from before the compensation overhaul (counted as 1 shift). */
  legacy: boolean
  /** HH:MM of an announced company window. */
  time: string | null
}

export interface AllowanceInfo {
  /** The working day the allowance applies on. */
  date: string
  minutes: number
  /** The extra-hours day that earned it. */
  workDate: string | null
  /** The latest arrival that is still on time (shift start + allowance + the shift's own grace); null without a shift. */
  onTimeUntil: string | null
  note: string | null
}

export interface CompensationEnabled {
  master: boolean
  allowance: boolean
  shift: boolean
  relaxation: boolean
  pay: boolean
  windows: boolean
  holidayWork: boolean
  birthday: boolean
  any: boolean
}

export interface CompensationAskHr {
  title: string
  text: string
  points: string[]
  /** HR's contact (Settings -> HR Contact); null when the server sent none. */
  contact: SupportContactBlock | null
}

export interface CompensationPayload {
  /** false for a production employee: compensation is for staff only, nothing below is meaningful. */
  isStaff: boolean
  /** null when the server did not say. */
  enabled: CompensationEnabled | null
  balanceShifts: number
  items: CompensationItem[]
  todayAllowance: AllowanceInfo | null
  tomorrowAllowance: AllowanceInfo | null
  askHr: CompensationAskHr | null
  message: string | null
}

export const STAFF_ONLY_MESSAGE = 'Compensation is for staff employees only.'
export const ASK_HR_TITLE = 'Ask Request for Compensation'
export const ASK_HR_TEXT =
  'The system detects when you work extra hours or work on a Sunday or a company holiday, and shows it here. If you ' +
  'worked extra and it is missing from the list, or you want to claim compensation, contact HR.'

// ---- Parsing ----------------------------------------------------------------------------------------------------

type PlainObject = Record<string, unknown>

function isObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrNull(value: unknown): string | null {
  return text(value) || null
}

/** A finite number, also from a numeric string (a Decimal field serialised as text); else null. */
function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** 'YYYY-MM-DD' from an ISO date or date-time string; null for anything else, including an impossible date (the screen
 * formats it with date-fns, which throws on one). */
export function isoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const day = value.trim().slice(0, 10)
  return isIsoDate(day) ? day : null
}

function parseItem(raw: unknown): CompensationItem | null {
  if (!isObject(raw)) return null
  const kind = text(raw.kind) || 'unknown'
  const date = isoDateOrNull(raw.date)
  return {
    key: text(raw.key) || `${kind}-${date ?? 'undated'}`,
    kind,
    group: text(raw.group) || 'other',
    date,
    workDate: isoDateOrNull(raw.workDate),
    title: text(raw.title) || kindInfo(kind).label,
    detail: text(raw.detail),
    status: text(raw.status),
    statusLabel: text(raw.statusLabel),
    shifts: numberOrNull(raw.shifts),
    minutes: numberOrNull(raw.minutes),
    minutesUsed: numberOrNull(raw.minutesUsed),
    used: typeof raw.used === 'boolean' ? raw.used : null,
    legacy: raw.legacy === true,
    time: textOrNull(raw.time),
  }
}

function parseAllowance(raw: unknown): AllowanceInfo | null {
  if (!isObject(raw)) return null
  const date = isoDateOrNull(raw.date)
  if (!date) return null
  return {
    date,
    minutes: numberOrNull(raw.minutes) ?? 0,
    workDate: isoDateOrNull(raw.workDate),
    onTimeUntil: textOrNull(raw.onTimeUntil),
    note: textOrNull(raw.note),
  }
}

function parseEnabled(raw: unknown): CompensationEnabled | null {
  if (!isObject(raw)) return null
  const flag = (key: string) => raw[key] === true
  return {
    master: flag('master'),
    allowance: flag('allowance'),
    shift: flag('shift'),
    relaxation: flag('relaxation'),
    pay: flag('pay'),
    windows: flag('windows'),
    holidayWork: flag('holidayWork'),
    birthday: flag('birthday'),
    any: flag('any'),
  }
}

function parseAskHr(raw: unknown): CompensationAskHr | null {
  if (!isObject(raw)) return null
  return {
    title: text(raw.title) || ASK_HR_TITLE,
    text: text(raw.text) || ASK_HR_TEXT,
    points: Array.isArray(raw.points) ? raw.points.map(text).filter(Boolean) : [],
    contact: normalizeContactBlock(raw.contact),
  }
}

/** Keys must be unique for React: a repeated one gets its position appended. */
function uniqueKeys(items: CompensationItem[]): CompensationItem[] {
  const seen = new Set<string>()
  return items.map((item, i) => {
    let key = item.key
    if (seen.has(key)) key = `${key}#${i}`
    seen.add(key)
    return key === item.key ? item : { ...item, key }
  })
}

/**
 * Validates the response and coerces it to the contract; null when it is not one (an HTML error page from a proxy, a
 * bare string), so the screen can say "could not read it" instead of crashing. Items that are not objects are dropped.
 */
export function parseCompensation(raw: unknown): CompensationPayload | null {
  if (!isObject(raw)) return null
  // Neither of the two keys every real answer has: some other document.
  if (typeof raw.isStaff !== 'boolean' && !Array.isArray(raw.items)) return null
  const isStaff = raw.isStaff !== false
  if (!isStaff) {
    return {
      isStaff: false,
      enabled: parseEnabled(raw.enabled),
      balanceShifts: 0,
      items: [],
      todayAllowance: null,
      tomorrowAllowance: null,
      askHr: null,
      message: textOrNull(raw.message) ?? STAFF_ONLY_MESSAGE,
    }
  }
  const items = Array.isArray(raw.items) ? raw.items.map(parseItem).filter((i): i is CompensationItem => i !== null) : []
  return {
    isStaff: true,
    enabled: parseEnabled(raw.enabled),
    balanceShifts: numberOrNull(raw.balanceShifts) ?? 0,
    items: uniqueKeys(items),
    todayAllowance: parseAllowance(raw.todayAllowance),
    tomorrowAllowance: parseAllowance(raw.tomorrowAllowance),
    askHr: parseAskHr(raw.askHr),
    message: textOrNull(raw.message),
  }
}

// ---- What each kind looks like ----------------------------------------------------------------------------------

export interface KindInfo {
  label: string
  /** Icon key, drawn by components/employee/MarkerSymbol.tsx. */
  symbol: MarkerSymbolName
  /** Chip tone (index.css). The five attendance-calendar kinds use the same colours as their calendar markers. */
  chip: string
}

const KIND_INFO: Record<CompensationKind, KindInfo> = {
  ot_allowance: { label: 'Late-in allowance', symbol: 'timer', chip: 'chip-teal' },
  ot_shift: { label: 'Extra hours detected', symbol: 'hourglass', chip: 'chip-warning' },
  ot_shift_relaxation: { label: 'Shift compensation: day off', symbol: 'bed', chip: 'chip-fuchsia' },
  ot_shift_pay: { label: 'Shift compensation: pay', symbol: 'handCoins', chip: 'chip-info' },
  holiday_work: { label: 'Sunday / holiday work', symbol: 'party', chip: 'chip-violet' },
  redemption: { label: 'Compensation day taken', symbol: 'bed', chip: 'chip-fuchsia' },
  window_late_in: { label: 'Company late-in time', symbol: 'sunrise', chip: 'chip-sky' },
  window_early_out: { label: 'Company early-out time', symbol: 'sunset', chip: 'chip-indigo' },
  birthday: { label: 'Birthday leave', symbol: 'cake', chip: 'chip-pink' },
}

/** A table entry by an outside string, ignoring what every object inherits ('constructor', 'toString'...). */
function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

/** How to draw a kind; a kind this app has never seen gets its own name, a neutral chip and a generic icon. */
export function kindInfo(kind: string): KindInfo {
  return own<KindInfo>(KIND_INFO, kind) ?? { label: humanize(kind) || 'Compensation', symbol: 'gift', chip: 'chip-muted' }
}

// ---- Status -----------------------------------------------------------------------------------------------------

export interface StatusInfo {
  label: string
  /** Chip tone (index.css). */
  chip: string
  /** Still moving (waiting on someone / coming up): the chip pulses. */
  live: boolean
}

/** What the server's own statusLabel would say, for an answer that carries none. */
const STATUS_LABEL: Record<string, string> = {
  detected: 'Detected: ask HR to claim it',
  assigned: 'Assigned by HR',
  applied: 'Applied',
  scheduled: 'Scheduled',
  not_applied: 'Not applied',
  used: 'Used',
  not_used: 'Not used',
  pending: 'Waiting',
  pending_hod: 'Waiting for your Department Head',
  approved: 'Approved',
  rejected: 'Not approved',
  taken: 'Taken',
  upcoming: 'Upcoming',
  today: 'Today',
  available: 'Available',
  not_applicable: 'Not applicable',
  paid: 'Paid',
  auto: 'Automatic',
}

const STATUS_CHIP: Record<string, string> = {
  approved: 'chip-success',
  applied: 'chip-success',
  used: 'chip-success',
  paid: 'chip-success',
  pending: 'chip-warning',
  pending_hod: 'chip-warning',
  detected: 'chip-warning',
  assigned: 'chip-info',
  scheduled: 'chip-info',
  upcoming: 'chip-info',
  today: 'chip-info',
  taken: 'chip-info',
  available: 'chip-info',
  rejected: 'chip-danger',
  not_applied: 'chip-excess',
  not_used: 'chip-muted',
  not_applicable: 'chip-muted',
  auto: 'chip-muted',
}

const LIVE_STATUSES = new Set(['pending', 'pending_hod', 'detected', 'upcoming', 'today', 'scheduled'])

export function statusInfo(item: Pick<CompensationItem, 'status' | 'statusLabel'>): StatusInfo {
  const status = item.status
  return {
    label: item.statusLabel || own(STATUS_LABEL, status) || humanize(status) || 'Status unknown',
    chip: own(STATUS_CHIP, status) ?? 'chip-muted',
    live: LIVE_STATUSES.has(status),
  }
}

// ---- Formatting -------------------------------------------------------------------------------------------------

/** 0.5 -> '0.50 shift', 1 -> '1.00 shift', 1.5 -> '1.50 shifts' (the way the HRMS writes shifts); '' when unknown. */
export function formatShifts(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return ''
  return `${value.toFixed(2)} ${value > 1 ? 'shifts' : 'shift'}`
}

/** 30 -> '30 min', 60 -> '1 h', 90 -> '1 h 30 min', 150 -> '2 h 30 min'. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return ''
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// ---- The allowance banner ---------------------------------------------------------------------------------------

export interface AllowanceBanner {
  when: 'today' | 'tomorrow'
  heading: string
  /** "You may arrive until 10:15 without being marked late." */
  headline: string
  /** The server's explanation ("You worked late on ..."), when it sent one. */
  detail: string | null
  minutes: number
  onTimeUntil: string | null
  date: string
}

/** 'YYYY-MM-DD' of a local calendar date (no time zone is involved: these are calendar days). */
function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The calendar day after `today`, as 'YYYY-MM-DD' (built from the date parts, so a daylight-saving change cannot skip it). */
export function nextCalendarDay(today: Date): string {
  return localIso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1))
}

export const TOMORROW_ALLOWANCE_HEADING = "Tomorrow's late-in allowance"
export const NEXT_WORKING_DAY_ALLOWANCE_HEADING = "Next working day's late-in allowance"

/**
 * The banner for today's or the next working day's late-in allowance; null when there is none.
 *
 * The server's `tomorrowAllowance` holds the NEXT WORKING day (employee_compensation_views.py), which is not always the
 * next calendar day: after Friday overtime on a Saturday-off shift it is Monday. So the heading says "Tomorrow" only when
 * `info.date` really is the day after `today`; otherwise it says "Next working day" (the page prints the date beside it).
 * `today` is the viewer's own calendar day, read when the page renders (the page can stay open past midnight).
 */
export function allowanceBanner(
  info: AllowanceInfo | null | undefined,
  when: 'today' | 'tomorrow',
  today: Date = new Date(),
): AllowanceBanner | null {
  if (!info) return null
  const headline = info.onTimeUntil
    ? `You may arrive until ${info.onTimeUntil} without being marked late.`
    : `You may arrive up to ${formatMinutes(info.minutes) || 'a little'} later than usual without being marked late.`
  const isNextCalendarDay = info.date === nextCalendarDay(today)
  return {
    when,
    heading:
      when === 'today'
        ? "Today's late-in allowance"
        : isNextCalendarDay
          ? TOMORROW_ALLOWANCE_HEADING
          : NEXT_WORKING_DAY_ALLOWANCE_HEADING,
    headline,
    detail: info.note,
    minutes: info.minutes,
    onTimeUntil: info.onTimeUntil,
    date: info.date,
  }
}

/** Both banners, today's first. */
export function allowanceBanners(
  payload: Pick<CompensationPayload, 'todayAllowance' | 'tomorrowAllowance'>,
  today: Date = new Date(),
): AllowanceBanner[] {
  return [
    allowanceBanner(payload.todayAllowance, 'today', today),
    allowanceBanner(payload.tomorrowAllowance, 'tomorrow', today),
  ].filter((b): b is AllowanceBanner => b !== null)
}

/** A line to show when HR has switched the compensation features off (records stay readable); null when they are on. */
export function enabledNotice(enabled: CompensationEnabled | null): string | null {
  if (!enabled) return null
  if (!enabled.master) {
    return 'HR has switched the overtime / compensation features off for now. Nothing new is detected or assigned, and your earlier records stay listed.'
  }
  if (!enabled.any) {
    return 'No compensation feature is switched on yet. Your earlier records stay listed.'
  }
  return null
}

// ---- Groups -----------------------------------------------------------------------------------------------------

export interface ItemGroup {
  id: string
  title: string
  hint: string
  items: CompensationItem[]
}

const GROUPS: { id: string; title: string; hint: string }[] = [
  { id: 'detected', title: 'Detected for you', hint: 'Found by the system from your punches. Late-in allowances are automatic.' },
  { id: 'assigned', title: 'Assigned by HR', hint: 'Given to you by HR. Sunday / holiday work counts once your Department Head approves it.' },
  { id: 'company', title: 'Company announcements', hint: 'Late-in and early-out times announced for everyone on a date.' },
  { id: 'birthday', title: 'Birthday leave', hint: 'Paid leave on your birthday: no attendance rule applies that day.' },
  { id: 'balance', title: 'Compensation days taken', hint: 'HR used your compensation balance on these dates.' },
]
const OTHER_GROUP = { id: 'other', title: 'Other', hint: '' }

/** Newest date first, undated last; stable for equal dates (the server's own order is kept). */
export function sortNewestFirst(items: CompensationItem[]): CompensationItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      if (a.item.date === b.item.date) return a.i - b.i
      if (a.item.date === null) return 1
      if (b.item.date === null) return -1
      return a.item.date < b.item.date ? 1 : -1
    })
    .map(({ item }) => item)
}

/** The items in their groups, in a fixed order; empty groups are left out, an unknown group is listed under "Other". */
export function groupItems(items: CompensationItem[]): ItemGroup[] {
  const known = new Set(GROUPS.map((g) => g.id))
  const out: ItemGroup[] = GROUPS.map((g) => ({
    ...g,
    items: sortNewestFirst(items.filter((i) => i.group === g.id)),
  }))
  out.push({ ...OTHER_GROUP, items: sortNewestFirst(items.filter((i) => !known.has(i.group))) })
  return out.filter((g) => g.items.length > 0)
}

// ---- Filters (by kind) ------------------------------------------------------------------------------------------

export type CompensationFilterId = 'all' | 'allowance' | 'shift' | 'holiday_work' | 'redemption' | 'window' | 'birthday' | 'other'

const FILTERS: { id: Exclude<CompensationFilterId, 'all' | 'other'>; label: string; kinds: string[] }[] = [
  { id: 'allowance', label: 'Late-in allowance', kinds: ['ot_allowance'] },
  { id: 'shift', label: 'Shift compensation', kinds: ['ot_shift', 'ot_shift_relaxation', 'ot_shift_pay'] },
  { id: 'holiday_work', label: 'Sunday / holiday work', kinds: ['holiday_work'] },
  { id: 'redemption', label: 'Days taken', kinds: ['redemption'] },
  { id: 'window', label: 'Company times', kinds: ['window_late_in', 'window_early_out'] },
  { id: 'birthday', label: 'Birthday', kinds: ['birthday'] },
]

const KNOWN_KINDS = new Set(FILTERS.flatMap((f) => f.kinds))

/** The filter an item belongs to; a kind that is not in any family is "other". */
export function filterOf(item: Pick<CompensationItem, 'kind'>): Exclude<CompensationFilterId, 'all'> {
  return FILTERS.find((f) => f.kinds.includes(item.kind))?.id ?? 'other'
}

export interface FilterOption {
  id: CompensationFilterId
  label: string
  count: number
}

/** "All" plus one chip for every kind family that actually has items, with its count. */
export function filterOptions(items: CompensationItem[]): FilterOption[] {
  const options: FilterOption[] = [{ id: 'all', label: 'All', count: items.length }]
  for (const f of FILTERS) {
    const count = items.filter((i) => f.kinds.includes(i.kind)).length
    if (count > 0) options.push({ id: f.id, label: f.label, count })
  }
  const other = items.filter((i) => !KNOWN_KINDS.has(i.kind)).length
  if (other > 0) options.push({ id: 'other', label: 'Other', count: other })
  return options
}

export function applyFilter(items: CompensationItem[], id: CompensationFilterId): CompensationItem[] {
  return id === 'all' ? items : items.filter((i) => filterOf(i) === id)
}

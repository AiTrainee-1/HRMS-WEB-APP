// Relative (not '@/types'): `npm test` and tsconfig.node.json load this file without the app's path alias.
import type { DayLateFlags, EmployeeShiftStats, ShiftPolicy } from '../types/index.ts'

// The one place a per-day attendance object (attendance history records[] and
// shift-stats dailyLogs[]) is turned into Late / Early Out / Half Day /
// Permission states. Both shapes carry the same keys. The current backend
// sends morningPermissionApplied & co.; an older one sends only the deprecated
// permissionMorning / permissionDeparture mirrors, so each flag falls back to
// them and nothing is required to be present.

export const DAY_STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  half_shift: 'Half Day',
  absent: 'Absent',
  on_leave: 'Leave',
  holiday: 'Holiday',
  future: 'Upcoming',
  no_record: 'No record',
}

export function dayStatusLabel(status: string): string {
  return DAY_STATUS_LABEL[status] ?? status.replace(/_/g, ' ')
}

export interface DayFlags {
  /** Morning Late-In (first punch after shift start + grace). */
  late: boolean
  /** Evening Early-Out (last punch before shift end - grace). */
  earlyOut: boolean
  /** A punch in only one of the two halves of the day. */
  halfDay: boolean
  /** An Allowed permission shifted that edge by 60 minutes today. */
  morningApplied: boolean
  eveningApplied: boolean
  /** Approved but Overdue / Excess: it did not protect the day. */
  morningExcess: boolean
  eveningExcess: boolean
  /** A Middle One-Hour Permission covers today. */
  middle: boolean
  /** Older backend only: the strict-mode lunch-return permission zone. The new
   * rules have exactly three permission types, so this is not surfaced there. */
  afternoon: boolean
  /** True when the backend predates morningPermissionApplied & co. */
  legacy: boolean
  lateReason: string | null
}

type DayLike = DayLateFlags & { status: string }

export function getDayFlags(day: DayLike): DayFlags {
  // Lateness only means something on a day the employee actually worked.
  const worked = day.status === 'present' || day.status === 'half_shift'
  const legacy = day.morningPermissionApplied === undefined && day.eveningPermissionApplied === undefined
  return {
    late: worked && !!day.isLate,
    earlyOut: worked && !!day.isEarlyOut,
    halfDay: day.status === 'half_shift',
    morningApplied: !!(day.morningPermissionApplied ?? day.permissionMorning),
    eveningApplied: !!(day.eveningPermissionApplied ?? day.permissionDeparture),
    morningExcess: !!day.morningPermissionExcess,
    eveningExcess: !!day.eveningPermissionExcess,
    middle: !!day.middlePermissionToday,
    afternoon: legacy && !!day.permissionAfternoon,
    legacy,
    lateReason: day.lateReason?.trim() || null,
  }
}

/** The Late / Early Out / Permission markers. */
export type FlagMarkerKey = 'late' | 'earlyOut' | 'permission' | 'excess' | 'middle'

/** What compensation shaped a day (the day record's `compensationKind`); 'compensation' is any kind this app does not know. */
export type CompensationMarkerKey =
  | 'ot_allowance'
  | 'window_late_in'
  | 'window_early_out'
  | 'birthday'
  | 'relaxation'
  | 'compensation'

/** Icons a marker or a compensation kind can carry; drawn by components/employee/MarkerSymbol.tsx. Colour is never the
 * only cue: every compensation marker also has a symbol. */
export type MarkerSymbolName = 'timer' | 'sunrise' | 'sunset' | 'cake' | 'bed' | 'hourglass' | 'handCoins' | 'party' | 'gift'

export interface DayMarker {
  key: FlagMarkerKey | CompensationMarkerKey
  label: string
  /** Small corner dot on the calendar grid (Tailwind class). */
  dot: string
  /** The same colour for the SVG trend chart. */
  fill: string
  /** Chip tone (index.css) for the detail panel, dashboard and shift log. */
  chip: string
  /** Compensation markers only: the symbol drawn in the calendar cell (instead of a dot). */
  symbol?: MarkerSymbolName
  /** Compensation markers only: text colour of that symbol. */
  text?: string
  /** Compensation markers only: ring around the calendar cell. */
  ring?: string
}

export const DAY_MARKERS: Record<FlagMarkerKey, DayMarker> = {
  late: { key: 'late', label: 'Late-In', dot: 'bg-warning', fill: 'var(--warning)', chip: 'chip-warning' },
  earlyOut: { key: 'earlyOut', label: 'Early Out', dot: 'bg-destructive', fill: 'var(--destructive)', chip: 'chip-danger' },
  permission: { key: 'permission', label: 'Permission applied', dot: 'bg-primary', fill: 'var(--primary)', chip: 'chip-info' },
  excess: { key: 'excess', label: 'Excess permission', dot: 'bg-orange-600', fill: '#ea580c', chip: 'chip-excess' },
  middle: { key: 'middle', label: 'Middle One-Hour', dot: 'bg-slate-400', fill: '#94a3b8', chip: 'chip-muted' },
}

/** Compensation Day has always had its own violet marker; kept here so the grid, chart and legend agree. */
export const COMPENSATION_MARKER = { label: 'Compensation day', dot: 'bg-violet-500', fill: '#8b5cf6' }

// ── Compensation (day record keys compensationKind / compensationMinutes / compensationNote) ──
// Five colours, each with its own symbol, none of them the Present / Half Day / Late / Early Out / Permission colours:
// teal + timer (a next-day late-in allowance was used), sky + sunrise (the company's announced late-in time applied),
// indigo + sunset (the announced early-out time applied), pink + cake (birthday leave), fuchsia + bed (a compensation day
// taken). A kind this app has never seen is drawn as a violet gift ("Compensation"), never dropped.

export const COMPENSATION_KIND_MARKERS: Record<Exclude<CompensationMarkerKey, 'compensation'>, DayMarker> = {
  ot_allowance: {
    key: 'ot_allowance', label: 'Late-in allowance used', dot: 'bg-teal-500', fill: '#14b8a6', chip: 'chip-teal',
    symbol: 'timer', text: 'text-teal-600 dark:text-teal-300', ring: 'ring-teal-500/70',
  },
  window_late_in: {
    key: 'window_late_in', label: 'Company late-in time', dot: 'bg-sky-500', fill: '#0ea5e9', chip: 'chip-sky',
    symbol: 'sunrise', text: 'text-sky-600 dark:text-sky-300', ring: 'ring-sky-500/70',
  },
  window_early_out: {
    key: 'window_early_out', label: 'Company early-out time', dot: 'bg-indigo-500', fill: '#6366f1', chip: 'chip-indigo',
    symbol: 'sunset', text: 'text-indigo-600 dark:text-indigo-300', ring: 'ring-indigo-500/70',
  },
  birthday: {
    key: 'birthday', label: 'Birthday leave', dot: 'bg-pink-500', fill: '#ec4899', chip: 'chip-pink',
    symbol: 'cake', text: 'text-pink-600 dark:text-pink-300', ring: 'ring-pink-500/70',
  },
  relaxation: {
    key: 'relaxation', label: 'Relaxation day', dot: 'bg-fuchsia-500', fill: '#d946ef', chip: 'chip-fuchsia',
    symbol: 'bed', text: 'text-fuchsia-600 dark:text-fuchsia-300', ring: 'ring-fuchsia-500/70',
  },
}

const GENERIC_COMPENSATION_MARKER: DayMarker = {
  key: 'compensation', label: 'Compensation', dot: 'bg-violet-500', fill: '#8b5cf6', chip: 'chip-violet',
  symbol: 'gift', text: 'text-violet-600 dark:text-violet-300', ring: 'ring-violet-500/70',
}

/** The compensation markers a calendar legend lists (the five kinds the server sends today). */
export function compensationLegend(): DayMarker[] {
  return Object.values(COMPENSATION_KIND_MARKERS)
}

type CompensationFields = Pick<DayLateFlags, 'compensationKind' | 'compensationMinutes' | 'compensationNote'>

/** The day's compensation kind as the server sent it, or null when nothing compensation-related shaped the day. */
export function compensationKindOf(day: CompensationFields): string | null {
  const kind = typeof day.compensationKind === 'string' ? day.compensationKind.trim() : ''
  return kind || null
}

/** True when the backend sends the compensation keys on at least one of these days (a newer backend, even if every
 * value is null); false means an older backend, which has nothing to explain. */
export function hasCompensationKeys(days: CompensationFields[]): boolean {
  return days.some((d) => d.compensationKind !== undefined)
}

/** The one plain sentence that explains the day's compensation marker: the server's note, else a fixed sentence for the
 * kind. Null when no compensation shaped the day. */
export function compensationLine(day: CompensationFields): string | null {
  const kind = compensationKindOf(day)
  if (!kind) return null
  const note = typeof day.compensationNote === 'string' ? day.compensationNote.trim() : ''
  if (note) return note
  const minutes = typeof day.compensationMinutes === 'number' && day.compensationMinutes > 0 ? day.compensationMinutes : 0
  switch (kind) {
    case 'ot_allowance':
      return `You arrived within your late-in allowance${minutes ? ` (${minutes} minutes used)` : ''}, so you were not marked late.`
    case 'window_late_in':
      return 'The company announced a late-in time for this day: your own shift start and grace did not apply, and you were not marked late.'
    case 'window_early_out':
      return 'The company announced an early-out time for this day: your own shift end and grace did not apply, and you were not marked as leaving early.'
    case 'birthday':
      return 'Paid birthday leave: no attendance rule applies on your birthday, whether you came to work or not.'
    case 'relaxation':
      return 'HR gave you a compensation day (relaxation) for this date.'
    default:
      return 'Compensation was applied to this day.'
  }
}

/** The compensation marker for a day (colour + symbol + the explaining sentence as `detail`), or null. Independent of
 * the day's status: a relaxation day with no punches still has one. */
export function getCompensationMarker(day: CompensationFields): DayMarkerHit | null {
  const kind = compensationKindOf(day)
  if (!kind) return null
  // Own keys only: a kind named like something every object inherits ('constructor') is not a known kind.
  const marker = Object.hasOwn(COMPENSATION_KIND_MARKERS, kind)
    ? COMPENSATION_KIND_MARKERS[kind as keyof typeof COMPENSATION_KIND_MARKERS]
    : GENERIC_COMPENSATION_MARKER
  return { ...marker, detail: compensationLine(day) ?? undefined }
}

type PunchFields = { status: string; firstPunch?: string | null; totalPunches?: number }

/** A compensation day taken (relaxation) that has no punches: HR topped the date up, the employee did not work it. Its
 * status reads Half Day or Present, but neither the half-day rule nor "no attendance record" describes it. */
export function isPunchlessRelaxation(day: CompensationFields & PunchFields): boolean {
  return compensationKindOf(day) === 'relaxation' && !day.firstPunch && !((day.totalPunches ?? 0) > 0)
}

/** The day's headline status: its status label, except a punchless relaxation day, which is not "Half Day" only. */
export function dayHeadline(day: CompensationFields & PunchFields): string {
  return isPunchlessRelaxation(day) ? 'Compensation day (relaxation)' : dayStatusLabel(day.status)
}

/** A marker on one particular day, with the extra explanation (if any) for a tooltip. */
export interface DayMarkerHit extends DayMarker {
  detail?: string
}

/** Markers to draw for a day, most important first. Flag markers (Late-In, Early Out, permissions) only appear on worked
 * days; a compensation marker comes first and appears whatever the status. With a policy, a Late-In / Early Out check the
 * company has switched off draws nothing. */
export function getDayMarkers(day: DayLike, policy?: ShiftPolicy | null): DayMarkerHit[] {
  const compensation = getCompensationMarker(day)
  if (day.status !== 'present' && day.status !== 'half_shift') return compensation ? [compensation] : []
  const f = getDayFlags(day)
  const out: DayMarkerHit[] = compensation ? [compensation] : []
  const showLate = f.late && lateInShown(policy)
  const showEarlyOut = f.earlyOut && earlyOutShown(policy)
  // The reason explains whichever deadline was missed, so it rides on the first of the two chips.
  if (showLate) out.push({ ...DAY_MARKERS.late, detail: f.lateReason ?? undefined })
  if (showEarlyOut) out.push({ ...DAY_MARKERS.earlyOut, detail: showLate ? undefined : (f.lateReason ?? undefined) })
  if (f.morningApplied || f.eveningApplied || f.afternoon) {
    out.push(f.legacy ? { ...DAY_MARKERS.permission, label: LEGACY_PERMISSION_LABEL } : DAY_MARKERS.permission)
  }
  if (f.morningExcess || f.eveningExcess) out.push(DAY_MARKERS.excess)
  if (f.middle) out.push(DAY_MARKERS.middle)
  return out
}

/** Older backend only: its permission flags were an auto-detected punch-timing zone that
 * did not mean a request exists, so "Permission applied" would overstate it. */
const LEGACY_PERMISSION_LABEL = 'Permission'

/** True when the backend sends the current permission flags (morningPermissionApplied /
 * eveningPermissionApplied) on at least one of these days; false means only the legacy keys. */
export function hasCurrentPermissionFlags(days: DayLateFlags[]): boolean {
  return days.some((d) => d.morningPermissionApplied !== undefined || d.eveningPermissionApplied !== undefined)
}

/** The markers a legend should list: everything except a check the company has switched off.
 * `legacy` = the days carry only the legacy permission keys (see hasCurrentPermissionFlags),
 * so the permission entry reads just "Permission", as its day markers do. */
export function legendMarkers(policy?: ShiftPolicy | null, legacy = false): DayMarker[] {
  return Object.values(DAY_MARKERS)
    .filter((m) => (m.key !== 'late' || lateInShown(policy)) && (m.key !== 'earlyOut' || earlyOutShown(policy)))
    .map((m) => (legacy && m.key === 'permission' ? { ...m, label: LEGACY_PERMISSION_LABEL } : m))
}

/** Early-Out days in a list of days, or null when the backend never sent the flag (older backend).
 * Callers also hide the count when earlyOutShown(policy) is false. */
export function countEarlyOuts(days: (DayLateFlags & { status: string })[]): number | null {
  if (!days.some((d) => d.isEarlyOut !== undefined)) return null
  return days.filter((d) => getDayFlags(d).earlyOut).length
}

// ── Company policy (top-level `policy` of GET /attendance/employee-shift-stats) ──
// Absent on an older backend, so every reader below treats a missing policy, or
// a missing field in it, as "no information": the two detection checks then count
// as enabled (the old behaviour) and no half-day time is ever shown.

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/

/** Keeps only well-formed fields of the raw `policy` object; null when there is none. */
export function parseShiftPolicy(raw: unknown): ShiftPolicy | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const flag = (v: unknown) => (typeof v === 'boolean' ? v : undefined)
  const time = (v: unknown) => (typeof v === 'string' && HHMM.test(v.trim()) ? v.trim() : undefined)
  const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
  return {
    morningLateInEnabled: flag(r.morningLateInEnabled),
    eveningEarlyOutEnabled: flag(r.eveningEarlyOutEnabled),
    halfDayFirstHalfEnd: time(r.halfDayFirstHalfEnd),
    halfDaySecondHalfStart: time(r.halfDaySecondHalfStart),
    lateWindowMinutes: count(r.lateWindowMinutes),
    permissionWindowMinutes: count(r.permissionWindowMinutes),
    arrivalExtraMinutes: count(r.arrivalExtraMinutes),
    arrivalQuarterDeduction: count(r.arrivalQuarterDeduction),
    permissionMonthlyCap: count(r.permissionMonthlyCap),
    freeAllowance: count(r.freeAllowance),
    permissionDurationMinutes: count(r.permissionDurationMinutes),
  }
}

/** The policy that applies to the employee these stats belong to. Production has its own
 * half-day windows and late policy (the company-wide staff rules would describe the wrong
 * days), so only the permission cap is kept for it. */
export function shiftPolicyOf(stats: Pick<EmployeeShiftStats, 'policy' | 'employmentType'>): ShiftPolicy | null {
  const policy = parseShiftPolicy(stats.policy)
  if (!policy || stats.employmentType !== 'production') return policy
  return { permissionMonthlyCap: policy.permissionMonthlyCap, permissionDurationMinutes: policy.permissionDurationMinutes }
}

/** False only when the company has switched Morning Late-In detection off. */
export function lateInShown(policy?: ShiftPolicy | null): boolean {
  return policy?.morningLateInEnabled !== false
}

/** False only when the company has switched Evening Early-Out detection off. */
export function earlyOutShown(policy?: ShiftPolicy | null): boolean {
  return policy?.eveningEarlyOutEnabled !== false
}

const shiftsText = (n: number) => String(Number(n.toFixed(2)))

/** What counts as the morning half. The current backend measures it from each shift's own start and grace (the timeline
 * numbers in the policy); an older one only has the fixed cut-off time. Null when the policy has neither. */
function morningHalfRule(policy: ShiftPolicy): string | null {
  const { lateWindowMinutes: late, permissionWindowMinutes: perm, arrivalExtraMinutes: extra, arrivalQuarterDeduction: q } = policy
  if (late !== undefined && perm !== undefined && extra !== undefined && q !== undefined) {
    const notes = [`Late up to ${late} min`]
    if (perm > 0) notes.push(`excused up to ${late + perm} min with an approved Late-In permission`)
    if (q > 0) notes.push(`after that the day counts ${shiftsText(1 - q)} shift`)
    return `any punch up to ${late + perm + extra} min after your grace time ends (${notes.join('; ')})`
  }
  return policy.halfDayFirstHalfEnd ? `any punch before ${policy.halfDayFirstHalfEnd}` : null
}

/** The company's half-day rule, or null unless the policy carries BOTH times (never guess a time). */
export function halfDayRule(policy?: ShiftPolicy | null): { morning: string; evening: string; outcome: string } | null {
  if (!policy?.halfDaySecondHalfStart) return null
  const morning = morningHalfRule(policy)
  if (!morning) return null
  return {
    morning: `Morning half: ${morning}`,
    evening: `Evening half: any punch from ${policy.halfDaySecondHalfStart}`,
    outcome: 'Both = Full Day, one = Half Day, none = Absent',
  }
}

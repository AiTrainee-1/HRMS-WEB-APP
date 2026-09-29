import type { DayLateFlags, EmployeeShiftStats, ShiftPolicy } from '@/types'

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

export interface DayMarker {
  key: 'late' | 'earlyOut' | 'permission' | 'excess' | 'middle'
  label: string
  /** Small corner dot on the calendar grid (Tailwind class). */
  dot: string
  /** The same colour for the SVG trend chart. */
  fill: string
  /** Chip tone (index.css) for the detail panel, dashboard and shift log. */
  chip: string
}

export const DAY_MARKERS: Record<DayMarker['key'], DayMarker> = {
  late: { key: 'late', label: 'Late-In', dot: 'bg-warning', fill: 'var(--warning)', chip: 'chip-warning' },
  earlyOut: { key: 'earlyOut', label: 'Early Out', dot: 'bg-destructive', fill: 'var(--destructive)', chip: 'chip-danger' },
  permission: { key: 'permission', label: 'Permission applied', dot: 'bg-primary', fill: 'var(--primary)', chip: 'chip-info' },
  excess: { key: 'excess', label: 'Excess permission', dot: 'bg-orange-600', fill: '#ea580c', chip: 'chip-excess' },
  middle: { key: 'middle', label: 'Middle One-Hour', dot: 'bg-slate-400', fill: '#94a3b8', chip: 'chip-muted' },
}

/** Compensation Day has always had its own violet marker; kept here so the grid, chart and legend agree. */
export const COMPENSATION_MARKER = { label: 'Compensation day', dot: 'bg-violet-500', fill: '#8b5cf6' }

/** A marker on one particular day, with the extra explanation (if any) for a tooltip. */
export interface DayMarkerHit extends DayMarker {
  detail?: string
}

/** Markers to draw for a day, most important first. Only worked days get any.
 * With a policy, a Late-In / Early Out check the company has switched off draws nothing. */
export function getDayMarkers(day: DayLike, policy?: ShiftPolicy | null): DayMarkerHit[] {
  if (day.status !== 'present' && day.status !== 'half_shift') return []
  const f = getDayFlags(day)
  const out: DayMarkerHit[] = []
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

/** The company's half-day rule, or null unless the policy carries BOTH times (never guess a time). */
export function halfDayRule(policy?: ShiftPolicy | null): { morning: string; evening: string; outcome: string } | null {
  if (!policy?.halfDayFirstHalfEnd || !policy.halfDaySecondHalfStart) return null
  return {
    morning: `Morning half: any punch before ${policy.halfDayFirstHalfEnd}`,
    evening: `Evening half: any punch from ${policy.halfDaySecondHalfStart}`,
    outcome: 'Both = Full Day, one = Half Day, none = Absent',
  }
}

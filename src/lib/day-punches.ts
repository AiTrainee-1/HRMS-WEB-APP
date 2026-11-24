// The attendance day panel (owner 2026-11-24): every punch of the day with its source, the shift the day earned, what the
// employee can do about the day (the action chips) and the date a request form opens with when they come from it.
// GET /attendance/employee/<id>?month&year sends per day `allPunches` (backend attendance_views.all_punches_of) and
// `shiftsEarned` (payroll's own figure; null for a day still to come); an older server sends neither, and the plain
// `punches` list stands in. Pure: unit-tested in day-punches.test.ts. Same rules as the mobile app (src/lib/dayPunches.ts
// and the day sheet's actionsFor in src/components/AttendanceCalendar.tsx).
import { getRequestWindow, isIsoDate, type RequestWindow } from './request-window.ts'

export type PunchKind = 'biometric' | 'geo' | 'on_duty' | 'ot' | 'missing_punch' | 'hr' | 'auto'

/** One punch as the server sends it in `allPunches` (an older server's `punches` rows fit too). */
export interface DayPunchWire {
  date?: string | null
  /** "HH:MM:SS" (or "HH:MM"). */
  time: string
  type?: 'IN' | 'OUT' | 'OT' | string | null
  source?: string | null
  sourceLabel?: string | null
  kind?: string | null
  /** Counted in the day's attendance (an OT punch, a waiting / rejected On-Duty punch and a double tap are not). */
  counted?: boolean | null
  /** An On-Duty / OT punch's own state: pending | approved | rejected. */
  verification?: string | null
  /** "double_tap" | "previous_shift". */
  note?: string | null
  nextDay?: boolean | null
}

/** The extra per-day fields of the 2026-11-24 server (absent on an older one). */
export interface DayPunchFields {
  allPunches?: DayPunchWire[] | null
  shiftsEarned?: number | string | null
}

export interface DayPunchView {
  key: string
  /** "1:05 PM". */
  time: string
  /** "In" / "Out" / "OT". */
  direction: 'In' | 'Out' | 'OT'
  kind: PunchKind
  /** "Biometric", "Geo Punch", "On-Duty", "OT Punch 1", "Missing Punch", "HR entry", "Auto". */
  source: string
  /** Under the source: "Waiting for HR", "Rejected by HR", "Not counted · double tap", "Next day" ... */
  detail: string | null
  counted: boolean
}

export const KIND_LABEL: Record<PunchKind, string> = {
  biometric: 'Biometric',
  geo: 'Geo Punch',
  on_duty: 'On-Duty',
  ot: 'OT Punch',
  missing_punch: 'Missing Punch',
  hr: 'HR entry',
  auto: 'Auto',
}

/** The kind from the server, or worked out from the source on an older server. */
export function kindOf(p: Pick<DayPunchWire, 'kind' | 'source'>): PunchKind {
  const k = String(p.kind ?? '')
  if (Object.hasOwn(KIND_LABEL, k)) return k as PunchKind
  const s = String(p.source ?? '').toLowerCase()
  if (s === 'on_duty_ot') return 'ot'
  if (s.startsWith('on_duty')) return 'on_duty'
  if (s.startsWith('geo')) return 'geo'
  if (s.startsWith('missing_punch')) return 'missing_punch'
  if (s === 'manual' || s.startsWith('hr') || s === 'punch_view') return 'hr'
  if (s.startsWith('auto')) return 'auto'
  return 'biometric'
}

/** "13:05" / "13:05:09" -> "1:05 PM"; anything else as it came. */
export function time12(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim())
  if (!m) return String(value ?? '')
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}

/**
 * The punches to show, oldest first (the server already sorts them): its full list (`allPunches`), or - from an older
 * server, or an empty full list - the plain attendance punches (`punches`) it always sent.
 */
export function dayPunchViews(all: readonly DayPunchWire[] | null | undefined, fallback?: readonly DayPunchWire[] | null): DayPunchView[] {
  const list = all && all.length ? all : (fallback ?? [])
  return list
    .filter((p) => p && typeof p.time === 'string')
    .map((p, i) => {
      const kind = kindOf(p)
      const details: string[] = []
      if (kind === 'ot') details.push(p.verification === 'approved' ? 'Overtime · approved' : 'Overtime · waiting for approval')
      else if (p.verification === 'pending') details.push('Waiting for HR')
      else if (p.verification === 'rejected') details.push('Rejected by HR')
      else if (p.note === 'double_tap') details.push('Not counted · double tap')
      else if (p.note === 'previous_shift') details.push("Previous night's shift")
      if (p.nextDay) details.push('Next day')
      return {
        key: `${p.date ?? ''}-${p.time}-${i}`,
        time: time12(p.time),
        direction: p.type === 'OT' || kind === 'ot' ? 'OT' : String(p.type ?? '').toUpperCase() === 'OUT' ? 'Out' : 'In',
        kind,
        source: kind === 'ot' ? p.sourceLabel?.trim() || KIND_LABEL.ot : KIND_LABEL[kind],
        detail: details.length ? details.join(' · ') : null,
        counted: p.counted !== false,
      }
    })
}

/** "5 recorded · 4 counted" (the counted part only when some were not counted); "None" for an empty day. */
export function punchCountText(punches: readonly Pick<DayPunchView, 'counted'>[]): string {
  if (!punches.length) return 'None'
  const counted = punches.filter((p) => p.counted).length
  return `${punches.length} recorded · ${counted} counted`
}

function shiftNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** "1.00 shift", "0.50 shift", "1.50 shifts"; null when the server sent none (an older server, a day to come). */
export function earnedShiftText(value: number | string | null | undefined): string | null {
  const n = shiftNumber(value)
  return n === null ? null : `${n.toFixed(2)} ${n > 1 ? 'shifts' : 'shift'}`
}

/** What the earned shift means, in a few words. */
export function earnedShiftHint(value: number | string | null | undefined): string | null {
  const n = shiftNumber(value)
  if (n === null) return null
  if (n >= 1) return 'Full day'
  if (n >= 0.75) return 'Three-quarter day'
  if (n >= 0.5) return 'Half day'
  if (n > 0) return 'Part of a day'
  return 'No shift earned'
}

// ---- what the employee can do about the day ------------------------------------------------------------------------

export type DayActionKey = 'leave' | 'casual_leave' | 'missing_punch' | 'permission'

export interface DayAction {
  key: DayActionKey
  label: string
  /** The request page, its apply form opened on that day (`?apply=YYYY-MM-DD`, plus `&type=` for a permission). */
  href: string
}

export interface DayActionInput {
  date: string
  status: string
  compensationKind?: string | null
  /** A Late-In shown on this day (the flag AND the company checks it). */
  late: boolean
  /** An Early Out shown on this day. */
  earlyOut: boolean
}

/** The permission kinds a day can open the form with (lib/permissions.ts keys). */
export type PrefillPermissionType = 'morning_late_in' | 'evening_early_out'

/**
 * The action chips of a day, and `closed` when the day has a problem the request forms can no longer take (outside the
 * request window: this month, last month on the 1st-5th), so the panel says to ask HR instead.
 *   Absent                -> Apply Leave (+ Casual Leave for a staff employee)
 *   Half Day              -> Missing Punch (a punch most likely never reached the system)
 *   Late-In / Early Out   -> Permission (Late In for a late day, else Early Out)
 * A birthday or relaxation day is made up by the compensation itself: no leave or missing punch is offered for it.
 */
export function dayActions(day: DayActionInput, w: RequestWindow, isStaff: boolean): { actions: DayAction[]; closed: boolean } {
  const actions: DayAction[] = []
  const comp = String(day.compensationKind ?? '').trim()
  const covered = comp === 'birthday' || comp === 'relaxation'
  const q = (extra = '') => `?apply=${day.date}${extra}`
  if (day.status === 'absent' && !covered) {
    actions.push({ key: 'leave', label: 'Apply Leave', href: `/employee/leave${q()}` })
    if (isStaff) actions.push({ key: 'casual_leave', label: 'Casual Leave', href: `/employee/casual-leave${q()}` })
  }
  if (day.status === 'half_shift' && !covered) {
    actions.push({ key: 'missing_punch', label: 'Missing Punch', href: `/employee/missing-punch${q()}` })
  }
  if (day.late || day.earlyOut) {
    const type: PrefillPermissionType = day.late ? 'morning_late_in' : 'evening_early_out'
    actions.push({ key: 'permission', label: 'Permission', href: `/employee/permissions${q(`&type=${type}`)}` })
  }
  if (actions.length && (!isIsoDate(day.date) || day.date < w.min || day.date > w.max)) return { actions: [], closed: true }
  return { actions, closed: false }
}

// ---- the request form opened on that day ---------------------------------------------------------------------------

/**
 * The date a request form opens with (`?apply=YYYY-MM-DD`): that day when the form can still take it (inside the
 * request window; not in the future unless `allowFuture` - leave and Casual Leave can be applied ahead); else null and
 * the form keeps its own default.
 */
export function prefillDate(value: unknown, now: Date, { allowFuture = false }: { allowFuture?: boolean } = {}): string | null {
  if (typeof value !== 'string' || !isIsoDate(value)) return null
  const w = getRequestWindow(now)
  if (value < w.min || value > w.max) return null
  if (!allowFuture && value > w.today) return null
  return value
}

/** `type=` of a permission link: the web's keys, or the mobile app's words ("Late In" / "Early Out"). */
export function prefillPermissionType(value: unknown): PrefillPermissionType | null {
  const s = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (s === 'morning_late_in' || s === 'late_in') return 'morning_late_in'
  if (s === 'evening_early_out' || s === 'early_out') return 'evening_early_out'
  return null
}

export interface ApplyPrefill {
  /** The day to open the form on (null: outside the window / not a date; the form keeps its default). */
  date: string | null
  permissionType: PrefillPermissionType | null
}

/** Reads `apply` (and `type`) from a query string; null when the link asks for no form. */
export function readApplyPrefill(search: string | null | undefined, now: Date, opts: { allowFuture?: boolean } = {}): ApplyPrefill | null {
  const p = new URLSearchParams(search ?? '')
  if (!p.has('apply')) return null
  return { date: prefillDate(p.get('apply'), now, opts), permissionType: prefillPermissionType(p.get('type')) }
}

/** The query string with the form params taken out (so a reload or Back does not open the form again). */
export function withoutApplyParams(search: string | null | undefined): string {
  const p = new URLSearchParams(search ?? '')
  p.delete('apply')
  p.delete('type')
  return p.toString()
}

// HR attendance edits on the employee's attendance calendar (owner 2026-11-02):
//   (1) "Whenever HR edits an attendance record, display a '!' icon on that date; clicking it shows a tooltip explaining
//       what was edited and which approval stage the edit is in."
//   (2) "Display HR-edited attendance records in a different colour so it is easy to identify which records were
//       modified by HR."
// The "!" is drawn for ANY edit (waiting, applied or rejected); the colour only once the edit was APPLIED (both approvers
// said yes). The server sends the day's latest edit as `records[].hrEdit` on GET /attendance/employee/<id> (backend
// api/hr_edit_marks.py); this file reads it defensively and words it. Pure, tested in hr-edit.test.ts.

// Relative (not '@/'): `npm test` loads this file without the app's path alias.
import type { HrEdit, HrEditSide } from '../types/index.ts'
import { formatWhen } from './decider.ts'

export const HR_EDIT_STATUSES = ['waiting_hod', 'waiting_hr', 'applied', 'rejected'] as const

type Raw = Record<string, unknown>

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function shiftsOf(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

function sideOf(raw: unknown): HrEditSide {
  const s = raw && typeof raw === 'object' ? (raw as Raw) : {}
  return { label: text(s.label) ?? 'Not recorded', shifts: shiftsOf(s.shifts) }
}

/**
 * The `hrEdit` block as the server sent it, checked: null for null / anything that is not an edit (no status). Missing
 * words fall back to plain ones, never to a guess about what was changed.
 */
export function readHrEdit(raw: unknown): HrEdit | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Raw
  const status = text(r.status)
  if (!status) return null
  const type = text(r.type) ?? ''
  const requestId = Number(r.requestId)
  return {
    requestId: Number.isFinite(requestId) ? requestId : 0,
    status,
    stageLabel: text(r.stageLabel) ?? hrEditStatusWord(status),
    from: sideOf(r.from),
    to: sideOf(r.to),
    option: text(r.option) ?? '',
    type,
    typeLabel: text(r.typeLabel) ?? (type ? type.replace(/_/g, ' ') : 'Attendance change'),
    reason: text(r.reason),
    comment: text(r.comment),
    raisedBy: text(r.raisedBy),
    raisedAt: text(r.raisedAt),
    decidedBy: text(r.decidedBy),
    decidedAt: text(r.decidedAt),
  }
}

/** The day's HR edit, or null (none, or an older server that sends no `hrEdit`). */
export function hrEditOf(day: { hrEdit?: unknown } | null | undefined): HrEdit | null {
  return day ? readHrEdit(day.hrEdit) : null
}

/** Only an APPLIED edit changes the day's colour; a waiting or rejected one shows the "!" only. */
export function isHrEditApplied(edit: Pick<HrEdit, 'status'> | null | undefined): boolean {
  return edit?.status === 'applied'
}

/** The short words on the stage pill. */
export function hrEditStatusWord(status: string): string {
  switch (status) {
    case 'waiting_hod':
      return 'Waiting for Department Head'
    case 'waiting_hr':
      return 'Waiting for HR'
    case 'applied':
      return 'Applied'
    case 'rejected':
      return 'Rejected'
    default: {
      const s = status.replace(/_/g, ' ').trim()
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'In progress'
    }
  }
}

/** The kit status tone of the stage (waiting = amber, applied = green, rejected = rose). */
export type HrEditTone = 'waiting' | 'approved' | 'rejected' | 'neutral'

export function hrEditTone(status: string): HrEditTone {
  if (status === 'waiting_hod' || status === 'waiting_hr') return 'waiting'
  if (status === 'applied') return 'approved'
  if (status === 'rejected') return 'rejected'
  return 'neutral'
}

/** The heading of the popover / the day dialog section. */
export function hrEditTitle(edit: Pick<HrEdit, 'status'>): string {
  switch (edit.status) {
    case 'applied':
      return 'Edited by HR'
    case 'rejected':
      return 'HR edit rejected'
    case 'waiting_hod':
    case 'waiting_hr':
      return 'HR edit waiting for approval'
    default:
      return 'HR edit'
  }
}

/** 1 -> "1 shift", 0 -> "0 shifts", 0.5 -> "½ shift", 1.5 -> "1½ shifts", 0.75 -> "0.75 shift". */
export function shiftsText(n: number): string {
  const whole = Math.floor(n)
  const isHalf = Math.abs(n * 2 - Math.round(n * 2)) < 1e-9
  const num = isHalf ? (n - whole >= 0.5 ? (whole ? `${whole}½` : '½') : String(whole)) : String(Number(n.toFixed(2)))
  return `${num} ${n > 0 && n <= 1 ? 'shift' : 'shifts'}`
}

/** "Present (1 shift)", or just "Present" when the shifts are not known. */
export function sideText(side: HrEditSide): string {
  return side.shifts == null ? side.label : `${side.label} (${shiftsText(side.shifts)})`
}

/** "Absent (0 shifts) → Present (1 shift)". */
export function changeText(edit: Pick<HrEdit, 'from' | 'to'>): string {
  return `${sideText(edit.from)} → ${sideText(edit.to)}`
}

/** One labelled line of the popover / dialog section. */
export type HrEditRow = { key: 'what' | 'change' | 'reason' | 'raised' | 'stage' | 'decided' | 'comment'; label: string; value: string }

/** "Raised by" / "Approved by" + "Meena · 2 Nov, 10:05 AM"; "... on" + the time when no name; null when neither. */
function who(verb: string, by: string | null, at: string | null, when: (iso: string) => string | null): { label: string; value: string } | null {
  const stamp = at ? when(at) : null
  if (by) return { label: `${verb} by`, value: stamp ? `${by} · ${stamp}` : by }
  if (stamp) return { label: `${verb} on`, value: stamp }
  return null
}

/** The decider's verb: applied = approved, rejected = rejected. */
function decidedVerb(status: string): string {
  return status === 'applied' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Decided'
}

/** The reviewer's comment, unless the stage sentence already ends with it ("Rejected by ... : <comment>"). */
export function commentText(edit: Pick<HrEdit, 'comment' | 'stageLabel'>): string | null {
  const c = edit.comment?.trim()
  if (!c) return null
  return edit.stageLabel.includes(c) ? null : c
}

/**
 * What the popover and the day dialog list, in order: what HR changed, from -> to (with shifts), why, who raised it and
 * when, the approval stage (the server's sentence), who decided and when, and the reviewer's comment. Lines without a
 * value are left out.
 */
export function hrEditRows(edit: HrEdit, when: (iso: string) => string | null = formatWhen): HrEditRow[] {
  const rows: HrEditRow[] = [
    { key: 'what', label: 'What HR changed', value: edit.typeLabel },
    { key: 'change', label: 'Change', value: changeText(edit) },
  ]
  if (edit.reason) rows.push({ key: 'reason', label: 'Reason', value: edit.reason })
  const raised = who('Raised', edit.raisedBy, edit.raisedAt, when)
  if (raised) rows.push({ key: 'raised', ...raised })
  rows.push({ key: 'stage', label: 'Approval stage', value: edit.stageLabel })
  const decided = edit.status === 'waiting_hod' || edit.status === 'waiting_hr' ? null : who(decidedVerb(edit.status), edit.decidedBy, edit.decidedAt, when)
  if (decided) rows.push({ key: 'decided', ...decided })
  const comment = commentText(edit)
  if (comment) rows.push({ key: 'comment', label: 'Comment', value: comment })
  return rows
}

/** For a calendar cell's accessible name: "edited by HR: Mark as Late, waiting for HR". */
export function hrEditAria(edit: Pick<HrEdit, 'status' | 'typeLabel'>): string {
  const word = hrEditStatusWord(edit.status)
  return `${isHrEditApplied(edit) ? 'edited by HR' : 'HR edit'}: ${edit.typeLabel}, ${word.charAt(0).toLowerCase()}${word.slice(1)}`
}

export type HrEditCounts = { any: number; applied: number; waiting: number; rejected: number }

/** How many days of a month carry an HR edit, by stage. */
export function countHrEdits(days: readonly { hrEdit?: unknown }[]): HrEditCounts {
  const out: HrEditCounts = { any: 0, applied: 0, waiting: 0, rejected: 0 }
  for (const d of days) {
    const e = hrEditOf(d)
    if (!e) continue
    out.any++
    const tone = hrEditTone(e.status)
    if (tone === 'approved') out.applied++
    else if (tone === 'waiting') out.waiting++
    else if (tone === 'rejected') out.rejected++
  }
  return out
}

/** The line under the calendar: "HR changed 2 days this month: 1 applied, 1 waiting for approval." (null for none). */
export function hrEditMonthText(c: HrEditCounts): string | null {
  if (!c.any) return null
  const parts = [
    c.applied ? `${c.applied} applied` : null,
    c.waiting ? `${c.waiting} waiting for approval` : null,
    c.rejected ? `${c.rejected} rejected` : null,
  ].filter(Boolean)
  return `HR changed ${c.any} ${c.any === 1 ? 'day' : 'days'} this month${parts.length ? `: ${parts.join(', ')}` : ''}.`
}

// ── The "Edited by HR" colour ──
// Indigo: no day kind uses it as a fill (desktop: emerald / amber / rose / sapphire / violet; phones = the mobile app's
// green / orange / red / violet / pink, plus blue / cyan / slate there). An outline AND a tint, so it reads as its own
// colour next to the violet Leave / Holiday days. The SAME values as the mobile app's calendar (both themes):
//   outline  #6366F1 (light) · #818CF8 (dark)
//   fill     #E0E7FF (light) · #6366F138 (dark, 22% indigo over the card)
//   ink      #3730A3 (light) · #C7D2FE (dark)        (ink on fill: about 8.5:1 in both themes)
// Phones repeat every class with `max-md:` so it wins over the phone status colours of the calendar.
export const HR_EDIT_HEX = {
  outlineLight: '#6366F1',
  outlineDark: '#818CF8',
  fillLight: '#E0E7FF',
  fillDark: '#6366F138',
  inkLight: '#3730A3',
  inkDark: '#C7D2FE',
} as const

/** A calendar cell (and the legend swatch) of a day with an APPLIED HR edit. */
export const HR_EDIT_CELL =
  'border-2 border-[#6366F1] bg-[#E0E7FF] text-[#3730A3] dark:border-[#818CF8] dark:bg-[#6366F138] dark:text-[#C7D2FE] ' +
  'max-md:border-[#6366F1] max-md:bg-[#E0E7FF] max-md:text-[#3730A3] max-md:dark:border-[#818CF8] max-md:dark:bg-[#6366F138] max-md:dark:text-[#C7D2FE]'

/** The day dialog / popover section of an APPLIED edit: the same indigo, softer. */
export const HR_EDIT_PANEL = 'border-[#6366F1]/45 bg-[#E0E7FF]/45 dark:border-[#818CF8]/40 dark:bg-[#6366F11F]'

/** The "!" badge, by stage: amber while waiting, indigo once applied, rose when rejected. */
export function hrEditBadgeClass(status: string): string {
  switch (hrEditTone(status)) {
    case 'waiting':
      return 'bg-warning text-warning-foreground'
    case 'approved':
      return 'bg-[#4F46E5] text-white dark:bg-[#818CF8] dark:text-[#1E1B4B]'
    case 'rejected':
      return 'bg-destructive text-destructive-foreground'
    default:
      return 'bg-muted-foreground text-background'
  }
}

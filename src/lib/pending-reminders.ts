// My Department Head -> "My Requests": the signed-in employee's own requests that are still waiting for an answer, and
// the "Remind Department Head / HR" button. Pure (no React), unit-tested in pending-reminders.test.ts.
// Mirrors the mobile app's src/lib/pendingReminders.ts.
//
// GET  /my/pending-requests                          (backend/api/mobile_reminder_views.py::my_pending_requests)
// POST /my/pending-requests/<module>/<id>/remind     (::remind_approver) - once per request every 24 hours
//
// Who a reminder goes to is decided by the server (the approval pipeline): the Department Head (phone push + in-app), or
// HR (shown on HR's Requests hub). Every field is optional: a missing or wrong-typed one reads as "not sent", and a reply
// that is not an object with a list is null (the page turns it into a Try again state).

import type { PathStep, PathStepState } from './decider.ts'

export type StepState = 'approved' | 'rejected' | 'skipped' | 'pending' | 'waiting'

export interface PendingStep {
  /** "Department Head", "HR" or "Department Head or HR". */
  label: string
  state: StepState
  by: string | null
  at: string | null
}

export interface TrailEntry {
  roleLabel: string
  decision: string
  by: string | null
  at: string | null
  comment: string | null
}

export interface PendingApprover {
  role: 'hod' | 'hr'
  /** The head's name, or "HR". */
  name: string
  label: string
}

/** What an attendance change HR proposed would do to the day (only on `attendance_correction` rows). */
export interface AttendanceChange {
  date: string | null
  fromLabel: string | null
  toLabel: string | null
  fromShifts: string | null
  toShifts: string | null
  firstPunch: string | null
  lastPunch: string | null
  marks: string[]
  /** The server's sentence: "2026-10-08: Absent (0.00 shift) → Present (1.00 shift), 09:00 to 18:00, marked Late". */
  text: string
}

export interface Detail {
  label: string
  value: string
}

/** Who raised a request: the employee, or HR for them (an attendance change HR proposed). */
export interface RaisedBy {
  raisedBy: 'employee' | 'hr'
  /** "Raised by HR" / "Raised by you" */
  raisedByLabel: string
  /** The HR user who proposed it ("Meena"), or null. */
  raisedByName: string | null
}

export interface PendingRequest extends RaisedBy {
  key: string
  /** leave, permission, casual_leave, missing_punch, on_duty, outpass, attendance_correction, resignation, advance, request */
  module: string
  moduleLabel: string
  id: number
  title: string
  summary: string
  reason: string | null
  submittedAt: string | null
  /** "Waiting for your Department Head (Ravi Shankar)" / "Waiting for HR" */
  stage: string
  approver: PendingApprover
  steps: PendingStep[]
  trail: TrailEntry[]
  workflowEnabled: boolean
  reminderCount: number
  lastRemindedAt: string | null
  canRemind: boolean
  nextReminderAt: string | null
  /** Seconds until a reminder is allowed again, as the server counted them when it answered (0 = now). */
  remindInSeconds: number
  details: Detail[]
  change: AttendanceChange | null
}

/** An attendance change HR proposed for the employee that was decided in the last `recentDays` days. */
export interface RecentHrEdit extends RaisedBy {
  key: string
  id: number
  title: string
  summary: string
  reason: string | null
  status: 'approved' | 'rejected'
  statusLabel: string
  decidedAt: string | null
  decidedBy: string | null
  /** "hod" | "hr" | null */
  decidedByRole: string | null
  comment: string | null
  change: AttendanceChange | null
}

export interface PendingRequests {
  items: PendingRequest[]
  count: number
  cooldownHours: number
  recentHrEdits: RecentHrEdit[]
  recentDays: number
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const orNull = (v: unknown): string | null => str(v) || null
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const STATES: readonly StepState[] = ['approved', 'rejected', 'skipped', 'pending', 'waiting']

function readStep(raw: unknown): PendingStep | null {
  if (!isObject(raw)) return null
  const label = str(raw.label)
  if (!label) return null
  const state = STATES.includes(raw.state as StepState) ? (raw.state as StepState) : 'waiting'
  return { label, state, by: orNull(raw.by), at: orNull(raw.at) }
}

function readTrail(raw: unknown): TrailEntry | null {
  if (!isObject(raw)) return null
  const decision = str(raw.decision)
  if (!decision) return null
  return {
    roleLabel: str(raw.roleLabel) || 'Approver',
    decision,
    by: orNull(raw.by),
    at: orNull(raw.at),
    comment: orNull(raw.comment),
  }
}

function readDetail(raw: unknown): Detail | null {
  if (!isObject(raw)) return null
  const label = str(raw.label)
  const value = typeof raw.value === 'number' ? String(raw.value) : str(raw.value)
  return label && value ? { label, value } : null
}

const readDetails = (raw: unknown): Detail[] => (Array.isArray(raw) ? raw : []).map(readDetail).filter((d): d is Detail => d !== null)

/** The sentence for a change, built from its parts (for a reply without `text`): "2026-10-08: Absent → Present". */
export function changeText(c: Omit<AttendanceChange, 'text'>): string {
  if (!c.fromLabel && !c.toLabel) return ''
  const side = (label: string | null, shifts: string | null) => `${label ?? 'Not recorded'}${shifts ? ` (${shifts})` : ''}`
  let text = `${c.date ? `${c.date}: ` : ''}${side(c.fromLabel, c.fromShifts)} → ${side(c.toLabel, c.toShifts)}`
  if (c.firstPunch || c.lastPunch) text += `, ${c.firstPunch ?? '-'} to ${c.lastPunch ?? '-'}`
  if (c.marks.length) text += `, marked ${c.marks.join(' and ')}`
  return text
}

/** The change block, or null when it is missing or says nothing. */
export function readChange(raw: unknown): AttendanceChange | null {
  if (!isObject(raw)) return null
  const change: AttendanceChange = {
    date: orNull(raw.date),
    fromLabel: orNull(raw.fromLabel),
    toLabel: orNull(raw.toLabel),
    fromShifts: orNull(raw.fromShifts),
    toShifts: orNull(raw.toShifts),
    firstPunch: orNull(raw.firstPunch),
    lastPunch: orNull(raw.lastPunch),
    marks: (Array.isArray(raw.marks) ? raw.marks : []).map(str).filter(Boolean),
    text: str(raw.text),
  }
  if (!change.text) change.text = changeText(change)
  return change.text ? change : null
}

function readRaisedBy(raw: Record<string, unknown>): RaisedBy {
  const hr = raw.raisedBy === 'hr'
  return {
    raisedBy: hr ? 'hr' : 'employee',
    raisedByLabel: str(raw.raisedByLabel) || (hr ? 'Raised by HR' : 'Raised by you'),
    raisedByName: hr ? orNull(raw.raisedByName) : null,
  }
}

/** One row of the list, or null when it has no id or kind. */
export function readPendingRequest(raw: unknown): PendingRequest | null {
  if (!isObject(raw)) return null
  const id = num(raw.id)
  const module = str(raw.module)
  if (id === null || !module) return null
  const approver = isObject(raw.approver) ? raw.approver : {}
  const role = approver.role === 'hod' ? 'hod' : 'hr'
  const wait = Math.max(0, Math.round(num(raw.remindInSeconds) ?? 0))
  // An explicit "no" from the server wins; without one, the wait decides.
  const canRemind = (raw.canRemind === undefined || raw.canRemind === true) && wait === 0
  return {
    key: str(raw.key) || `${module}-${id}`,
    module,
    moduleLabel: str(raw.moduleLabel) || module,
    id,
    title: str(raw.title) || str(raw.moduleLabel) || 'Request',
    summary: str(raw.summary),
    reason: orNull(raw.reason),
    submittedAt: orNull(raw.submittedAt),
    stage: str(raw.stage) || 'Waiting for an answer',
    approver: {
      role,
      name: str(approver.name) || (role === 'hod' ? 'your Department Head' : 'HR'),
      label: str(approver.label) || (role === 'hod' ? 'Department Head' : 'HR'),
    },
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map(readStep).filter((x): x is PendingStep => x !== null),
    trail: (Array.isArray(raw.trail) ? raw.trail : []).map(readTrail).filter((x): x is TrailEntry => x !== null),
    workflowEnabled: raw.workflowEnabled !== false,
    reminderCount: Math.max(0, num(raw.reminderCount) ?? 0),
    lastRemindedAt: orNull(raw.lastRemindedAt),
    canRemind,
    nextReminderAt: orNull(raw.nextReminderAt),
    remindInSeconds: canRemind ? 0 : wait,
    details: readDetails(raw.details),
    change: readChange(raw.change),
    ...readRaisedBy(raw),
  }
}

/** One recently decided HR attendance change, or null when it has no id or no decision. */
export function readRecentHrEdit(raw: unknown): RecentHrEdit | null {
  if (!isObject(raw)) return null
  const id = num(raw.id)
  if (id === null || (raw.status !== 'approved' && raw.status !== 'rejected')) return null
  const status = raw.status
  return {
    key: str(raw.key) || `attendance_correction-${id}`,
    id,
    title: str(raw.title) || 'Attendance correction',
    summary: str(raw.summary),
    reason: orNull(raw.reason),
    status,
    statusLabel: str(raw.statusLabel) || (status === 'approved' ? 'Approved' : 'Rejected'),
    decidedAt: orNull(raw.decidedAt),
    decidedBy: orNull(raw.decidedBy),
    decidedByRole: orNull(raw.decidedByRole),
    comment: orNull(raw.comment),
    change: readChange(raw.change),
    ...readRaisedBy({ raisedBy: 'hr', ...raw }),
  }
}

/** The reply of GET /my/pending-requests, or null when it is not an object with a list. */
export function normalizePendingRequests(raw: unknown): PendingRequests | null {
  if (!isObject(raw) || !Array.isArray(raw.items)) return null
  const items = raw.items.map(readPendingRequest).filter((i): i is PendingRequest => i !== null)
  const recentHrEdits = (Array.isArray(raw.recentHrEdits) ? raw.recentHrEdits : [])
    .map(readRecentHrEdit)
    .filter((e): e is RecentHrEdit => e !== null)
  return {
    items,
    count: items.length,
    cooldownHours: num(raw.cooldownHours) ?? 24,
    recentHrEdits,
    recentDays: num(raw.recentDays) ?? 30,
  }
}

/**
 * Seconds still to wait before this request can be reminded again, `nowMs` being this PC's clock and `fetchedAtMs` when
 * the list arrived. Counted from the server's own figure, so a PC whose clock is wrong still shows the right wait.
 */
export function secondsUntilRemind(item: Pick<PendingRequest, 'canRemind' | 'remindInSeconds'>, fetchedAtMs: number, nowMs: number): number {
  if (item.canRemind) return 0
  const elapsed = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000))
  return Math.max(0, item.remindInSeconds - elapsed)
}

/** "5 h 12 m", "12 m", "under a minute". Rounded UP to the minute, so it never promises a time that is too early. */
export function durationText(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds))
  if (sec === 0) return ''
  if (sec < 60) return 'under a minute'
  const minutes = Math.ceil(sec / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${m} m` : `${m} m`
}

/** "You can remind again in 5 h 12 m" (or '' when the button is free). */
export function cooldownText(seconds: number): string {
  const d = durationText(seconds)
  return d ? `You can remind again in ${d}` : ''
}

/** Share of the cooldown already passed, 0..1 (for the countdown ring). */
export function cooldownProgress(secondsLeft: number, cooldownHours: number): number {
  const total = Math.max(1, cooldownHours * 3600)
  return Math.min(1, Math.max(0, 1 - secondsLeft / total))
}

/** The button's words. */
export function remindLabel(item: Pick<PendingRequest, 'approver'>): string {
  return item.approver.role === 'hod' ? 'Remind Department Head' : 'Remind HR'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "31 Oct, 10:05 AM" in this PC's own time. '' for a missing or bad date. */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

const STEP_STATE: Record<StepState, PathStepState> = {
  approved: 'done',
  rejected: 'rejected',
  skipped: 'skipped',
  pending: 'current',
  waiting: 'upcoming',
}

/**
 * The kit Stepper's steps: who raised it first ("You", or "HR (raised it)" for a change HR proposed), then the pipeline's
 * steps, the one it waits at now marked current.
 */
export function stepperSteps(
  item: Pick<PendingRequest, 'steps' | 'submittedAt' | 'raisedBy' | 'raisedByName'>,
  when: (iso: string) => string = shortDateTime,
): PathStep[] {
  const sent = item.submittedAt ? when(item.submittedAt) : ''
  const first: PathStep = {
    key: 'raised',
    label: item.raisedBy === 'hr' ? 'HR (raised it)' : 'You',
    detail: sent ? `Sent ${sent}` : 'Sent',
    state: 'done',
    comment: null,
  }
  const steps = item.steps.length ? item.steps : [{ label: 'Approver', state: 'pending' as StepState, by: null, at: null }]
  return [
    first,
    ...steps.map((s, i): PathStep => {
      const at = s.at ? when(s.at) : ''
      const detail =
        s.state === 'approved'
          ? `Approved${s.by ? ` by ${s.by}` : ''}${at ? ` · ${at}` : ''}`
          : s.state === 'rejected'
            ? `Rejected${s.by ? ` by ${s.by}` : ''}`
            : s.state === 'pending'
              ? 'Waiting now'
              : s.state === 'skipped'
                ? 'Skipped'
                : 'Up next'
      return { key: `${i}`, label: s.label, detail, state: STEP_STATE[s.state], comment: null }
    }),
  ]
}

/** "Waiting 3 days" / "Waiting 5 h" / "Sent just now", counted from when it was submitted. */
export function waitingSinceText(submittedAt: string | null | undefined, nowMs: number): string {
  if (!submittedAt) return ''
  const t = new Date(submittedAt).getTime()
  if (Number.isNaN(t)) return ''
  const minutes = Math.max(0, Math.floor((nowMs - t) / 60000))
  if (minutes < 60) return minutes < 2 ? 'Sent just now' : `Waiting ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Waiting ${hours} h`
  const days = Math.floor(hours / 24)
  return `Waiting ${days} day${days === 1 ? '' : 's'}`
}

/** "Approved by Meena (HR) on 31 Oct, 10:05 AM" / "Rejected by your Department Head". */
export function decisionLine(e: Pick<RecentHrEdit, 'statusLabel' | 'decidedBy' | 'decidedByRole' | 'decidedAt'>): string {
  const role = e.decidedByRole === 'hod' ? 'Department Head' : e.decidedByRole === 'hr' ? 'HR' : ''
  const who = e.decidedBy ? ` by ${e.decidedBy}${role ? ` (${role})` : ''}` : role ? ` by ${role === 'HR' ? 'HR' : `your ${role}`}` : ''
  const when = shortDateTime(e.decidedAt)
  return `${e.statusLabel}${who}${when ? ` on ${when}` : ''}`
}

/** The server's message for a failed reminder (a 429 says when it opens again), or a plain fallback. Works on the app's
 *  ApiError ({ message, status, data }) without importing it. */
export function remindErrorText(err: unknown): string {
  const e = isObject(err) ? err : null
  const data = e && isObject(e.data) ? e.data : null
  const text = data ? str(data.error) || str(data.message) || str(data.detail) : ''
  if (text) return text
  if (e && typeof e.status === 'number') return 'The reminder could not be sent. Please try again.'
  return 'No connection. Check your internet and try again.'
}

/** Seconds to wait from a refused (429 too_soon) reminder, or null. */
export function retryAfterSeconds(err: unknown): number | null {
  const e = isObject(err) ? err : null
  const data = e && isObject(e.data) ? e.data : null
  const s = data ? num(data.retryAfterSeconds) : null
  return s !== null && s > 0 ? Math.round(s) : null
}

/** The answer of a successful reminder: the server's sentence (who was reminded) and the request as it is now. */
export function readRemindResult(raw: unknown): { message: string; item: PendingRequest | null } {
  if (!isObject(raw)) return { message: 'Reminder sent.', item: null }
  return { message: str(raw.message) || 'Reminder sent.', item: readPendingRequest(raw.item) }
}

/** The number on the "My Requests" tab: '' for none, '99+' past 99. */
export function countBadge(count: number | null | undefined): string {
  const c = Math.max(0, Math.floor(count ?? 0))
  if (c === 0) return ''
  return c > 99 ? '99+' : String(c)
}

// WHO approved or rejected a request, in one prominent line: "Approved by HR (Meena) · 31 Oct, 10:05 AM",
// "Rejected by Department Head (Kavya)", "Approved by you · waiting for HR". Pure and unit-tested (decider.test.ts).
//
// Mirrors the mobile app's src/lib/approvalsDecider.ts and the DecisionBadge in src/components/approval/ApprovalTrail.tsx
// so both apps name the decider the same way. Read from the request's `approval` block (approval_workflow.progress on
// the server: each decided step carries by / at / decidedBy) or, for a request decided before that block existed, from
// the fields the request kept (approvedBy, reviewedBy, hodBy / hrBy ...). Owner 2026-10-31: every decided request must
// clearly show who decided it.

import type { ApprovalProgress, ApprovalRole } from '../types/index.ts'

export const ROLE_NAMES: Record<ApprovalRole, string> = { hod: 'Department Head', hr: 'HR' }

export interface Decider {
  decision: 'approved' | 'rejected'
  /** Department Head or HR; null when the request does not say. */
  role: ApprovalRole | null
  name: string | null
  /** ISO time of the decision, when known. */
  at: string | null
  /** The person reading is the one who decided (the Department Head's own Approvals page). */
  you?: boolean
}

export type DecisionTone = 'approved' | 'rejected' | 'waiting'

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "31 Oct, 10:05 AM" in the device's time zone; null for a timestamp that does not parse. */
export function formatWhen(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const h = d.getHours()
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hour12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

/** A role in any spelling the server has used ("hod", "dept_head", "hr", ...), or null ("system" and unknowns). */
export function roleOf(raw: unknown): ApprovalRole | null {
  const r = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  if (r === 'hr') return 'hr'
  if (r === 'hod' || r === 'dept_head' || r === 'department_head' || r === 'manager') return 'hod'
  return null
}

/**
 * The final decision recorded in an `approval` block, or null while the request still waits (or the block is missing,
 * or it is an old request whose steps carry nothing). A rejection names the step that rejected; an approval the last
 * step that approved.
 */
export function deciderFromApproval(a: ApprovalProgress | null | undefined): Decider | null {
  if (!a || !Array.isArray(a.steps) || !a.steps.length) return null
  if (a.currentStep != null || (Array.isArray(a.waitingFor) && a.waitingFor.length)) return null
  const roleOfStep = (s: ApprovalProgress['steps'][number]): ApprovalRole | null =>
    s.decidedBy ?? (Array.isArray(s.roles) && s.roles.length === 1 ? s.roles[0] : null)
  const rejected = a.steps.find((s) => s.state === 'rejected')
  if (rejected) return { decision: 'rejected', role: roleOfStep(rejected), name: text(rejected.by), at: text(rejected.at) }
  // Not rejected, yet a step was never reached: an old rejected request whose stamps only recorded approvals. Saying
  // "Approved by ..." there would be wrong, so say nothing (the card's own status still shows).
  if (a.steps.some((s) => s.state === 'waiting' || s.state === 'pending')) return null
  const approved = a.steps.filter((s) => s.state === 'approved')
  if (!approved.length) return null
  // The step decided last; steps decided at the same time (or without times) fall back to pipeline order.
  const last = approved.reduce((best, s) => ((s.at ?? '') >= (best.at ?? '') ? s : best))
  return { decision: 'approved', role: roleOfStep(last), name: text(last.by), at: text(last.at) }
}

/** A decider from a request's own fields, for one decided before the `approval` block existed. Null when undecided or
 *  nobody is named. */
export function deciderFromFields(f: { status: unknown; name?: unknown; role?: unknown; at?: unknown }): Decider | null {
  const status = typeof f.status === 'string' ? f.status.toLowerCase() : ''
  const decision =
    status === 'rejected' ? 'rejected' : ['approved', 'closed', 'active', 'completed'].includes(status) ? 'approved' : null
  if (!decision) return null
  let name = text(f.name)
  let role = roleOf(f.role)
  // Some old rows kept the ROLE in the name field ("hr", "dept_head").
  if (name && roleOf(name) && !role) {
    role = roleOf(name)
    name = null
  } else if (name && name.toLowerCase() === 'system') {
    name = null
  }
  if (!name && !role) return null
  return { decision, role, name, at: text(f.at) }
}

/** Missing Punch / On-Duty requests decided before the `approval` block kept a Department Head stamp and an HR stamp.
 *  The last one stamped made the final call (HR when both are there). */
export function deciderFromStamps(f: { status: unknown; hodBy?: unknown; hodAt?: unknown; hrBy?: unknown; hrAt?: unknown }): Decider | null {
  const hr = text(f.hrBy)
  return hr
    ? deciderFromFields({ status: f.status, name: hr, role: 'hr', at: f.hrAt })
    : deciderFromFields({ status: f.status, name: f.hodBy, role: text(f.hodBy) ? 'hod' : null, at: f.hodAt })
}

/** A salary advance / settlement: HR alone decides it. Who and when come from the record, else from its timeline. */
export function deciderForAdvance(a: {
  status: unknown
  approvedBy?: unknown
  approvedAt?: unknown
  timeline?: { kind?: unknown; by?: unknown; at?: unknown }[] | null
}): Decider | null {
  const status = typeof a.status === 'string' ? a.status.toLowerCase() : ''
  const kind = status === 'rejected' ? 'rejected' : 'approved'
  const event = (a.timeline ?? []).find((e) => e && e.kind === kind)
  return deciderFromFields({ status, name: text(a.approvedBy) ?? event?.by, role: 'hr', at: text(a.approvedAt) ?? event?.at })
}

/** "Approved by HR (Meena) · 31 Oct, 10:05 AM". `when` formats the time (null leaves it out). */
export function deciderText(d: Decider, when: (iso: string) => string | null = formatWhen): string {
  const verb = d.decision === 'approved' ? 'Approved' : 'Rejected'
  const who = d.you ? 'you' : d.role && d.name ? `${ROLE_NAMES[d.role]} (${d.name})` : d.role ? ROLE_NAMES[d.role] : d.name
  const at = d.at ? when(d.at) : null
  return [who ? `${verb} by ${who}` : verb, at].filter(Boolean).join(' · ')
}

/** Who a pending request waits for now ("HR", "Department Head or HR"), or null once it is decided. */
export function waitingTarget(a: ApprovalProgress | null | undefined): string | null {
  if (!a || a.currentStep == null || !Array.isArray(a.waitingFor) || !a.waitingFor.length) return null
  return [...a.waitingFor]
    .filter((r) => r in ROLE_NAMES)
    .sort()
    .map((r) => ROLE_NAMES[r])
    .join(' or ') || null
}

export interface DecisionLine {
  text: string
  tone: DecisionTone
  decider: Decider
}

/**
 * The band for a Department Head looking at a request on their Approvals page: once they approved it and it moved on
 * to HR, "Approved by you · 31 Oct, 10:05 AM · waiting for HR" (tone 'waiting'); once it is final, the final decider
 * ("Rejected by HR (Meena) · ..."), with "you" when the viewer's role made the final call. Null while nothing is
 * decided yet.
 */
export function decisionLineFor(
  a: ApprovalProgress | null | undefined,
  viewer: ApprovalRole,
  when: (iso: string) => string | null = formatWhen,
): DecisionLine | null {
  if (!a || !Array.isArray(a.steps)) return null
  const target = waitingTarget(a)
  if (target) {
    const mine = a.steps.find(
      (s) => s.state === 'approved' && (s.decidedBy === viewer || (!s.decidedBy && s.roles.length === 1 && s.roles[0] === viewer)),
    )
    if (!mine) return null
    const decider: Decider = { decision: 'approved', role: viewer, name: null, at: text(mine.at), you: true }
    return { text: `${deciderText(decider, when)} · waiting for ${target}`, tone: 'waiting', decider }
  }
  const final = deciderFromApproval(a)
  if (!final) return null
  const decider = final.role === viewer ? { ...final, you: true } : final
  return { text: deciderText(decider, when), tone: decider.decision, decider }
}

// ---- The approval path as stepper steps ---------------------------------------------------------------------------

export type PathStepState = 'done' | 'current' | 'upcoming' | 'rejected' | 'skipped'

export interface PathStep {
  key: string
  /** "You", "Department Head", "HR", "Department Head or HR" (+ " (optional)"). */
  label: string
  /** "Sent 30 Oct, 9:12 AM", "Approved by Kavya · 31 Oct, 10:05 AM", "Waiting for decision", "Up next". */
  detail: string | null
  state: PathStepState
  comment: string | null
}

/**
 * A request's path for the kit's <Stepper>: "You" (sent) first, then one step per approver, in pipeline order. Empty
 * when there is no usable `approval` block (the page then shows its plain status only).
 */
export function approvalPath(
  a: ApprovalProgress | null | undefined,
  sentAt?: string | null,
  when: (iso: string) => string | null = formatWhen,
): PathStep[] {
  if (!a || !Array.isArray(a.steps) || !a.steps.length) return []
  const sent = sentAt ? when(sentAt) : null
  const out: PathStep[] = [{ key: 'sent', label: 'You', detail: sent ? `Sent ${sent}` : 'Sent', state: 'done', comment: null }]
  const waiting = a.currentStep != null
  for (const [i, s] of a.steps.entries()) {
    const roles = Array.isArray(s.roles) ? [...s.roles].sort() : []
    const label = roles.map((r) => ROLE_NAMES[r] ?? r).join(' or ') + (s.mandatory === false ? ' (optional)' : '')
    const decided = s.state === 'approved' || s.state === 'rejected'
    const via = decided && roles.length > 1 && s.decidedBy ? ` (${ROLE_NAMES[s.decidedBy]})` : ''
    const at = decided && s.at ? when(s.at) : null
    const by = decided && text(s.by) ? ` by ${text(s.by)}${via}` : via
    const detail =
      s.state === 'approved'
        ? `Approved${by}${at ? ` · ${at}` : ''}`
        : s.state === 'rejected'
          ? `Rejected${by}${at ? ` · ${at}` : ''}`
          : s.state === 'pending'
            ? 'Waiting for decision'
            : s.state === 'skipped'
              ? 'Skipped'
              : waiting
                ? 'Up next'
                : 'Not reached'
    const state: PathStepState =
      s.state === 'approved'
        ? 'done'
        : s.state === 'rejected'
          ? 'rejected'
          : s.state === 'pending'
            ? 'current'
            : s.state === 'skipped'
              ? 'skipped'
              : 'upcoming'
    out.push({ key: String(s.index ?? i), label, detail, state, comment: decided ? text(s.comment) : null })
  }
  return out
}

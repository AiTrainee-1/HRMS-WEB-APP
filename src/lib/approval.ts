import type {
  ApprovalProgress,
  ApprovalRole,
  ApprovalStep,
  ApprovalStepState,
  ApprovalSummary,
  ApprovalSummaryItem,
  ApprovalWorkflowKey,
} from '@/types'

// The one place an approval pipeline is turned into words and decisions for this app. The rules themselves (who may
// decide what, and when) live in backend/api/approval_workflow.py, which decides every real request; this only
// explains a request's path and hides an action the pipeline forbids. The backend sends each request's own `approval`
// block and GET /approval-summary; an older backend (or a failed summary call) sends neither, so every helper here
// answers "no information" (null / the fallback you pass) and the screen keeps doing what it did before pipelines.

/** How a role is named in a status ("Waiting for Department Head")... */
const ROLE_NAME: Record<ApprovalRole, string> = { hod: 'Department Head', hr: 'HR' }
/** ...and in a sentence addressed to the employee ("goes to your Department Head"). */
const ROLE_YOUR: Record<ApprovalRole, string> = { hod: 'your Department Head', hr: 'HR' }

const joinRoles = (roles: ApprovalRole[], names: Record<ApprovalRole, string>) =>
  roles.map((r) => names[r] ?? r).join(' or ')

/** "Department Head" | "HR" | "Department Head or HR" (a step both hold: whoever acts first decides it). */
function stepName(step: Pick<ApprovalStep, 'roles'>): string {
  return joinRoles(step.roles, ROLE_NAME)
}

/** Does the pipeline have a step for this role at all? */
export function takesPart(pipeline: Pick<ApprovalSummaryItem, 'steps'>, role: ApprovalRole): boolean {
  return pipeline.steps.some((s) => s.roles.includes(role))
}

// ---- Per request ----------------------------------------------------------------------------------------------

/** "Waiting for HR" / "Waiting for Department Head" / "Waiting for Department Head or HR"; null when the request is not
 * waiting (decided) or has no approval block, so the caller falls back to its old status label. */
export function waitingText(approval: ApprovalProgress | null | undefined): string | null {
  if (!approval || approval.currentStep == null || !approval.waitingFor?.length) return null
  return `Waiting for ${joinRoles(approval.waitingFor, ROLE_NAME)}`
}

/** Can the Department Head approve this request right now? The pipeline's answer when the server sent one, else the
 * rule the screen used before (`fallback`). Not counting who the individual HOD is: the per-person switches still apply. */
export function hodCanAct(approval: ApprovalProgress | null | undefined, fallback: boolean): boolean {
  return approval?.canAct?.hod ?? fallback
}

/** Can the Department Head reject it right now (canAct, plus a rejection the pipeline allows out of turn)? */
export function hodCanReject(approval: ApprovalProgress | null | undefined, fallback: boolean): boolean {
  return approval?.canReject?.hod ?? approval?.canAct?.hod ?? fallback
}

function approvedRoles(approval: ApprovalProgress): Set<ApprovalRole> {
  return new Set(approval.steps.flatMap((s) => (s.state === 'approved' && s.decidedBy ? [s.decidedBy] : [])))
}

/** Which steps are dealt with once these roles have approved: a step a role of it approved, or an optional one whose
 * next step is done (the server's own rule, approval_workflow.satisfied_mask). */
function satisfiedSteps(steps: ApprovalStep[], approved: Set<ApprovalRole>): boolean[] {
  const done = steps.map((s) => s.roles.some((r) => approved.has(r)))
  for (let i = steps.length - 2; i >= 0; i -= 1) if (!done[i] && !steps[i].mandatory && done[i + 1]) done[i] = true
  return done
}

/** What approving does next, for the person deciding: "Approving forwards it to HR." / "Your approval completes this
 * request." Null when the pipeline has a single step (nothing to explain) or the request has no approval block. */
export function approveEffect(approval: ApprovalProgress | null | undefined, role: ApprovalRole): string | null {
  if (!approval || (approval.steps?.length ?? 0) < 2) return null
  const approved = approvedRoles(approval)
  approved.add(role)
  const done = satisfiedSteps(approval.steps, approved)
  const next = approval.steps.find((_, i) => !done[i])
  return next ? `Approving forwards it to ${stepName(next)}.` : 'Your approval completes this request.'
}

export interface TrailEntry {
  index: number
  /** "Department Head" | "HR" | "Department Head or HR" */
  name: string
  roles: ApprovalRole[]
  state: ApprovalStepState
  /** What became of the step: Approved, Rejected, Skipped, Waiting for decision, Up next, Not reached. */
  status: string
  /** Who decided it; a step both roles hold also names the role ("Kumar (HR)"). */
  by: string | null
  at: string | null
  comment: string | null
}

function stepStatus(state: ApprovalStepState, requestWaiting: boolean): string {
  switch (state) {
    case 'approved': return 'Approved'
    case 'rejected': return 'Rejected'
    case 'skipped': return 'Skipped'
    case 'pending': return 'Waiting for decision'
    default: return requestWaiting ? 'Up next' : 'Not reached'
  }
}

/** The request's steps, one entry each, ready to draw. */
export function trailOf(approval: ApprovalProgress): TrailEntry[] {
  const waiting = approval.currentStep != null
  return approval.steps.map((step) => ({
    index: step.index,
    name: stepName(step),
    roles: step.roles,
    state: step.state,
    status: stepStatus(step.state, waiting),
    by: step.by ? (step.roles.length > 1 && step.decidedBy ? `${step.by} (${ROLE_NAME[step.decidedBy]})` : step.by) : null,
    at: step.at ?? null,
    comment: step.comment?.trim() || null,
  }))
}

/** Do the steps tell the truth about the request? A waiting request always does. A finished one does only when its steps
 * record the decision itself (the last step approved, or one rejected): a row decided before the backend kept a trail
 * comes back with every step "skipped" / "waiting" (or only the Department Head's stamp), and reading who decided from
 * that would be guessing, so the caller shows what it showed before. */
export function stepsAreReliable(approval: ApprovalProgress | null | undefined): approval is ApprovalProgress {
  const steps = approval?.steps
  if (!approval || !steps?.length) return false
  if (approval.currentStep != null) return true
  return steps.some((s) => s.state === 'rejected') || steps[steps.length - 1].state === 'approved'
}

/** Is there a trail worth drawing? A single step still waiting is already said by the status chip. */
export function hasTrail(approval: ApprovalProgress | null | undefined): approval is ApprovalProgress {
  if (!stepsAreReliable(approval)) return false
  return approval.steps.length > 1 || approval.steps.some((s) => s.state === 'approved' || s.state === 'rejected')
}

// ---- Static copy (the pipeline in force, from the summary or a request's own block) ---------------------------------

/** "Your request goes to your Department Head, then to HR." / "...to your Department Head or HR, whoever acts first." /
 * "...to HR." Null when there is no pipeline to describe, so the caller uses neutral wording. */
export function pipelineSentence(
  pipeline: Pick<ApprovalSummaryItem, 'steps'> | null | undefined,
  subject = 'request',
): string | null {
  const steps = pipeline?.steps
  if (!steps?.length) return null
  const who = (step: ApprovalStep) => joinRoles(step.roles, ROLE_YOUR)
  const single = steps.length === 1 && steps[0].roles.length > 1
  let text = `Your ${subject} goes to ${steps.map(who).join(', then to ')}${single ? ', whoever acts first' : ''}.`
  // An optional step does not hold the request up: the step after it can decide without it.
  steps.forEach((step, i) => {
    if (i === steps.length - 1 || step.mandatory) return
    const next = who(steps[i + 1])
    text += ` ${next.charAt(0).toUpperCase()}${next.slice(1)} can decide it without waiting for ${who(step)}.`
  })
  return text
}

/** "Leave requests are switched off by HR right now." when HR has switched the workflow off, else null. The server is
 * the authority (it refuses a new request with 403 workflow_disabled); this is only the advance warning. */
export function workflowOffNote(workflow: ApprovalSummaryItem | null | undefined): string | null {
  return workflow && workflow.enabled === false ? `${workflow.label} requests are switched off by HR right now.` : null
}

/** The server refused a new request because its workflow is switched off (403, code workflow_disabled). Structural, so
 * it works on the app's ApiError without importing it. */
export function isWorkflowDisabled(err: unknown): boolean {
  const e = err as { status?: number; data?: { code?: string } } | null
  return !!e && e.status === 403 && e.data?.code === 'workflow_disabled'
}

// ---- GET /approval-summary --------------------------------------------------------------------------------------

type PlainObject = Record<string, unknown>

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStep(raw: unknown): ApprovalStep | null {
  if (!isPlainObject(raw) || !Array.isArray(raw.roles)) return null
  const roles = raw.roles.filter((r): r is ApprovalRole => r === 'hod' || r === 'hr')
  if (roles.length === 0) return null
  return {
    roles,
    mandatory: raw.mandatory !== false,
    label: typeof raw.label === 'string' && raw.label ? raw.label : joinRoles(roles, ROLE_NAME),
  }
}

/** Validates the response and coerces it to the contract; null when it is not one (e.g. an HTML error page from a
 * proxy), so the caller carries on without any pipeline information. A workflow whose steps are unusable is left out. */
export function parseApprovalSummary(raw: unknown): ApprovalSummary | null {
  if (!isPlainObject(raw)) return null
  const summary: ApprovalSummary = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isPlainObject(value) || !Array.isArray(value.steps)) continue
    const steps = value.steps.map(parseStep)
    if (steps.length === 0 || steps.includes(null)) continue
    summary[key as ApprovalWorkflowKey] = {
      label: typeof value.label === 'string' && value.label ? value.label : key,
      // Only an explicit false switches a request type off in the UI.
      enabled: value.enabled !== false,
      requestedBy: value.requestedBy === 'HR' ? 'HR' : 'Employee',
      steps: steps as ApprovalStep[],
      path: typeof value.path === 'string' ? value.path : '',
    }
  }
  return Object.keys(summary).length > 0 ? summary : null
}

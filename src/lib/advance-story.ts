// How a Loan & Advance application's amount was decided (`amountStory`, owner 2026-11-28): what was asked, the eligible
// limit and what it is based on, the Salary Advance rounding (nearest ₹500, ₹250 and up rounds up, never above the
// limit), every review step by ROLE (HR, Management, Auditor - never a reviewer's name inside the review), the final
// amount, why it is lower than asked, and the remarks. Pure, unit-tested in advance-story.test.ts (`npm test`).
//
// The server writes every sentence and decides every figure (backend api/employee_transparency.py amount_story, on GET
// /my/advances, GET /my/advances/<id> and the POST reply). While a request waits the server sends only what is fixed
// (the ask, the limit, the rounding) and keeps the review private: this file never fills that gap. An older server sends
// no `amountStory`: everything here then reads as null and the page shows what it always did.

import { formatINR } from './money.ts'

/** The stages the server sends (current server). An unknown stage is still shown, as a review step. */
export type StoryStage = 'requested' | 'rounding' | 'hr_review' | 'md_review' | 'hr_final' | 'auditor_review' | 'final'
/** employee | hr | md | auditor | policy */
export type StoryRole = 'employee' | 'hr' | 'md' | 'auditor' | 'policy'
/** requested | rounded_up | rounded_down | unchanged | capped | approved | reduced | increased | rejected | remark */
export type StoryAction =
  | 'requested'
  | 'rounded_up'
  | 'rounded_down'
  | 'unchanged'
  | 'capped'
  | 'approved'
  | 'reduced'
  | 'increased'
  | 'rejected'
  | 'remark'

export interface AmountStoryStep {
  /** A StoryStage (kept as sent, so a newer server's stage still shows). */
  stage: string
  role: string
  /** The ROLE label the server gives ("You", "HR", "Management", "Auditor", "Company policy"). */
  by: string
  /** Only HR's own decision in the Normal Method (the name the apps already show); null everywhere else. */
  name: string | null
  action: string
  /** The amount before / after the step (`to` null = rejected). */
  from: number | null
  to: number | null
  /** The server's wording (requested / rounding / final). */
  reason: string | null
  /** The reviewer's remark (on `requested`: the purpose). */
  remark: string | null
  at: string | null
  /** The review round (rework cycles); null outside the review. */
  round: number | null
}

export interface AmountStoryRemark {
  stage: string
  role: string
  by: string
  text: string
  at: string | null
}

export interface AmountStory {
  type: 'general' | 'term'
  status: string
  /** "automation" = decided (or waiting) in the Loan & Advance review; "normal" = HR decided it directly. */
  method: 'normal' | 'automation'
  /** A decision was made; false = what is known so far. */
  isFinal: boolean
  raisedBy: 'employee' | 'hr'
  requested: number
  eligibleLimit: number | null
  /** "50% of the ₹24,000 salary you earned from 1 to 20 October 2026 (24 paid days)." */
  limitBasis: string | null
  limitBasisCode: 'earned_salary' | 'monthly_salary' | null
  /** True only for a Salary Advance in the automation method. */
  roundingApplies: boolean
  /** False while it is only a preview (still at HR Review / not in a batch yet); null when there is no rounding. */
  roundingIsFinal: boolean | null
  beforeRounding: number | null
  afterRounding: number | null
  rounded: boolean
  cappedAtLimit: boolean
  roundsToZero: boolean
  /** The policy sentence and what happened (Term Loan: "Term Loans are not rounded: ..."). */
  roundingNote: string | null
  finalApproved: number | null
  /** finalApproved - requested (negative = less). */
  difference: number | null
  reductionReason: string | null
  rejectionReason: string | null
  steps: AmountStoryStep[]
  remarks: AmountStoryRemark[]
}

// ---- reading the reply ------------------------------------------------------------------------------------------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strOrNull = (v: unknown): string | null => str(v) || null
const num = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** The role labels, used only when a step comes without its own `by` (never a person's name). */
const ROLE_LABEL: Record<string, string> = { employee: 'You', hr: 'HR', md: 'Management', auditor: 'Auditor', policy: 'Company policy' }

function readStep(raw: unknown): AmountStoryStep | null {
  if (!isObject(raw)) return null
  const stage = str(raw.stage)
  if (!stage) return null
  const role = str(raw.role)
  return {
    stage,
    role,
    by: str(raw.by) || ROLE_LABEL[role] || 'HR',
    name: strOrNull(raw.name),
    action: str(raw.action),
    from: num(raw.from),
    to: num(raw.to),
    reason: strOrNull(raw.reason),
    remark: strOrNull(raw.remark),
    at: strOrNull(raw.at),
    round: num(raw.round),
  }
}

function readRemark(raw: unknown): AmountStoryRemark | null {
  if (!isObject(raw)) return null
  const text = str(raw.text)
  if (!text) return null
  const role = str(raw.role)
  return { stage: str(raw.stage), role, by: str(raw.by) || ROLE_LABEL[role] || 'HR', text, at: strOrNull(raw.at) }
}

/** `amountStory` of an application, or null when it is missing or not readable (an older server). */
export function normalizeAmountStory(raw: unknown): AmountStory | null {
  if (!isObject(raw)) return null
  const requested = num(raw.requested)
  if (requested == null) return null
  const code = str(raw.limitBasisCode)
  const roundingApplies = raw.roundingApplies === true
  return {
    type: raw.type === 'term' ? 'term' : 'general',
    status: str(raw.status) || 'pending',
    method: raw.method === 'automation' ? 'automation' : 'normal',
    isFinal: raw.isFinal === true,
    raisedBy: raw.raisedBy === 'hr' ? 'hr' : 'employee',
    requested,
    eligibleLimit: num(raw.eligibleLimit),
    limitBasis: strOrNull(raw.limitBasis),
    limitBasisCode: code === 'earned_salary' || code === 'monthly_salary' ? code : null,
    roundingApplies,
    roundingIsFinal: roundingApplies && typeof raw.roundingIsFinal === 'boolean' ? raw.roundingIsFinal : null,
    beforeRounding: num(raw.beforeRounding),
    afterRounding: num(raw.afterRounding),
    rounded: raw.rounded === true,
    cappedAtLimit: raw.cappedAtLimit === true,
    roundsToZero: raw.roundsToZero === true,
    roundingNote: strOrNull(raw.roundingNote),
    finalApproved: num(raw.finalApproved),
    difference: num(raw.difference),
    reductionReason: strOrNull(raw.reductionReason),
    rejectionReason: strOrNull(raw.rejectionReason),
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map(readStep).filter((s): s is AmountStoryStep => s !== null),
    remarks: (Array.isArray(raw.remarks) ? raw.remarks : []).map(readRemark).filter((r): r is AmountStoryRemark => r !== null),
  }
}

/// ---- wording (the same words as the mobile app's src/lib/amountStory.ts) -----------------------------------------

const rupees = (n: number) => formatINR(n)
const isApproved = (s: Pick<AmountStory, 'status'>) => s.status === 'approved' || s.status === 'closed'

/** less = lower than asked (amber), more = higher (green), rejected (rose), waiting (muted), plain. */
export type FigureTone = 'plain' | 'less' | 'more' | 'rejected' | 'waiting'

export interface StoryFigure {
  key: 'requested' | 'limit' | 'before' | 'after' | 'final'
  label: string
  value: string
  /** A line under the figure (what the limit is based on, how far the final amount is from the ask). */
  sub: string | null
  tone: FigureTone
}

type Decided = Pick<AmountStory, 'isFinal' | 'status' | 'finalApproved' | 'difference' | 'requested'>

/** Final approved minus asked (negative = less) once approved: the server's `difference`, else worked out; null while it
 *  waits or when rejected. */
export function differenceOf(s: Decided): number | null {
  if (!s.isFinal || !isApproved(s) || s.finalApproved == null) return null
  return s.difference ?? Math.round((s.finalApproved - s.requested) * 100) / 100
}

/** "₹2,300 less than asked", "₹200 more than asked", "The amount asked for"; null when it cannot be said. */
export function differenceText(s: Decided): string | null {
  const d = differenceOf(s)
  if (d == null) return null
  if (d < 0) return `${rupees(-d)} less than asked`
  if (d > 0) return `${rupees(d)} more than asked`
  return 'The amount asked for'
}

/**
 * The amounts of the story, top to bottom: asked, the eligible limit (with what it is based on, in the server's words),
 * before and after the rounding (a Salary Advance in the Automation Method), the final approved amount ("Not decided
 * yet" while it waits, "Not approved" once rejected). Only what the server sent.
 */
export function storyFigures(s: AmountStory): StoryFigure[] {
  const out: StoryFigure[] = [
    {
      key: 'requested',
      label: s.raisedBy === 'hr' ? 'Requested (raised by HR)' : 'You asked for',
      value: rupees(s.requested),
      sub: null,
      tone: 'plain',
    },
  ]
  if (s.eligibleLimit != null || s.limitBasis) {
    out.push({
      key: 'limit',
      label: 'Eligible up to',
      value: s.eligibleLimit != null ? rupees(s.eligibleLimit) : 'Not recorded',
      sub: s.limitBasis,
      tone: 'plain',
    })
  }
  if (s.roundingApplies && s.beforeRounding != null && s.afterRounding != null) {
    out.push({
      key: 'before',
      label: 'Before rounding',
      value: rupees(s.beforeRounding),
      sub: s.cappedAtLimit ? 'Your ask was above the limit, so the limit is used.' : null,
      tone: 'plain',
    })
    out.push({
      key: 'after',
      label: s.roundingIsFinal === false ? 'After rounding (not final yet)' : 'After rounding',
      value: rupees(s.afterRounding),
      sub: null,
      tone: s.roundsToZero ? 'rejected' : s.afterRounding > s.beforeRounding ? 'more' : s.afterRounding < s.beforeRounding ? 'less' : 'plain',
    })
  }
  if (s.isFinal && isApproved(s) && s.finalApproved != null) {
    const d = differenceOf(s)
    out.push({
      key: 'final',
      label: 'Final approved',
      value: rupees(s.finalApproved),
      sub: differenceText(s),
      tone: d != null && d < 0 ? 'less' : d != null && d > 0 ? 'more' : 'plain',
    })
  } else if (s.isFinal && s.status === 'rejected') {
    out.push({ key: 'final', label: 'Final approved', value: 'Not approved', sub: null, tone: 'rejected' })
  } else if (!s.isFinal) {
    out.push({ key: 'final', label: 'Final approved', value: 'Not decided yet', sub: null, tone: 'waiting' })
  }
  return out
}

/** The server's rounding sentence (the policy in plain words and what happened, or why it is not rounded) with its look:
 *  "info" when the rounding applies, "warn" when it rounds to ₹0, "muted" when it is not rounded. Null without one. */
export function roundingLine(
  s: Pick<AmountStory, 'roundingNote' | 'roundingApplies' | 'roundsToZero'>,
): { text: string; tone: 'info' | 'warn' | 'muted' } | null {
  if (!s.roundingNote) return null
  return { text: s.roundingNote, tone: s.roundsToZero ? 'warn' : s.roundingApplies ? 'info' : 'muted' }
}

/** The steps that are review decisions (the ask, the rounding and the final line are the figures above). */
export const REVIEW_STAGES: readonly string[] = ['hr_review', 'md_review', 'hr_final', 'auditor_review']

const STAGE_LABEL: Record<string, string> = {
  hr_review: 'HR review',
  md_review: 'Management review',
  hr_final: 'HR final settlement',
  auditor_review: 'Auditor check',
}

/** Who decided, as the server labels the role; HR's own name only where the server sends it (the Normal Method). */
export function stepWho(step: Pick<AmountStoryStep, 'by' | 'name' | 'role'>): string {
  const by = step.by || ROLE_LABEL[step.role] || 'HR'
  return step.name ? `${by} (${step.name})` : by
}

/** One review decision in words: "HR approved ₹7,500", "Management reduced it to ₹6,000", "Auditor rejected it". */
export function stepTitle(step: AmountStoryStep): string {
  const who = stepWho(step)
  switch (step.action) {
    case 'approved':
      return step.to != null ? `${who} approved ${rupees(step.to)}` : `${who} approved it`
    case 'reduced':
      return step.to != null ? `${who} reduced it to ${rupees(step.to)}` : `${who} reduced it`
    case 'increased':
      return step.to != null ? `${who} raised it to ${rupees(step.to)}` : `${who} raised it`
    case 'rejected':
      return `${who} rejected it`
    case 'remark':
      return `${who} added a remark`
    default:
      return step.action ? `${who}: ${step.action.replace(/_/g, ' ')}` : who
  }
}

export interface ReviewRow {
  key: string
  /** "Management reduced it to ₹6,000" */
  title: string
  /** "₹7,500 → ₹6,000" when the step changed the amount, else null. */
  change: string | null
  /** "Management review · Round 2" (the round only when there were rework rounds). */
  meta: string
  /** The reviewer's remark, shown once, next to its decision. */
  remark: string | null
  at: string | null
  tone: 'ok' | 'less' | 'more' | 'rejected' | 'remark'
}

/** The review decisions, oldest first, each with its own remark (only what the server sent: none while it waits). */
export function reviewRows(s: Pick<AmountStory, 'steps' | 'method'>): ReviewRow[] {
  const steps = s.steps.filter((x) => REVIEW_STAGES.includes(x.stage))
  const manyRounds = new Set(steps.map((x) => x.round).filter((r): r is number => r != null)).size > 1
  return steps.map((x, i) => {
    const change = x.from != null && x.to != null && x.from !== x.to ? `${rupees(x.from)} → ${rupees(x.to)}` : null
    const stage = s.method === 'normal' && x.stage === 'hr_review' ? 'HR decision' : (STAGE_LABEL[x.stage] ?? '')
    const meta = [stage, manyRounds && x.round != null ? `Round ${x.round}` : ''].filter(Boolean).join(' · ')
    const tone: ReviewRow['tone'] =
      x.action === 'rejected'
        ? 'rejected'
        : x.action === 'reduced'
          ? 'less'
          : x.action === 'increased'
            ? 'more'
            : x.action === 'remark'
              ? 'remark'
              : 'ok'
    return { key: `${x.stage}-${x.round ?? 0}-${i}`, title: stepTitle(x), change, meta, remark: x.remark, at: x.at, tone }
  })
}

/** The same words with the white space folded (how the server compares remarks). */
const folded = (t: string | null | undefined) => (t ?? '').split(/\s+/).filter(Boolean).join(' ')

/** The remarks NOT already shown next to their review decision (each remark is shown once, with who wrote it). */
export function remarksNotInSteps(s: Pick<AmountStory, 'steps' | 'remarks'>): AmountStoryRemark[] {
  const shown = new Set(s.steps.filter((x) => REVIEW_STAGES.includes(x.stage) && x.remark).map((x) => `${x.role}|${folded(x.remark)}`))
  return s.remarks.filter((r) => !shown.has(`${r.role}|${folded(r.text)}`))
}

/** The line while the application waits (the review is private until it is decided); null once decided. */
export function waitingText(s: Pick<AmountStory, 'isFinal'>): string | null {
  return s.isFinal ? null : 'The decision, and any remarks, are shown here once it is decided.'
}

/** Whether the story already explains the limit (then the older "Your limit was ..." line is left out). */
export function storyExplainsLimit(s: AmountStory | null | undefined): boolean {
  return !!s && !!s.limitBasis && s.eligibleLimit != null
}

/** The one line a card shows under a decided application: "Why it is lower: Management: Pending canteen dues." or
 *  "Reason: HR: Already took one this year"; null when the story has nothing to add (or there is no story). */
export function storyCardNote(a: { status: string; amountStory?: AmountStory | null }): string | null {
  const s = a.amountStory
  if (!s) return null
  if (isApproved(a) && s.reductionReason) return `Why it is lower: ${s.reductionReason}`
  if (a.status === 'rejected' && s.rejectionReason) return `Reason: ${s.rejectionReason}`
  return null
}

const squash = (t: string) => folded(t).toLowerCase()

/** True when the story already says `remark` (a decision's remark, its remarks, why it is lower, why it was rejected),
 *  so the older "Remark" box would repeat it. */
export function storyMentions(s: AmountStory | null | undefined, remark: string | null | undefined): boolean {
  if (!s || !remark?.trim()) return false
  const needle = squash(remark)
  const said = [
    ...s.steps.map((x) => (REVIEW_STAGES.includes(x.stage) ? (x.remark ?? '') : '')),
    ...s.remarks.map((r) => r.text),
    s.reductionReason ?? '',
    s.rejectionReason ?? '',
  ]
  return said.some((t) => t && squash(t).includes(needle))
}

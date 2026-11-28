// Compensation self-claims (2026-11-19): the employee claims what the system found for them (Sunday / holiday work, a
// late-in allowance, extra hours) and asks to use their balance as a day off; their Department Head approves each one.
// A worked birthday is no longer a credit to claim (2026-11-25): it gives Birthday Compensation to place on chosen dates
// (lib/birthday-compensation.ts); birthday claims raised before that stay readable here.
// The server (backend/api/employee_compensation_views.py + compensation_claims.py):
//
//   GET    /employee/compensation                 items carry claimable / claimKind / claim / suggestedShifts; the
//                                                 payload carries canClaim, claimWindowDays, useBalance (lib/compensation.ts)
//   POST   /employee/compensation/claims          {kind, date, overtimeRecordId?, shifts?, reason} -> 201 the claim
//   POST   /employee/compensation/use             {date, shifts, reason} -> 201 the claim (kind use_balance)
//   GET    /employee/compensation/claims          the employee's own claims, newest first
//   DELETE /employee/compensation/claims/<id>     withdraw one that is still waiting
//
// A refusal comes back as {error, code} with a sentence for people (not_eligible, too_old, already_claimed, no_hod ...),
// which is shown as it is. Pure TypeScript (only other pure lib modules), so Node's test runner runs it: `npm test`.
import { formatMinutes, formatShifts, isoDateOrNull, type ClaimKind, type CompensationItem, type CompensationPayload } from './compensation.ts'
import { dayText } from './my-requests.ts'
import { checkRequestDate } from './request-window.ts'
import { humanize } from './strings.ts'

// ---- words ----------------------------------------------------------------------------------------------------------

/** What each kind of claim is called (the employee's list and the Department Head's cards). */
export const CLAIM_KIND_LABEL: Record<string, string> = {
  holiday_work: 'Sunday / holiday work',
  ot_allowance: 'Late-in allowance',
  ot_shift: 'Extra hours credit',
  birthday: 'Birthday credit',
  use_balance: 'Day off from balance',
}

/** A claim kind in words; a kind this app has never seen gets its own name. */
export function claimKindLabel(kind: string | null | undefined, serverLabel?: string | null): string {
  const label = typeof serverLabel === 'string' ? serverLabel.trim() : ''
  if (label) return label
  const k = typeof kind === 'string' ? kind.trim() : ''
  return (k && Object.hasOwn(CLAIM_KIND_LABEL, k) ? CLAIM_KIND_LABEL[k] : humanize(k)) || 'Compensation claim'
}

export const REASON_MAX = 500
export const QUARTERS: readonly number[] = [0.25, 0.5, 0.75, 1]

/** "a quarter of a shift" ... "a full shift": what each quarter means, under the number. */
export const QUARTER_HINT: Record<string, string> = {
  '0.25': 'A quarter of a shift',
  '0.5': 'Half a shift',
  '0.75': 'Three quarters of a shift',
  '1': 'A full shift',
}

/** `value` rounded DOWN to a quarter and kept within 0..1 (0.6 -> 0.5, 1.3 -> 1); 0 for anything that is not a number. */
export function quarterFloor(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return 0
  return Math.min(1, Math.floor(value * 4 + 1e-9) / 4)
}

/** The quarters that may be picked when at most `max` shifts are allowed (0.5 -> [0.25, 0.5]). */
export function shiftChoices(max: number | null | undefined): number[] {
  const top = quarterFloor(max)
  return QUARTERS.filter((q) => q <= top)
}

// ---- an item's claim ------------------------------------------------------------------------------------------------

export type ClaimState = 'claimable' | 'pending' | 'approved' | 'rejected'

/**
 * Where an item stands as a claim: a claim that is waiting or approved wins; then "claimable" (also after a rejected claim,
 * which can be claimed again while the day is still open); then a rejected claim; null = nothing to do with claims (an older
 * backend, an announcement, a redemption ...). The item's own `status` (claim_pending ...) is read when it carries no claim.
 */
export function claimStateOf(item: Pick<CompensationItem, 'claimable' | 'claim' | 'status'>): ClaimState | null {
  const s = item.claim?.status
  if (s === 'pending' || s === 'approved') return s
  if (item.claimable) return 'claimable'
  if (s === 'rejected') return 'rejected'
  switch (item.status) {
    case 'claim_pending':
      return 'pending'
    case 'claim_approved':
      return 'approved'
    case 'claim_rejected':
      return 'rejected'
  }
  return null
}

/** Whether the Claim button shows on an item: the employee may claim (canClaim) and this item can be claimed now. */
export function canClaimItem(item: CompensationItem, canClaim: boolean): boolean {
  return canClaim && claimStateOf(item) === 'claimable' && item.claimKind !== null && claimDateOf(item) !== null
}

/** The day a claim for the item is about: the day worked / the OT day / the birthday. */
export function claimDateOf(item: Pick<CompensationItem, 'workDate' | 'date'>): string | null {
  return item.workDate ?? item.date
}

/** Every item the employee can claim right now, newest day first. */
export function claimableItems(payload: Pick<CompensationPayload, 'items' | 'canClaim'> | null | undefined): CompensationItem[] {
  if (!payload?.canClaim) return []
  return payload.items
    .filter((i) => canClaimItem(i, true))
    .sort((a, b) => ((claimDateOf(a) ?? '') < (claimDateOf(b) ?? '') ? 1 : (claimDateOf(a) ?? '') > (claimDateOf(b) ?? '') ? -1 : 0))
}

export interface ClaimDraft {
  kind: ClaimKind
  label: string
  /** YYYY-MM-DD the claim is for. */
  date: string
  overtimeRecordId: number | null
  /** The quarters the employee may pick from; empty = no picker (a fixed amount, or not counted in shifts). */
  choices: number[]
  /** The pick to start with (null without a picker). */
  defaultShifts: number | null
  /** The amount when there is nothing to pick, else null (no kind has one since birthday credits ended, 2026-11-25). */
  fixedShifts: number | null
  /** The allowance minutes (ot_allowance). */
  minutes: number | null
  /** "Sunday / holiday work on Sun, 9 Nov 2026". */
  what: string
  /** What an approval does. */
  effect: string
  /** The last claim for this day was not approved (it can be claimed again). */
  rejectedBefore: boolean
}

/**
 * What the Claim dialog offers for an item, or null when it cannot be claimed.
 *   holiday_work  pick 0.25 .. 1.00 (starting at the server's suggestion, else the item's shifts, else 1.00)
 *   ot_shift      pick 0.25 .. the suggested credit (the quarters rule), never above it; starting AT it. Without a
 *                 suggestion there is no picker and the server works the shifts out
 *   ot_allowance  no shifts: the allowance minutes apply on the next working day once approved
 * A worked birthday is never claimed (2026-11-25): its Birthday Compensation is placed on chosen dates instead.
 */
export function claimDraft(item: CompensationItem): ClaimDraft | null {
  const kind = item.claimKind
  const date = claimDateOf(item)
  if (!kind || !date || claimStateOf(item) !== 'claimable') return null
  const label = claimKindLabel(kind)
  const base = {
    kind,
    label,
    date,
    overtimeRecordId: kind === 'ot_allowance' || kind === 'ot_shift' ? item.overtimeRecordId : null,
    rejectedBefore: item.claim?.status === 'rejected',
    minutes: null as number | null,
  }
  const day = dayText(date)
  const adds = (amount: string) => `Once your Department Head approves it, ${amount} is added to your compensation balance.`
  switch (kind) {
    case 'holiday_work': {
      const start = quarterFloor(item.suggestedShifts ?? item.shifts ?? 1) || 1
      return {
        ...base,
        choices: [...QUARTERS],
        defaultShifts: start,
        fixedShifts: null,
        what: `${label} on ${day}`,
        effect: adds('the shifts you claim'),
      }
    }
    case 'ot_shift': {
      const cap = item.suggestedShifts ?? item.shifts
      const choices = shiftChoices(cap)
      return {
        ...base,
        choices,
        defaultShifts: choices.length ? choices[choices.length - 1] : null,
        fixedShifts: null,
        what: `Extra hours on ${day}`,
        effect: choices.length
          ? `${adds('the shifts you claim')} Extra hours earn a quarter of a shift for every quarter of your shift worked, up to ${formatShifts(choices[choices.length - 1])} for this day.`
          : adds('the shifts this day earned'),
      }
    }
    case 'ot_allowance': {
      const minutes = item.minutes != null && item.minutes > 0 ? item.minutes : null
      return {
        ...base,
        minutes,
        choices: [],
        defaultShifts: null,
        fixedShifts: null,
        what: `Late-in allowance for working late on ${day}`,
        effect: `Once your Department Head approves it, you may arrive up to ${formatMinutes(minutes) || 'the allowance'} later on your next working day after ${day} without being marked late.`,
      }
    }
  }
  return null
}

export interface ClaimBody {
  kind: ClaimKind
  date: string
  overtimeRecordId?: number
  shifts?: number
  reason: string
}

/** Why the claim cannot be sent yet, or null. */
export function claimProblem(draft: ClaimDraft, shifts: number | null, reason: string): string | null {
  if (draft.choices.length && (shifts === null || !draft.choices.includes(shifts))) return 'Pick how many shifts to claim.'
  return reasonProblem(reason)
}

export function reasonProblem(reason: string): string | null {
  const r = reason.trim()
  if (!r) return 'Give a reason: your Department Head reads it before deciding.'
  if (r.length > REASON_MAX) return `The reason can be at most ${REASON_MAX} characters.`
  return null
}

/** The POST body: shifts only where they are picked, the overtime record only for the two overtime kinds. */
export function claimBody(draft: ClaimDraft, shifts: number | null, reason: string): ClaimBody {
  const body: ClaimBody = { kind: draft.kind, date: draft.date, reason: reason.trim() }
  if (draft.overtimeRecordId !== null) body.overtimeRecordId = draft.overtimeRecordId
  if (draft.choices.length && shifts !== null) body.shifts = shifts
  return body
}

// ---- using the balance ----------------------------------------------------------------------------------------------

export interface BalanceUse {
  allowed: boolean
  balance: number
  pending: number
  /** balance - pending, never below 0. */
  available: number
  /** The quarters a request may use (up to the available balance, at most a full shift). */
  choices: number[]
  /** Why the button is off (the server's words, else ours); null while it may be used. */
  blocked: string | null
}

/** "Use my balance": what may be asked for now. The server's `useBalance` block decides; without it nothing is allowed. */
export function balanceUse(payload: Pick<CompensationPayload, 'useBalance' | 'balanceShifts' | 'canClaim'> | null | undefined): BalanceUse {
  const info = payload?.useBalance
  const balance = info?.balanceShifts ?? payload?.balanceShifts ?? 0
  const pending = info?.pendingShifts ?? 0
  const available = Math.max(0, info ? info.availableShifts : balance - pending)
  const choices = shiftChoices(available)
  let blocked: string | null = null
  if (!payload?.canClaim || !info) blocked = 'Using your balance yourself is not available yet. Ask HR.'
  else if (!info.allowed) blocked = info.message ?? 'You cannot use your balance right now.'
  else if (!choices.length)
    blocked =
      pending > 0
        ? `Nothing left to use: ${formatShifts(pending)} is already waiting for your Department Head.`
        : 'You have no compensation balance to use yet.'
  return { allowed: blocked === null, balance, pending, available, choices, blocked }
}

/** Why the use-balance request cannot be sent yet, or null. `now` = the viewer's clock (the request window). */
export function balanceUseProblem(form: { date: string; shifts: number | null; reason: string }, use: BalanceUse, now: Date): string | null {
  if (!form.date) return 'Pick the day you want off.'
  const dateProblem = checkRequestDate(form.date, now)
  if (dateProblem) return dateProblem
  if (form.shifts === null || !use.choices.includes(form.shifts)) return 'Pick how much of your balance to use.'
  return reasonProblem(form.reason)
}

// ---- the employee's own claims (GET /employee/compensation/claims) --------------------------------------------------

export interface MyClaimOvertime {
  date: string | null
  shiftEnd: string | null
  lastPunch: string | null
  lastPunchNextDay: boolean
  extraMinutes: number | null
}

export interface MyClaim {
  id: number | string
  /** "hw-<id>": the key a notification points at (the claims share the Holiday-work table, hence the prefix). */
  key: string
  kind: string
  kindLabel: string
  /** pending | approved | rejected | withdrawn (anything else is drawn generically) */
  status: string
  statusLabel: string
  /** The day it is about (work day / OT day / birthday; for use_balance the day off). */
  date: string | null
  shifts: number | null
  minutes: number | null
  reason: string
  raisedByRole: 'employee' | 'hr' | null
  raisedByName: string | null
  reviewedBy: string | null
  reviewComment: string | null
  reviewedAt: string | null
  createdAt: string | null
  canWithdraw: boolean
  overtime: MyClaimOvertime | null
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const strOrNull = (v: unknown): string | null => str(v) || null
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** The `overtime` block of a claim ({date, shiftEnd, lastPunch, extraMinutes}), or null. */
export function parseOvertime(raw: unknown): MyClaimOvertime | null {
  if (!isObj(raw)) return null
  const date = isoDateOrNull(raw.date)
  const last = str(raw.lastPunch)
  // A last punch may come as a full timestamp: on a later calendar day than the OT day it closed = "next day".
  const lastDay = isoDateOrNull(last.length > 10 ? last : null)
  const out: MyClaimOvertime = {
    date,
    shiftEnd: strOrNull(raw.shiftEnd),
    lastPunch: last || null,
    lastPunchNextDay: raw.lastPunchNextDay === true || (!!date && !!lastDay && lastDay > date),
    extraMinutes: numOrNull(raw.extraMinutes),
  }
  return out.date || out.shiftEnd || out.lastPunch || out.extraMinutes !== null ? out : null
}

function readClaim(raw: unknown): MyClaim | null {
  if (!isObj(raw)) return null
  const id = typeof raw.id === 'number' || (typeof raw.id === 'string' && raw.id.trim()) ? (raw.id as number | string) : null
  if (id === null) return null
  const kind = str(raw.kind) || 'holiday_work'
  const status = str(raw.status)
  const role = str(raw.raisedByRole)
  const raisedByRole = role === 'employee' || role === 'hr' ? role : null
  const date =
    (kind === 'use_balance' ? isoDateOrNull(raw.useDate) : null) ?? isoDateOrNull(raw.workDate) ?? isoDateOrNull(raw.date) ?? isoDateOrNull(raw.useDate)
  return {
    id,
    key: `hw-${id}`,
    kind,
    kindLabel: claimKindLabel(kind, str(raw.kindLabel)),
    status,
    statusLabel: str(raw.statusLabel),
    date,
    shifts: numOrNull(raw.shifts),
    minutes: numOrNull(raw.minutes),
    reason: str(raw.reason),
    raisedByRole,
    raisedByName: strOrNull(raw.raisedByName) ?? strOrNull(raw.requestedBy),
    reviewedBy: strOrNull(raw.reviewedBy),
    reviewComment: strOrNull(raw.reviewComment),
    reviewedAt: strOrNull(raw.reviewedAt),
    createdAt: strOrNull(raw.createdAt),
    // The server's word when it gives one; else only a waiting claim the employee raised themselves.
    canWithdraw: typeof raw.canWithdraw === 'boolean' ? raw.canWithdraw && status === 'pending' : status === 'pending' && raisedByRole === 'employee',
    overtime: parseOvertime(raw.overtime),
  }
}

/** The claims list in any of the shapes a server may send ([...], {items}, {claims}), or null when it is none of them. */
export function normalizeMyClaims(raw: unknown): MyClaim[] | null {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? (Array.isArray(raw.items) ? raw.items : Array.isArray(raw.claims) ? raw.claims : null) : null
  if (!list) return null
  const seen = new Set<string>()
  const out: MyClaim[] = []
  for (const entry of list) {
    const c = readClaim(entry)
    if (!c || seen.has(c.key)) continue
    seen.add(c.key)
    out.push(c)
  }
  return out
}

export interface ClaimStatusInfo {
  label: string
  /** Chip tone (index.css). */
  chip: string
  live: boolean
}

const CLAIM_STATUS: Record<string, ClaimStatusInfo> = {
  pending: { label: 'Waiting for your Department Head', chip: 'chip-warning', live: true },
  approved: { label: 'Approved', chip: 'chip-success', live: false },
  rejected: { label: 'Not approved', chip: 'chip-danger', live: false },
  withdrawn: { label: 'Withdrawn', chip: 'chip-muted', live: false },
}

export function claimStatusInfo(claim: Pick<MyClaim, 'status' | 'statusLabel'>): ClaimStatusInfo {
  const known = Object.hasOwn(CLAIM_STATUS, claim.status) ? CLAIM_STATUS[claim.status] : null
  return {
    label: claim.statusLabel || known?.label || humanize(claim.status) || 'Status unknown',
    chip: known?.chip ?? 'chip-muted',
    live: known?.live ?? false,
  }
}

/** "0.50 shift" / "30 min allowance" / "1.00 shift": what the claim is worth, '' when it does not say. */
export function claimAmount(claim: Pick<MyClaim, 'kind' | 'shifts' | 'minutes'>): string {
  if (claim.kind === 'ot_allowance') {
    const m = formatMinutes(claim.minutes)
    return m ? `${m} allowance` : ''
  }
  return formatShifts(claim.shifts)
}

/** "Day off on Mon, 24 Nov 2026" / "For Sun, 9 Nov 2026" / "Birthday, Thu, 20 Nov 2026"; '' without a date. */
export function claimDateLine(claim: Pick<MyClaim, 'kind' | 'date'>): string {
  if (!claim.date) return ''
  const day = dayText(claim.date)
  if (claim.kind === 'use_balance') return `Day off on ${day}`
  if (claim.kind === 'birthday') return `Birthday, ${day}`
  if (claim.kind === 'ot_allowance' || claim.kind === 'ot_shift') return `Overtime on ${day}`
  return `For ${day}`
}

/** "Raised by you" / "Raised by HR (Meena)" / "Raised by HR". */
export function claimRaisedByText(claim: Pick<MyClaim, 'raisedByRole' | 'raisedByName'>): string {
  if (claim.raisedByRole === 'employee') return 'Raised by you'
  if (claim.raisedByRole === 'hr') return claim.raisedByName ? `Raised by HR (${claim.raisedByName})` : 'Raised by HR'
  return ''
}

/** "Approved by Suresh Raj" / "Not approved by Suresh Raj: Not a working day." / null while waiting. */
export function claimDecisionLine(claim: Pick<MyClaim, 'status' | 'reviewedBy' | 'reviewComment'>): string | null {
  if (claim.status !== 'approved' && claim.status !== 'rejected') return null
  const by = claim.reviewedBy ? ` by ${claim.reviewedBy}` : ''
  const base = claim.status === 'approved' ? `Approved${by}` : `Not approved${by}`
  return claim.reviewComment ? `${base}: ${claim.reviewComment}` : `${base}.`
}

export type ClaimFilterId = 'all' | 'pending' | 'approved' | 'rejected' | 'other'

export interface ClaimFilterOption {
  id: ClaimFilterId
  label: string
  count: number
}

const CLAIM_FILTERS: { id: Exclude<ClaimFilterId, 'all' | 'other'>; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Not approved' },
]

const claimFilterOf = (c: Pick<MyClaim, 'status'>): Exclude<ClaimFilterId, 'all'> =>
  c.status === 'pending' || c.status === 'approved' || c.status === 'rejected' ? c.status : 'other'

/** "All" plus a chip for every status that has claims (withdrawn and unknown ones under "Other"). */
export function claimFilterOptions(claims: readonly MyClaim[]): ClaimFilterOption[] {
  const options: ClaimFilterOption[] = [{ id: 'all', label: 'All', count: claims.length }]
  for (const f of CLAIM_FILTERS) {
    const count = claims.filter((c) => claimFilterOf(c) === f.id).length
    if (count) options.push({ ...f, count })
  }
  const other = claims.filter((c) => claimFilterOf(c) === 'other').length
  if (other) options.push({ id: 'other', label: 'Other', count: other })
  return options
}

export function applyClaimFilter(claims: readonly MyClaim[], id: ClaimFilterId): MyClaim[] {
  return id === 'all' ? [...claims] : claims.filter((c) => claimFilterOf(c) === id)
}

// ---- errors -----------------------------------------------------------------------------------------------------------

/**
 * The sentence to show when a claim, a use-balance request or a withdrawal fails: the server's own words for a refusal
 * (400 / 403 / 404 / 409), a plain sentence for anything else (no "Request failed with status code 500").
 */
export function claimErrorText(err: { status?: number; message?: string } | null | undefined, fallback = 'Could not send it. Check your connection and try again.'): string {
  const message = typeof err?.message === 'string' ? err.message.trim() : ''
  const status = err?.status ?? 0
  return status >= 400 && status < 500 && message && !/^Request failed with status code/i.test(message) ? message : fallback
}

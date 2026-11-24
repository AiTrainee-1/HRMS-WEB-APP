// How a compensation claim reads on the Department Head's Approvals screen ("Compensation"). Every claim kind lives in the
// one Holiday-work claim table and comes through the same lists and the same PATCH (backend holiday_work_views.py
// claim_json + compensation_claims.py, 2026-11-19):
//   holiday_work  a Sunday / holiday worked: approving adds the shifts to the employee's compensation balance
//   ot_allowance  a late-in allowance after working late: approving applies it on the next working day
//   ot_shift      extra hours: approving adds the shift credit to the balance
//   birthday      a birthday the employee worked: approving adds one shift to the balance
//   use_balance   a day off taken from the balance: approving uses the shifts on that day
// HR raises claims on the employee's behalf (`raisedByRole` "hr") and, since 2026-11-19, employees raise their own
// ("employee"). An older backend sends no `kind` (every claim is holiday work) and no `raisedByRole` (HR raised all of
// them). Every field but the id may be missing, so each helper has a plain fallback and none of them can throw.
//
// Pure TypeScript (it imports only other pure lib modules and types), so Node's test runner can run it: `npm test`.
import { formatMinutes, formatShifts } from './compensation.ts'
import { claimKindLabel, parseOvertime, type MyClaimOvertime } from './compensation-claims.ts'
import { isIsoDate } from './request-window.ts'
import type { PendingHolidayWorkClaim } from '../types/index.ts'

export interface ClaimView {
  /** holiday_work for an older backend that sends no kind. */
  kind: string
  /** "Sunday / holiday work", "Late-in allowance", ... (the server's words when it sends them). */
  kindLabel: string
  name: string
  code: string
  department: string | null
  /** YYYY-MM-DD the claim is about (for a day off from the balance: that day), or null without a usable date. */
  workDate: string | null
  /** The raw date text when it is not a YYYY-MM-DD one, so the card can still show something. */
  workDateText: string
  /** What the date is ("Day off on", "Birthday", "Overtime on"); null for Sunday / holiday work (the date alone). */
  dateWord: string | null
  reason: string
  /** "Sunday · 0.50 shift" / "Late-in allowance · 30 min" / "Day off from balance · 0.50 shift". */
  badge: string
  /** Who raised it: the employee themselves, or HR (the default on an older backend). */
  raisedBy: 'employee' | 'hr'
  /** "Raised by the employee" / "Raised by Meena (HR)" / "Raised by HR". */
  raisedByText: string
  /** What approving does, in one sentence. */
  approveText: string
  /** Who raised it and what a decision does. */
  note: string
  /** The overtime the claim is about (ot_allowance / ot_shift), when the server sent it. */
  overtime: MyClaimOvertime | null
  /** The allowance minutes (ot_allowance). */
  minutes: number | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function positive(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

/** The claim's kind; an older backend sends none (every claim was Sunday / holiday work then). */
export function claimKindOf(claim: Pick<PendingHolidayWorkClaim, 'kind'>): string {
  return text(claim.kind) || 'holiday_work'
}

/** Who raised it; an older backend sends nothing (only HR could raise claims then). */
export function claimRaisedBy(claim: Pick<PendingHolidayWorkClaim, 'raisedByRole'>): 'employee' | 'hr' {
  return text(claim.raisedByRole) === 'employee' ? 'employee' : 'hr'
}

/** 'Sunday', 'Holiday (Diwali)', 'Holiday', or 'Sunday / holiday' when the claim does not say which. */
export function claimDayLabel(claim: Pick<PendingHolidayWorkClaim, 'dayKind' | 'holidayName'>): string {
  if (claim.dayKind === 'sunday') return 'Sunday'
  if (claim.dayKind === 'holiday') {
    const name = text(claim.holidayName)
    return name ? `Holiday (${name})` : 'Holiday'
  }
  return 'Sunday / holiday'
}

/** "Sunday · 0.50 shift" (the shifts left out when the claim carries none); every other kind by its own label. */
export function claimBadge(
  claim: Pick<PendingHolidayWorkClaim, 'dayKind' | 'holidayName' | 'shifts' | 'kind' | 'kindLabel' | 'minutes'>,
): string {
  const kind = claimKindOf(claim)
  if (kind === 'ot_allowance') {
    const minutes = formatMinutes(positive(claim.minutes))
    const label = claimKindLabel(kind, claim.kindLabel)
    return minutes ? `${label} · ${minutes}` : label
  }
  const head = kind === 'holiday_work' ? claimDayLabel(claim) : claimKindLabel(kind, claim.kindLabel)
  const shifts = formatShifts(positive(claim.shifts))
  return shifts ? `${head} · ${shifts}` : head
}

const DATE_WORD: Record<string, string> = {
  use_balance: 'Day off on',
  birthday: 'Birthday',
  ot_allowance: 'Overtime on',
  ot_shift: 'Overtime on',
}

/** The claim as the Approvals card draws it. */
export function describeClaim(claim: PendingHolidayWorkClaim): ClaimView {
  const kind = claimKindOf(claim)
  const name = text(claim.employeeName) || 'Employee'
  const shifts = formatShifts(positive(claim.shifts))
  const minutes = positive(claim.minutes)
  const raisedBy = claimRaisedBy(claim)
  const hrName = text(claim.requestedBy)
  const overtime = parseOvertime(claim.overtime)
  const dateText =
    (kind === 'use_balance' ? text(claim.useDate) : '') || text(claim.workDate) || (overtime?.date ?? '') || text(claim.useDate)

  let approveText: string
  if (kind === 'ot_allowance') {
    approveText = `Approving lets ${name} arrive up to ${formatMinutes(minutes) || 'the allowance'} later on their next working day without being marked late; rejecting changes nothing.`
  } else if (kind === 'use_balance') {
    approveText = `Approving uses ${shifts || 'the requested shifts'} of ${name}'s compensation balance as a paid day off on that day; rejecting keeps the balance as it is.`
  } else {
    approveText = shifts
      ? `Approving adds ${shifts} to ${name}'s compensation balance; rejecting adds nothing.`
      : `Approving adds the claimed shifts to ${name}'s compensation balance; rejecting adds nothing.`
  }
  const raisedByText = raisedBy === 'employee' ? 'Raised by the employee' : hrName ? `Raised by ${hrName} (HR)` : 'Raised by HR'
  return {
    kind,
    kindLabel: claimKindLabel(kind, claim.kindLabel),
    name,
    code: text(claim.employeeCode),
    department: text(claim.department) || null,
    // A real calendar date only: the card formats it with date-fns, which throws on an impossible one.
    workDate: isIsoDate(dateText) ? dateText : null,
    workDateText: dateText || '—',
    dateWord: Object.hasOwn(DATE_WORD, kind) ? DATE_WORD[kind] : null,
    reason: text(claim.reason) || 'No reason given.',
    badge: claimBadge(claim),
    raisedBy,
    raisedByText,
    approveText,
    note: `${raisedByText}. ${approveText}`,
    overtime,
    minutes,
  }
}

/**
 * The toast after a head approved a claim: the server's own `effect` sentence when it sends one, else what the kind does
 * ("Added to Asha's compensation balance."). null = say what every other request says (a rejection, or nothing known).
 */
export function claimDecisionToast(
  claim: PendingHolidayWorkClaim,
  decision: 'approved' | 'rejected',
  result: unknown,
): { title: string; description: string } | null {
  if (decision !== 'approved') return null
  const r = (result && typeof result === 'object' ? result : {}) as { credited?: unknown; effect?: unknown }
  const v = describeClaim(claim)
  const title = 'Compensation approved'
  const effect = text(r.effect)
  if (effect) return { title, description: effect }
  if (r.credited) return { title, description: `Added to ${v.name}'s compensation balance.` }
  if (v.kind === 'ot_allowance') return { title, description: `${v.name}'s late-in allowance applies on their next working day.` }
  if (v.kind === 'use_balance') return { title, description: `${v.name}'s day off is taken from their compensation balance.` }
  return null
}

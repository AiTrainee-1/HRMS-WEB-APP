// How a Holiday / Sunday work compensation claim reads on the Department Head's Approvals screen. HR raises the claim
// ("this person worked that Sunday, give them 0.50 shift"), the head approves or rejects it, and an approval adds the
// shifts to the employee's compensation balance (backend holiday_work_views.py). Every field of a claim except its id may
// be missing (an older or newer backend), so each helper has a plain fallback and none of them can throw.
//
// Pure TypeScript (it imports only other pure lib modules and types), so Node's test runner can run it: `npm test`.
import { formatShifts } from './compensation.ts'
import { isIsoDate } from './request-window.ts'
import type { PendingHolidayWorkClaim } from '../types/index.ts'

export interface ClaimView {
  name: string
  code: string
  department: string | null
  /** YYYY-MM-DD of the Sunday / holiday that was worked, or null when the claim carries no usable date. */
  workDate: string | null
  /** The raw date text when it is not a YYYY-MM-DD one, so the card can still show something. */
  workDateText: string
  reason: string
  /** "Sunday · 0.50 shift" / "Holiday (Diwali) · 1.00 shift". */
  badge: string
  /** Who raised it and what a decision does. */
  note: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function shiftsOf(value: number | string | undefined): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
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

/** "Sunday · 0.50 shift" (the shifts left out when the claim carries none). */
export function claimBadge(claim: Pick<PendingHolidayWorkClaim, 'dayKind' | 'holidayName' | 'shifts'>): string {
  const shifts = formatShifts(shiftsOf(claim.shifts))
  return shifts ? `${claimDayLabel(claim)} · ${shifts}` : claimDayLabel(claim)
}

/** The claim as the Approvals card draws it. */
export function describeClaim(claim: PendingHolidayWorkClaim): ClaimView {
  const name = text(claim.employeeName) || 'Employee'
  const shifts = formatShifts(shiftsOf(claim.shifts))
  const raisedBy = text(claim.requestedBy)
  const dateText = text(claim.workDate)
  const effect = shifts
    ? `Approving adds ${shifts} to ${name}'s compensation balance; rejecting adds nothing.`
    : `Approving adds the claimed shifts to ${name}'s compensation balance; rejecting adds nothing.`
  return {
    name,
    code: text(claim.employeeCode),
    department: text(claim.department) || null,
    // A real calendar date only: the card formats it with date-fns, which throws on an impossible one.
    workDate: isIsoDate(dateText) ? dateText : null,
    workDateText: dateText || '—',
    reason: text(claim.reason) || 'No reason given.',
    badge: claimBadge(claim),
    note: `${raisedBy ? `Raised by ${raisedBy} (HR). ` : 'Raised by HR. '}${effect}`,
  }
}

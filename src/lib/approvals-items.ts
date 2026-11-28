// How one request on the Approvals page is worded: who, what, when, plus the On-Duty punches a head is approving.
// Pure (no React), unit-tested in approvals-items.test.ts. Mirrors the mobile app's src/lib/approvalsItems.ts
// ("Leave · Sick", "Casual Leave · Half day (first half)", "Morning Check-In", "In 9:05 AM · Out 1:00 PM").
//
// Every category sends its own shape (leave / permission / outpass rows carry a nested `employee`, the others flat
// employeeName / employeeCode), and any field may be missing on an older backend, so every reader has a fallback.

import { fmtDay, type ApprovalCategory, type ApprovalItem, type ApprovalStatus } from './approvals-history.ts'
import { approvalPath, type PathStep } from './decider.ts'
import { claimBadge, claimRaisedBy, describeClaim } from './holiday-work.ts'
import { formatMinutes, formatShifts } from './compensation.ts'
import { daysText, parseUse, placementFacts, placementNote, placementTypeLabel, type BdcUse } from './birthday-compensation.ts'
import type { ApprovalProgress, PendingHolidayWorkClaim } from '../types/index.ts'

const PUNCH_SLOT_LABEL: Record<string, string> = {
  morning_in: 'Morning Check-In',
  lunch_out: 'Lunch Check-Out',
  lunch_in: 'Lunch Check-In',
  evening_out: 'Evening Check-Out',
}

type Item = Record<string, unknown>

const s = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const emp = (item: Item | null | undefined): Item => {
  const e = item?.employee
  return e && typeof e === 'object' ? (e as Item) : {}
}

export function empName(item: Item | null | undefined): string {
  return s(item?.employeeName) || s(emp(item).name) || 'Employee'
}

export function empCode(item: Item | null | undefined): string {
  return s(item?.employeeCode) || s(emp(item).employeeCode) || s(emp(item).code)
}

/** "Sewing" (the department) where the row carries one. */
export function empDepartment(item: Item | null | undefined): string | null {
  return s(item?.departmentName) || s(item?.department) || s(emp(item).department) || null
}

/** "SR" from "Suresh Raj"; "?" when there is no name. */
export function empInitials(item: Item | null | undefined): string {
  const name = empName(item)
  if (name === 'Employee') return '?'
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase() || '?'
  )
}

const HALF_SLOT: Record<string, string> = { first_half: 'first half', second_half: 'second half', morning: 'morning', afternoon: 'afternoon' }

/** What the request is: the chip on a card and the "Type" row of the detail dialog. */
export function itemTypeLabel(category: ApprovalCategory, item: Item): string {
  switch (category) {
    case 'leave': {
      const reasonCategory = s(item.reasonCategoryLabel)
      const base = reasonCategory ? `Leave · ${reasonCategory}` : s(item.type) || s(item.leaveType) || 'Leave'
      if (item.isHalfDay === true) {
        const slot = HALF_SLOT[s(item.halfDaySlot)] ?? s(item.halfDaySlot)
        return `${base} · Half day${slot ? ` (${slot})` : ''}`
      }
      return base
    }
    case 'permission':
      // The full wording (legacy types, the fixed hour) is lib/permissions.ts, applied by components/approvals/words.ts:
      // that module uses the app's path alias, which Node's test runner cannot load.
      return s(item.typeLabel) || 'Permission'
    case 'casual_leave':
      return item.portion && item.portion !== 'full' && s(item.portionLabel) ? `Casual Leave · ${s(item.portionLabel)}` : 'Casual Leave'
    case 'attendance': {
      const t = s(item.typeLabel)
      if (t) return t
      const req = item.requestedValues && typeof item.requestedValues === 'object' ? (item.requestedValues as Item) : {}
      const status = s(item.requestedStatus) || s(req.status)
      return status ? `Mark as ${status}` : 'Attendance correction'
    }
    case 'missing_punch':
      return PUNCH_SLOT_LABEL[s(item.punchSlot)] ?? (item.punchType === 'IN' ? 'Check-In' : 'Check-Out')
    case 'outpass':
      return s(item.destination) ? `Outpass · ${s(item.destination)}` : 'Outpass'
    case 'on_duty':
      return s(item.destination) ? `On-Duty · ${s(item.destination)}` : 'On-Duty'
    case 'holiday_work':
      return claimBadge(item as unknown as PendingHolidayWorkClaim)
    case 'birthday_compensation':
      return placementTypeLabel(birthdayUse(item))
    case 'resignation':
      return 'Resignation'
  }
}

/** When it is for: "06 Oct → 08 Oct 2026 · 3 days", "10 Oct 2026 · 09:30", ... */
export function itemDateLabel(category: ApprovalCategory, item: Item): string {
  switch (category) {
    case 'leave': {
      const days = typeof item.totalDays === 'number' && item.totalDays > 0 ? item.totalDays : null
      const range =
        s(item.startDate) && s(item.endDate) && item.startDate !== item.endDate
          ? `${fmtDay(item.startDate, { year: false })} → ${fmtDay(item.endDate)}`
          : fmtDay(item.startDate)
      return days ? `${range} · ${days} ${days === 1 ? 'day' : 'days'}` : range
    }
    case 'permission': {
      const time = s(item.permissionTime) || s(item.time)
      return `${fmtDay(item.date)}${time ? ` · ${time}` : ''}`
    }
    case 'missing_punch':
      return `${fmtDay(item.date)}${s(item.punchTime) ? ` · ${s(item.punchTime)}` : ''}`
    case 'casual_leave':
    case 'attendance':
      return fmtDay(item.date)
    case 'outpass':
      return `Asked ${fmtDay(item.createdAt)}`
    case 'on_duty': {
      const count = onDutyPunches(item).length
      const base = fmtDay(item.date ?? item.createdAt)
      return Array.isArray(item.punches) ? `${base} · ${count ? `${count} ${count === 1 ? 'punch' : 'punches'}` : 'No punches yet'}` : base
    }
    case 'holiday_work': {
      // A compensation claim (any kind): "09 Nov 2026" for Sunday / holiday work, "Day off on 24 Nov 2026", ...
      const claim = describeClaim(item as unknown as PendingHolidayWorkClaim)
      const day = claim.workDate ? fmtDay(claim.workDate) : claim.workDateText || '—'
      return claim.dateWord ? `${claim.dateWord} ${day}` : day
    }
    case 'birthday_compensation':
      // the day the Birthday Compensation is placed on (its part is on the type chip)
      return fmtDay(item.useDate ?? item.date)
    case 'resignation':
      return `Sent ${fmtDay(item.createdAt)}${s(item.lastWorkingDate) ? ` · Last day ${fmtDay(item.lastWorkingDate)}` : ''}`
  }
}

/** The reason the employee (or HR) gave, if any. Outpass and On-Duty fold their destination into the type instead. */
export function itemReason(category: ApprovalCategory, item: Item): string | null {
  if (category === 'holiday_work') return describeClaim(item as unknown as PendingHolidayWorkClaim).reason || null
  return s(item.reason) || null
}

/** Extra context a head needs before deciding ("Rejecting voids its punches."). */
export function itemNote(category: ApprovalCategory, item: Item): string | null {
  if (category === 'on_duty') return 'Rejecting voids the punches recorded under it.'
  if (category === 'holiday_work') return describeClaim(item as unknown as PendingHolidayWorkClaim).note || null
  if (category === 'birthday_compensation') return placementNote(birthdayUse(item))
  if (category === 'permission' && s(item.capStatus)) {
    const limit = typeof item.monthlyLimit === 'number' ? item.monthlyLimit : 3
    return `Only the first ${limit} approved permissions each month are Allowed; any after that are Overdue / Excess.`
  }
  return null
}

export type BadgeTone = 'waiting' | 'approved' | 'rejected' | 'info' | 'neutral'

/** The status pill on a card: a request a Department Head approved that now waits for HR says "With HR". (A permission's
 *  own outcome, Allowed / Excess, is applied by components/approvals/words.ts.) */
export function itemBadge(_category: ApprovalCategory, status: ApprovalStatus, item: Item): { label: string; tone: BadgeTone } {
  const outcome = item.outcome && typeof item.outcome === 'object' ? (item.outcome as Item) : null
  if (outcome?.state === 'in_progress') return { label: 'With HR', tone: 'info' }
  if (status === 'approved') return { label: 'Approved', tone: 'approved' }
  if (status === 'rejected') return { label: 'Rejected', tone: 'rejected' }
  return { label: 'Pending', tone: 'waiting' }
}

// ---- On-Duty -------------------------------------------------------------------------------------------------------

export interface OnDutyPunchRow {
  id: number
  punchDate: string | null
  /** "HH:MM" */
  punchTime: string | null
  punchType: 'IN' | 'OUT'
  punchNumber: number | null
  status: 'approved' | 'rejected' | 'pending'
  hasPhoto: boolean
  hasPhoto2: boolean
  latitude: number | null
  longitude: number | null
  accuracyM: number | null
  isMocked: boolean
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** The punches recorded under an On-Duty request (GET /manager/requests sends them; the old pending list does not). */
export function onDutyPunches(item: Item | null | undefined): OnDutyPunchRow[] {
  const raw = item?.punches
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is Item => !!p && typeof p === 'object' && typeof (p as Item).id === 'number')
    .map((p) => ({
      id: p.id as number,
      punchDate: s(p.punchDate) || null,
      punchTime: s(p.punchTime) || null,
      punchType: p.punchType === 'OUT' ? 'OUT' : 'IN',
      punchNumber: num(p.punchNumber),
      status: p.status === 'approved' || p.status === 'rejected' ? p.status : 'pending',
      hasPhoto: p.hasPhoto === true,
      hasPhoto2: p.hasPhoto2 === true,
      latitude: num(p.latitude),
      longitude: num(p.longitude),
      accuracyM: num(p.accuracyM),
      isMocked: p.isMocked === true,
    }))
}

/** "9:05 AM" from "09:05" or "09:05:30" (the text as it came when it is not a time; an em dash when missing). */
export function clock12(hhmm: unknown): string {
  const m = typeof hhmm === 'string' ? /^(\d{1,2}):(\d{2})/.exec(hhmm) : null
  if (!m) return typeof hhmm === 'string' && hhmm ? hhmm : '—'
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/** "In 9:05 AM · Out 1:00 PM" for a card, or null without punches. */
export function onDutyPunchLine(item: Item | null | undefined): string | null {
  const punches = onDutyPunches(item)
  if (!punches.length) return null
  return punches.map((p) => `${p.punchType === 'OUT' ? 'Out' : 'In'} ${clock12(p.punchTime)}`).join(' · ')
}

/** The recorded route of an On-Duty request's day (`journeyId` on the GET /manager/requests and /manager/pending-requests
 *  rows), or null when nothing was recorded or the server is too old to say. "View route" opens it (GET
 *  /tracking/journeys/<id> lets the employee's Department Head in). */
export function onDutyJourneyId(item: Item | null | undefined): number | null {
  const raw = item?.journeyId
  const id = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw.trim()) ? Number(raw) : NaN
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Does any punch of the request say its location may be faked? */
export function hasMockedPunch(item: Item | null | undefined): boolean {
  return onDutyPunches(item).some((p) => p.isMocked)
}

/** The Google Maps link for a place, or null without coordinates. */
export function mapLink(lat: number | null | undefined, lng: number | null | undefined): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/** The item's id as the PATCH endpoints take it. */
export function itemId(item: ApprovalItem): string {
  return String(item.id)
}

/** The item's `approval` block, when it is one. */
export function itemApproval(item: Item | null | undefined): ApprovalProgress | null {
  const a = item?.approval
  return a && typeof a === 'object' && Array.isArray((a as ApprovalProgress).steps) ? (a as ApprovalProgress) : null
}

/**
 * The approval path as a Department Head sees it on their Approvals page: the employee's first name (or "HR" for a request
 * HR raised) instead of "You", then one step per approver. Empty without an `approval` block.
 */
export function headSteps(category: ApprovalCategory, item: Item, when?: (iso: string) => string | null): PathStep[] {
  const steps = approvalPath(itemApproval(item), s(item.createdAt) || null, when)
  if (!steps.length) return steps
  // A compensation claim may be raised by HR or (since 2026-11-19) by the employee; an older backend: always HR. Birthday
  // Compensation is placed by the employee or by HR (2026-11-25).
  const raisedByHr =
    category === 'attendance' ||
    (category === 'holiday_work' && claimRaisedBy(item as unknown as PendingHolidayWorkClaim) === 'hr') ||
    (category === 'birthday_compensation' && s(item.raisedByRole) === 'hr')
  const first = empName(item).split(/\s+/)[0]
  steps[0] = { ...steps[0], label: raisedByHr ? 'HR' : first && first !== 'Employee' ? first : 'Employee' }
  return steps
}

// ---- compensation claims ---------------------------------------------------------------------------------------------

/** "6:00 PM", "2:10 AM (next day)" for an overtime's last punch (a full timestamp is cut to its time). */
function punchClock(value: string | null, nextDay: boolean): string | null {
  if (!value) return null
  const time = /T(\d{1,2}:\d{2})/.exec(value)?.[1] ?? value
  return `${clock12(time)}${nextDay ? ' (next day)' : ''}`
}

/**
 * The facts a head needs on a compensation claim, as label / value rows for the detail dialog: who raised it, the
 * overtime (day, shift end, last punch, extra time), the allowance minutes, the shifts. Only the rows the claim carries
 * (an older backend's Sunday claim: who raised it and the shifts).
 */
export function claimFacts(item: Item): [string, string][] {
  const claim = item as unknown as PendingHolidayWorkClaim
  const v = describeClaim(claim)
  const shifts = Number(claim.shifts)
  const rows: [string, string | null][] = [
    ['Raised by', v.raisedBy === 'employee' ? `${v.name} (employee)` : v.raisedByText.replace(/^Raised by /, '')],
    ['Overtime day', v.overtime?.date ? fmtDay(v.overtime.date) : null],
    ['Shift end', v.overtime?.shiftEnd ? clock12(v.overtime.shiftEnd) : null],
    ['Last punch', v.overtime ? punchClock(v.overtime.lastPunch, v.overtime.lastPunchNextDay) : null],
    ['Extra time', v.overtime?.extraMinutes ? formatMinutes(v.overtime.extraMinutes) : null],
    ['Allowance', v.kind === 'ot_allowance' && v.minutes ? `${formatMinutes(v.minutes)} late-in` : null],
    ['Shifts', v.kind !== 'ot_allowance' && shifts > 0 ? formatShifts(shifts) : null],
  ]
  return rows.filter((r): r is [string, string] => !!r[1])
}

// ---- Birthday Compensation (2026-11-25) --------------------------------------------------------------------------------

/** The row read as a Birthday Compensation placement (every field defensively; the id always comes through). */
export function birthdayUse(item: Item): BdcUse {
  // parseUse only refuses a row without an id, which the lists never send; a stand-in id keeps such a card drawable
  return parseUse(item) ?? (parseUse({ ...item, id: '?' }) as BdcUse)
}

/** The facts a head needs on a Birthday Compensation placement (the decision dialog's rows). */
export function birthdayFacts(item: Item): [string, string][] {
  return placementFacts(birthdayUse(item))
}

/** One line for its card: "Birthday 05 Mar 2026 · 0.50 day"; null without a birthday. */
export function birthdayLine(item: Item): string | null {
  const use = birthdayUse(item)
  if (!use.birthday) return null
  return `Birthday ${fmtDay(use.birthday)}${use.days ? ` · ${daysText(use.days)}` : ''}`
}

/** Who placed it: the employee themselves, or HR on their behalf; null when the row does not say. */
export function birthdayRaisedBy(item: Item): 'employee' | 'hr' | null {
  return birthdayUse(item).raisedByRole
}

/** One line for a claim's card: "Shift end 6:00 PM · Last punch 9:30 PM · 3 h 30 min extra"; null without overtime. */
export function claimLine(item: Item): string | null {
  const o = describeClaim(item as unknown as PendingHolidayWorkClaim).overtime
  if (!o) return null
  const parts = [
    o.shiftEnd ? `Shift end ${clock12(o.shiftEnd)}` : null,
    o.lastPunch ? `Last punch ${punchClock(o.lastPunch, o.lastPunchNextDay)}` : null,
    o.extraMinutes ? `${formatMinutes(o.extraMinutes)} extra` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

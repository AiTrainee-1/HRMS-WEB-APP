// The Leave page's own rules (owner 2026-10-31), mirroring the mobile app's src/lib/leaveForm.ts: Casual Leave left the
// leave form (it is its own request now); the employee says WHY with one of four reason categories. The category is
// descriptive only (backend LeaveRequest.reason_category): sent with the plain type "Leave", the server stores type
// "Leave" and deducts NO leave balance. Pure, tested in leave-form.test.ts.

export type ReasonCategory = 'sick' | 'emergency' | 'personal' | 'other'

export const REASON_CATEGORIES: readonly { key: ReasonCategory; label: string; hint: string }[] = [
  { key: 'sick', label: 'Sick Leave', hint: 'You are unwell or seeing a doctor' },
  { key: 'emergency', label: 'Emergency', hint: 'Something urgent came up' },
  { key: 'personal', label: 'Personal', hint: 'Family or personal work' },
  { key: 'other', label: 'Other Reasons', hint: 'Anything else' },
]

const LABEL: Record<string, string> = Object.fromEntries(REASON_CATEGORIES.map((c) => [c.key, c.label]))

export function isReasonCategory(value: unknown): value is ReasonCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LABEL, value)
}

export function reasonCategoryLabel(value: string | null | undefined): string | null {
  return value && isReasonCategory(value) ? LABEL[value] : null
}

/** The leave type sent with every request: a plain "Leave", never a Casual Leave type and never a made-up id. */
export const PLAIN_LEAVE_TYPE = 'Leave'

export type HalfSlot = 'morning' | 'afternoon'

export type LeaveFormInput = {
  employeeId: string
  reasonCategory: ReasonCategory
  mode: 'single' | 'range' | 'half'
  /** The day (single / half) or the first day (range), YYYY-MM-DD. */
  startDate: string
  /** The last day (range only). */
  endDate?: string
  halfDaySlot?: HalfSlot
  reason: string
}

/** Exactly the body the mobile app sends to POST /leave-requests: the plain type "Leave" + the reason category, so the
 *  backend deducts no balance. A half day is one date sent as both ends. */
export function buildLeaveBody(f: LeaveFormInput): {
  employeeId: string
  type: string
  reasonCategory: ReasonCategory
  startDate: string
  endDate: string
  reason: string
  isHalfDay?: boolean
  halfDaySlot?: HalfSlot
} {
  const end = f.mode === 'range' ? (f.endDate ?? f.startDate) : f.startDate
  return {
    employeeId: f.employeeId,
    type: PLAIN_LEAVE_TYPE,
    reasonCategory: f.reasonCategory,
    startDate: f.startDate,
    endDate: end,
    reason: f.reason.trim(),
    ...(f.mode === 'half' ? { isHalfDay: true, halfDaySlot: f.halfDaySlot ?? 'morning' } : {}),
  }
}

/** A leave card's title: the reason category when the request has one; older requests keep their type, except the old
 *  server default "casual", which was never Casual Leave and would be mistaken for it. */
export function leaveTitle(r: { reasonCategory?: string | null; type?: string | null; isHalfDay?: boolean | null }): string {
  const category = reasonCategoryLabel(r.reasonCategory)
  if (category) return r.isHalfDay ? `${category} · Half day` : category
  if (r.isHalfDay) return 'Half-day leave'
  const type = String(r.type ?? '').trim()
  if (!type || type.toLowerCase() === 'casual') return 'Leave'
  return type
}

/** The day "Taken this month" looks at for a leave from `start` to `end`: a day of the range inside today's month when
 *  there is one (a leave from 30 Sep to 2 Oct is taken in October too), else the start. */
export function leaveDayForMonth(start: string, end: string | null | undefined, today: Date): string {
  const first = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const last = `${first.slice(0, 8)}${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
  const stop = end && end >= start ? end : start
  if (stop < first || start > last) return start
  return start >= first ? start : first
}

/** "1 day", "½ day", "3 days". */
export function leaveDaysText(days: number | null | undefined, isHalfDay?: boolean | null): string {
  if (isHalfDay) return '½ day'
  const n = Number(days ?? 0)
  if (!Number.isFinite(n) || n <= 0) return ''
  return `${n} ${n === 1 ? 'day' : 'days'}`
}

/** Why the form cannot be sent yet (the first problem), or null. Dates are checked separately (lib/request-window). */
export function leaveFormProblem(f: { reasonCategory: string; reason: string; mode: LeaveFormInput['mode']; halfDaySlot?: string | null }): string | null {
  if (!isReasonCategory(f.reasonCategory)) return 'Choose why you need leave.'
  if (f.mode === 'half' && f.halfDaySlot !== 'morning' && f.halfDaySlot !== 'afternoon') return 'Choose the morning or the afternoon.'
  const len = f.reason.trim().length
  if (len < 5) return 'Please give a reason (at least 5 letters).'
  if (f.reason.length > 300) return 'The reason is too long (300 letters at most).'
  return null
}

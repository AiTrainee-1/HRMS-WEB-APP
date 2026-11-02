// Where a notification leads, how the inbox groups it, and the words around it. The backend creates a notification per
// event with a free-form `type` (push_messages.notification_type, approval_workflow, mobile_reminder_views ...); the types
// listed here have a page worth opening, every other type is plain text. Mirrors the mobile app's notificationRoute
// (src/lib/compensation.ts) and goes further: the web app has a page for every request kind.
// Since 2026-11-02 the server says what each notification is about (`target`, read by lib/notification-target.ts, which
// opens the exact request); `notificationTarget` below is the fallback for an older server that sends no `target`.
// Pure TypeScript with no imports, so Node's test runner can run it: `npm test`.

export interface NotificationTarget {
  href: string
  /** The link's words ("View compensation"). */
  label: string
}

export interface NotificationViewer {
  /** Whether the reader is a Department Head (GET /manager/me). null / undefined = not known yet. */
  isManager?: boolean | null
}

const APPROVALS: NotificationTarget = { href: '/employee/approvals', label: 'Open approvals' }

/** A request kind's own page, for the employee it is about. */
const OWN_PAGE: Record<string, NotificationTarget> = {
  // Sent to the employee when their Department Head decides a Holiday / Sunday work claim HR raised for them.
  compensation: { href: '/employee/compensation', label: 'View compensation' },
  leave: { href: '/employee/leave', label: 'View your leave' },
  permission: { href: '/employee/permissions', label: 'View your permissions' },
  casual_leave: { href: '/employee/casual-leave', label: 'View casual leave' },
  missing_punch: { href: '/employee/missing-punch', label: 'View missing punch' },
  on_duty: { href: '/employee/attendance-request?mode=onduty', label: 'View On-Duty' },
  outpass: { href: '/employee/outpass', label: 'View outpass' },
  resignation: { href: '/employee/resignation', label: 'View resignation' },
  attendance: { href: '/employee/attendance', label: 'View attendance' },
  salary_slip: { href: '/employee/salary', label: 'View salary slips' },
  id_card: { href: '/employee/id-card', label: 'View ID card' },
  offer_letter: { href: '/employee/documents', label: 'View documents' },
  experience_letter: { href: '/employee/documents', label: 'View documents' },
  resignation_letter: { href: '/employee/documents', label: 'View documents' },
  chat: { href: '/employee/chat', label: 'Open chat' },
}

/** Only ever sent to a Department Head: a Holiday / Sunday work claim waiting for them, or an employee's reminder. */
const HEAD_ONLY = new Set(['holiday_work', 'approval_reminder'])

/** "Suresh Raj's leave is waiting for your approval." (approval_workflow.notify_hod_of_request) and the reminder's
 *  "Sir, please review this request and provide your approval." */
const WAITING_FOR_YOU = /waiting for your approval|provide your approval|needs your approval/i

/**
 * The page a notification opens, or null when it has none.
 *   approval_reminder / holiday_work -> Approvals (null when the reader is known NOT to be a head any more)
 *   any kind whose message says it waits for the reader's approval -> Approvals, for a head
 *   otherwise the kind's own page (leave -> Leave, salary_slip -> Salary slips ...)
 * Types are matched exactly (the server sends lower case); anything else has no link.
 */
export function notificationTarget(
  type: string | null | undefined,
  viewer?: NotificationViewer | null,
  message?: string | null,
): NotificationTarget | null {
  if (typeof type !== 'string') return null
  if (HEAD_ONLY.has(type)) return viewer?.isManager === false ? null : APPROVALS
  if (viewer?.isManager === true && typeof message === 'string' && WAITING_FOR_YOU.test(message)) return APPROVALS
  return Object.hasOwn(OWN_PAGE, type) ? OWN_PAGE[type] : null
}

/** Is the notification asking a head to act (it gets the approvals icon)? */
export function isApprovalNudge(type: string | null | undefined, message?: string | null): boolean {
  return (typeof type === 'string' && HEAD_ONLY.has(type)) || (typeof message === 'string' && WAITING_FOR_YOU.test(message))
}

// ---- grouping by day -----------------------------------------------------------------------------------------------

export interface DayGroup<T> {
  key: string
  /** "Today", "Yesterday", "Monday", "12 Oct", "12 Oct 2025". */
  label: string
  items: T[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Today" / "Yesterday" / the weekday (within the last week) / "12 Oct" / "12 Oct 2025". */
export function dayLabel(d: Date, now: Date = new Date()): string {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.round((b - a) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return DAYS[d.getDay()]
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** Rows under their local day, newest day first, newest row first within a day. Undated rows go last, under "Earlier". */
export function groupByDay<T>(rows: readonly T[], dateOf: (row: T) => string | null | undefined, now: Date = new Date()): DayGroup<T>[] {
  const time = (row: T) => {
    const ms = Date.parse(dateOf(row) ?? '')
    return Number.isNaN(ms) ? null : ms
  }
  const sorted = [...rows].sort((x, y) => (time(y) ?? -Infinity) - (time(x) ?? -Infinity))
  const out: DayGroup<T>[] = []
  const byKey = new Map<string, DayGroup<T>>()
  for (const row of sorted) {
    const ms = time(row)
    const d = ms === null ? null : new Date(ms)
    const key = d ? localKey(d) : 'earlier'
    let group = byKey.get(key)
    if (!group) {
      group = { key, label: d ? dayLabel(d, now) : 'Earlier', items: [] }
      byKey.set(key, group)
      out.push(group)
    }
    group.items.push(row)
  }
  return out
}

/** "10:05 AM" in this PC's time; '' when it does not parse. */
export function timeOfDay(iso: string | null | undefined): string {
  const ms = Date.parse(iso ?? '')
  if (Number.isNaN(ms)) return ''
  const d = new Date(ms)
  const h = d.getHours()
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

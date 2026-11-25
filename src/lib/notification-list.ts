// The Notifications page as a to-do list (owner 2026-11-25, mirror of the mobile app's src/lib/notificationList.ts):
// pure helpers, no React, unit-tested in notification-list.test.ts. The page is pages/employee/Notifications.tsx; the
// rows, the check and the detail dialog are in components/notifications/.
//
// - every notification falls in one of three groups by the day it arrived: Today, Yesterday, Earlier;
// - the rows show one line of the message and a short time ("5 min ago", "9:14 am", "12 Nov");
// - the detail dialog shows the whole message and the full time ("Tuesday, 25 Nov 2026 at 3:42 pm");
// - each notification type has its own headline (a WhatsApp-made one brings its own); icons and colours are the page's.

export type NotificationFilter = 'all' | 'unread'
export type DayGroup = 'today' | 'yesterday' | 'earlier'

export const DAY_GROUP_ORDER: readonly DayGroup[] = ['today', 'yesterday', 'earlier']
export const DAY_GROUP_LABEL: Record<DayGroup, string> = { today: 'Today', yesterday: 'Yesterday', earlier: 'Earlier' }

/** What these helpers read of a notification (types/index.ts Notification). */
export interface ListNotification {
  id: string | number
  isRead: boolean
  createdAt: string
  title?: string
  message: string
  type?: string
}

export type NotificationListRow<T> =
  | { kind: 'header'; key: string; group: DayGroup; label: string; count: number; unread: number }
  | { kind: 'item'; key: string; group: DayGroup; item: T; first: boolean; last: boolean }

// ---- time ----------------------------------------------------------------------------------------------------------

/** The time a notification arrived, or null when the server sent something that is not a date. */
export function parseTime(createdAt: unknown): Date | null {
  if (typeof createdAt !== 'string' || createdAt.trim() === '') return null
  const d = new Date(createdAt)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Today / Yesterday / Earlier, by this computer's own calendar day. A time a little in the future (the server's clock
 *  ahead of this one) counts as today; an unreadable one as earlier. */
export function dayGroup(createdAt: unknown, now: Date): DayGroup {
  const d = parseTime(createdAt)
  if (!d) return 'earlier'
  const today = startOfDay(now)
  const day = startOfDay(d)
  if (day >= today) return 'today'
  // Yesterday is the calendar day before today (not "24 hours"), daylight-saving days included.
  const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()
  return day >= y ? 'yesterday' : 'earlier'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "9:05 am", "12:30 pm". */
export function clockTime(d: Date): string {
  const h = d.getHours()
  const m = d.getMinutes()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** The short time on a row: "Just now", "5 min ago", "3 h ago" today; the clock time yesterday (the group already says
 *  which day); "12 Nov" earlier this year and "12 Nov 2025" before that. */
export function shortTime(createdAt: unknown, now: Date): string {
  const d = parseTime(createdAt)
  if (!d) return ''
  const group = dayGroup(createdAt, now)
  if (group === 'today') {
    const mins = Math.floor((now.getTime() - d.getTime()) / 60_000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    return `${Math.floor(mins / 60)} h ago`
  }
  if (group === 'yesterday') return clockTime(d)
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? day : `${day} ${d.getFullYear()}`
}

/** The detail dialog's time: "Today at 3:42 pm", "Yesterday at 9:05 am", "Tuesday, 18 Nov 2026 at 3:42 pm". */
export function fullTime(createdAt: unknown, now: Date): string {
  const d = parseTime(createdAt)
  if (!d) return ''
  const group = dayGroup(createdAt, now)
  if (group === 'today') return `Today at ${clockTime(d)}`
  if (group === 'yesterday') return `Yesterday at ${clockTime(d)}`
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} at ${clockTime(d)}`
}

// ---- text ----------------------------------------------------------------------------------------------------------

/** The message on one line: line breaks and runs of spaces become single spaces. */
export function previewLine(message: unknown): string {
  return typeof message === 'string' ? message.replace(/\s+/g, ' ').trim() : ''
}

// ---- the list ------------------------------------------------------------------------------------------------------

/**
 * The notifications a filter shows, in the server's order (newest first). `keep`: ids that stay on the Unread list a
 * moment after they were ticked, so the tick can be seen before the row leaves.
 */
export function visibleNotifications<T extends ListNotification>(
  items: readonly T[] | undefined,
  filter: NotificationFilter,
  keep: ReadonlySet<string> = new Set(),
): T[] {
  return (items ?? []).filter((n) => filter === 'all' || !n.isRead || keep.has(String(n.id)))
}

/** How many are unread. */
export function unreadCount(items: readonly ListNotification[] | undefined): number {
  return (items ?? []).reduce((sum, n) => sum + (n.isRead ? 0 : 1), 0)
}

/**
 * The list's rows: a header for each day group that has notifications (Today, Yesterday, Earlier, in that order), then
 * its notifications in the server's order. `first` / `last` mark a group's ends (the rows of a group are drawn as one
 * card).
 */
export function groupNotifications<T extends ListNotification>(items: readonly T[], now: Date): NotificationListRow<T>[] {
  const groups: Record<DayGroup, T[]> = { today: [], yesterday: [], earlier: [] }
  for (const n of items) groups[dayGroup(n.createdAt, now)].push(n)
  const rows: NotificationListRow<T>[] = []
  for (const group of DAY_GROUP_ORDER) {
    const list = groups[group]
    if (!list.length) continue
    rows.push({ kind: 'header', key: `h-${group}`, group, label: DAY_GROUP_LABEL[group], count: list.length, unread: unreadCount(list) })
    list.forEach((item, i) => {
      rows.push({ kind: 'item', key: `n-${item.id}`, group, item, first: i === 0, last: i === list.length - 1 })
    })
  }
  return rows
}

// ---- the kinds -----------------------------------------------------------------------------------------------------

// The real `type` values the backend creates (every Notification.objects.create() call site, and the WhatsApp-made ones
// of backend/api/push_messages.py), worded as the mobile app words them; anything else is a plain "Notification".
const KIND_TITLE: Record<string, string> = {
  leave: 'Leave update',
  casual_leave: 'Casual Leave update',
  permission: 'Permission update',
  on_duty: 'On-Duty update',
  missing_punch: 'Missing punch update',
  attendance: 'Attendance update',
  employee_request: 'Request update',
  enquiry: 'Enquiry update',
  resignation: 'Resignation update',
  // to the employee: the Department Head decided one of their compensation claims
  compensation: 'Compensation update',
  // to the Department Head: a compensation claim waits for their decision
  holiday_work: 'Compensation approval',
  advance: 'Advance update',
  approval: 'Request update',
  approval_reminder: 'Reminder',
  outpass: 'Outpass',
  visitors: 'Visitor',
  salary_slip: 'Salary slip',
  id_card: 'ID card',
  offer_letter: 'Offer letter',
  experience_letter: 'Experience letter',
  resignation_letter: 'Resignation letter',
  chat: 'Chat message',
  other: 'Document',
  general: 'Notification',
}

/** The name of a notification type ("Leave update", "Reminder"); unknown types are a plain "Notification". */
export function notificationKindTitle(type: unknown): string {
  const key = typeof type === 'string' ? type.trim().toLowerCase() : ''
  return Object.hasOwn(KIND_TITLE, key) ? KIND_TITLE[key] : KIND_TITLE.general
}

/** The headline a row shows: the notification's own title (WhatsApp-made ones have one), else its kind's name. */
export function notificationHeadline(n: { title?: unknown; type?: unknown }): string {
  const own = typeof n.title === 'string' ? n.title.trim() : ''
  return own || notificationKindTitle(n.type)
}

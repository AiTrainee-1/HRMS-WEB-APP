// Where a notification leads. The backend creates a notification per event with a free-form `type`; only the ones listed
// here have a page worth opening, every other type is plain text (and keeps the generic bell icon). Pure TypeScript
// with no imports, so Node's test runner can run it: `npm test`.

export interface NotificationTarget {
  href: string
  /** The link's words ("View compensation"). */
  label: string
}

const TARGETS: Record<string, NotificationTarget> = {
  // Sent to the employee when their Department Head decides a Holiday / Sunday work claim HR raised for them.
  compensation: { href: '/employee/compensation', label: 'View compensation' },
  // Sent to the Department Head when such a claim is waiting for their decision.
  holiday_work: { href: '/employee/approvals', label: 'Open approvals' },
}

/** The page a notification of this type opens, or null when it has none. */
export function notificationTarget(type: string | null | undefined): NotificationTarget | null {
  return typeof type === 'string' && Object.hasOwn(TARGETS, type) ? TARGETS[type] : null
}

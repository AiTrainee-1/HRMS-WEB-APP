import { Link, useLocation } from 'wouter'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { cn } from '@/lib/utils'
import { isActiveHref } from '../nav-config'
import { PHONE_TABS } from './phone-nav'

/**
 * PHONE bottom tab bar (< 768px only): the mobile app's tab bar (app/(tabs)/_layout.tsx + DockTabIcon) - Home,
 * Attendance, My Shift, Approvals (department heads only, with the waiting count), Profile. White card bar with a hairline
 * on top and a soft lift; the chosen tab's icon magnifies out of a tinted well with a dot beneath it, label in primary.
 *
 * It is the last child of the shell's flex column, not `position: fixed`, so the scrolling <main> simply ends above it:
 * nothing on a page can hide behind it, and pages need no bottom padding for it. Its bottom padding clears the phone's
 * home indicator (safe-area inset).
 */
export function MobileTabBar() {
  const [location] = useLocation()
  const { isManager, flags } = useManagerStatus()
  const pending = flags?.pendingApprovalsCount ?? 0
  const tabs = PHONE_TABS.filter((t) => !t.managerOnly || isManager)

  return (
    <nav
      aria-label="Main tabs"
      className="max-md:relative max-md:z-20 hidden max-md:shrink-0 max-md:border-t max-md:border-input max-md:bg-card max-md:px-1 max-md:pt-2 max-md:pb-[max(env(safe-area-inset-bottom),8px)] max-md:shadow-[0_-4px_12px_rgb(30_58_138/0.08)] max-md:flex max-md:dark:shadow-[0_-4px_12px_rgb(0_0_0/0.35)]"
    >
      {tabs.map((tab) => {
        const active = isActiveHref(location, tab.href)
        const Icon = tab.icon
        const badge = tab.managerOnly && pending > 0 ? (pending > 99 ? '99+' : String(pending)) : null
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-ring max-md:relative max-md:flex max-md:min-h-12 max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:items-center max-md:justify-start max-md:gap-0.5 max-md:rounded-xl',
              active ? 'max-md:text-primary' : 'max-md:text-muted-foreground',
            )}
          >
            <span className="max-md:relative max-md:grid max-md:h-[30px] max-md:w-11 max-md:place-items-center">
              {/* The dock well: grows in behind the chosen icon. */}
              <span
                aria-hidden="true"
                className={cn(
                  'max-md:absolute max-md:inset-x-0.5 max-md:top-0 max-md:bottom-0.5 max-md:rounded-[14px] max-md:bg-accent max-md:transition-[opacity,scale] max-md:duration-300 max-md:ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                  active ? 'max-md:scale-100 max-md:opacity-100' : 'max-md:scale-[0.4] max-md:opacity-0',
                )}
              />
              <Icon
                aria-hidden="true"
                strokeWidth={active ? 2.25 : 2}
                className={cn(
                  'max-md:relative max-md:size-[22px] max-md:transition-[scale,translate] max-md:duration-300 max-md:ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                  active ? 'max-md:-translate-y-[3px] max-md:scale-[1.22]' : 'max-md:translate-y-0 max-md:scale-100',
                )}
              />
              {/* The dock's "running" dot. */}
              <span
                aria-hidden="true"
                className={cn(
                  'max-md:absolute max-md:-bottom-px max-md:left-1/2 max-md:size-[3.5px] max-md:-translate-x-1/2 max-md:rounded-full max-md:bg-current max-md:transition-[opacity,scale] max-md:duration-300',
                  active ? 'max-md:scale-100 max-md:opacity-100' : 'max-md:scale-0 max-md:opacity-0',
                )}
              />
              {badge && (
                <span
                  aria-hidden="true"
                  className="max-md:absolute max-md:-top-1 max-md:left-[calc(50%+6px)] max-md:grid max-md:h-[18px] max-md:min-w-[18px] max-md:place-items-center max-md:rounded-full max-md:bg-rejected-bg max-md:px-1 max-md:text-[10px] max-md:leading-none max-md:font-bold max-md:text-rejected max-md:tabular-nums"
                >
                  {badge}
                </span>
              )}
            </span>
            <span className="max-md:mt-0.5 max-md:max-w-full max-md:truncate max-md:px-0.5 max-md:text-[10px] max-md:leading-[13px] max-md:font-bold max-md:tracking-[0.2px]">{tab.label}</span>
            {badge && <span className="sr-only">, {badge} waiting</span>}
          </Link>
        )
      })}
    </nav>
  )
}

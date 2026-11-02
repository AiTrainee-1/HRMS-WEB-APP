import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Link, useLocation } from 'wouter'
import { ChevronRight, LogOut, Moon, Sun, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { useEmploymentType } from '@/hooks/useEmploymentType'
import { cn } from '@/lib/utils'
import { isActiveHref } from '../nav-config'
import { PHONE_DRAWER, type PhoneNavItem } from './phone-nav'
import { UktLogo } from './UktLogo'
import { useUnreadNotifications } from './useUnreadNotifications'

function DrawerLink({ item, active, badge, onNavigate }: { item: PhoneNavItem; active: boolean; badge?: number; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-ring max-md:flex max-md:min-h-[52px] max-md:items-center max-md:gap-3 max-md:rounded-xl max-md:px-3 max-md:py-2.5 max-md:transition-colors max-md:active:bg-foreground/[0.06]',
        active && 'max-md:bg-accent/70',
      )}
    >
      {/* The app's tinted icon well: the entry's colour at ~9% behind the icon in that colour (lighter on dark). */}
      <span
        aria-hidden="true"
        style={{ '--c': item.color ?? 'var(--primary)' } as React.CSSProperties}
        className={cn(
          'max-md:grid max-md:size-9 max-md:shrink-0 max-md:place-items-center max-md:rounded-lg',
          item.danger
            ? 'max-md:bg-rejected-bg max-md:text-rejected'
            : 'max-md:bg-[color-mix(in_srgb,var(--c)_9%,transparent)] max-md:text-[var(--c)] max-md:dark:bg-[color-mix(in_srgb,var(--c)_20%,transparent)] max-md:dark:text-[color-mix(in_srgb,var(--c)_55%,white)]',
        )}
      >
        <Icon className="max-md:size-5" />
      </span>
      <span className={cn('max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:text-[14px] max-md:font-semibold', item.danger ? 'max-md:text-rejected' : 'max-md:text-foreground')}>
        {item.label}
      </span>
      {!!badge && (
        <span className="max-md:grid max-md:h-5 max-md:min-w-5 max-md:place-items-center max-md:rounded-full max-md:bg-destructive max-md:px-[5px] max-md:text-[10px] max-md:leading-none max-md:font-bold max-md:text-destructive-foreground max-md:tabular-nums">
          {badge > 99 ? '99+' : badge}
          <span className="sr-only"> unread</span>
        </span>
      )}
      <ChevronRight className="max-md:size-4 max-md:shrink-0 max-md:text-input" aria-hidden="true" />
    </Link>
  )
}

/**
 * PHONE side drawer (opened from the phone top bar's menu button): the mobile app's SideDrawer - a sapphire gradient
 * header with the mark, grouped links with tinted icon wells (Home & Attendance, HR Operations, Payroll & Salary,
 * Records & Community, Account & System), and a footer with the Dark Mode switch (+ "Auto") and Sign out.
 * Its own Radix dialog (not ui/sheet) so it carries no desktop styling; the desktop drawer (768-1023px) is untouched.
 */
export function MobileDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [location] = useLocation()
  const { logout } = useAuth()
  const { isManager } = useManagerStatus()
  const { isStaff } = useEmploymentType()
  const { mode, isDark, setMode, toggle } = useTheme()
  const unread = useUnreadNotifications()
  const close = () => onOpenChange(false)

  const groups = PHONE_DRAWER.map((g) => ({
    ...g,
    items: g.items.filter((i) => (!i.managerOnly || isManager) && (!i.staffOnly || isStaff)),
  })).filter((g) => g.items.length > 0)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-fade max-md:fixed max-md:inset-0 max-md:z-50 max-md:bg-[rgb(15_23_42/0.4)]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="ui-slide-left max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:flex max-md:w-[min(78vw,300px)] max-md:flex-col max-md:bg-background max-md:shadow-[8px_0_20px_rgb(15_23_42/0.12)] max-md:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>

          {/* Header: brand only, like the app (the person's details live on Profile). */}
          <div className="max-md:relative max-md:flex max-md:shrink-0 max-md:items-center max-md:gap-3 max-md:overflow-hidden max-md:bg-[linear-gradient(135deg,#1e3a8a,#2563eb)] max-md:px-5 max-md:pt-[calc(env(safe-area-inset-top)+18px)] max-md:pb-5 max-md:dark:bg-[linear-gradient(135deg,#0b1220,#1e3a5f)]">
            <span aria-hidden="true" className="max-md:absolute max-md:-top-5 max-md:-right-5 max-md:size-[100px] max-md:rounded-full max-md:bg-white/[0.08]" />
            <span aria-hidden="true" className="max-md:absolute max-md:right-10 max-md:-bottom-[30px] max-md:size-[70px] max-md:rounded-full max-md:bg-white/[0.05]" />
            <UktLogo className="max-md:relative max-md:h-11" />
            <span className="max-md:relative max-md:min-w-0">
              <span className="font-display max-md:block max-md:truncate max-md:text-[15px] max-md:leading-5 max-md:font-bold max-md:tracking-[1.6px] max-md:text-white max-md:uppercase">uktextiles</span>
              <span className="max-md:mt-0.5 max-md:block max-md:truncate max-md:text-[11px] max-md:leading-4 max-md:text-white/[0.72]">Employee Self-Service</span>
            </span>
            <DialogPrimitive.Close
              aria-label="Close menu"
              className="focus-ring max-md:absolute max-md:top-[calc(env(safe-area-inset-top)+4px)] max-md:right-1 max-md:grid max-md:size-11 max-md:place-items-center max-md:rounded-full max-md:text-white/80"
            >
              <X className="max-md:size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <nav aria-label="Menu" className="scrollbar-none max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-contain max-md:px-3 max-md:py-3">
            {groups.map((g) => (
              <div key={g.heading} className="max-md:mb-1.5">
                <p className="max-md:px-3 max-md:pt-2.5 max-md:pb-1 max-md:text-[10.5px] max-md:leading-[14px] max-md:font-semibold max-md:tracking-[0.6px] max-md:text-muted-foreground max-md:uppercase">
                  {g.heading}
                </p>
                <ul className="max-md:flex max-md:flex-col max-md:gap-0.5">
                  {g.items.map((item, i) => (
                    <li key={item.href}>
                      {g.dividerBeforeLast && i === g.items.length - 1 && (
                        <div role="presentation" className="max-md:mx-3 max-md:my-2 max-md:h-px max-md:bg-input" />
                      )}
                      <DrawerLink
                        item={item}
                        active={isActiveHref(location, item.href)}
                        badge={item.href === '/employee/notifications' ? unread : undefined}
                        onNavigate={close}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Footer, pinned under the list: appearance + sign out. */}
          <div className="max-md:shrink-0 max-md:border-t max-md:border-input max-md:bg-card max-md:px-3 max-md:pt-3 max-md:pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div className="max-md:mb-2.5 max-md:flex max-md:items-center max-md:gap-2.5 max-md:rounded-xl max-md:bg-muted max-md:px-3 max-md:py-2">
              <span aria-hidden="true" className="max-md:grid max-md:size-[30px] max-md:shrink-0 max-md:place-items-center max-md:rounded-[9px] max-md:bg-info-bg max-md:text-primary">
                {isDark ? <Moon className="max-md:size-[17px]" /> : <Sun className="max-md:size-[17px]" />}
              </span>
              <span className="max-md:min-w-0 max-md:flex-1">
                <span className="max-md:block max-md:text-[13px] max-md:leading-4 max-md:font-bold max-md:text-foreground">Dark Mode</span>
                <span className="max-md:block max-md:text-[10.5px] max-md:leading-[14px] max-md:text-muted-foreground">
                  {mode === 'system' ? 'Following your device' : isDark ? 'On' : 'Off'}
                </span>
              </span>
              {mode !== 'system' && (
                <button
                  type="button"
                  onClick={() => setMode('system')}
                  aria-label="Follow my device's appearance"
                  className="focus-ring max-md:-my-2 max-md:grid max-md:min-h-11 max-md:place-items-center max-md:rounded-full"
                >
                  {/* The small chip the app shows; the button around it is the 44px touch target. */}
                  <span className="max-md:rounded-full max-md:border max-md:border-input max-md:px-2 max-md:py-[3px] max-md:text-[10px] max-md:leading-3 max-md:font-bold max-md:text-muted-foreground">Auto</span>
                </button>
              )}
              <Switch checked={isDark} onCheckedChange={() => toggle()} aria-label="Dark mode" className="max-md:data-[state=checked]:bg-primary" />
            </div>
            <button
              type="button"
              onClick={() => {
                close()
                logout()
              }}
              className="focus-ring max-md:flex max-md:min-h-12 max-md:w-full max-md:items-center max-md:justify-center max-md:gap-2.5 max-md:rounded-xl max-md:bg-rejected-bg max-md:px-3 max-md:text-[14px] max-md:font-bold max-md:text-rejected"
            >
              <LogOut className="max-md:size-5" aria-hidden="true" /> Sign out
            </button>
            <p className="max-md:mt-2.5 max-md:text-center max-md:text-[10px] max-md:leading-3 max-md:text-muted-foreground">uktextiles · employee portal</p>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

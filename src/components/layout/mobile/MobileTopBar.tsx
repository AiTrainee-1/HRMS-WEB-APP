import * as React from 'react'
import { Link } from 'wouter'
import { Bell, User } from 'lucide-react'
import { UktLogo } from './UktLogo'
import { useUnreadNotifications } from './useUnreadNotifications'
import { HeaderAvatar } from '../HeaderAvatar'

/**
 * The mobile app's sidebar glyph (src/components/HamburgerToggle.tsx): three offset strokes drawn from one path that
 * morph into a cross when the drawer is open. Inline styles, so it adds no CSS.
 */
function MenuGlyph({ open }: { open: boolean }) {
  const ease = '400ms cubic-bezier(0.16, 1, 0.3, 1)'
  return (
    <svg
      viewBox="0 0 32 32"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      style={{ transform: open ? 'rotate(-45deg)' : 'none', transition: `transform ${ease}` }}
    >
      <path
        d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: open ? '20 300' : '12 63',
          strokeDashoffset: open ? -32.42 : 0,
          transition: `stroke-dasharray ${ease}, stroke-dashoffset ${ease}`,
        }}
      />
      <path d="M7 16 27 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * PHONE top bar (< 768px only; the desktop header is hidden there): exactly the mobile app's tab-screen bar
 * (app/(tabs)/home.tsx) - the menu glyph, the UKT mark, "UKTEXTILES / EMPLOYEE PORTAL", then the bell (red dot while
 * anything is unread) and the round profile button. It sits outside the scrolling <main>, so it is always on screen.
 * `children` lands along its bottom edge (the shell's loading thread).
 */
export function MobileTopBar({
  menuOpen,
  onMenu,
  children,
}: {
  menuOpen: boolean
  onMenu: () => void
  children?: React.ReactNode
}) {
  const unread = useUnreadNotifications()
  return (
    <header className="max-md:relative max-md:z-20 hidden max-md:h-[52px] max-md:shrink-0 max-md:items-center max-md:gap-2.5 max-md:bg-background max-md:pr-[9px] max-md:pl-1 max-md:flex">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open menu"
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
        className="focus-ring max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:text-foreground"
      >
        <MenuGlyph open={menuOpen} />
      </button>
      <Link
        href="/employee/dashboard"
        aria-label="UKTextiles Employee Portal - go to Home"
        className="focus-ring max-md:-ml-3 max-md:flex max-md:min-w-0 max-md:items-center max-md:gap-2.5 max-md:rounded-lg max-md:py-1"
      >
        <UktLogo className="max-md:h-7" />
        <span className="max-md:flex max-md:min-w-0 max-md:flex-col max-md:gap-px max-md:leading-none">
          <span className="font-display max-md:truncate max-md:text-[13px] max-md:leading-4 max-md:font-bold max-md:tracking-[0.2px] max-md:text-foreground">UKTEXTILES</span>
          <span className="max-md:truncate max-md:text-[8px] max-md:leading-[10px] max-md:font-bold max-md:tracking-[0.8px] max-md:text-muted-foreground">EMPLOYEE PORTAL</span>
        </span>
      </Link>
      <span className="max-md:flex-1" aria-hidden="true" />
      <Link
        href="/employee/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="focus-ring max-md:relative max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:text-foreground"
      >
        <Bell className="max-md:size-5" aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="max-md:absolute max-md:top-[11px] max-md:right-[11px] max-md:size-[7px] max-md:rounded-full max-md:bg-destructive max-md:ring-1 max-md:ring-background"
          />
        )}
      </Link>
      <Link
        href="/employee/profile"
        aria-label="My Profile"
        className="focus-ring max-md:-ml-3 max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full"
      >
        {/* The person's photo (owner 2026-11-25, the app's HeaderAvatarButton), initials without one, the glyph until the
            name is known. */}
        <span className="max-md:grid max-md:size-[34px] max-md:place-items-center max-md:rounded-full max-md:border-[1.5px] max-md:border-accent">
          <HeaderAvatar
            className="max-md:size-[30px]"
            fallbackClassName="max-md:bg-primary max-md:font-[family-name:var(--font-display)] max-md:text-[11.5px] max-md:font-bold max-md:tracking-[0.3px] max-md:text-primary-foreground"
            icon={<User className="max-md:size-[18px]" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />}
          />
        </span>
      </Link>
      {children}
    </header>
  )
}

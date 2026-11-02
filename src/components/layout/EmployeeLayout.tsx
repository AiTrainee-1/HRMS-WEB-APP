import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { ChevronRight, Menu } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useIsFetching } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SidebarNav } from './SidebarNav'
import { NotificationBell } from './NotificationBell'
import { PermissionNudgeBanner } from './PermissionNudgeBanner'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { findNav } from './nav-config'
import { useAuth } from '@/context/AuthContext'
import { useTodayAttendance } from '@/hooks/useTodayAttendance'
import { greetingFor } from '@/lib/relative-time'
import { WeaveBackground } from '@/components/kit/WeaveBackground'
import { ThreadProgress } from '@/components/kit/ThreadProgress'
import { fadeIn } from '@/components/kit/motion'
import { useIsPhone } from '@/hooks/useIsPhone'
import { cn } from '@/lib/utils'
import { MobileDrawer } from './mobile/MobileDrawer'
import { MobileTabBar } from './mobile/MobileTabBar'
import { MobileTopBar } from './mobile/MobileTopBar'

/** Context that exposes the main scroll container ref for parallax consumers */
export const MainScrollContext = React.createContext<React.RefObject<HTMLElement | null>>(
  React.createRef<HTMLElement>(),
)

const COLLAPSE_KEY = 'uktex.sidebarCollapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "Good morning, Priya" over "Friday, 31 October · Requests › Leave"; on phones just the page name. */
function Greeting() {
  const { user } = useAuth()
  const [location] = useLocation()
  const crumb = findNav(location)
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const first = (user?.name ?? '').trim().split(/\s+/)[0] ?? ''
  const name = first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : ''

  return (
    <div className="min-w-0 leading-tight">
      <p className="font-display hidden truncate text-[17px] font-semibold sm:block">
        {greetingFor(now)}
        {name && `, ${name}`}
      </p>
      <p className="truncate text-[15px] font-semibold sm:hidden">{crumb?.item.label ?? 'UKTextiles'}</p>
      <nav aria-label="Breadcrumb" className="mt-0.5 hidden min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground sm:flex">
        <span className="hidden lg:inline">
          {DAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
        </span>
        {crumb && (
          <>
            <span className="hidden lg:inline" aria-hidden="true">
              ·
            </span>
            <span>{crumb.group.heading}</span>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="truncate font-semibold text-brand-blue" aria-current="page">
              {crumb.item.label}
            </span>
          </>
        )}
      </nav>
    </div>
  )
}

/** "Punched IN 09:14 AM" pill, from today's own punches. */
function PunchPill() {
  const { last, isIn, isLoading } = useTodayAttendance()
  if (isLoading) return null
  return (
    <Link
      href="/employee/attendance"
      className="glass focus-ring hidden min-h-10 items-center gap-2 rounded-full py-1 pr-1 pl-3 text-[13px] font-semibold transition-shadow hover:shadow-[var(--glow-primary)] md:flex"
    >
      <span className={cn('pip', last ? (isIn ? 'text-success pip-live' : 'text-warning') : 'text-muted-foreground')} aria-hidden="true" />
      {last ? (
        <>
          <span>Punched {last.type}</span>
          <span className="font-label text-[12px] text-muted-foreground">{last.time}</span>
        </>
      ) : (
        <span className="text-muted-foreground">No punch today</span>
      )}
      <span
        className={cn(
          'label-caps rounded-full px-2.5 py-1',
          isIn ? 'bg-approved-bg text-approved' : 'bg-brand-gradient text-white',
        )}
      >
        {isIn ? 'IN' : 'OUT'}
      </span>
    </Link>
  )
}

/** A thread runs under the top bar while a page's first data is loading (not on background refreshes). */
function LoadingThread() {
  const loading = useIsFetching({ predicate: (q) => q.state.status === 'pending' })
  return (
    <AnimatePresence>
      {loading > 0 && (
        <motion.div
          key="thread"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="absolute inset-x-0 -bottom-px"
        >
          <ThreadProgress label="Loading this page" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  // The PHONE drawer (< 768px) is a separate one, like the mobile app's SideDrawer (layout/mobile/MobileDrawer).
  const [phoneMenuOpen, setPhoneMenuOpen] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(readCollapsed)
  const isPhone = useIsPhone()
  const mainRef = React.useRef<HTMLElement>(null)

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // Not fatal: the choice just will not be remembered.
      }
      return !c
    })
  }, [])

  // Crossing the 768px line closes the drawer that belongs to the other side of it (its opener is hidden there).
  React.useEffect(() => {
    if (isPhone) setDrawerOpen(false)
    else setPhoneMenuOpen(false)
  }, [isPhone])

  // A new page starts at the top (the scroll container is <main>, not the window).
  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [location])

  return (
    <TooltipProvider delayDuration={200}>
      {/* data-shell marks the signed-in shell: index.css scopes the phone skin to it (:root:has([data-shell='employee'])),
          so the sign-in pages keep their own look on phones. */}
      <div data-shell="employee" className="relative flex h-screen w-full overflow-hidden max-md:h-dvh">
        <a
          href="#main-content"
          className="focus-ring sr-only z-50 rounded-md bg-brand-gradient px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
        >
          Skip to content
        </a>

        <aside
          className={cn(
            'z-20 hidden shrink-0 flex-col border-r hairline bg-card/80 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex dark:bg-[#0a1122]/90',
            collapsed ? 'w-[76px]' : 'w-[272px]',
          )}
        >
          <SidebarNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </aside>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-[288px] max-w-[85vw] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav onNavigate={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>
        <MobileDrawer open={phoneMenuOpen} onOpenChange={setPhoneMenuOpen} />

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          {/* Phones (< 768px): the mobile app's top bar; the desktop header below is hidden there. */}
          <MobileTopBar menuOpen={phoneMenuOpen} onMenu={() => setPhoneMenuOpen(true)}>
            <LoadingThread />
          </MobileTopBar>
          <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b hairline bg-background/70 px-3 backdrop-blur-xl max-md:hidden sm:px-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="focus-ring grid size-11 shrink-0 place-items-center rounded-lg text-foreground/85 hover:bg-foreground/[0.06] lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
              <Greeting />
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <PunchPill />
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </div>
            <LoadingThread />
          </header>
          <PermissionNudgeBanner />
          <MainScrollContext.Provider value={mainRef}>
            <main id="main-content" ref={mainRef} tabIndex={-1} className="scrollbar-thin relative flex-1 overflow-x-hidden overflow-y-auto outline-none">
              <div className="relative min-h-full">
                {/* The LOOM field behind the top of every page (one canvas for the whole app; pages never add another). */}
                <WeaveBackground className="h-[440px] max-md:hidden" />
                <div className="relative px-4 py-6 max-md:pt-2 lg:px-8 lg:py-8">
                  <div className="mx-auto max-w-[1400px]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={location} variants={fadeIn} initial="hidden" animate="show" exit="exit">
                        {children}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </main>
          </MainScrollContext.Provider>
          {/* Phones: the mobile app's bottom tab bar (the column's last child, so <main> ends above it). */}
          <MobileTabBar />
        </div>
      </div>
    </TooltipProvider>
  )
}

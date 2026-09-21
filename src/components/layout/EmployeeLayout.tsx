import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { ChevronRight, Clock3, Menu } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SidebarNav } from './SidebarNav'
import { NotificationBell } from './NotificationBell'
import { PermissionNudgeBanner } from './PermissionNudgeBanner'
import { findNav } from './nav-config'
import { useAuth } from '@/context/AuthContext'
import { useTodayAttendance } from '@/hooks/useTodayAttendance'
import { useQuery } from '@tanstack/react-query'
import { employeeApi } from '@/api/resources'
import { cn } from '@/lib/utils'

/** Context that exposes the main scroll container ref for parallax consumers */
export const MainScrollContext = React.createContext<React.RefObject<HTMLElement | null>>(
  React.createRef<HTMLElement>(),
)

function LiveClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <span className="hidden items-center gap-2 text-[13px] font-medium text-foreground/85 xl:flex">
      <Clock3 className="size-4 text-muted-foreground" />
      {format(now, 'EEE, d MMM')} <span className="text-muted-foreground">•</span> {format(now, 'h:mm a')}
    </span>
  )
}

/** "Punched IN 09:14 AM" pill, from today's own punches. */
function PunchPill() {
  const { last, isIn, isLoading } = useTodayAttendance()
  if (isLoading) return null
  return (
    <Link
      href="/employee/attendance"
      className="glass hidden items-center gap-2 rounded-full py-1 pr-1 pl-3 text-[13px] font-semibold md:flex"
    >
      <span className={cn('pip', last ? (isIn ? 'text-success pip-live' : 'text-warning') : 'text-muted-foreground')} />
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
          isIn ? 'bg-success/15 text-success' : 'bg-brand-gradient text-white',
        )}
      >
        {isIn ? 'IN' : 'OUT'}
      </span>
    </Link>
  )
}

export function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [location] = useLocation()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const mainRef = React.useRef<HTMLElement>(null)
  const crumb = findNav(location)

  const profileQuery = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const initials = (user?.name ?? '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="relative flex h-screen w-full overflow-hidden">
      <aside className="z-20 hidden w-[272px] shrink-0 flex-col border-r hairline bg-card lg:flex dark:bg-[#0a1122]">
        <SidebarNav />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b hairline bg-background/70 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
              <Menu />
            </Button>
            <LiveClock />
            {crumb && (
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
                <span className="hidden text-muted-foreground sm:inline">{crumb.group.heading}</span>
                <ChevronRight className="hidden size-3.5 text-muted-foreground sm:inline" />
                <span className="truncate font-semibold text-brand-blue">{crumb.item.label}</span>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <PunchPill />
            <NotificationBell />
            <Link href="/employee/profile" className="flex items-center gap-2.5 rounded-md py-1 pr-1 pl-1 hover:bg-foreground/[0.05]">
              <span className="relative">
                <Avatar className="size-9 ring-1 ring-foreground/15">
                  {profileQuery.data?.photoUrl && <AvatarImage src={profileQuery.data.photoUrl} alt="" />}
                  <AvatarFallback className="bg-primary/15 text-[12px] font-bold text-brand-blue">{initials || 'EM'}</AvatarFallback>
                </Avatar>
                <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-background" />
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block max-w-40 truncate text-[13px] font-semibold">{user?.name}</span>
                <span className="block max-w-40 truncate text-[11px] text-muted-foreground">
                  {profileQuery.data?.employeeCode ?? 'Employee'}
                </span>
              </span>
            </Link>
          </div>
        </header>
        <PermissionNudgeBanner />
        <MainScrollContext.Provider value={mainRef}>
          <main ref={mainRef} className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1400px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </MainScrollContext.Provider>
      </div>
    </div>
  )
}

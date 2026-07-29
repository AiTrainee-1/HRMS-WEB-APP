import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import {
  Send, Timer, Wallet, Clock, PartyPopper, Radio, LogIn, LogOut, LayoutDashboard,
  CalendarCheck, MapPin, CalendarClock, Fingerprint, FolderOpen, FileStack,
  MessageCircle, Building2, Bell, UserRound, Navigation,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Reveal } from '@/components/employee/Reveal'
import { useAuth } from '@/context/AuthContext'
import { attendanceApi, dashboardApi, employeeApi, holidayApi, idCardApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { IdCardFront } from '@/components/idcard/IdCardViews'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const quickActions = [
  { label: 'Attendance', href: '/employee/attendance', icon: CalendarCheck },
  { label: 'Attendance Request', href: '/employee/attendance-request', icon: MapPin },
  { label: 'Permission', href: '/employee/permissions', icon: Timer },
  { label: 'Leave', href: '/employee/leave', icon: Send },
  { label: 'Casual Leave', href: '/employee/casual-leave', icon: CalendarClock },
  { label: 'Missing Punch', href: '/employee/missing-punch', icon: Fingerprint },
  { label: 'Salary', href: '/employee/salary', icon: Wallet },
  { label: 'Shift', href: '/employee/shift', icon: Clock },
  { label: 'Documents', href: '/employee/documents', icon: FolderOpen },
  { label: 'Holidays', href: '/employee/holidays', icon: PartyPopper },
  { label: 'Settlement', href: '/employee/settlement', icon: FileStack },
  { label: 'Chat', href: '/employee/chat', icon: MessageCircle },
  { label: 'Notifications', href: '/employee/notifications', icon: Bell },
  { label: 'Profile', href: '/employee/profile', icon: UserRound },
  { label: 'Company', href: '/employee/company', icon: Building2 },
]

export default function Dashboard() {
  const { user } = useAuth()
  const now = new Date()

  const profileQuery = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
  })

  const idCardQuery = useQuery({
    queryKey: ['idcard', user?.employeeId],
    queryFn: () => idCardApi.get(user!.employeeId),
    enabled: !!user,
    retry: 0,
  })

  const holidaysQuery = useQuery({
    queryKey: ['holidays', new Date().getFullYear()],
    queryFn: () => holidayApi.list(new Date().getFullYear()),
  })

  // Own punches today — same data the Attendance page already fetches for
  // the calendar, just filtered to today's date here.
  const attendanceQuery = useQuery({
    queryKey: ['attendance', user?.employeeId, now.getMonth() + 1, now.getFullYear()],
    queryFn: () => attendanceApi.monthly(user!.employeeId, now.getMonth() + 1, now.getFullYear()),
    enabled: !!user,
  })
  const todayStr = format(now, 'yyyy-MM-dd')
  const todayPunches = attendanceQuery.data?.records.find((r) => r.date === todayStr)?.punches ?? []

  // Self-scoped server-side (an employee token only ever sees their own
  // punches here) — so this is always the logged-in employee's own recent
  // in/out activity, not a company-wide feed.
  const liveFeedQuery = useQuery({
    queryKey: ['live-feed'],
    queryFn: async () => {
      try {
        return await dashboardApi.liveFeed(15)
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return { items: [] }
        throw err
      }
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  })

  const upcomingHoliday = holidaysQuery.data
    ?.filter((h) => h.date >= format(new Date(), 'yyyy-MM-dd'))
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  const employee = profileQuery.data
  const hasBranchLocation = employee?.branchLat != null && employee?.branchLng != null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
        icon={<LayoutDashboard />}
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((action, i) => (
            <Reveal key={action.href} index={i}>
              <Link href={action.href}>
                <Card className="shadow-clay-hover cursor-pointer">
                  <CardContent className="flex flex-col items-center gap-2 py-2">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-clay-sm">
                      <action.icon className="size-5" />
                    </div>
                    <span className="text-sm font-medium text-center">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Punches Today</CardTitle>
        </CardHeader>
        <CardContent>
          {todayPunches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No punches recorded yet today.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {todayPunches.map((p, i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                    p.type === 'IN' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
                  )}
                >
                  {p.type === 'IN' ? <LogIn className="size-3.5" /> : <LogOut className="size-3.5" />}
                  {p.time}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="size-4 text-primary" /> Live Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveFeedQuery.isLoading && <Skeleton className="h-24 w-full" />}
          {!liveFeedQuery.isLoading && (liveFeedQuery.data?.items.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">No recent punches yet today.</p>
          )}
          {(liveFeedQuery.data?.items.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2">
              {liveFeedQuery.data!.items.map((item, i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                    item.event === 'in' ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary',
                  )}
                >
                  {item.event === 'in' ? <LogIn className="size-3.5" /> : <LogOut className="size-3.5" />}
                  {item.event === 'in' ? 'Checked in' : 'Checked out'} at {item.time}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {hasBranchLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> Company Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{employee?.branchName ?? 'Your Branch'}</p>
                {employee?.branchAddress && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{employee.branchAddress}</p>
                )}
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${employee!.branchLat},${employee!.branchLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white shadow-clay-sm"
                aria-label="Get directions"
              >
                <Navigation className="size-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Digital ID Card</CardTitle>
          </CardHeader>
          <CardContent>
            {idCardQuery.isLoading && <Skeleton className="h-48 w-full" />}
            {idCardQuery.isError && <p className="text-sm text-muted-foreground">Couldn't load your ID card right now.</p>}
            {idCardQuery.data && (
              <Link href="/employee/id-card" className="inline-block">
                <IdCardFront data={idCardQuery.data} scale={0.75} />
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PartyPopper className="size-4" /> Upcoming Holiday
            </CardTitle>
          </CardHeader>
          <CardContent>
            {holidaysQuery.isLoading && <Skeleton className="h-16 w-full" />}
            {!holidaysQuery.isLoading && !upcomingHoliday && (
              <p className="text-sm text-muted-foreground">No upcoming holidays scheduled.</p>
            )}
            {upcomingHoliday && (
              <div>
                <p className="text-lg font-semibold">{upcomingHoliday.name}</p>
                <p className="text-muted-foreground text-sm">{format(parseISO(upcomingHoliday.date), 'EEEE, MMMM d, yyyy')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {profileQuery.isError && <p className="text-sm text-muted-foreground">Some dashboard widgets failed to load. Please refresh.</p>}
    </div>
  )
}

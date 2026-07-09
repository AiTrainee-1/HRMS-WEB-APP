import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { Send, Timer, Wallet, Clock, PartyPopper, Radio, LogIn, LogOut, LayoutDashboard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Reveal } from '@/components/employee/Reveal'
import { useAuth } from '@/context/AuthContext'
import { dashboardApi, employeeApi, holidayApi, idCardApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { IdCardFront } from '@/components/idcard/IdCardViews'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

const quickActions = [
  { label: 'Permission', href: '/employee/permissions', icon: Timer },
  { label: 'Leave', href: '/employee/leave', icon: Send },
  { label: 'Salary', href: '/employee/salary', icon: Wallet },
  { label: 'Shift', href: '/employee/shift', icon: Clock },
]

function StatCard({ label, value, loading }: { label: string; value: React.ReactNode; loading?: boolean }) {
  return (
    <Card>
      <CardContent className="py-1">
        <p className="text-muted-foreground text-xs">{label}</p>
        {loading ? <Skeleton className="mt-1 h-7 w-12" /> : <p className="mt-1 text-2xl font-bold">{value}</p>}
      </CardContent>
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()

  const profileQuery = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
  })

  const summaryQuery = useQuery({
    queryKey: ['mobile-home-summary'],
    queryFn: async () => {
      try {
        return await dashboardApi.mobileHomeSummary()
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null
        throw err
      }
    },
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
        icon={<LayoutDashboard />}
      />

      {summaryQuery.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Present Today" value={summaryQuery.data.presentToday} />
          <StatCard label="Absent Today" value={summaryQuery.data.absentToday} />
          <StatCard label="On Leave Today" value={summaryQuery.data.onLeaveToday} />
          <StatCard label="Pending Requests" value={summaryQuery.data.pendingRequestsCount} />
        </div>
      )}

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
                    <span className="text-sm font-medium">{action.label}</span>
                  </CardContent>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>

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
            <div className="flex flex-col divide-y">
              {liveFeedQuery.data!.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      item.event === 'in' ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary',
                    )}
                  >
                    {item.event === 'in' ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.employeeName}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.department}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.event === 'in' ? 'Punched in' : 'Punched out'} · {item.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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

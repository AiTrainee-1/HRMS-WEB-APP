import * as React from 'react'
import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowRight, BadgeCheck, CalendarCheck, CalendarClock, CalendarDays, CalendarX2, Clock, DoorOpen,
  Factory, FileSignature, FileStack, Fingerprint, FolderOpen, LayoutGrid, LogIn, LogOut, MapPin,
  Maximize2, MessageCircle, Navigation, PartyPopper, Send, ShieldCheck, Timer, Wallet,
} from 'lucide-react'
import { format, parseISO, differenceInCalendarDays, subDays } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Reveal } from '@/components/employee/Reveal'
import { useAuth } from '@/context/AuthContext'
import { casualLeaveApi, dashboardApi, employeeApi, holidayApi, idCardApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { verifyUrl } from '@/lib/verify'
import { useTodayAttendance } from '@/hooks/useTodayAttendance'
import { useMyShiftSummary } from '@/hooks/useMyShiftSummary'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { cn } from '@/lib/utils'
import type { AttendanceDay } from '@/types'

type Tile = { label: string; hint: string; href: string; icon: React.ComponentType<{ className?: string }> }

// The workflow hub mirrors the Stitch "Operations & Workflow Hub": three
// categories, each a row of tiles into real routes of this app.
const hub: { title: string; tone: string; tiles: Tile[] }[] = [
  {
    title: 'HR approvals & leave requests',
    tone: 'text-brand-blue',
    tiles: [
      { label: 'Apply Leave', hint: 'Leave requests', href: '/employee/leave', icon: Send },
      { label: 'Permission', hint: 'Short early-out / late-in', href: '/employee/permissions', icon: Timer },
      { label: 'Casual Leave', hint: 'Yearly CL balance', href: '/employee/casual-leave', icon: CalendarClock },
      { label: 'Missing Punch', hint: 'Regularization', href: '/employee/missing-punch', icon: Fingerprint },
      { label: 'Resignation', hint: 'Separation desk', href: '/employee/resignation', icon: FileSignature },
    ],
  },
  {
    title: 'Security, geo-fence & gate pass',
    tone: 'text-brand-emerald',
    tiles: [
      { label: 'Geo Punch', hint: 'GPS office check-in', href: '/employee/attendance-request', icon: MapPin },
      { label: 'Gate Outpass', hint: 'QR exit & return', href: '/employee/outpass', icon: DoorOpen },
      { label: 'My Shift', hint: 'Timings & deductions', href: '/employee/shift', icon: Clock },
      { label: 'Digital ID', hint: 'Verifiable ID card', href: '/employee/id-card', icon: BadgeCheck },
    ],
  },
  {
    title: 'Payroll, compensation & records',
    tone: 'text-brand-gold',
    tiles: [
      { label: 'Salary Slips', hint: 'Monthly payslips', href: '/employee/salary', icon: Wallet },
      { label: 'Advances', hint: 'Loans & settlement', href: '/employee/settlement', icon: FileStack },
      { label: 'Documents', hint: 'HR records', href: '/employee/documents', icon: FolderOpen },
      { label: 'Holidays', hint: 'Yearly calendar', href: '/employee/holidays', icon: PartyPopper },
    ],
  },
]

function greeting(d: Date) {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({
  eyebrow, title, value, unit, icon: Icon, tone, footer, progress,
}: {
  eyebrow: string
  title: string
  value: React.ReactNode
  unit?: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'blue' | 'emerald' | 'slate' | 'amber'
  footer?: React.ReactNode
  progress?: number
}) {
  const toneText = {
    blue: 'text-brand-blue',
    emerald: 'text-brand-emerald',
    slate: 'text-muted-foreground',
    amber: 'text-brand-gold',
  }[tone]
  const bar = { blue: 'bg-[#b4c5ff]', emerald: 'bg-emerald-400', slate: 'bg-slate-400', amber: 'bg-amber-400' }[tone]
  return (
    <div className="glass-raised flex h-full flex-col rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn('label-caps', tone === 'slate' ? 'text-muted-foreground' : toneText)}>{eyebrow}</p>
          <p className="mt-1 text-[17px] font-semibold">{title}</p>
        </div>
        <span className={cn('grid size-9 place-items-center rounded-md border hairline bg-foreground/[0.04]', toneText)}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="mt-5 flex items-end gap-3">
        <span className={cn('metric text-[44px] leading-none', tone === 'emerald' && 'text-brand-emerald', tone === 'amber' && 'text-brand-gold')}>
          {value}
        </span>
        {unit && <span className="pb-1 text-[15px] text-muted-foreground">{unit}</span>}
      </div>
      {footer && <div className="mt-3 text-[12.5px] text-muted-foreground">{footer}</div>}
      {progress != null && (
        <div className="mt-auto pt-4">
          <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
            <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

function dayDot(day: AttendanceDay | undefined) {
  if (!day) return 'bg-foreground/15'
  switch (day.status) {
    case 'present':
      return day.isLate ? 'bg-amber-400' : 'bg-emerald-400'
    case 'half_shift':
      return 'bg-amber-400'
    case 'absent':
      return 'bg-red-400'
    case 'on_leave':
      return 'bg-[#b4c5ff]'
    case 'holiday':
      return 'bg-violet-400'
    default:
      return 'bg-foreground/15'
  }
}

export default function Dashboard() {
  const { user } = useAuth()
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const { isManager, flags } = useManagerStatus()

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
    queryKey: ['holidays', year],
    queryFn: () => holidayApi.list(year),
  })
  const clQuery = useQuery({
    queryKey: ['cl-eligibility'],
    queryFn: casualLeaveApi.eligibility,
  })
  const shiftQuery = useMyShiftSummary(month, year)
  const attendance = useTodayAttendance()

  // Self-scoped server-side: always this employee's own recent in/out events.
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

  const employee = profileQuery.data
  const shift = shiftQuery.data?.assignedShift
  const records = attendance.data?.records ?? []
  const summary = attendance.data?.summary
  const todayStr = format(now, 'yyyy-MM-dd')

  // Working days so far this month: every elapsed day that isn't a holiday.
  const elapsed = records.filter((r) => r.date <= todayStr && r.status !== 'future' && r.status !== 'holiday')
  const workingDays = elapsed.length
  const presentDays = (summary?.present ?? 0) + (summary?.halfShift ?? 0) * 0.5
  const compliance = workingDays ? Math.round((presentDays / workingDays) * 100) : 0

  const upcomingHolidays = (holidaysQuery.data ?? [])
    .filter((h) => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2)

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(now, 6 - i)
    const key = format(d, 'yyyy-MM-dd')
    return { d, key, rec: records.find((r) => r.date === key) }
  })

  const firstName = user?.name?.split(' ')[0] ?? ''
  const initials = (user?.name ?? '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  const last = attendance.last
  const feed = liveFeedQuery.data?.items ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <Reveal index={0}>
        <section className="glass-raised relative overflow-hidden rounded-lg p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-24 right-1/4 size-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_minmax(320px,440px)] lg:items-center">
            <div className="min-w-0">
              <p className="label-caps flex flex-wrap items-center gap-2 text-brand-emerald">
                {shift?.name ?? 'General shift'}
                {employee?.employeeCode && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-foreground/80">{employee.employeeCode}</span>
                  </>
                )}
              </p>
              <h1 className="font-display mt-3 text-[38px] leading-[1.1] font-semibold tracking-tight sm:text-[50px]">
                {greeting(now)},
                <br />
                {firstName}
              </h1>
              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-foreground/80">
                <Factory className="size-4 text-brand-gold" />
                {[employee?.departmentName, employee?.branchName, shift ? `${shift.name} (${shift.startTime} – ${shift.endTime})` : null]
                  .filter(Boolean)
                  .join(' • ') || format(now, 'EEEE, d MMMM yyyy')}
              </p>
            </div>

            {/* Punch status panel */}
            <div className="glass flex flex-col gap-4 rounded-lg p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                {attendance.isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : last ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className={cn('pip pip-live', attendance.isIn ? 'text-success' : 'text-warning')} />
                      <p className="text-[15px] font-semibold">Punched {last.type} at</p>
                      <span className="chip chip-success ml-auto !px-2 !text-[10px]">Recorded</span>
                    </div>
                    <p className="metric mt-1 text-[30px] leading-none">{last.time}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                      <MapPin className="size-3.5" /> {last.sourceLabel || last.source}
                      {employee?.branchName ? ` • ${employee.branchName}` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-2 text-[15px] font-semibold">
                      <span className="pip text-muted-foreground" /> No punch yet today
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Biometric punches appear once the device syncs. Office geo-punch is available below.
                    </p>
                  </>
                )}
              </div>
              <Link
                href="/employee/attendance-request"
                className="bg-brand-gradient glow-primary font-label flex h-14 shrink-0 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-semibold text-white"
              >
                {attendance.isIn ? <LogOut className="size-5" /> : <LogIn className="size-5" />}
                Punch {attendance.isIn ? 'OUT' : 'IN'}
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── Month stats ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal index={1}>
          <StatCard
            eyebrow="Cycle schedule"
            title="Working Days"
            value={attendance.isLoading ? '–' : workingDays}
            unit="days"
            icon={CalendarDays}
            tone="blue"
            footer={`${format(new Date(year, month - 1, 1), 'MMM d')} – ${format(now, 'MMM d')}`}
            progress={records.length ? (workingDays / Math.max(1, records.filter((r) => r.status !== 'holiday').length)) * 100 : 0}
          />
        </Reveal>
        <Reveal index={2}>
          <StatCard
            eyebrow="Logged presence"
            title="Present Days"
            value={attendance.isLoading ? '–' : presentDays}
            unit="days"
            icon={ShieldCheck}
            tone="emerald"
            footer={
              <span className="chip chip-success">
                {compliance}% attendance{summary?.late ? ` • ${summary.late} late` : ''}
              </span>
            }
            progress={compliance}
          />
        </Reveal>
        <Reveal index={3}>
          <StatCard
            eyebrow="Truancy & absences"
            title="Absent Days"
            value={attendance.isLoading ? '–' : summary?.absent ?? 0}
            unit="days"
            icon={CalendarX2}
            tone="slate"
            footer={
              (summary?.absent ?? 0) === 0 ? (
                <span className="chip chip-info">Clean record</span>
              ) : (
                <Link href="/employee/missing-punch" className="text-brand-blue hover:underline">
                  Missing a punch? Regularize →
                </Link>
              )
            }
          />
        </Reveal>
        <Reveal index={4}>
          <StatCard
            eyebrow="Authorized leaves"
            title="Leave & Casual"
            value={summary?.onLeave ?? 0}
            unit={`days this month`}
            icon={CalendarCheck}
            tone="amber"
            footer={
              clQuery.data?.remainingThisYear != null ? (
                <span>
                  <span className="font-semibold text-foreground">{clQuery.data.remainingThisYear}</span> CL remaining of{' '}
                  {clQuery.data.yearlyEntitlement ?? '—'} this year
                </span>
              ) : (
                'Leave taken in the current month'
              )
            }
          />
        </Reveal>
      </div>

      {/* ── Live activity ticker ───────────────────────────────────────── */}
      <div className="glass flex items-center gap-4 overflow-hidden rounded-lg px-5 py-3">
        <span className="label-caps flex shrink-0 items-center gap-2 text-brand-emerald">
          <span className="pip pip-live" /> Live feed
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
          {feed.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">
              {liveFeedQuery.isLoading ? 'Loading recent activity…' : 'No punch activity recorded yet today.'}
            </p>
          ) : (
            <div className={cn('flex w-max gap-10', feed.length > 2 && 'marquee')}>
              {(feed.length > 2 ? [...feed, ...feed] : feed).map((item, i) => (
                <span key={i} className="flex items-center gap-2 text-[13.5px] whitespace-nowrap">
                  <span className="font-semibold">{item.employeeName}</span>
                  {item.department && <span className="text-muted-foreground">({item.department})</span>}
                  <span className={item.event === 'in' ? 'text-brand-emerald' : 'text-brand-gold'}>
                    {item.event === 'in' ? 'IN' : 'OUT'} @ {item.time}
                  </span>
                  <span className="text-muted-foreground">•</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">
          <section className="glass-raised rounded-lg p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display flex items-center gap-2.5 text-[22px] font-semibold">
                <Timer className="size-5 text-brand-blue" /> My Punches Today
              </h2>
              {shift && (
                <span className="label-caps text-muted-foreground">
                  Shift {shift.startTime} – {shift.endTime}
                </span>
              )}
            </div>
            {attendance.isLoading ? (
              <Skeleton className="mt-5 h-24 w-full" />
            ) : attendance.punches.length === 0 ? (
              <p className="mt-5 rounded-md border border-dashed hairline px-4 py-6 text-center text-sm text-muted-foreground">
                No punches recorded yet today.
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                {attendance.punches.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-md border-l-[3px] bg-foreground/[0.04] p-4',
                      p.type === 'IN' ? 'border-l-emerald-400' : 'border-l-[#b4c5ff]',
                    )}
                  >
                    <p className="label-caps text-muted-foreground">
                      Punch {i + 1} • {p.type === 'IN' ? 'Check-in' : 'Check-out'}
                    </p>
                    <p className="font-label mt-2 text-[22px] font-semibold tabular-nums">{p.time}</p>
                    <p className={cn('mt-1 text-[13px]', p.type === 'IN' ? 'text-brand-emerald' : 'text-brand-blue')}>
                      {p.sourceLabel || p.source}
                    </p>
                  </div>
                ))}
                {shift && attendance.isIn && (
                  <div className="rounded-md border-l-[3px] border-l-slate-500 bg-foreground/[0.04] p-4">
                    <p className="label-caps text-muted-foreground">Scheduled departure</p>
                    <p className="font-label mt-2 text-[22px] font-semibold tabular-nums">{shift.endTime}</p>
                    <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
                      <Clock className="size-3.5" /> End of shift
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display flex items-center gap-2.5 text-[22px] font-semibold">
                <LayoutGrid className="size-5 text-brand-blue" /> Operations & Workflow Hub
              </h2>
              {isManager && (
                <Link
                  href="/employee/approvals"
                  className="font-label flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[13px] font-semibold text-brand-gold hover:bg-amber-500/20"
                >
                  Manager approvals
                  {(flags?.pendingApprovalsCount ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-[#2a1700]">
                      {flags!.pendingApprovalsCount}
                    </span>
                  )}
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-4">
              {hub.map((cat, ci) => (
                <div key={cat.title} className="glass rounded-lg p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className={cn('font-label text-[14px] font-bold tracking-[0.06em] uppercase', cat.tone)}>{cat.title}</h3>
                    <span className="label-caps text-muted-foreground">Category 0{ci + 1}</span>
                  </div>
                  <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', cat.tiles.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
                    {cat.tiles.map((t) => (
                      <Link
                        key={t.href}
                        href={t.href}
                        className="group flex flex-col items-center gap-2 rounded-md border hairline bg-foreground/[0.03] px-3 py-5 text-center transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.08]"
                      >
                        <t.icon className={cn('size-6 transition-transform group-hover:scale-110', cat.tone)} />
                        <span className="text-[15px] leading-tight font-semibold">{t.label}</span>
                        <span className="text-[12px] leading-tight text-muted-foreground">{t.hint}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Right rail ─────────────────────────────────────────────── */}
        <aside className="flex flex-col gap-6">
          {/* Digital identity pass */}
          <section className="glass-raised rounded-lg p-5">
            <div className="flex items-center justify-between">
              <p className="label-caps flex items-center gap-2 text-foreground/85">
                <BadgeCheck className="size-4 text-brand-blue" /> Digital identity pass
              </p>
              {idCardQuery.data?.status && (
                <span className="chip chip-success !text-[10px] uppercase">{idCardQuery.data.status}</span>
              )}
            </div>
            {idCardQuery.isLoading ? (
              <Skeleton className="mt-4 h-40 w-full" />
            ) : (
              <>
                <div className="mt-4 flex items-center gap-4">
                  <Avatar className="size-16 rounded-md ring-1 ring-foreground/15">
                    {(idCardQuery.data?.photoUrl || employee?.photoUrl) && (
                      <AvatarImage src={idCardQuery.data?.photoUrl || employee?.photoUrl} alt="" className="object-cover" />
                    )}
                    <AvatarFallback className="rounded-md bg-primary/15 text-lg font-bold text-brand-blue">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold">{idCardQuery.data?.name ?? user?.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {idCardQuery.data?.designation ?? employee?.designationTitle}
                    </p>
                    <p className="font-label mt-0.5 text-[12px] font-bold text-brand-blue">
                      ID: {idCardQuery.data?.code ?? employee?.employeeCode}
                    </p>
                  </div>
                </div>
                {idCardQuery.data?.code && (
                  <div className="mt-4 flex items-center gap-4 rounded-md bg-[#060e20] p-4 text-[#dae2fd]">
                    <div className="min-w-0 flex-1">
                      <p className="label-caps text-[#94a3b8]">Scan to verify</p>
                      <p className="mt-1 text-[14px] font-semibold">Security gates & reception</p>
                      <p className="mt-1 text-[12px] text-[#4edea3]">Verifiable employee credential</p>
                    </div>
                    <div className="rounded bg-white p-1.5">
                      <QRCodeSVG value={verifyUrl(idCardQuery.data.code)} size={64} fgColor="#0f172a" bgColor="#ffffff" />
                    </div>
                  </div>
                )}
                <Link
                  href="/employee/id-card"
                  className="font-label mt-3 flex items-center justify-center gap-2 rounded-md border hairline bg-foreground/[0.04] py-2 text-[13.5px] font-semibold hover:border-primary/50"
                >
                  <Maximize2 className="size-4" /> Expand digital pass
                </Link>
              </>
            )}
          </section>

          {/* 7-day trajectory */}
          <section className="glass-raised rounded-lg p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[17px] font-semibold">Recent 7-day trajectory</h3>
              <Link href="/employee/attendance" className="label-caps text-brand-emerald hover:underline">
                Calendar
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {last7.map(({ d, key, rec }) => {
                const isToday = key === todayStr
                return (
                  <div
                    key={key}
                    title={rec ? rec.status.replace('_', ' ') : 'No record'}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-md py-2',
                      isToday ? 'border border-primary/60 bg-primary/15' : 'bg-foreground/[0.04]',
                    )}
                  >
                    <span className={cn('label-caps !text-[9.5px]', isToday ? 'text-foreground' : 'text-muted-foreground')}>
                      {format(d, 'EEE')}
                    </span>
                    <span className={cn('size-2.5 rounded-full', dayDot(rec))} />
                    <span className={cn('text-[11px]', isToday ? 'font-bold text-brand-blue' : 'text-muted-foreground')}>
                      {isToday ? 'Today' : format(d, 'd')}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-400" /> Present</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-400" /> Late / half</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-red-400" /> Absent</span>
              <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-[#b4c5ff]" /> Leave</span>
            </div>
          </section>

          {/* Upcoming holidays */}
          <section className="glass-raised rounded-lg p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[17px] font-semibold">
                <PartyPopper className="size-[18px] text-brand-gold" /> Upcoming Holidays
              </h3>
              <Link href="/employee/holidays" className="label-caps text-foreground/80 hover:text-foreground">
                Full schedule
              </Link>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {holidaysQuery.isLoading && <Skeleton className="h-20 w-full" />}
              {!holidaysQuery.isLoading && upcomingHolidays.length === 0 && (
                <p className="text-sm text-muted-foreground">No upcoming holidays scheduled.</p>
              )}
              {upcomingHolidays.map((h) => {
                const date = parseISO(h.date)
                const days = differenceInCalendarDays(date, now)
                return (
                  <div key={h.id} className="flex items-center gap-3 rounded-md bg-foreground/[0.04] p-3">
                    <div className="grid w-12 shrink-0 place-items-center rounded bg-amber-500/10 py-1.5 text-center">
                      <span className="label-caps text-brand-gold">{format(date, 'MMM')}</span>
                      <span className="metric text-[22px] leading-none text-brand-gold">{format(date, 'd')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold">{h.name}</p>
                      <p className="text-[12px] text-muted-foreground capitalize">{h.holidayType} holiday</p>
                    </div>
                    <span className="label-caps shrink-0 rounded bg-foreground/[0.06] px-2 py-1 text-foreground/80">
                      {days === 0 ? 'Today' : `${days} days`}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Branch location */}
          {employee?.branchLat != null && employee?.branchLng != null && (
            <section className="glass flex items-center gap-3 rounded-lg p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-brand-blue">
                <MapPin className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{employee.branchName ?? 'Your branch'}</p>
                {employee.branchAddress && <p className="line-clamp-1 text-[12px] text-muted-foreground">{employee.branchAddress}</p>}
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${employee.branchLat},${employee.branchLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-label flex shrink-0 items-center gap-1.5 rounded-md border hairline px-3 py-1.5 text-[13px] font-semibold text-brand-blue hover:border-primary/50"
              >
                <Navigation className="size-3.5" /> Directions
              </a>
            </section>
          )}

          <Link
            href="/employee/chat"
            className="glass flex items-center gap-3 rounded-lg p-4 transition hover:border-primary/40"
          >
            <MessageCircle className="size-5 text-brand-blue" />
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">Team Chat</span>
              <span className="block text-[12px] text-muted-foreground">Message your department</span>
            </span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        </aside>
      </div>

      {profileQuery.isError && (
        <p className="text-sm text-muted-foreground">Some dashboard widgets failed to load. Please refresh.</p>
      )}
    </div>
  )
}

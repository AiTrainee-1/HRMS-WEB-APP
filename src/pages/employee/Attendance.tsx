import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearch } from 'wouter'
import {
  AlertTriangle, BarChart3, Briefcase, CalendarCheck, CalendarDays, CalendarHeart, CalendarX2, ChevronRight, Clock, Navigation, ShieldCheck,
  Timer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ErrorState, GlassCard, KpiTile, PageHero, PageShell, RingMeter, SectionHeader, SkeletonBlock, StatusPill,
} from '@/components/kit'
import { MonthYearPicker, PhoneMonthBar } from '@/components/employee/MonthYearPicker'
import { AttendanceCalendarGrid } from '@/components/employee/AttendanceCalendarGrid'
import { AttendanceTrendChart } from '@/components/employee/AttendanceTrendChart'
import { DayDetailPanel } from '@/components/employee/DayDetailPanel'
import { GeoPunchCard } from '@/components/employee/GeoPunchCard'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { attendanceApi, casualLeaveApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useMyShiftSummary } from '@/hooks/useMyShiftSummary'
import { useAttendanceSyncStatus } from '@/hooks/useGeoAttendance'
import { useGeoStatusOnce } from '@/hooks/useHomeSources'
import { useEmploymentType } from '@/hooks/useEmploymentType'
import {
  countEarlyOuts, earlyOutShown, getDayMarkers, halfDayRule, hasCompensationKeys, hasCurrentPermissionFlags, lateInShown,
} from '@/lib/attendance-flags'
import { balanceBreakdown, balanceLine, isCasualLeaveEligible, readBalance } from '@/lib/casual-leave'
import { readFocusParams } from '@/lib/focus-item'
import { dayText } from '@/lib/my-requests'
import { to12h } from '@/lib/home-punches'
import { dateKey, dayCountText, monthSnapshot } from '@/lib/home-attention'
import { cn } from '@/lib/utils'
import type { AttendanceDay } from '@/types'

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Attendance() {
  const { user } = useAuth()
  const now = new Date()
  // A link (a notification about a day: late, absent, an attendance change) may name the day: ?date=YYYY-MM-DD opens
  // its month and that day's details.
  const search = useSearch()
  const focusDate = React.useMemo(() => readFocusParams(search).date, [search])
  const [month, setMonth] = React.useState(() => (focusDate ? Number(focusDate.slice(5, 7)) : now.getMonth() + 1))
  const [year, setYear] = React.useState(() => (focusDate ? Number(focusDate.slice(0, 4)) : now.getFullYear()))
  const [selectedDay, setSelectedDay] = React.useState<AttendanceDay | null>(null)
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  React.useEffect(() => {
    if (!focusDate) return
    setMonth(Number(focusDate.slice(5, 7)))
    setYear(Number(focusDate.slice(0, 4)))
  }, [focusDate])

  // Same key as the top bar and the Dashboard (hooks/useTodayAttendance.ts), so this month is already loaded.
  const monthQuery = useQuery({
    queryKey: ['attendance', user?.employeeId, month, year],
    queryFn: () => attendanceApi.monthly(user!.employeeId, month, year),
    enabled: !!user,
  })
  const { data } = monthQuery
  const focusMonthShown = !!focusDate && month === Number(focusDate.slice(5, 7)) && year === Number(focusDate.slice(0, 4))
  const focus = useFocusItem({
    scope: 'attendance',
    rows: focusMonthShown ? data?.records : undefined,
    idOf: (d) => d.date,
    dateOf: (d) => d.date,
    highlight: false,
    reveal: setSelectedDay,
  })

  const { data: shiftSummary } = useMyShiftSummary(month, year)
  const { data: syncStatus } = useAttendanceSyncStatus()
  // Compensation is for staff: the calendar's compensation legend is listed for a staff employee on a backend that sends
  // the day markers (a production employee, or an older backend, has nothing to explain).
  const { isStaff } = useEmploymentType()
  const showCompensationLegend = isStaff && hasCompensationKeys(data?.records ?? [])
  const { data: eligibility } = useQuery({
    queryKey: ['cl-eligibility', user?.employeeId],
    queryFn: () => casualLeaveApi.eligibility(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const summary = data?.summary
  const clEligible = eligibility ? isCasualLeaveEligible(eligibility) : false
  // 2026-11-02: the Casual Leave yearly balance (12 a year, resets on 1 Jan); null on an older server.
  const clBalance = eligibility && eligibility.rule !== 'one_per_month' ? readBalance(eligibility.balance) : null
  const policy = shiftSummary?.policy ?? null
  const showLateIn = lateInShown(policy)
  const earlyOutCount = countEarlyOuts(data?.records ?? [])
  const showEarlyOut = earlyOutCount != null && earlyOutShown(policy)
  const newRules = hasCurrentPermissionFlags(data?.records ?? [])
  const halfRule = halfDayRule(policy)
  const rulesNote = [
    showLateIn ? 'Late-In: your first punch is after shift start plus grace.' : null,
    earlyOutShown(policy)
      ? `Early Out: your last punch is before shift end minus grace${policy?.eveningEarlyOutEnabled ? '' : ' (when your company checks it)'}.`
      : null,
    halfRule
      ? `Half-day rule: ${halfRule.morning}. ${halfRule.evening}. ${halfRule.outcome}.`
      : 'Half Day: a punch in only one of the two halves of the day (before First Half End, or at/after Second Half Start); both halves is a full day, neither is absent.',
    "An Allowed permission moves that day's start or end by 60 minutes; an Overdue / Excess one does not, and counts toward late deductions.",
  ].filter(Boolean).join(' ')

  const value = (n: number | undefined) => (monthQuery.isPending || monthQuery.isError ? null : (n ?? 0))
  const flaggedHint = [
    showLateIn && summary ? `${summary.late} late` : null,
    showEarlyOut ? `${earlyOutCount} early` : null,
  ].filter(Boolean).join(' · ')
  const shift = shiftSummary?.assignedShift
  // Days with a Late-In or an Early Out shown (a day with both counts once).
  const flaggedDays = (data?.records ?? []).filter((r) =>
    getDayMarkers(r, policy).some((m) => (m.key === 'late' && showLateIn) || (m.key === 'earlyOut' && showEarlyOut)),
  ).length

  // Phone-only figures (the app's six stat cards): working days so far, from the same month records.
  const working = monthSnapshot(data?.records, dateKey(now)).workingDays
  const presentPct = working > 0 && summary ? Math.round((summary.present / working) * 100) : 0
  const loadingMonth = monthQuery.isPending
  const changeMonth = (m: number, y: number) => {
    setMonth(m)
    setYear(y)
  }

  return (
    <>
      {/* Phones (< 768px): the mobile app's Attendance tab (app/(tabs)/attendance.tsx, kit/MOBILE.md) - month card with
          the sync pill, geo-punch row, shift banner, six stat cards, Casual Leave status, Monthly Overview, then the
          calendar in the app's colours. PageShell's gap is off on phones; every block carries the app's 14px spacing. */}
      <PageShell width="wide" className="max-md:gap-0">
        <>
          <PageHero
            className="max-md:hidden"
            icon={<CalendarCheck />}
            title="Attendance"
            subtitle="Your days and punches, month by month. Click a day to see its punches."
            actions={<MonthYearPicker className="max-md:hidden" month={month} year={year} onChange={changeMonth} />}
            kpis={
              <>
                <KpiTile
                  label="Present"
                  value={value(summary?.present)}
                  unit="days"
                  icon={ShieldCheck}
                  tone="emerald"
                  hint={summary?.halfShift ? `plus ${summary.halfShift} half ${summary.halfShift === 1 ? 'day' : 'days'}` : 'full days'}
                />
                <KpiTile label="Absent" value={value(summary?.absent)} unit="days" icon={CalendarX2} tone="rose" hint={`in ${MONTH[month - 1]}`} />
                <KpiTile label="On leave" value={value(summary?.onLeave)} unit="days" icon={CalendarDays} tone="sapphire" hint="approved leave" />
                {showLateIn || showEarlyOut ? (
                  <KpiTile
                    label="Days flagged"
                    value={value(flaggedDays)}
                    unit="days"
                    icon={Timer}
                    tone="amber"
                    hint={flaggedHint || 'late or early'}
                    href="/employee/shift"
                  />
                ) : (
                  <KpiTile label="Half days" value={value(summary?.halfShift)} unit="days" icon={Timer} tone="amber" hint="a punch in only one half" />
                )}
              </>
            }
          >
            {shift && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock className="size-4 text-info" aria-hidden="true" /> {shift.name}
                </span>
                <span className="tabular-nums">{to12h(shift.startTime)} – {to12h(shift.endTime)}</span>
                <span>{shift.gracePeriodMinutes} min grace</span>
              </p>
            )}
          </PageHero>
          {/* The app's Attendance tab has no title row (the tab bar names it): the heading is for screen readers only. */}
          <h1 className="hidden max-md:block max-md:sr-only">Attendance</h1>
          <PhoneMonthBar
            className="max-md:mb-3.5"
            month={month}
            year={year}
            onChange={changeMonth}
            trailing={
              <span
                className={cn(
                  'max-md:flex max-md:shrink-0 max-md:items-center max-md:gap-[5px] max-md:rounded-full max-md:px-[9px] max-md:py-[5px] max-md:text-[10.5px] max-md:font-bold',
                  syncStatus?.pendingSync && isCurrentMonth ? 'max-md:bg-waiting-bg max-md:text-waiting' : 'max-md:bg-approved-bg max-md:text-approved',
                )}
              >
                <span aria-hidden="true" className="max-md:size-1.5 max-md:rounded-full max-md:bg-current" />
                {syncStatus?.pendingSync && isCurrentMonth ? 'Pending Sync' : 'Synced'}
              </span>
            }
          />
        </>

        {focus.missing && focus.requested && (
          <FocusMissNote className="max-md:mb-3.5" onDismiss={focus.dismiss}>
            There is no attendance record for {dayText(focus.requested)} yet.
          </FocusMissNote>
        )}

        {isCurrentMonth && (
          <>
            <div className="max-md:hidden">
              <GeoPunchCard />
            </div>
            <PhoneGeoRow />
          </>
        )}

        {syncStatus?.pendingSync && isCurrentMonth && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-waiting-border bg-waiting-bg p-4 text-sm text-waiting max-md:mb-3.5 max-md:border-0 max-md:p-3 max-md:text-[12px]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Today may not be complete yet: the biometric punches have not synced. It updates by itself after the next sync.
            </p>
          </div>
        )}

        <>
          {/* Phone-only: shift banner, the six stat cards, Casual Leave status. */}
          {shift && (
            <Link
              href="/employee/shift"
              className="focus-ring hidden max-md:mb-3.5 max-md:flex max-md:items-center max-md:gap-2.5 max-md:rounded-xl max-md:bg-accent max-md:p-3 max-md:active:opacity-85"
            >
              <span aria-hidden="true" className="max-md:grid max-md:size-[30px] max-md:shrink-0 max-md:place-items-center max-md:rounded-[9px] max-md:bg-card max-md:text-primary">
                <Clock className="max-md:size-4" />
              </span>
              <span className="max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">
                <span className="max-md:text-[12.5px] max-md:font-semibold max-md:text-foreground">Shift: {shift.name}</span>
                {'  '}
                {shift.startTime.slice(0, 5)} – {shift.endTime.slice(0, 5)} · Grace Period: {shift.gracePeriodMinutes} mins
              </span>
            </Link>
          )}
          {monthQuery.isError ? null : loadingMonth ? (
            <SkeletonBlock className="hidden max-md:mb-3.5 max-md:block max-md:h-[180px] max-md:rounded-xl" />
          ) : (
            <dl className="hidden max-md:mb-3.5 max-md:grid max-md:grid-cols-3 max-md:gap-2">
              {[
                { key: 'working', label: 'Working', value: working, unit: 'days', dot: 'max-md:bg-muted-foreground', badge: null, tone: '' },
                { key: 'present', label: 'Present', value: summary?.present ?? 0, dot: 'max-md:bg-[#16A34A]', badge: `${presentPct}%`, tone: 'max-md:bg-approved-bg max-md:text-approved' },
                {
                  key: 'absent',
                  label: 'Absent',
                  value: summary?.absent ?? 0,
                  dot: 'max-md:bg-[#DC2626]',
                  badge: summary?.absent ? `${summary.absent} ${summary.absent === 1 ? 'day' : 'days'}` : null,
                  tone: 'max-md:bg-rejected-bg max-md:text-rejected',
                },
                ...(showLateIn
                  ? [{ key: 'late', label: 'Late-In', value: summary?.late ?? 0, dot: 'max-md:bg-[#D97706]', badge: summary?.late ? 'Alert' : null, tone: 'max-md:bg-waiting-bg max-md:text-waiting' }]
                  : []),
                { key: 'half', label: 'Half Day', value: summary?.halfShift ?? 0, dot: 'max-md:bg-[#EA580C]', badge: null, tone: '' },
                { key: 'leave', label: 'Leave', value: summary?.onLeave ?? 0, dot: 'max-md:bg-[#7C3AED]', badge: summary?.onLeave ? 'Approved' : null, tone: 'max-md:bg-info-bg max-md:text-info' },
              ].map((c) => (
                <div
                  key={c.key}
                  className="max-md:flex max-md:min-w-0 max-md:flex-col max-md:gap-1.5 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-2.5 max-md:shadow-[var(--m-shadow-low)]"
                >
                  <dt className="max-md:flex max-md:items-center max-md:gap-[5px] max-md:text-[10.5px] max-md:font-semibold max-md:text-muted-foreground">
                    <span aria-hidden="true" className={cn('max-md:size-1.5 max-md:shrink-0 max-md:rounded-full', c.dot)} />
                    <span className="max-md:truncate">{c.label}</span>
                  </dt>
                  <dd className="max-md:flex max-md:flex-col max-md:gap-1.5">
                    <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-6 max-md:font-bold max-md:tabular-nums">
                      {dayCountText(c.value)}
                      {c.unit && <span className="max-md:ml-1 max-md:font-sans max-md:text-[10px] max-md:font-semibold max-md:text-muted-foreground">{c.unit}</span>}
                    </span>
                    {c.badge ? (
                      <span className={cn('max-md:self-start max-md:rounded-full max-md:px-[7px] max-md:py-0.5 max-md:text-[9.5px] max-md:font-[800]', c.tone)}>{c.badge}</span>
                    ) : (
                      <span className="max-md:text-[11px] max-md:leading-4 max-md:font-bold max-md:text-input" aria-hidden="true">—</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {eligibility && (
            <Link
              href="/employee/casual-leave"
              className="focus-ring hidden max-md:mb-3.5 max-md:flex max-md:items-center max-md:gap-3 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)] max-md:active:opacity-85"
            >
              <span aria-hidden="true" className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-approved-bg max-md:text-approved">
                <ShieldCheck className="max-md:size-[18px]" />
              </span>
              <span className="max-md:min-w-0 max-md:flex-1">
                <span className="max-md:flex max-md:items-center max-md:gap-2">
                  <span className="max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[14px] max-md:font-semibold max-md:text-foreground">Casual Leave Status</span>
                  <span
                    className={cn(
                      'max-md:shrink-0 max-md:rounded-full max-md:px-2 max-md:py-0.5 max-md:text-[9.5px] max-md:font-[800]',
                      clEligible ? 'max-md:bg-approved-bg max-md:text-approved' : 'max-md:bg-rejected-bg max-md:text-rejected',
                    )}
                  >
                    {clEligible ? 'Eligible' : 'Not Eligible'}
                  </span>
                </span>
                <span className="max-md:mt-[3px] max-md:block max-md:truncate max-md:text-[11.5px] max-md:text-muted-foreground">
                  {clEligible && clBalance?.tracked
                    ? balanceLine(clBalance)
                    : clEligible && eligibility.yearlyEntitlement != null
                      ? `${dayCountText(eligibility.remainingThisYear ?? 0)} Remaining of ${eligibility.yearlyEntitlement} yearly entitlement`
                      : (eligibility.reason ?? 'Not eligible this period')}
                </span>
              </span>
              <ChevronRight className="max-md:size-[18px] max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
            </Link>
          )}

          {monthQuery.isError ? (
            <ErrorState error={monthQuery.error} what={`your attendance for ${MONTH[month - 1]}`} onRetry={() => monthQuery.refetch()} retrying={monthQuery.isFetching} />
          ) : (
            <div className="grid gap-6 max-md:gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <GlassCard variant="raised" padding="lg" className="flex flex-col gap-4 max-md:gap-3 max-md:p-4! max-md:shadow-[var(--m-shadow-low)]!">
                <SectionHeader
                  as="h2"
                  icon={CalendarDays}
                  title={`${MONTH[month - 1]} ${year}`}
                  description="Each day's colour is its status (indigo: edited by HR); dots mark late, early and permissions; ! marks a day HR changed."
                  className="max-md:hidden"
                />
                <div className="hidden max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-2">
                  <h2 className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold">Attendance Calendar</h2>
                  <span className="max-md:text-[12px] max-md:font-bold max-md:text-primary">
                    {MONTH[month - 1]} {year}
                  </span>
                </div>
                {monthQuery.isPending ? (
                  <div className="grid grid-cols-7 gap-1.5" aria-label="Loading the calendar" role="status">
                    {Array.from({ length: 35 }, (_, i) => (
                      <SkeletonBlock key={i} className="aspect-square rounded-lg" />
                    ))}
                  </div>
                ) : (
                  <AttendanceCalendarGrid
                    month={month}
                    year={year}
                    days={data?.records ?? []}
                    onSelectDay={setSelectedDay}
                    policy={policy}
                    showCompensationLegend={showCompensationLegend}
                  />
                )}
                {newRules && <p className="text-[12px] leading-5 text-muted-foreground max-md:text-[11.5px] max-md:leading-4">{rulesNote}</p>}
              </GlassCard>

              <div className="flex min-w-0 flex-col gap-6 max-md:order-first max-md:gap-3.5">
                <GlassCard padding="lg" className="flex flex-col gap-4 max-md:gap-3 max-md:p-4!">
                  <SectionHeader
                    as="h2"
                    icon={BarChart3}
                    title="The month at a glance"
                    description="Tall bar: present. Half: half day. Short: absent."
                    className="max-md:hidden"
                  />
                  <div className="hidden max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-2">
                    <h2 className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold">Monthly Overview</h2>
                    <span className="max-md:text-[11px] max-md:font-semibold max-md:text-muted-foreground">
                      {MONTH[month - 1]} {year}
                    </span>
                  </div>
                  <p className="hidden max-md:block max-md:-mt-1.5 max-md:text-[11.5px] max-md:text-muted-foreground">Tall bar: present. Half: half day. Short: absent.</p>
                  {monthQuery.isPending ? <SkeletonBlock className="h-24 w-full" /> : <AttendanceTrendChart records={data?.records ?? []} policy={policy} />}
                </GlassCard>

                {eligibility && (
                  <GlassCard padding="lg" className="flex flex-col gap-4 max-md:hidden">
                    <SectionHeader
                      as="h2"
                      icon={CalendarHeart}
                      tone="violet"
                      title="Casual Leave"
                      action={<StatusPill tone={clEligible ? 'approved' : 'neutral'} size="sm">{clEligible ? 'You can apply' : 'Not available now'}</StatusPill>}
                    />
                    {eligibility.yearlyEntitlement != null ? (
                      <div className="flex items-center gap-5">
                        <RingMeter
                          // The yearly balance: the ring fills with what is taken or waiting (both hold days).
                          value={clBalance?.tracked ? clBalance.used + clBalance.pending : (eligibility.usedThisYear ?? 0)}
                          max={eligibility.yearlyEntitlement}
                          tone="violet"
                          size={96}
                          label={clBalance?.tracked ? balanceLine(clBalance) : `Casual Leave used in ${eligibility.year ?? year}`}
                        >
                          <span className="metric text-2xl leading-none">{dayCountText(eligibility.remainingThisYear ?? 0)}</span>
                          <span className="text-[11px] text-muted-foreground">left</span>
                        </RingMeter>
                        <dl className="grid flex-1 grid-cols-3 gap-2 text-center">
                          <div>
                            <dt className="label-caps text-muted-foreground">Yearly</dt>
                            <dd className="metric text-lg">{eligibility.yearlyEntitlement}</dd>
                          </div>
                          <div>
                            <dt className="label-caps text-muted-foreground">Used</dt>
                            <dd className="metric text-lg text-waiting">{dayCountText(eligibility.usedThisYear ?? 0)}</dd>
                          </div>
                          <div>
                            <dt className="label-caps text-muted-foreground">Left</dt>
                            <dd className="metric text-lg text-approved">{dayCountText(eligibility.remainingThisYear ?? 0)}</dd>
                          </div>
                        </dl>
                      </div>
                    ) : null}
                    {clBalance?.tracked && (
                      <p className="text-[13px] text-muted-foreground tabular-nums">
                        {balanceBreakdown(clBalance)} · resets on 1 Jan. Any month, full or half days, while the balance lasts.
                      </p>
                    )}
                    {!clEligible && eligibility.reason && <p className="text-[13px] text-muted-foreground">{eligibility.reason}</p>}
                    {clEligible && (
                      <Button asChild variant="outline" size="sm" className="min-h-11 self-start sm:min-h-8">
                        <Link href="/employee/casual-leave">Apply for Casual Leave</Link>
                      </Button>
                    )}
                  </GlassCard>
                )}
              </div>
            </div>
          )}
        </>
      </PageShell>

      <DayDetailPanel day={selectedDay} onClose={() => setSelectedDay(null)} policy={policy} isStaff={isStaff} />
    </>
  )
}

/**
 * PHONE ONLY (< 768px): the app's "Office Geo-Punch" row on the Attendance tab - a blue well, the title with an Active /
 * No Punch badge, today's count and the next punch, and "View Details" (opens Geo Punch / On-Duty). Reads the cached
 * geo status (the desktop card on the same page keeps it fresh), so it adds no request of its own.
 */
function PhoneGeoRow() {
  const { data: status } = useGeoStatusOnce()
  const count = status?.punches?.length ?? 0
  const nextType = status?.nextPunchType
  const s = status?.onDutySession
  const onDuty = !!s && s.status === 'active' && !s.employeeEndedAt
  return (
    <Link
      href={onDuty ? '/employee/attendance-request?mode=onduty' : '/employee/attendance-request'}
      className="focus-ring hidden max-md:mb-3.5 max-md:flex max-md:items-center max-md:gap-3 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)] max-md:active:opacity-85"
    >
      <span aria-hidden="true" className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-lg max-md:bg-info-bg max-md:text-[#0369A1] max-md:dark:text-[#38BDF8]">
        {onDuty ? <Briefcase className="max-md:size-[18px]" /> : <Navigation className="max-md:size-[18px]" />}
      </span>
      <span className="max-md:min-w-0 max-md:flex-1">
        <span className="max-md:flex max-md:items-center max-md:gap-2">
          <span className="max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[14px] max-md:font-semibold max-md:text-foreground">
            {onDuty ? 'On-Duty' : 'Office Geo-Punch'}
          </span>
          <span
            className={cn(
              'max-md:shrink-0 max-md:rounded-full max-md:px-2 max-md:py-0.5 max-md:text-[9.5px] max-md:font-[800]',
              count > 0 ? 'max-md:bg-approved-bg max-md:text-approved' : 'max-md:bg-muted max-md:text-muted-foreground',
            )}
          >
            {count > 0 ? 'Active' : 'No Punch'}
          </span>
        </span>
        <span className="max-md:mt-[3px] max-md:block max-md:truncate max-md:text-[11.5px] max-md:text-muted-foreground">
          {count === 0
            ? 'No punches recorded yet today'
            : `${count} ${count === 1 ? 'punch' : 'punches'} today${nextType ? ` · next is ${nextType === 'IN' ? 'Check-In' : 'Check-Out'}` : ''}`}
        </span>
      </span>
      <span className="max-md:shrink-0 max-md:px-1 max-md:text-[12px] max-md:font-semibold max-md:text-primary">View Details</span>
    </Link>
  )
}

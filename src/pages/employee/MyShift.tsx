import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight, Briefcase, CalendarCheck, CalendarX2, CheckCircle2, Clock, Factory, Hourglass, Info, ListChecks, Sunrise, Sunset, Timer,
  Workflow, XCircle, type LucideIcon,
} from 'lucide-react'
import { useMyShiftSummary } from '@/hooks/useMyShiftSummary'
import {
  EASE_OUT, EmptyState, ErrorState, GlassCard, KpiTile, PageHero, PageShell, SectionHeader, SkeletonList, StatusPill,
  type StatusTone,
} from '@/components/kit'
import { MonthYearPicker, PhoneMonthBar } from '@/components/employee/MonthYearPicker'
import { DayMarkerChips } from '@/components/employee/DayMarkerChips'
import { LateDeductionCard } from '@/components/employee/LateDeductionCard'
import {
  compensationLine, countEarlyOuts, dayHeadline, earlyOutShown, getDayFlags, getDayMarkers, halfDayRule, lateInShown,
} from '@/lib/attendance-flags'
import { minutesOf, to12h } from '@/lib/home-punches'
import { isDayInProgress, settledDays } from '@/lib/day-progress'
import { dayCountText } from '@/lib/home-attention'
import { useEmploymentType } from '@/hooks/useEmploymentType'
import { cn } from '@/lib/utils'
import type { AssignedShift, ShiftDailyLog, ShiftPolicy } from '@/types'
import { format, parseISO } from 'date-fns'

const STATUS_TONE: Record<string, StatusTone> = { present: 'approved', half_shift: 'waiting', absent: 'rejected', on_leave: 'info', holiday: 'neutral' }
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function MyShift() {
  const now = new Date()
  const [month, setMonth] = React.useState(now.getMonth() + 1)
  const [year, setYear] = React.useState(now.getFullYear())
  const q = useMyShiftSummary(month, year)
  const { data } = q
  const policy = data?.policy ?? null
  const showLateIn = lateInShown(policy)
  const earlyOutCount = data ? countEarlyOuts(data.dailyLogs) : null
  const showEarlyOut = earlyOutCount != null && earlyOutShown(policy)
  const halfRule = halfDayRule(policy)
  const value = (n: number | undefined) => (q.isPending || q.isError ? null : (n ?? 0))
  const { isProduction } = useEmploymentType()

  return (
    <PageShell className="max-md:gap-3">
      {/* Phones (< 768px): the mobile app's My Shift screen (app/shift/index.tsx, kit/MOBILE.md) - title, the month bar,
          the gradient shift card, Shift Details, This Month's Summary, Late & Permission Deductions, the days as the app's
          schedule rows and the HR note. The desktop hero, KPI row, band and table are hidden there. */}
      <>
        <PageHero
          className="max-md:hidden"
          icon={<Clock />}
          title="My Shift"
          subtitle="Your shift timings, and how this month's days were counted."
          actions={<MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />}
          kpis={
            <>
              <KpiTile
                label="Working shifts"
                value={value(data?.totalWorkingShifts)}
                format={dayCountText}
                icon={Workflow}
                tone="emerald"
                hint={data?.casualLeaveApprovals ? `includes ${data.casualLeaveApprovals} Casual Leave` : 'counted this month'}
              />
              {showLateIn ? (
                <KpiTile
                  label="Days flagged late"
                  value={value(data?.lateCount)}
                  icon={Timer}
                  tone="amber"
                  hint={showEarlyOut ? `${earlyOutCount} flagged early` : 'first punch after grace'}
                />
              ) : (
                <KpiTile label="Days flagged early" value={showEarlyOut ? value(earlyOutCount ?? 0) : null} icon={Timer} tone="amber" hint="last punch before shift end" />
              )}
              <KpiTile label="Half days" value={value(data?.halfShiftCount)} icon={Hourglass} tone="violet" hint="a punch in one half only" />
              <KpiTile label="Absent" value={value(data?.absentCount)} icon={CalendarX2} tone="rose" hint="no punch on a working day" />
            </>
          }
        />
        <div className="hidden max-md:block">
          <h1 className="max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-7 max-md:font-bold max-md:tracking-[-0.01em]">My Shift</h1>
          <p className="max-md:mt-0.5 max-md:text-[12px] max-md:leading-4 max-md:text-muted-foreground">
            {MONTH[month - 1]} {year} · Assigned Schedule & Monthly Timing
          </p>
          <PhoneMonthBar className="max-md:mt-3" month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
        </div>
      </>

      {q.isError ? (
        <ErrorState error={q.error} what="your shift details" onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : q.isPending || !data ? (
        <SkeletonList variant="cards" count={2} />
      ) : (
        <>
          {data.assignedShift ? (
            <>
              <ShiftCard shift={data.assignedShift} lateChecked={showLateIn} />
              <PhoneShiftCards
                shift={data.assignedShift}
                isProduction={isProduction}
                lateChecked={showLateIn}
                policy={policy}
              />
            </>
          ) : (
            <EmptyState icon={Clock} title="No shift assigned yet" description="HR has not assigned you a shift for this period. Ask HR if this looks wrong." compact />
          )}

          {halfRule && (
            <p className="text-[13px] text-muted-foreground max-md:hidden">
              Half-day rule: {halfRule.morning}. {halfRule.evening}. {halfRule.outcome}.
            </p>
          )}

          {/* Phones: the app's "This Month's Summary" card (the desktop KPI row's figures). */}
          <PhoneMonthSummary
            items={[
              // Today's day while its shift is still running is not counted until it is final (lib/day-progress.ts).
              { key: 'present', label: 'Present', value: settledDays(data.dailyLogs).filter((d) => !!d.firstPunch).length, icon: CheckCircle2, tone: 'max-md:bg-approved-bg max-md:text-approved' },
              { key: 'absent', label: 'Absent', value: data.absentCount, icon: XCircle, tone: 'max-md:bg-rejected-bg max-md:text-rejected' },
              ...(showLateIn
                ? [{ key: 'late', label: 'Days flagged late', value: data.lateCount, icon: Timer, tone: 'max-md:bg-waiting-bg max-md:text-waiting' }]
                : showEarlyOut
                  ? [{ key: 'early', label: 'Days flagged early', value: earlyOutCount ?? 0, icon: Timer, tone: 'max-md:bg-waiting-bg max-md:text-waiting' }]
                  : []),
              { key: 'half', label: 'Half Days', value: data.halfShiftCount, icon: Hourglass, tone: 'max-md:bg-waiting-bg max-md:text-waiting' },
              { key: 'cl', label: 'CL Approved', value: data.casualLeaveApprovals ?? 0, icon: CalendarCheck, tone: 'max-md:bg-approved-bg max-md:text-approved' },
            ]}
            total={data.totalWorkingShifts}
          />

          {/* Late-in / early-out / excess-permission pool and its deduction impact: the numbers HR sees on the Report Log. */}
          {data.deductions && <LateDeductionCard deductions={data.deductions} />}

          <section aria-labelledby="log-title" className={cn('flex flex-col gap-4', data.deductions && 'max-md:mt-3')}>
            <SectionHeader className="max-md:hidden" id="log-title" icon={ListChecks} title="Day by day" count={data.dailyLogs.length} description="Each day's first and last punch, and why it was flagged." />
            {data.dailyLogs.length === 0 ? (
              <EmptyState icon={Clock} title="No days to show yet" description="Days appear here as your punches are counted." compact />
            ) : (
              <>
                <PhoneDayRows logs={data.dailyLogs} policy={policy} />
                <GlassCard padding="none" className="overflow-hidden max-md:hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <caption className="sr-only">Your days this month</caption>
                      <thead className="border-b hairline bg-foreground/[0.03] text-left">
                        <tr>
                          <th scope="col" className="label-caps px-4 py-3 text-muted-foreground">Date</th>
                          <th scope="col" className="label-caps px-4 py-3 text-muted-foreground">In</th>
                          <th scope="col" className="label-caps px-4 py-3 text-muted-foreground">Out</th>
                          <th scope="col" className="label-caps px-4 py-3 text-muted-foreground">Day</th>
                          <th scope="col" className="label-caps px-4 py-3 text-muted-foreground">Why</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.dailyLogs.map((log) => {
                          const reason = getDayFlags(log).lateReason
                          const comp = compensationLine(log)
                          // Today, its shift still running: a neutral live "In progress", never a final verdict.
                          const live = isDayInProgress(log)
                          return (
                            <tr key={log.date} className="border-b hairline transition-colors last:border-b-0 hover:bg-foreground/[0.03]">
                              <td className="px-4 py-3 font-medium whitespace-nowrap">{format(parseISO(log.date), 'EEE, d MMM')}</td>
                              <td className="px-4 py-3 tabular-nums">{log.firstPunch ? to12h(log.firstPunch) : '—'}</td>
                              <td className="px-4 py-3 tabular-nums">{log.lastPunch ? to12h(log.lastPunch) : '—'}</td>
                              <td className="px-4 py-3">
                                <StatusPill size="sm" tone={live ? 'neutral' : (STATUS_TONE[log.status] ?? 'neutral')} icon={false} dot={live}>
                                  {dayHeadline(log)}
                                </StatusPill>
                              </td>
                              <td className="px-4 py-3">
                                <DayMarkerChips markers={getDayMarkers(log, policy)} />
                                {comp && <p className="mt-1 text-xs text-muted-foreground">{comp}</p>}
                                {reason && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </>
            )}
          </section>

          <p className="hidden max-md:mt-3 max-md:flex max-md:items-start max-md:gap-2 max-md:rounded-xl max-md:bg-card max-md:p-3 max-md:text-[12px] max-md:leading-[18px] max-md:text-muted-foreground">
            <Info className="max-md:mt-px max-md:size-4 max-md:shrink-0" aria-hidden="true" />
            Shift details are managed by HR. Contact HR to request a shift change.
          </p>
        </>
      )}
    </PageShell>
  )
}

/** "09:00:00" -> "09:00": the app prints the shift's own times. */
function hhmm(t: string | null | undefined): string {
  return (t ?? '').slice(0, 5)
}

/**
 * PHONE ONLY (< 768px): the app's gradient shift card (name, Staff / Production badge, Start Time -> End Time) and its
 * "Shift Details" card (grace, length, the punch-in deadline, the company's half-day windows).
 */
function PhoneShiftCards({
  shift,
  isProduction,
  lateChecked,
  policy,
}: {
  shift: AssignedShift
  isProduction: boolean
  lateChecked: boolean
  policy: ShiftPolicy | null
}) {
  const start = minutesOf(shift.startTime)
  const end = minutesOf(shift.endTime)
  const night = start != null && end != null && end <= start
  const lengthMin = start != null && end != null ? (night ? end + 24 * 60 - start : end - start) : null
  const hours = lengthMin != null ? `${Math.floor(lengthMin / 60)} h${lengthMin % 60 ? ` ${lengthMin % 60} min` : ''}` : null
  const graceEnd = start != null ? start + (shift.gracePeriodMinutes || 0) : null
  const punchBy =
    graceEnd != null
      ? to12h(`${String(Math.floor((graceEnd % 1440) / 60)).padStart(2, '0')}:${String(graceEnd % 60).padStart(2, '0')}`)
      : to12h(shift.startTime)
  const halfRule = halfDayRule(policy)
  const rows: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Timer, label: 'Grace Period', value: `${shift.gracePeriodMinutes} min` },
    ...(hours ? [{ icon: Clock, label: 'Shift Length', value: hours }] : []),
    ...(lateChecked ? [{ icon: CheckCircle2, label: 'Punch in by', value: punchBy }] : []),
    ...(halfRule
      ? [
          { icon: Sunrise, label: 'Morning half', value: halfRule.morning },
          { icon: Sunset, label: 'Evening half', value: halfRule.evening },
        ]
      : []),
  ]
  return (
    <div className="hidden max-md:mb-3 max-md:flex max-md:flex-col max-md:gap-3">
      <div className="max-md:relative max-md:flex max-md:flex-col max-md:gap-4 max-md:overflow-hidden max-md:rounded-3xl max-md:bg-[linear-gradient(135deg,var(--grad-from),var(--grad-to))] max-md:p-[22px] max-md:text-white max-md:shadow-[var(--m-shadow-mid)]">
        <span aria-hidden="true" className="max-md:pointer-events-none max-md:absolute max-md:-top-[30px] max-md:-right-[30px] max-md:size-[130px] max-md:rounded-full max-md:bg-white/8" />
        <div className="max-md:relative max-md:flex max-md:items-center max-md:justify-between max-md:gap-3">
          <h2 className="max-md:min-w-0 max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[21px] max-md:leading-7 max-md:font-bold">{shift.name}</h2>
          <span className="max-md:flex max-md:shrink-0 max-md:items-center max-md:gap-1 max-md:rounded-full max-md:border max-md:border-white/35 max-md:bg-white/22 max-md:px-2.5 max-md:py-[5px] max-md:text-[11px] max-md:font-bold">
            {isProduction ? <Factory className="max-md:size-[13px]" aria-hidden="true" /> : <Briefcase className="max-md:size-[13px]" aria-hidden="true" />}
            {isProduction ? 'Production' : 'Staff'}
          </span>
        </div>
        <div className="max-md:relative max-md:flex max-md:items-center max-md:gap-4">
          <div className="max-md:flex max-md:flex-1 max-md:flex-col max-md:gap-1">
            <span className="max-md:text-[11px] max-md:font-semibold max-md:text-white/75">Start Time</span>
            <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[26px] max-md:leading-8 max-md:font-bold max-md:tabular-nums">{hhmm(shift.startTime)}</span>
          </div>
          <span aria-hidden="true" className="max-md:grid max-md:size-[30px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-white/18">
            <ArrowRight className="max-md:size-[18px]" />
          </span>
          <div className="max-md:flex max-md:flex-1 max-md:flex-col max-md:gap-1">
            <span className="max-md:text-[11px] max-md:font-semibold max-md:text-white/75">End Time</span>
            <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[26px] max-md:leading-8 max-md:font-bold max-md:tabular-nums">{hhmm(shift.endTime)}</span>
          </div>
        </div>
      </div>

      <section aria-labelledby="m-shift-details" className="max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]">
        <h2 id="m-shift-details" className="max-md:mb-1 max-md:font-[family-name:var(--font-display)] max-md:text-[14px] max-md:font-semibold">Shift Details</h2>
        <dl>
          {rows.map((r) => {
            const long = r.value.length > 24
            return (
              <div
                key={r.label}
                className={cn(
                  'max-md:flex max-md:border-b max-md:border-input max-md:py-2.5 max-md:last:border-b-0',
                  long ? 'max-md:flex-col max-md:gap-2' : 'max-md:items-center max-md:justify-between max-md:gap-3',
                )}
              >
                <dt className="max-md:flex max-md:shrink-0 max-md:items-center max-md:gap-2.5 max-md:text-[13px] max-md:font-medium max-md:text-secondary-foreground">
                  <span aria-hidden="true" className="max-md:grid max-md:size-[30px] max-md:place-items-center max-md:rounded-[10px] max-md:bg-accent max-md:text-primary">
                    <r.icon className="max-md:size-4" />
                  </span>
                  {r.label}
                </dt>
                <dd className={cn(long ? 'max-md:text-[12.5px] max-md:leading-[18px] max-md:font-semibold max-md:text-secondary-foreground' : 'max-md:text-right max-md:text-[13px] max-md:font-bold max-md:text-foreground')}>
                  {r.value}
                </dd>
              </div>
            )
          })}
        </dl>
        {halfRule && (
          <p className="max-md:mt-2 max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">
            Punches in both halves = Full Day, in one half = Half Day. {halfRule.outcome}.
          </p>
        )}
      </section>
    </div>
  )
}

/** PHONE ONLY: the app's "This Month's Summary" - round tinted icons, the figures, and Total Working Shifts. */
function PhoneMonthSummary({
  items,
  total,
}: {
  items: { key: string; label: string; value: number; icon: LucideIcon; tone: string }[]
  total: number
}) {
  return (
    <section aria-labelledby="m-shift-summary" className="hidden max-md:mb-3 max-md:block max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]">
      <h2 id="m-shift-summary" className="max-md:mb-2 max-md:font-[family-name:var(--font-display)] max-md:text-[14px] max-md:font-semibold">This Month's Summary</h2>
      <dl className="max-md:flex">
        {items.map((it) => (
          <div key={it.key} className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col-reverse max-md:items-center max-md:gap-1.5 max-md:py-1.5">
            <dt className="max-md:text-center max-md:text-[9px] max-md:leading-3 max-md:font-semibold max-md:text-muted-foreground">{it.label}</dt>
            <dd className="max-md:flex max-md:flex-col max-md:items-center max-md:gap-1.5">
              <span aria-hidden="true" className={cn('max-md:grid max-md:size-8 max-md:place-items-center max-md:rounded-full', it.tone)}>
                <it.icon className="max-md:size-4" />
              </span>
              <span className="max-md:text-[15px] max-md:font-black max-md:tabular-nums">{dayCountText(it.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="max-md:mt-2.5 max-md:flex max-md:items-center max-md:justify-between max-md:border-t max-md:border-input max-md:pt-3">
        <span className="max-md:text-[13px] max-md:font-bold max-md:text-secondary-foreground">Total Working Shifts</span>
        <span className="max-md:text-[18px] max-md:font-black max-md:text-primary max-md:tabular-nums">{dayCountText(total)}</span>
      </p>
    </section>
  )
}

const DAY_PILL: Record<string, string> = {
  present: 'max-md:bg-approved-bg max-md:text-approved',
  half_shift: 'max-md:bg-waiting-bg max-md:text-waiting',
  absent: 'max-md:bg-rejected-bg max-md:text-rejected',
  on_leave: 'max-md:bg-violet-bg max-md:text-violet',
  holiday: 'max-md:bg-[#FCE7F3] max-md:text-[#BE185D] max-md:dark:bg-[#DB277738] max-md:dark:text-[#F9A8D4]',
}

/**
 * PHONE ONLY: the month's days as the app's schedule rows (app/shift/index.tsx "Weekly Schedule") - a date badge (today
 * filled sapphire), the punches or what the day was, why it was flagged, and the day's status pill. Same rows as the
 * desktop "Day by day" table.
 */
function PhoneDayRows({ logs, policy }: { logs: ShiftDailyLog[]; policy: ShiftPolicy | null }) {
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return (
    <div className="hidden max-md:block max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]">
      <div className="max-md:mb-2 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-2">
        <h2 className="max-md:font-[family-name:var(--font-display)] max-md:text-[14px] max-md:font-semibold">Day by day</h2>
        <span className="max-md:text-[11px] max-md:font-semibold max-md:text-muted-foreground">
          {logs.length} {logs.length === 1 ? 'day' : 'days'}
        </span>
      </div>
      <ol className="max-md:flex max-md:flex-col max-md:gap-2" aria-label="Your days this month">
        {logs.map((log) => {
          const d = parseISO(log.date)
          const today = log.date === todayKey
          const markers = getDayMarkers(log, policy)
          const live = isDayInProgress(log, now)
          const flagged = !live && markers.length > 0 && (log.status === 'present' || log.status === 'half_shift')
          const reason = getDayFlags(log).lateReason
          const comp = compensationLine(log)
          return (
            <li
              key={log.date}
              className={cn(
                'max-md:flex max-md:items-center max-md:gap-2.5 max-md:rounded-lg max-md:p-2.5',
                today ? 'max-md:border max-md:border-primary max-md:bg-accent' : 'max-md:bg-muted',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'max-md:flex max-md:h-[46px] max-md:w-[42px] max-md:shrink-0 max-md:flex-col max-md:items-center max-md:justify-center max-md:rounded-sm',
                  today ? 'max-md:bg-primary max-md:text-primary-foreground' : 'max-md:bg-card',
                )}
              >
                <span className={cn('max-md:text-[8px] max-md:font-[800] max-md:uppercase', !today && 'max-md:text-muted-foreground')}>{format(d, 'EEE')}</span>
                <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:leading-5 max-md:font-bold max-md:tabular-nums">{format(d, 'd')}</span>
              </span>
              <span className="max-md:min-w-0 max-md:flex-1">
                <span className="sr-only">{format(d, 'EEEE, d MMMM')}: </span>
                <span className="max-md:block max-md:truncate max-md:text-[12.5px] max-md:font-bold max-md:text-foreground">
                  {log.firstPunch ? `In ${to12h(log.firstPunch)}${log.lastPunch ? ` · Out ${to12h(log.lastPunch)}` : ''}` : dayHeadline(log)}
                </span>
                {markers.length > 0 && (
                  <span className="max-md:mt-0.5 max-md:block max-md:text-[10.5px] max-md:leading-[14px] max-md:text-muted-foreground">{markers.map((m) => m.label).join(' · ')}</span>
                )}
                {comp && <span className="max-md:mt-0.5 max-md:block max-md:text-[10.5px] max-md:leading-[14px] max-md:text-muted-foreground">{comp}</span>}
                {reason && <span className="max-md:mt-0.5 max-md:block max-md:text-[10.5px] max-md:leading-[14px] max-md:text-muted-foreground">{reason}</span>}
              </span>
              <span
                className={cn(
                  'max-md:max-w-[38%] max-md:shrink-0 max-md:truncate max-md:rounded-full max-md:px-[9px] max-md:py-1 max-md:text-[10px] max-md:font-[800]',
                  live
                    ? 'max-md:inline-flex max-md:items-center max-md:gap-1 max-md:bg-neutral-bg max-md:text-neutral'
                    : flagged
                      ? 'max-md:bg-waiting-bg max-md:text-waiting'
                      : (DAY_PILL[log.status] ?? 'max-md:bg-card max-md:text-muted-foreground'),
                )}
              >
                {live && <span className="pulse-ring max-md:size-1.5 max-md:shrink-0 max-md:rounded-full max-md:bg-current" aria-hidden="true" />}
                {flagged ? markers[0].label : dayHeadline(log)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** The shift as a day: a 24-hour band with the shift window and its grace drawn on it, plus the times in words. */
function ShiftCard({ shift, lateChecked }: { shift: AssignedShift; lateChecked: boolean }) {
  const start = minutesOf(shift.startTime)
  const end = minutesOf(shift.endTime)
  const night = start != null && end != null && end <= start
  const pct = (m: number) => `${(m / (24 * 60)) * 100}%`
  const lengthMin = start != null && end != null ? (night ? end + 24 * 60 - start : end - start) : null
  const hours = lengthMin != null ? `${Math.floor(lengthMin / 60)} h${lengthMin % 60 ? ` ${lengthMin % 60} min` : ''}` : null
  const graceEnd = start != null ? start + (shift.gracePeriodMinutes || 0) : null

  return (
    <GlassCard variant="stitched" tone="sapphire" padding="lg" className="flex flex-col gap-5 max-md:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps text-muted-foreground">Your shift</p>
          <h2 className="font-display mt-1 text-2xl font-semibold">{shift.name}</h2>
        </div>
        {hours && <StatusPill tone="info" icon={Clock}>{hours} long</StatusPill>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border hairline bg-foreground/[0.03] p-3">
          <Sunrise className="size-5 shrink-0 text-approved" aria-hidden="true" />
          <div>
            <dt className="label-caps text-muted-foreground">Starts</dt>
            <dd className="metric text-xl">{to12h(shift.startTime)}</dd>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border hairline bg-foreground/[0.03] p-3">
          <Sunset className="size-5 shrink-0 text-waiting" aria-hidden="true" />
          <div>
            <dt className="label-caps text-muted-foreground">Ends</dt>
            <dd className="metric text-xl">{to12h(shift.endTime)}</dd>
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-3 rounded-lg border hairline bg-foreground/[0.03] p-3 sm:col-span-1">
          <Hourglass className="size-5 shrink-0 text-violet" aria-hidden="true" />
          <div>
            <dt className="label-caps text-muted-foreground">Grace</dt>
            <dd className="metric text-xl">{shift.gracePeriodMinutes} min</dd>
          </div>
        </div>
      </dl>

      {start != null && end != null && (
        <div aria-hidden="true">
          <div className="relative h-4 overflow-hidden rounded-full bg-foreground/[0.07]">
            {(night ? [{ from: start, to: 24 * 60 }, { from: 0, to: end }] : [{ from: start, to: end }]).map((seg, i) => (
              <motion.span
                key={i}
                className="bg-silk absolute inset-y-0 origin-left rounded-full"
                style={{ left: pct(seg.from), width: `calc(${pct(seg.to)} - ${pct(seg.from)})` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.15 + i * 0.1 }}
              />
            ))}
            {graceEnd != null && shift.gracePeriodMinutes > 0 && (
              <span
                className="absolute inset-y-0 bg-white/45 dark:bg-white/25"
                style={{ left: pct(start), width: `calc(${pct(Math.min(24 * 60, graceEnd))} - ${pct(start)})` }}
              />
            )}
          </div>
          <div className="relative mt-1 h-4 text-[11px] text-muted-foreground tabular-nums">
            {[0, 6, 12, 18, 24].map((h) => (
              <span key={h} className="absolute -translate-x-1/2" style={{ left: `${(h / 24) * 100}%` }}>
                {h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
              </span>
            ))}
          </div>
        </div>
      )}
      {lateChecked && (
      <p className="text-[13px] text-muted-foreground">
        Punch in by {graceEnd != null ? to12h(`${String(Math.floor((graceEnd % 1440) / 60)).padStart(2, '0')}:${String(graceEnd % 60).padStart(2, '0')}`) : to12h(shift.startTime)}{' '}
        (shift start plus {shift.gracePeriodMinutes} minutes of grace) to avoid a Late-In.
      </p>
      )}
    </GlassCard>
  )
}

import * as React from 'react'
import { CalendarClock, CalendarHeart, ChevronLeft, ChevronRight, Clock, Plus, Sunrise, Sunset, Sun, XCircle, CalendarCheck2, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ErrorState,
  GlassCard,
  KpiTile,
  PageHero,
  PageShell,
  RingMeter,
  SectionHeader,
  SkeletonBlock,
  StatusPill,
  TONE_SOFT,
  TONE_TEXT,
  deciderFromFields,
  useRequestViews,
  type ViewOptions,
} from '@/components/kit'
import { ClApplyDialog } from '@/components/requests/ClApplyDialog'
import { ClBalanceHistory } from '@/components/requests/ClBalanceHistory'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { CL_STATE } from '@/components/requests/cl-state'
import { ClLegend, ClMonthCalendar, ClYearGrid } from '@/components/requests/ClYearView'
import { OffNotice } from '@/components/requests/FormBits'
import { RequestCard } from '@/components/requests/RequestCard'
import { RequestList } from '@/components/requests/RequestList'
import { WithdrawButton } from '@/components/requests/WithdrawButton'
import { HERO_NO_ACTIONS_ON_PHONE, HERO_NO_KPIS_ON_PHONE } from '@/components/requests/phone'
import { showView } from '@/components/requests/show-view'
import type { CasualLeaveRow } from '@/api/requests-api'
import { useApplyPrefill } from '@/hooks/useApplyPrefill'
import { useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { useCasualLeaveEligibility, useCasualLeaveRequests } from '@/hooks/useCasualLeave'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { pipelineSentence } from '@/lib/approval'
import { currentMonth, inMonthText, laterMonth, latestMonthOf, monthOf } from '@/lib/month-switch'
import {
  PORTION_DAYS,
  PORTION_LONG,
  balanceBreakdown,
  balanceSinceDate,
  balanceSinceText,
  clCardState,
  clock12,
  daysText,
  halfNum,
  isYearlyBalance,
  mergeUsageRows,
  yearMonths,
  yearRange,
  yearTotals,
  type CLPortion,
  type CLRow,
} from '@/lib/casual-leave'
import { dayText } from '@/lib/my-requests'
import { cn } from '@/lib/utils'

/** 1.5 -> "1½", 0.5 -> "½", 2 -> "2" (also while a KPI counts up). */
const halfDays = (n: number) => {
  const r = Math.round(n * 2) / 2
  return r % 1 ? `${Math.floor(r) || ''}½` : String(r)
}

const PORTION_ICON: Record<CLPortion, LucideIcon> = { full: Sun, first_half: Sunrise, second_half: Sunset }

export default function CasualLeave() {
  const thisYear = new Date().getFullYear()
  const [applyOpen, setApplyOpen] = React.useState(false)
  // The attendance day panel's "Casual Leave" (?apply=YYYY-MM-DD): the form opens on that day (it may be ahead).
  const [applyDate, setApplyDate] = React.useState<string | null>(null)
  useApplyPrefill(
    (p) => {
      setApplyDate(p.date)
      setApplyOpen(true)
    },
    { allowFuture: true },
  )
  // The month switcher (owner 2026-11-02) drives the month calendar and the list; the year view follows its year. A tap
  // on a month tile, or the year arrows, move the same month.
  const [month, setMonth] = useSelectedMonth()
  const year = month.year
  const selectedMonth = month.month
  // The pipeline HR configured for casual leave, and the note when HR has switched it off.
  const { workflow, offNote } = useApprovalWorkflow('casual_leave')
  const pipeline = pipelineSentence(workflow, 'Casual Leave request')

  // Every request the employee ever made (a few a year): one call, so switching years is instant.
  const list = useCasualLeaveRequests()
  const elig = useCasualLeaveEligibility()

  const all = React.useMemo(() => list.data ?? [], [list.data])
  const rows: CLRow[] = React.useMemo(() => all.map((r) => ({ id: r.id, date: r.date, portion: r.portion, status: r.status, source: r.source })), [all])
  const range = yearRange(rows, thisYear)
  // The yearly balance (owner 2026-11-02): 12 days a year, any month while it lasts. For the year the server counted,
  // the year view draws its monthsUsage (which also holds a Casual Leave HR proposed on an attendance edit that still
  // waits); every other year, and an older server, the request list.
  const yearly = isYearlyBalance(elig.data)
  const balance = yearly ? elig.data!.balance! : null
  const yearRows = React.useMemo(() => mergeUsageRows(rows, elig.data?.monthsUsage), [rows, elig.data?.monthsUsage])
  const months = React.useMemo(() => yearMonths(yearRows, year), [yearRows, year])
  const totals = React.useMemo(() => yearTotals(yearRows, year), [yearRows, year])
  // The balance figures belong to the balance's own year; another year on screen keeps the counts of its requests.
  const balanceShown = balance && balance.year === year ? balance : null
  const since = balanceShown ? balanceSinceText(balanceShown) : null
  const sorted = React.useMemo(() => (list.data ? [...list.data].sort((a, b) => b.date.localeCompare(a.date)) : undefined), [list.data])
  const baseOptions: ViewOptions<CasualLeaveRow> = { statusOf: (r) => r.status, month: { dateOf: (r) => r.date, kind: 'taken' } }
  // The four views hold only the Casual Leave of the chosen month (by its date).
  const viewOptions: ViewOptions<CasualLeaveRow> = { ...baseOptions, scope: { ...month, daysOf: (r) => r.date } }
  const views = useRequestViews(sorted, viewOptions)
  // The KPI tiles (owner 2026-11-02): Waiting and Rejected follow the month on screen (the four views' counts; a tile
  // opens its view in that month); "Taken" and "Months used" stay yearly (the year of that month) and say so.
  const inMonth = inMonthText(month)
  // The arrows reach as far as the year arrows do (back to January of the first year; as in the mobile app), and past
  // the current month only when a Casual Leave lies in a later month.
  const firstMonth = { year: range.min, month: 1 }
  const lastMonth = laterMonth(currentMonth(), latestMonthOf(all, (r) => r.date) ?? currentMonth())
  // A notification's View button opens ?focus=<request id>: its month (and so its year), the view holding it, scrolled
  // to and ringed.
  const focus = useFocusItem({ scope: 'cl', rows: list.data, idOf: (r) => r.id, views, viewOptions, setMonth })

  function changeYear(next: number) {
    // Switching years opens the month that matters: this month for this year, else the first month with Casual Leave
    // (else the same month of that year).
    if (next === thisYear) setMonth(currentMonth())
    else setMonth({ year: next, month: yearMonths(rows, next).find((m) => m.shape !== 'none')?.month ?? selectedMonth })
  }

  const state = elig.data ? clCardState(elig.data, new Date()) : null
  const canApply = !!state && (state.tone === 'open' || state.tone === 'half' || (elig.data?.months ?? []).some((m) => m.eligible && m.left !== 'nothing'))
  const meta = state ? CL_STATE[state.tone] : null
  const StateIcon = meta?.icon ?? CalendarClock
  const entitlement = elig.data?.yearlyEntitlement ?? 12
  const usedYear = elig.data?.usedThisYear ?? totals.takenDays
  const shift = elig.data?.shift

  return (
    <>
      <PageShell>
        {/* Phones: no KPI tiles (the counts are in "Your year" and on the four count cards) and the Apply button sits in the
            This month card, as in the mobile app. */}
        <PageHero
          icon={<CalendarClock />}
          className={cn(HERO_NO_KPIS_ON_PHONE, HERO_NO_ACTIONS_ON_PHONE)}
          title="Casual Leave"
          subtitle={
            yearly ? (
              <>
                <span className="max-md:hidden">
                  {halfNum(balance!.total)} paid days a year - take full days or half-days on any dates while your balance lasts. Unused days lapse on 31 Dec.
                </span>
                <span className="hidden max-md:inline">{halfNum(balance!.total)} paid days a year, full or half days</span>
              </>
            ) : (
              <>
                <span className="max-md:hidden">One paid day a month - take it as a full day, or as two half-days on any dates of that month.</span>
                <span className="hidden max-md:inline">One paid day a month, or two half-days</span>
              </>
            )
          }
          actions={
            <Button size="lg" onClick={() => setApplyOpen(true)} disabled={!canApply || !!offNote}>
              <Plus aria-hidden="true" /> Apply for Casual Leave
            </Button>
          }
          kpis={
            balanceShown ? (
              // The yearly balance (2026-11-02): what is left and what was taken come from the server's balance (the
              // whole year, from the cut-over in 2026); Waiting / Rejected still follow the month on screen.
              <>
                <KpiTile label={`Left in ${year}`} value={balanceShown.remaining} format={halfDays} unit={`of ${halfNum(balanceShown.total)} days`} icon={CalendarHeart} tone="violet" hint="the whole year · resets on 1 Jan" />
                <KpiTile label="Waiting" value={list.data ? views.counts.waiting : null} icon={Clock} tone="amber" hint={`for a decision · ${inMonth}`} onClick={() => showView(views, 'waiting', 'cl')} />
                <KpiTile
                  label={`Taken in ${year}`}
                  value={balanceShown.used}
                  format={halfDays}
                  unit={`of ${halfNum(balanceShown.total)} days`}
                  icon={CalendarCheck2}
                  tone="emerald"
                  hint={since ? `approved · ${since.charAt(0).toLowerCase()}${since.slice(1)}` : 'approved · the whole year'}
                />
                <KpiTile label="Rejected" value={list.data ? views.counts.rejected : null} icon={XCircle} tone="rose" hint={inMonth} onClick={() => showView(views, 'rejected', 'cl')} />
              </>
            ) : (
              <>
                <KpiTile label={`Taken in ${year}`} value={list.data ? totals.takenDays : null} format={halfDays} unit={`of ${entitlement} days`} icon={CalendarCheck2} tone="violet" hint="approved · the whole year" />
                <KpiTile label="Waiting" value={list.data ? views.counts.waiting : null} icon={Clock} tone="amber" hint={`for a decision · ${inMonth}`} onClick={() => showView(views, 'waiting', 'cl')} />
                <KpiTile label="Months used" value={list.data ? totals.monthsUsed : null} unit="of 12" icon={CalendarHeart} tone="emerald" hint={`in ${year} · the whole year`} />
                <KpiTile label="Rejected" value={list.data ? views.counts.rejected : null} icon={XCircle} tone="rose" hint={inMonth} onClick={() => showView(views, 'rejected', 'cl')} />
              </>
            )
          }
        >
          {offNote && <OffNotice text={offNote} />}
        </PageHero>

        {/* This month */}
        {elig.isError && !elig.data ? (
          <ErrorState error={elig.error} what="this month's Casual Leave" onRetry={() => void elig.refetch()} retrying={elig.isFetching} title="Could not check this month's Casual Leave" />
        ) : (
          <>
            <GlassCard variant="stitched" tone="violet" padding="lg" className="flex flex-col gap-5 max-md:hidden sm:flex-row sm:items-center">
              {balance ? (
                // The yearly balance: the ring fills with what is taken or waiting; the centre says what is left.
                <RingMeter value={balance.used + balance.pending} max={balance.total} silk size={116} thickness={11} label={`Casual Leave days left in ${balance.year}: ${halfNum(balance.remaining)} of ${halfNum(balance.total)}`}>
                  <span className="metric text-2xl">{halfDays(balance.remaining)}</span>
                  <span className="text-[11px] text-muted-foreground">of {halfNum(balance.total)} left</span>
                </RingMeter>
              ) : (
                <RingMeter value={usedYear} max={entitlement} silk size={116} thickness={11} label={`Casual Leave days taken in ${elig.data?.year ?? thisYear}`}>
                  <span className="metric text-2xl">{halfDays(usedYear)}</span>
                  <span className="text-[11px] text-muted-foreground">of {entitlement} days</span>
                </RingMeter>
              )}
              <div className="min-w-0 flex-1">
                <p className="label-caps text-violet">{balance ? `Your ${balance.year} balance` : 'This month'}</p>
                {!state ? (
                  <div className="mt-2 flex flex-col gap-2" aria-hidden="true">
                    <SkeletonBlock className="h-6 w-48" />
                    <SkeletonBlock className="h-3.5 w-72 max-w-full" />
                  </div>
                ) : (
                  <>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StateIcon className={cn('size-5', TONE_TEXT[meta?.tone ?? 'violet'])} aria-hidden="true" />
                      <h2 className="font-display text-2xl font-semibold">{state.title}</h2>
                      {meta && <StatusPill tone={meta.status} size="sm">{meta.word}</StatusPill>}
                    </div>
                    <p className="mt-1 text-[14px] text-muted-foreground">{state.detail}</p>
                    {balance && (
                      <p className="mt-2 text-[13px] font-medium text-foreground/85 tabular-nums">
                        {balanceBreakdown(balance)} · resets on 1 Jan
                        {balanceSinceText(balance) ? ` · ${balanceSinceText(balance)}` : ''}
                      </p>
                    )}
                  </>
                )}
                {shift && (
                  <p className="mt-3 text-[13px] text-foreground/80">
                    Your shift is {clock12(shift.start)} - {clock12(shift.end)}. First half ends {clock12(shift.firstHalfEnd)}; second half starts{' '}
                    {clock12(shift.secondHalfStart)}.
                  </p>
                )}
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Approved Casual Leave counts as a paid day (a half-day as half a day; the other half counts by your punches).
                </p>
              </div>
            </GlassCard>

            {/* Phones: the mobile app's This month card, with the Apply button in it. */}
            <div className="hidden max-md:flex max-md:flex-col max-md:gap-3 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-mid)]">
              {!state ? (
                <div className="max-md:flex max-md:flex-col max-md:gap-2.5" aria-hidden="true">
                  <SkeletonBlock className="max-md:h-3.5 max-md:w-[40%]" />
                  <SkeletonBlock className="max-md:h-[22px] max-md:w-[70%]" />
                  <SkeletonBlock className="max-md:h-3 max-md:w-[90%]" />
                </div>
              ) : (
                <>
                  <p className="label-caps text-muted-foreground max-md:font-[800]! max-md:tracking-[0.1em]!">{balance ? `Your ${balance.year} balance` : 'This month'}</p>
                  <div className="max-md:flex max-md:items-center max-md:gap-3">
                    <span className={cn('max-md:grid max-md:size-12 max-md:shrink-0 max-md:place-items-center max-md:rounded-full', TONE_SOFT[meta?.tone ?? 'violet'])} aria-hidden="true">
                      <StateIcon className="max-md:size-6" />
                    </span>
                    <div className="max-md:min-w-0 max-md:flex-1">
                      <h2 className="font-display max-md:text-[19px] max-md:leading-6 max-md:font-bold">{state.title}</h2>
                      <p className="max-md:mt-[3px] max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">{state.detail}</p>
                    </div>
                  </div>
                  {balance ? (
                    <p className="max-md:text-[12px] max-md:text-muted-foreground max-md:tabular-nums">
                      {balanceBreakdown(balance)} · resets on 1 Jan
                    </p>
                  ) : (
                    elig.data && (
                      <p className="max-md:text-[12px] max-md:text-muted-foreground max-md:tabular-nums">
                        {daysText(usedYear)} of {entitlement} days taken in {elig.data.year ?? thisYear}
                      </p>
                    )
                  )}
                  {shift && (
                    <p className="max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">
                      Your shift is {clock12(shift.start)} - {clock12(shift.end)}. First half ends {clock12(shift.firstHalfEnd)}; second half starts{' '}
                      {clock12(shift.secondHalfStart)}.
                    </p>
                  )}
                  <p className="max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">
                    Approved Casual Leave counts as a paid day (a half-day as half a day; the other half counts by your punches).
                  </p>
                  <Button onClick={() => setApplyOpen(true)} disabled={!canApply || !!offNote} className="max-md:w-full max-md:text-[13.5px]">
                    <Plus aria-hidden="true" /> Apply for Casual Leave
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        {/* The year */}
        <section aria-labelledby="cl-year-title" className="flex flex-col gap-4">
          <SectionHeader
            id="cl-year-title"
            icon={CalendarHeart}
            tone="violet"
            title="Your year"
            description="Tap a month to see its days."
            action={
              <div className="glass flex items-center gap-1 rounded-xl p-1 max-md:gap-0 max-md:rounded-full max-md:p-0.5">
                <Button variant="ghost" size="icon" className="size-11 sm:size-9" aria-label="Previous year" disabled={year <= range.min} onClick={() => changeYear(year - 1)}>
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <span className="metric min-w-14 text-center text-base max-md:min-w-10 max-md:text-[14px]" aria-live="polite">{year}</span>
                <Button variant="ghost" size="icon" className="size-11 sm:size-9" aria-label="Next year" disabled={year >= range.max} onClick={() => changeYear(year + 1)}>
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            }
          />
          {list.isError && !list.data ? (
            <ErrorState error={list.error} what="your Casual Leave" onRetry={() => void list.refetch()} retrying={list.isFetching} />
          ) : list.isPending ? (
            <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]" aria-hidden="true">
              <SkeletonBlock className="h-56 w-full rounded-xl" />
              <SkeletonBlock className="h-56 w-full rounded-xl" />
            </div>
          ) : (
            <div className="grid gap-4 max-md:gap-2.5 lg:grid-cols-[1.3fr_1fr]">
              {/* Phones: the app's stats row above the month cells. */}
              <div className="hidden max-md:flex max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:py-3">
                {(balanceShown
                  ? [
                      { label: 'Left', value: `${halfNum(balanceShown.remaining)} of ${halfNum(balanceShown.total)}`, tone: 'max-md:text-primary' },
                      { label: 'Taken', value: daysText(balanceShown.used), tone: 'max-md:text-approved' },
                      { label: 'Waiting', value: daysText(balanceShown.pending), tone: 'max-md:text-waiting' },
                      { label: 'Rejected', value: String(totals.rejected), tone: 'max-md:text-rejected' },
                    ]
                  : [
                      { label: 'Taken', value: daysText(totals.takenDays), tone: 'max-md:text-primary' },
                      { label: 'Waiting', value: daysText(totals.waitingDays), tone: 'max-md:text-waiting' },
                      { label: 'Months used', value: String(totals.monthsUsed), tone: 'max-md:text-approved' },
                      { label: 'Rejected', value: String(totals.rejected), tone: 'max-md:text-rejected' },
                    ]
                ).map((c) => (
                  <div key={c.label} className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:items-center max-md:gap-0.5 max-md:px-1 max-md:text-center">
                    <span className={cn('font-display max-md:text-[15px] max-md:leading-5 max-md:font-bold max-md:tabular-nums', c.tone)}>{c.value}</span>
                    <span className="max-md:text-[10.5px] max-md:leading-[14px] max-md:font-semibold max-md:text-muted-foreground">{c.label}</span>
                  </div>
                ))}
              </div>
              {/* Phones: the month cells sit straight on the page (no card around them), as in the app. */}
              <GlassCard className="flex flex-col gap-4 max-md:gap-2.5 max-md:border-0! max-md:bg-transparent! max-md:p-0! max-md:shadow-none!">
                <ClYearGrid months={months} year={year} selected={selectedMonth} onSelect={(m) => setMonth({ year, month: m })} calendarId="cl-month-calendar" pickUntil={lastMonth} />
                <ClLegend yearly={yearly} />
                <p className="text-[13px] text-muted-foreground">
                  In {year}: <span className="font-semibold text-foreground">{daysText(totals.takenDays)}</span> taken
                  {totals.waitingDays > 0 && (
                    <>
                      , <span className="font-semibold text-waiting">{daysText(totals.waitingDays)}</span> waiting
                    </>
                  )}
                  , {totals.applications} {totals.applications === 1 ? 'application' : 'applications'}.
                  {balanceShown && balanceSinceDate(balanceShown) && <> Casual Leave before {balanceSinceDate(balanceShown)} is not counted in the balance.</>}
                </p>
              </GlassCard>
              <GlassCard className="max-md:p-3.5!">
                <ClMonthCalendar id="cl-month-calendar" year={year} month={selectedMonth} rows={yearRows} />
              </GlassCard>
            </div>
          )}
        </section>

        {/* The balance's running story (2026-11-02); left out on an older server (no balance, no history endpoint). */}
        {elig.data?.balance && <ClBalanceHistory year={year} />}

        <RequestList<CasualLeaveRow>
          id="cl"
          title="Your applications"
          icon={CalendarClock}
          tone="violet"
          noun="Casual Leave requests"
          monthKind="taken"
          labels={{ month: 'Taken this month' }}
          views={views}
          monthSwitch={{ onChange: setMonth, min: firstMonth, max: lastMonth }}
          query={list}
          keyOf={(r) => r.id}
          dateOf={(r) => r.date}
          notice={focus.missing ? <FocusMissNote onDismiss={focus.dismiss} /> : undefined}
          emptyIcon={CalendarClock}
          emptyAction={
            canApply && !offNote ? (
              <Button variant="outline" onClick={() => setApplyOpen(true)}>
                <Plus aria-hidden="true" /> Apply for Casual Leave
              </Button>
            ) : undefined
          }
          renderItem={(r) => (
            <RequestCard
              icon={PORTION_ICON[r.portion]}
              tone="violet"
              title={dayText(r.date)}
              when={
                <>
                  {PORTION_LONG[r.portion]}
                  <span className="text-foreground/75"> · {daysText(PORTION_DAYS[r.portion])}</span>
                  {/* 2026-11-02: written by an approved HR attendance edit. */}
                  {r.source === 'hr_edit' && <span className="font-semibold text-info"> · given by HR</span>}
                </>
              }
              pill={r.status === 'approved' ? <StatusPill tone="approved" size="sm">Approved</StatusPill> : r.status === 'rejected' ? <StatusPill tone="rejected" size="sm">Rejected</StatusPill> : undefined}
              reason={r.reason}
              status={r.status}
              approval={r.approval}
              sentAt={r.createdAt}
              comment={r.reviewComment}
              fallback={deciderFromFields({ status: r.status, name: r.reviewedBy, role: r.reviewerRole, at: r.reviewedAt })}
              // Owner 2026-11-24: a Casual Leave still waiting can be taken back (not one HR wrote: source "hr_edit").
              footer={<WithdrawButton module="casual_leave" id={r.id} status={r.status} source={r.source} label={`Casual Leave request for ${dayText(r.date)}`} />}
            />
          )}
        />
      </PageShell>
      <ClApplyDialog
        open={applyOpen}
        onOpenChange={(o) => {
          setApplyOpen(o)
          if (!o) setApplyDate(null)
        }}
        initialDate={applyDate}
        months={elig.data?.months}
        balance={balance}
        shift={shift}
        pipeline={pipeline}
        offNote={offNote}
        // The new request: its month (and year), in Waiting.
        onSent={(day) => {
          setMonth(monthOf(day) ?? currentMonth())
          views.setView('waiting')
        }}
      />
    </>
  )
}

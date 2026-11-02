import * as React from 'react'
import { Link } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarCheck, CalendarDays, ChevronRight, Clock, Ellipsis, HeartHandshake, PartyPopper, Plus, Send, Siren, Stethoscope, Umbrella, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiTile, PageHero, PageShell, StatusPill, useRequestViews, type ViewOptions } from '@/components/kit'
import { ClEntryCard } from '@/components/requests/ClEntryCard'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { OffNotice } from '@/components/requests/FormBits'
import { LeaveApplyDialog } from '@/components/requests/LeaveApplyDialog'
import { RequestCard } from '@/components/requests/RequestCard'
import { RequestList } from '@/components/requests/RequestList'
import { HERO_NO_KPIS_ON_PHONE } from '@/components/requests/phone'
import { showView } from '@/components/requests/show-view'
import { leaveRequestsApi, type LeaveRow } from '@/api/requests-api'
import { holidayApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { useCasualLeaveEligibility, useCasualLeaveRequests } from '@/hooks/useCasualLeave'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { pipelineSentence } from '@/lib/approval'
import { currentMonth, inMonthText, laterMonth, latestMonthOf, monthOf, monthTileLabel } from '@/lib/month-switch'
import { asPortion, asStatus, clCardState, isYearlyBalance, mergeUsageRows, yearMonths, yearTotals } from '@/lib/casual-leave'
import { leaveDayForMonth, leaveDaysText, leaveTitle, type ReasonCategory } from '@/lib/leave-form'
import { dayRangeText, newestFirst } from '@/lib/my-requests'
import { statusGroup } from '@/lib/request-views'

const CATEGORY_ICON: Record<ReasonCategory, LucideIcon> = { sick: Stethoscope, emergency: Siren, personal: HeartHandshake, other: Ellipsis }
const HALF_WORDS: Record<string, string> = { morning: 'morning', afternoon: 'afternoon' }

export default function Leave() {
  const { user } = useAuth()
  const [applyOpen, setApplyOpen] = React.useState(false)
  // The pipeline HR configured for leave, and the note when HR has switched leave requests off.
  const { workflow, offNote } = useApprovalWorkflow('leave')
  const { offNote: clOffNote } = useApprovalWorkflow('casual_leave')
  const pipeline = pipelineSentence(workflow, 'leave request')

  const list = useQuery({
    queryKey: ['leave-requests', user?.employeeId],
    queryFn: () => leaveRequestsApi.list(user!.employeeId),
    enabled: !!user,
  })
  const rows = React.useMemo(() => (list.data ? newestFirst(list.data, (r) => r.startDate) : undefined), [list.data])

  // "This month" without the switcher = approved leave on a day of this month (a 30 Sep - 2 Oct leave counts in October too).
  const today = new Date()
  const baseOptions: ViewOptions<LeaveRow> = {
    statusOf: (r) => r.status,
    month: { dateOf: (r) => leaveDayForMonth(r.startDate, r.endDate, today), kind: 'taken' },
  }
  // The month switcher (owner 2026-11-02): the four views hold only the leave whose dates touch the chosen month (a
  // 30 Sep - 2 Oct leave is in both months).
  const [month, setMonth] = useSelectedMonth()
  const viewOptions: ViewOptions<LeaveRow> = { ...baseOptions, scope: { ...month, daysOf: (r) => [r.startDate, r.endDate] } }
  const views = useRequestViews(rows, viewOptions)
  // The KPI tiles follow the month on screen too (owner 2026-11-02): the four views' counts ("Taken" = that month's
  // approved leave); a tile opens its view in that month. Only "Days off" is yearly (the year of that month).
  const inMonth = inMonthText(month, today)
  // The › arrow passes the current month only when a leave lies in a later month (as in the mobile app).
  const lastMonth = laterMonth(currentMonth(), latestMonthOf(rows ?? [], (r) => [r.startDate, r.endDate]) ?? currentMonth())
  // A notification's View button opens ?focus=<leave id>: its month, the view holding it, scrolled to and ringed.
  const focus = useFocusItem({ scope: 'leave', rows, idOf: (r) => r.id, views, viewOptions, setMonth })

  // Casual Leave lives on its own page; the card here shows this month and the year at a glance.
  const thisYear = today.getFullYear()
  const clElig = useCasualLeaveEligibility()
  const clList = useCasualLeaveRequests()
  // 2026-11-02: the yearly balance - the year's dials from the server's monthsUsage (incl. Casual Leave HR proposed on an
  // attendance edit), the card's words from the balance; an older server keeps this month's answer.
  const clRows = React.useMemo(
    () =>
      mergeUsageRows(
        (clList.data ?? []).map((r) => ({ id: r.id, date: r.date, portion: asPortion(r.portion), status: asStatus(r.status), source: r.source })),
        clElig.data?.monthsUsage,
      ),
    [clList.data, clElig.data?.monthsUsage],
  )
  const clMonths = React.useMemo(() => yearMonths(clRows, thisYear), [clRows, thisYear])
  const clTotals = React.useMemo(() => yearTotals(clRows, thisYear), [clRows, thisYear])
  const clState = clElig.data ? clCardState(clElig.data, today) : null
  const clBalance = isYearlyBalance(clElig.data) ? clElig.data!.balance : null
  const clFailed = (clElig.isError && !clElig.data) || (clList.isError && !clList.data)

  const all = rows ?? []
  // Approved leave days of the switcher's year (by the day a leave starts).
  const daysInYear = all
    .filter((r) => statusGroup(r.status) === 'approved' && r.startDate.startsWith(`${month.year}-`))
    .reduce((n, r) => n + (r.isHalfDay ? 0.5 : Number(r.totalDays) || 0), 0)

  // Phones only: the mobile app's "Upcoming Holiday" card under the list. Fetched only on a phone (the desktop page has no
  // such card), with the Holidays page's own query key, so it shares that cache.
  const isPhone = useIsPhone()
  const holidays = useQuery({
    queryKey: ['holidays', thisYear],
    queryFn: () => holidayApi.list(thisYear),
    staleTime: 30 * 60_000,
    enabled: isPhone,
  })
  const todayIso = format(today, 'yyyy-MM-dd')
  const nextHoliday = (holidays.data ?? [])
    .filter((h) => /^\d{4}-\d{2}-\d{2}/.test(h.date) && h.date.slice(0, 10) >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  return (
    <>
      <PageShell>
        <PageHero
          icon={<Send />}
          className={HERO_NO_KPIS_ON_PHONE}
          title={
            <>
              <span className="max-md:hidden">Leave</span>
              <span className="hidden max-md:inline">Leave Portal</span>
            </>
          }
          subtitle={
            <>
              <span className="max-md:hidden">Ask for leave and see who decided it. Casual Leave has its own page.</span>
              <span className="hidden max-md:inline">Your leave and Casual Leave</span>
            </>
          }
          actions={
            <Button size="lg" onClick={() => setApplyOpen(true)} disabled={!!offNote} className="max-md:h-11 max-md:px-5 max-md:text-[13.5px] max-md:font-semibold">
              <Plus aria-hidden="true" /> <span className="max-md:hidden">Apply for leave</span>
              <span className="hidden max-md:inline">Apply Leave</span>
            </Button>
          }
          kpis={
            <>
              <KpiTile label="Waiting" value={list.data ? views.counts.waiting : null} icon={Clock} tone="amber" hint={`for a decision · ${inMonth}`} onClick={() => showView(views, 'waiting', 'leave')} />
              <KpiTile label={monthTileLabel('Taken', month, today)} value={list.data ? views.counts.approved : null} icon={CalendarDays} tone="sapphire" hint="approved requests" onClick={() => showView(views, 'approved', 'leave')} />
              <KpiTile label={`Days off in ${month.year}`} value={list.data ? daysInYear : null} format={(n) => (Number.isInteger(n) ? String(n) : n.toFixed(1))} unit="days" icon={CalendarCheck} tone="emerald" hint="approved leave · the whole year" />
              <KpiTile label="Rejected" value={list.data ? views.counts.rejected : null} icon={XCircle} tone="rose" hint={inMonth} onClick={() => showView(views, 'rejected', 'leave')} />
            </>
          }
        >
          {offNote && <OffNotice text={offNote} />}
        </PageHero>

        <ClEntryCard
          state={clState}
          months={clList.data ? clMonths : null}
          year={thisYear}
          takenDays={clTotals.takenDays}
          waitingDays={clTotals.waitingDays}
          balance={clBalance}
          loading={clElig.isPending}
          failed={clFailed}
          error={clElig.error ?? clList.error}
          onRetry={() => {
            void clElig.refetch()
            void clList.refetch()
          }}
          retrying={clElig.isFetching || clList.isFetching}
        />
        {clOffNote && <OffNotice text={clOffNote} />}

        <RequestList<LeaveRow>
          id="leave"
          title="Your leave requests"
          description="Newest first. Open the steps on a card to see who has looked at it."
          icon={Umbrella}
          noun="leave requests"
          monthKind="taken"
          labels={{ month: 'Taken this month' }}
          views={views}
          monthSwitch={{ onChange: setMonth, max: lastMonth }}
          query={list}
          keyOf={(r) => r.id}
          dateOf={(r) => r.startDate}
          notice={focus.missing ? <FocusMissNote onDismiss={focus.dismiss} /> : undefined}
          emptyIcon={Umbrella}
          emptyAction={
            <Button variant="outline" onClick={() => setApplyOpen(true)} disabled={!!offNote}>
              <Plus aria-hidden="true" /> Apply for leave
            </Button>
          }
          renderItem={(r) => {
            const cat = (r.reasonCategory ?? '') as ReasonCategory
            const half = r.isHalfDay ? `Half day${r.halfDaySlot ? `, ${HALF_WORDS[r.halfDaySlot] ?? r.halfDaySlot}` : ''}` : leaveDaysText(r.totalDays)
            return (
              <RequestCard
                icon={CATEGORY_ICON[cat] ?? Umbrella}
                tone={r.isHalfDay ? 'violet' : 'sapphire'}
                title={leaveTitle(r)}
                when={
                  <>
                    {dayRangeText(r.startDate, r.endDate)}
                    {half && <span className="text-foreground/75"> · {half}</span>}
                  </>
                }
                pill={statusGroup(r.status) === 'rejected' ? <StatusPill tone="rejected" size="sm">Rejected</StatusPill> : statusGroup(r.status) === 'approved' ? <StatusPill tone="approved" size="sm">Approved</StatusPill> : undefined}
                reason={r.reason}
                status={r.status}
                approval={r.approval}
                sentAt={r.createdAt}
                comment={r.hrComment}
              />
            )
          }}
        />

        {/* Phones: the mobile app's Upcoming Holiday card (nothing at all on the desktop page). */}
        {isPhone && nextHoliday && (
          <Link
            href="/employee/holidays"
            className="focus-ring hidden max-md:flex max-md:items-center max-md:gap-3 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-3 max-md:shadow-[var(--m-shadow-low)] max-md:active:opacity-85"
          >
            <span className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-lg max-md:bg-waiting-bg max-md:text-waiting" aria-hidden="true">
              <PartyPopper className="max-md:size-[18px]" />
            </span>
            <span className="max-md:min-w-0 max-md:flex-1">
              <span className="max-md:block max-md:text-[13.5px] max-md:font-semibold max-md:text-foreground">Upcoming Holiday</span>
              <span className="max-md:mt-0.5 max-md:block max-md:truncate max-md:text-[11.5px] max-md:text-muted-foreground">
                {nextHoliday.name} · {format(new Date(`${nextHoliday.date.slice(0, 10)}T00:00:00`), 'd MMM yyyy')}
              </span>
            </span>
            <ChevronRight className="max-md:size-[18px] max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
      </PageShell>
      <LeaveApplyDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        pipeline={pipeline}
        offNote={offNote}
        // The new request: its month, in Waiting.
        onSent={(day) => {
          setMonth(monthOf(day) ?? currentMonth())
          views.setView('waiting')
        }}
      />
    </>
  )
}

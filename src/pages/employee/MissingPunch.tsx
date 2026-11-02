import * as React from 'react'
import { useSearch } from 'wouter'
import { format } from 'date-fns'
import { CalendarDays, CheckCircle2, Clock, Fingerprint, LogIn, LogOut, Plus, Utensils, UtensilsCrossed, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GlassCard,
  KpiTile,
  PageHero,
  PageShell,
  StatusPill,
  deciderFromStamps,
  rowsInScope,
  useRequestViews,
  waitingInOtherMonths,
  type ViewOptions,
} from '@/components/kit'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { OffNotice } from '@/components/requests/FormBits'
import { MissingPunchDialog } from '@/components/requests/MissingPunchDialog'
import { RequestCard } from '@/components/requests/RequestCard'
import { RequestList } from '@/components/requests/RequestList'
import { HERO_NO_KPIS_ON_PHONE } from '@/components/requests/phone'
import { showView } from '@/components/requests/show-view'
import { useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { useCasualLeaveEligibility } from '@/hooks/useCasualLeave'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useAssignedShiftTimes, useMissingPunchMonth, useMissingPunchRequests } from '@/hooks/useMissingPunchRequests'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { pipelineSentence } from '@/lib/approval'
import { readFocusParams } from '@/lib/focus-item'
import { currentMonth, inMonthText, monthOf, monthViewLabel } from '@/lib/month-switch'
import { clockText, dayText, missingPunchViewOptions } from '@/lib/my-requests'
import { SLOT_LABEL, shiftTimesFrom, to12hLabel, slotTargets, type PunchSlot } from '@/lib/punch-time-picker'
import type { MissingPunchRequest } from '@/types'

const SLOT_ICON: Record<PunchSlot, LucideIcon> = { morning_in: LogIn, lunch_out: UtensilsCrossed, lunch_in: Utensils, evening_out: LogOut }
// Phones: the full names on the usual-times tiles (the app's slot cards), with no room to cut them short.
const PHONE_SLOT_WORDS: Record<PunchSlot, string> = { morning_in: 'Morning in', lunch_out: 'Lunch out', lunch_in: 'Lunch back in', evening_out: 'Evening out' }

export default function MissingPunch() {
  const [applyOpen, setApplyOpen] = React.useState(false)
  // The pipeline HR configured for missing punches, and the note when HR has switched them off.
  const { workflow, offNote } = useApprovalWorkflow('missing_punch')
  const pipeline = pipelineSentence(workflow)

  // Every request (the latest 300): the "already asked" reminder, the waiting-elsewhere note and what a link's request is
  // looked up in.
  const list = useMissingPunchRequests()
  // "This month" without the switcher = sent this month, any status (owner 2026-10-31).
  const baseOptions = missingPunchViewOptions<MissingPunchRequest>()
  // The month switcher (owner 2026-11-02): the four views hold only the requests for a PUNCH DATE in the chosen month,
  // from that month's own list (complete beyond the latest 300); the latest 300 stand in while it loads.
  const search = useSearch()
  const linkDate = React.useMemo(() => readFocusParams(search).date, [search])
  const [month, setMonth] = useSelectedMonth(monthOf(linkDate))
  const monthList = useMissingPunchMonth(month)
  const viewOptions: ViewOptions<MissingPunchRequest> = { ...baseOptions, scope: { ...month, daysOf: (r) => r.date } }
  const shown = monthList.data ?? list.data
  const monthViews = useRequestViews(shown, viewOptions)
  // The waiting-in-another-month note reads every request, not only this month's.
  const views = { ...monthViews, elsewhere: waitingInOtherMonths(list.data ?? [], viewOptions) }
  const listQuery = {
    // Skeleton while nothing of the month is on hand yet (not the month's empty state, which its own list may yet fill).
    isPending: (!shown && (list.isPending || monthList.isPending)) || (!monthList.data && monthList.isPending && rowsInScope(shown ?? [], viewOptions).length === 0),
    isError: list.isError || monthList.isError,
    error: monthList.error ?? list.error,
    isFetching: list.isFetching || monthList.isFetching,
    refetch: () => Promise.all([list.refetch(), monthList.refetch()]),
    data: shown,
  }
  // The KPI tiles follow the month on screen too (owner 2026-11-02): the four views' counts of that month (from the
  // month's own list once it is in); a tile opens its view in that month. A dash while the list shows its skeleton.
  const kpi = shown && !listQuery.isPending ? views.counts : null
  const inMonth = inMonthText(month)
  // A notification's View button opens ?focus=<request id> (or ?date= for a missing-punch alert about a day): its month,
  // the view holding it, scrolled to and ringed.
  const focus = useFocusItem({ scope: 'missing-punch', rows: list.data, idOf: (r) => r.id, dateOf: (r) => r.date, views, viewOptions, setMonth })

  // The shift for the picker's quick times: Casual Leave's shift halves (start, lunch, end) when known, else the assignment.
  const clElig = useCasualLeaveEligibility()
  const assigned = useAssignedShiftTimes()
  const shift = React.useMemo(() => shiftTimesFrom(clElig.data?.shift, assigned.data), [clElig.data?.shift, assigned.data])
  const targets = slotTargets(shift)
  const shiftKnown = targets.morning_in.fromShift || targets.evening_out.fromShift

  return (
    <>
      <PageShell>
        <PageHero
          icon={<Fingerprint />}
          className={HERO_NO_KPIS_ON_PHONE}
          title="Missing Punch"
          subtitle={
            <>
              <span className="max-md:hidden">Forgot to punch, or the machine missed you? Report it here. Once approved, the punch is added to your attendance.</span>
              <span className="hidden max-md:inline">Biometric punch regularization</span>
            </>
          }
          actions={
            <Button size="lg" onClick={() => setApplyOpen(true)} disabled={!!offNote} className="max-md:h-11 max-md:px-5 max-md:text-[13.5px] max-md:font-semibold">
              <Plus aria-hidden="true" /> Report a missing punch
            </Button>
          }
          kpis={
            <>
              <KpiTile label="Waiting" value={kpi ? kpi.waiting : null} icon={Clock} tone="amber" hint={`for a decision · ${inMonth}`} onClick={() => showView(views, 'waiting', 'missing-punch')} />
              <KpiTile label={monthViewLabel(month)} value={kpi ? kpi.month : null} icon={CalendarDays} tone="sapphire" hint="every request · any status" onClick={() => showView(views, 'month', 'missing-punch')} />
              <KpiTile label="Approved" value={kpi ? kpi.approved : null} icon={CheckCircle2} tone="emerald" hint={`added to attendance · ${inMonth}`} onClick={() => showView(views, 'approved', 'missing-punch')} />
              <KpiTile label="Rejected" value={kpi ? kpi.rejected : null} icon={XCircle} tone="rose" hint={`not added · ${inMonth}`} onClick={() => showView(views, 'rejected', 'missing-punch')} />
            </>
          }
        >
          {offNote && <OffNotice text={offNote} />}
        </PageHero>

        {/* Phones: the mobile app's intro card - blue tint, a 38px sapphire well with the fingerprint. */}
        <GlassCard className="flex flex-col gap-3 max-md:border-0! max-md:bg-accent! max-md:p-3.5! max-md:shadow-none! sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 max-md:flex max-md:items-start max-md:gap-3">
            <span className="hidden max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-lg max-md:bg-primary max-md:text-primary-foreground" aria-hidden="true">
              <Fingerprint className="max-md:size-5" />
            </span>
            <div className="max-md:min-w-0 max-md:flex-1">
              <h2 className="font-display text-lg font-semibold max-md:text-[14px] max-md:leading-5">
                <span className="max-md:hidden">How it works</span>
                <span className="hidden max-md:inline">Missing Punch Regularization</span>
              </h2>
              <p className="mt-1 text-[13.5px] text-muted-foreground max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">
                Pick the day, the punch you missed and the time. {pipeline ?? 'It goes for approval.'} You can report two or three
                different punches of the same day; we remind you when a punch is already asked for.
              </p>
            </div>
          </div>
          {shiftKnown && (
            <ul className="grid grid-cols-2 gap-2 text-[12.5px] sm:w-80" aria-label="Your usual punch times">
              {(Object.keys(SLOT_ICON) as PunchSlot[]).map((s) => {
                const Icon = SLOT_ICON[s]
                return (
                  <li
                    key={s}
                    className="flex items-center gap-2 rounded-lg bg-foreground/[0.04] px-2.5 py-1.5 max-md:grid max-md:grid-cols-[auto_1fr] max-md:gap-x-1.5 max-md:gap-y-0.5 max-md:bg-card max-md:px-3 max-md:py-2"
                  >
                    <Icon className="size-3.5 shrink-0 text-info" aria-hidden="true" />
                    <span className="min-w-0 truncate max-md:hidden">{SLOT_LABEL[s].replace(' Check-', ' ')}</span>
                    <span className="hidden max-md:block max-md:min-w-0 max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">{PHONE_SLOT_WORDS[s]}</span>
                    <span className="ml-auto font-semibold tabular-nums max-md:col-span-2 max-md:row-start-2 max-md:ml-0 max-md:text-[14.5px] max-md:leading-5 max-md:font-bold max-md:whitespace-nowrap">
                      {to12hLabel(targets[s].minutes)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </GlassCard>

        <RequestList<MissingPunchRequest>
          id="missing-punch"
          title="Your missing punch requests"
          description="Newest first."
          icon={Fingerprint}
          noun="missing punch requests"
          monthKind="submitted"
          labels={{ month: 'Sent this month' }}
          views={views}
          monthSwitch={{ onChange: setMonth }}
          query={listQuery}
          keyOf={(r) => r.id}
          dateOf={(r) => r.date}
          notice={
            focus.missing ? (
              <FocusMissNote onDismiss={focus.dismiss}>
                {focus.missingBy === 'date' && focus.requested
                  ? `You have not reported a missing punch for ${dayText(focus.requested)} yet. Use “Report a missing punch” to send one.`
                  : undefined}
              </FocusMissNote>
            ) : undefined
          }
          emptyIcon={Fingerprint}
          emptyAction={
            <Button variant="outline" onClick={() => setApplyOpen(true)} disabled={!!offNote}>
              <Plus aria-hidden="true" /> Report a missing punch
            </Button>
          }
          renderItem={(r) => {
            const slot = r.punchSlot ?? null
            const label = slot ? SLOT_LABEL[slot] : r.punchType === 'OUT' ? 'Check-Out' : 'Check-In'
            return (
              <RequestCard
                icon={slot ? SLOT_ICON[slot] : r.punchType === 'OUT' ? LogOut : LogIn}
                tone="sapphire"
                title={label}
                when={
                  <>
                    {dayText(r.date)}
                    <span className="text-foreground/75"> · at {clockText(r.punchTime)}</span>
                  </>
                }
                pill={r.status === 'approved' ? <StatusPill tone="approved" size="sm">Added</StatusPill> : r.status === 'rejected' ? <StatusPill tone="rejected" size="sm">Rejected</StatusPill> : undefined}
                reason={r.reason}
                status={r.status}
                approval={r.approval}
                sentAt={r.createdAt}
                comment={r.hrReviewComment ?? r.hodReviewComment}
                fallback={deciderFromStamps({ status: r.status, hodBy: r.hodReviewedBy, hrBy: r.hrReviewedBy })}
                footer={
                  <p className="hidden max-md:block max-md:truncate max-md:text-[10.5px] max-md:font-bold max-md:text-muted-foreground">
                    #MP-{r.id}
                    {r.createdAt && !Number.isNaN(Date.parse(r.createdAt)) ? ` · Sent ${format(new Date(r.createdAt), 'EEE, dd MMM yyyy')}` : ''}
                  </p>
                }
              >
                {r.status === 'approved' && <p className="text-[12.5px] font-medium text-approved">Added to your attendance.</p>}
              </RequestCard>
            )
          }}
        />
      </PageShell>
      <MissingPunchDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        shift={shift}
        rows={list.data ?? []}
        pipeline={pipeline}
        offNote={offNote}
        // The new request: the month of its punch date, in Waiting.
        onSent={(day) => {
          setMonth(monthOf(day) ?? currentMonth())
          views.setView('waiting')
        }}
      />
    </>
  )
}

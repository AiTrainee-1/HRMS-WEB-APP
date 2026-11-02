import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeftRight, CalendarDays, Clock, Info, LogIn, LogOut, Plus, ShieldCheck, Timer, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard, KpiTile, PageHero, PageShell, RingMeter, StatusPill, useRequestViews, type StatusTone, type ViewOptions } from '@/components/kit'
import { LateDeductionCard } from '@/components/employee/LateDeductionCard'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { FormNote, OffNotice } from '@/components/requests/FormBits'
import { PermissionApplyDialog } from '@/components/requests/PermissionApplyDialog'
import { RequestCard } from '@/components/requests/RequestCard'
import { RequestList } from '@/components/requests/RequestList'
import { HERO_NO_KPIS_ON_PHONE } from '@/components/requests/phone'
import { showView } from '@/components/requests/show-view'
import { attendanceApi, permissionApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { pipelineSentence } from '@/lib/approval'
import { currentMonth, inMonthText, isCurrentMonth, laterMonth, latestMonthOf, monthOf, monthTileLabel } from '@/lib/month-switch'
import { shiftPolicyOf } from '@/lib/attendance-flags'
import { toDeductionPreview } from '@/lib/deductions'
import { clockText, dayText, newestFirst, permissionViewOptions, permissionsUsedIn } from '@/lib/my-requests'
import { permissionDurationLabel, permissionOutcome, permissionTypeKey, permissionTypeLabel, permissionTypeOption, type PermissionOutcomeKind } from '@/lib/permissions'
import { yearMonthOf } from '@/lib/request-views'
import { cn } from '@/lib/utils'
import type { DeductionPreview, PermissionRequest, PermissionTypeKey } from '@/types'

const TYPE_ICON: Record<PermissionTypeKey, LucideIcon> = { morning_late_in: LogIn, evening_early_out: LogOut, middle_permission: ArrowLeftRight }
const OUTCOME_TONE: Record<PermissionOutcomeKind, StatusTone | null> = {
  pending: null,
  allowed: 'approved',
  approved: 'approved',
  excess: 'waiting',
  not_allowed: 'rejected',
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const NO_DEDUCTIONS: DeductionPreview = {
  permissionsUsed: 0,
  permissionOverageCount: 0,
  billableLateCount: 0,
  shiftDeductions: 0,
  salaryDeductionAmount: 0,
}

export default function Permissions() {
  const { user } = useAuth()
  const now = new Date()
  const [applyOpen, setApplyOpen] = React.useState(false)
  // The pipeline HR configured for permissions, and the note when HR has switched them off.
  const { workflow, offNote } = useApprovalWorkflow('permission')
  const pipeline = pipelineSentence(workflow, 'permission request')

  const list = useQuery({
    queryKey: ['permissions', user?.employeeId],
    queryFn: () => permissionApi.list(user!.employeeId),
    enabled: !!user,
  })
  const stats = useQuery({
    queryKey: ['shift-stats', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => attendanceApi.shiftStats(now.getMonth() + 1, now.getFullYear()),
  })

  const rows = React.useMemo(() => (list.data ? newestFirst(list.data, (r) => r.date) : undefined), [list.data])
  const baseOptions = permissionViewOptions<PermissionRequest>()
  // The month switcher (owner 2026-11-02): the four views hold only the permissions FOR a day of the chosen month. The
  // allowance card above stays on the current month.
  const [month, setMonth] = useSelectedMonth()
  const viewOptions: ViewOptions<PermissionRequest> = { ...baseOptions, scope: { ...month, daysOf: (r) => r.date } }
  const views = useRequestViews(rows, viewOptions)
  // A notification's View button opens ?focus=<permission id>: its month, the view holding it, scrolled to and ringed.
  const focus = useFocusItem({ scope: 'permissions', rows, idOf: (r) => r.id, views, viewOptions, setMonth })
  const all = rows ?? []
  // The KPI tiles follow the month on screen too (owner 2026-11-02): the four views' counts ("Taken" = that month's
  // approved permissions); a tile opens its view in that month. "Left this month" is always the current month's allowance.
  const inMonth = inMonthText(month, now)
  // The › arrow passes the current month only when a permission lies in a later month (as in the mobile app).
  const lastMonth = laterMonth(currentMonth(), latestMonthOf(all, (r) => r.date) ?? currentMonth())

  // Company rules from the shift stats (null on an older backend).
  const policy = stats.data ? shiftPolicyOf(stats.data) : null
  const deductions = stats.data ? (toDeductionPreview(stats.data) ?? { ...NO_DEDUCTIONS, policy }) : null
  // HR's cap on Allowed permissions per calendar month (default 3): the stats policy, then a row's copy, then the summary's.
  const monthlyLimit = policy?.permissionMonthlyCap ?? all[0]?.monthlyLimit ?? stats.data?.summary?.permissionMonthlyCap ?? 3
  // The server sends monthlyUsed only on create, so count this month's pending + approved ourselves.
  const used = permissionsUsedIn(all, now.getFullYear(), now.getMonth())
  const excessThisMonth = all.filter((r) => {
    const ym = yearMonthOf(r.date)
    return ym && ym[0] === now.getFullYear() && ym[1] === now.getMonth() + 1 && r.capStatus === 'excess'
  }).length
  const left = Math.max(0, monthlyLimit - used)
  // Phones: the app's segmented bar - one segment per permission allowed this month, filled for each one used.
  const segments = Math.min(Math.max(monthlyLimit, 1), 10)

  return (
    <>
      <PageShell>
        <PageHero
          icon={<Timer />}
          className={HERO_NO_KPIS_ON_PHONE}
          title={
            <>
              <span className="max-md:hidden">Permission</span>
              <span className="hidden max-md:inline">Permission Requests</span>
            </>
          }
          subtitle={
            <>
              <span className="max-md:hidden">Ask to come in late, leave early or step out - one hour each time.</span>
              <span className="hidden max-md:inline">Morning Late-In • Evening Early-Out • Middle One-Hour</span>
            </>
          }
          actions={
            <Button size="lg" onClick={() => setApplyOpen(true)} disabled={!!offNote} className="max-md:h-11 max-md:px-5 max-md:text-[13.5px] max-md:font-semibold">
              <Plus aria-hidden="true" /> <span className="max-md:hidden">Ask for permission</span>
              <span className="hidden max-md:inline">New Permission Request</span>
            </Button>
          }
          kpis={
            <>
              <KpiTile label="Waiting" value={list.data ? views.counts.waiting : null} icon={Clock} tone="amber" hint={`for a decision · ${inMonth}`} onClick={() => showView(views, 'waiting', 'permissions')} />
              <KpiTile label={monthTileLabel('Taken', month, now)} value={list.data ? views.counts.approved : null} icon={CalendarDays} tone="sapphire" hint="approved" onClick={() => showView(views, 'approved', 'permissions')} />
              <KpiTile
                label="Left this month"
                value={list.data ? left : null}
                unit={`of ${monthlyLimit}`}
                icon={ShieldCheck}
                tone="emerald"
                hint={isCurrentMonth(month, now) ? 'within your limit' : `within your ${MONTHS[now.getMonth()]} limit · always the current month`}
              />
              <KpiTile label="Rejected" value={list.data ? views.counts.rejected : null} icon={XCircle} tone="rose" hint={inMonth} onClick={() => showView(views, 'rejected', 'permissions')} />
            </>
          }
        >
          {offNote && <OffNotice text={offNote} />}
        </PageHero>

        <div className="grid gap-4 max-md:gap-2.5 lg:grid-cols-[1fr_1.1fr]">
          {/* Phones: the mobile app's stats card - a 54px "left" ring, "Used N of M" and the segmented bar. */}
          <div className="hidden max-md:flex max-md:flex-col max-md:gap-3 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]">
            <div className="max-md:flex max-md:items-center max-md:gap-3.5">
              <div className="max-md:flex max-md:size-[54px] max-md:shrink-0 max-md:flex-col max-md:items-center max-md:justify-center max-md:rounded-full max-md:border-[3px] max-md:border-primary max-md:bg-accent max-md:text-primary">
                <span className="max-md:text-[18px] max-md:leading-5 max-md:font-black max-md:tabular-nums">{list.data ? left : '–'}</span>
                <span className="max-md:text-[8px] max-md:leading-[10px] max-md:font-bold">left</span>
              </div>
              <div className="max-md:min-w-0 max-md:flex-1">
                <h2 className="font-display max-md:text-[14px] max-md:leading-5 max-md:font-semibold">Permissions this month</h2>
                <p className="max-md:mt-0.5 max-md:mb-2 max-md:text-[12px] max-md:text-muted-foreground">
                  Used {used} of {monthlyLimit}
                </p>
                <div className="max-md:flex max-md:gap-1" role="img" aria-label={`${used} of ${monthlyLimit} used this month`}>
                  {Array.from({ length: segments }).map((_, i) => (
                    <span
                      key={i}
                      className={cn('max-md:h-2 max-md:flex-1 max-md:rounded', i < used ? (used > monthlyLimit ? 'max-md:bg-warning' : 'max-md:bg-primary') : 'max-md:bg-border')}
                    />
                  ))}
                </div>
              </div>
            </div>
            {used >= monthlyLimit && (
              <FormNote tone="waiting" icon={AlertTriangle}>
                Monthly limit reached. You can still ask, but further permissions this month will be Overdue / Excess.
              </FormNote>
            )}
            {excessThisMonth > 0 && (
              <StatusPill tone="waiting" icon={AlertTriangle}>
                {excessThisMonth} Overdue / Excess this month
              </StatusPill>
            )}
          </div>
          <GlassCard variant="raised" className="flex flex-col gap-4 max-md:hidden sm:flex-row sm:items-center">
            <RingMeter value={Math.min(used, monthlyLimit)} max={monthlyLimit} silk size={112} label={`Permissions used in ${MONTHS[now.getMonth()]}`}>
              <span className="metric text-2xl">{used}</span>
              <span className="text-[11px] text-muted-foreground">of {monthlyLimit} used</span>
            </RingMeter>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h2 className="font-display text-lg font-semibold">Your {MONTHS[now.getMonth()]} allowance</h2>
              <p className="text-[13.5px] text-muted-foreground">
                Each permission is 1 hour. Your first {monthlyLimit} approved permissions each month are <b className="text-foreground">Allowed</b>. Any
                beyond that are <b className="text-foreground">Overdue / Excess</b>: they do not protect the day and count toward late deductions.
              </p>
              {used >= monthlyLimit && (
                <FormNote tone="waiting" icon={AlertTriangle}>
                  Monthly limit reached. You can still ask, but further permissions this month will be Overdue / Excess.
                </FormNote>
              )}
              {excessThisMonth > 0 && (
                <StatusPill tone="waiting" icon={AlertTriangle}>
                  {excessThisMonth} Overdue / Excess this month
                </StatusPill>
              )}
            </div>
          </GlassCard>
          {deductions && <LateDeductionCard deductions={deductions} monthlyLimit={monthlyLimit} lateCount={stats.data?.totalLateCount} />}
          {/* Phones: the app's "how this is calculated" box. */}
          <div className="hidden max-md:flex max-md:items-start max-md:gap-2 max-md:rounded-xl max-md:bg-card max-md:p-3">
            <Info className="max-md:mt-px max-md:size-4 max-md:shrink-0 max-md:text-primary" aria-hidden="true" />
            <p className="max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">
              Each permission is 1 hour. Your first {monthlyLimit} approved permissions each month are Allowed and protect that day. Any
              beyond that are Overdue / Excess: they do not protect the day and count toward late deductions.
            </p>
          </div>
        </div>

        <RequestList<PermissionRequest>
          id="permissions"
          title="Your permissions"
          description="Newest first."
          icon={Timer}
          noun="permission requests"
          monthKind="taken"
          labels={{ month: 'Taken this month' }}
          views={views}
          monthSwitch={{ onChange: setMonth, max: lastMonth }}
          query={list}
          keyOf={(r) => r.id}
          dateOf={(r) => r.date}
          notice={focus.missing ? <FocusMissNote onDismiss={focus.dismiss} /> : undefined}
          emptyIcon={Timer}
          emptyAction={
            <Button variant="outline" onClick={() => setApplyOpen(true)} disabled={!!offNote}>
              <Plus aria-hidden="true" /> Ask for permission
            </Button>
          }
          renderItem={(r) => {
            const key = permissionTypeKey(r)
            const outcome = permissionOutcome(r)
            const tone = OUTCOME_TONE[outcome.kind]
            const effect = permissionTypeOption(key)?.effect
            const duration = permissionDurationLabel(r.durationMinutes) || '1 hour'
            return (
              <RequestCard
                icon={key ? TYPE_ICON[key] : Timer}
                tone={outcome.kind === 'excess' ? 'amber' : 'sapphire'}
                title={permissionTypeLabel(r)}
                when={
                  <>
                    {dayText(r.date)}
                    <span className="text-foreground/75">
                      {' '}
                      · {clockText(r.permissionTime)} · {duration}
                    </span>
                  </>
                }
                pill={tone ? <StatusPill tone={tone} size="sm">{outcome.label}</StatusPill> : undefined}
                reason={r.reason}
                status={r.status}
                approval={r.approval}
                sentAt={r.createdAt}
                footer={
                  <p className="hidden max-md:flex max-md:items-center max-md:justify-between max-md:gap-2 max-md:text-[10.5px] max-md:font-bold">
                    <span className="max-md:text-muted-foreground">Req ID: #PR-{r.id}</span>
                    <span className="max-md:font-[800] max-md:text-primary">{duration}</span>
                  </p>
                }
              >
                {outcome.kind === 'allowed' && effect && <p className="text-[12.5px] font-medium text-approved">{effect}</p>}
                {outcome.kind === 'excess' && (
                  <p className="text-[12.5px] font-medium text-waiting">
                    Beyond your monthly limit of {r.monthlyLimit ?? monthlyLimit}: it does not protect this day and counts toward late deductions.
                  </p>
                )}
              </RequestCard>
            )
          }}
        />
      </PageShell>
      <PermissionApplyDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        rows={all}
        monthlyLimit={monthlyLimit}
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

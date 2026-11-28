import * as React from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  CirclePause,
  ClipboardList,
  Clock,
  Hourglass,
  Info,
  Landmark,
  ListChecks,
  OctagonX,
  Send,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ApprovalState,
  EASE_OUT,
  ErrorState,
  GlassCard,
  MoneyText,
  RingMeter,
  SectionHeader,
  SkeletonList,
  StatusPill,
  ThreadProgress,
  Timeline,
  deciderForAdvance,
  formatWhen,
  relativeTime,
  type TimelineItem,
} from '@/components/kit'
import { WithdrawButton } from '@/components/requests/WithdrawButton'
import { useMyAdvance } from '@/hooks/useAdvances'
import { formatINR } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  approvedAmountText,
  askedNote,
  countdownText,
  decisionRemarkOf,
  decisionTitle,
  deleteRowText,
  earnedBasisView,
  limitWhenAppliedText,
  remarkLine,
  repaidRatio,
  reviewText,
  salaryAdvanceRuleText,
  salaryAdvanceWindow,
  scheduleLook,
  scheduleTitle,
  statusText,
  termLoanBlock,
  termLoanServiceView,
  termLoanWindow,
  windowDeadline,
  windowHeadline,
  windowProgress,
  windowStrip,
  type AdvanceDecisionRow,
  type AdvanceEligibility,
  type AdvanceEvent,
  type EarnedBasis,
  type MyAdvance,
  type ScheduleRow,
  type TermLoanService,
} from '@/lib/advances'

const TYPE_ICON: Record<'general' | 'term', LucideIcon> = { general: Wallet, term: Landmark }

/** The current time, refreshed every `ms` (for a countdown written in words; it never animates). */
function useNow(ms = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}

/**
 * When applications are open (owner 2026-11-26): a Salary Advance only on the 21st and 22nd of each month (factory
 * time; the days come from the server's window), a Term Loan on any day. The banner is the Salary Advance window: open = green seam with the time left; closed =
 * amber with when it opens; a thread shows how far through the period we are; a line under it says a Term Loan can be
 * applied for on any day. An older server sends one window for both forms (the 20th to the month end): the banner then
 * shows that one, worded by the server.
 */
export function WindowBanner({ eligibility }: { eligibility: AdvanceEligibility }) {
  const w = salaryAdvanceWindow(eligibility)
  // The current server: each form has its own window, and a Term Loan has none (and is not offered at all to an employee
  // who is not staff: no "any day" line then).
  const separate = !!eligibility.windows
  const termAnyDay = separate && termLoanWindow(eligibility) === null && !termLoanBlock(eligibility).hidden
  const now = useNow()
  const left = countdownText(now, windowDeadline(w))
  const open = w.isOpen
  const rule = salaryAdvanceRuleText(w, eligibility.salaryAdvance.rules)
  return (
    <GlassCard
      variant="stitched"
      tone={open ? 'emerald' : 'amber'}
      className="flex flex-col gap-4 max-md:p-3.5! sm:flex-row sm:items-center sm:gap-6"
      data-testid="settlement-window-banner"
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative grid size-14 shrink-0 place-items-center rounded-2xl border max-md:hidden',
          open ? 'border-approved-border bg-approved-bg text-approved' : 'border-waiting-border bg-waiting-bg text-waiting',
        )}
      >
        {open ? <CalendarCheck2 className="size-6" /> : <CalendarClock className="size-6" />}
        {open && <span className="pulse-ring absolute inset-0 rounded-2xl text-approved" />}
      </span>
      <div className="min-w-0 flex-1 max-md:hidden">
        <p className="label-caps text-muted-foreground">{separate ? 'Salary Advance window' : 'Applications'}</p>
        <p className="font-display mt-0.5 text-[22px] leading-7 font-semibold">{windowHeadline(w)}</p>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          {left && (
            <span className={cn('font-semibold', open ? 'text-approved' : 'text-waiting')}>
              {open ? `Closes in ${left}. ` : `Opens in ${left}. `}
            </span>
          )}
          {separate ? rule : w.message}
        </p>
        <ThreadProgress
          className="mt-3"
          value={Math.round(windowProgress(w) * 100)}
          label={open ? 'How much of this month’s Salary Advance window has passed' : 'How close the next Salary Advance window is'}
        />
        {termAnyDay && (
          <p className="mt-3 flex items-center gap-2 border-t hairline pt-3 text-[13px] text-muted-foreground" data-testid="settlement-term-any-day">
            <CheckCircle2 className="size-4 shrink-0 text-approved" aria-hidden="true" />
            <span>
              <span className="font-semibold text-foreground">Term Loan: </span>you can apply on any day.
            </span>
          </p>
        )}
        {/* HR switched new applications off (Approval Workflow Control): said here too, not only in the cards' reasons. */}
        {eligibility.workflowMessage && (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] font-semibold text-waiting">
            <CirclePause className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {eligibility.workflowMessage}
          </p>
        )}
      </div>
      <PhoneWindow eligibility={eligibility} />
    </GlassCard>
  )
}

/**
 * Phones only (< 768px): the mobile app's window banner - the headline and the rule, the days left (or to go) as a big
 * number, a strip of the month with the Salary Advance window's days lit (the 21st and 22nd) and a ring on today,
 * and the line that a Term Loan can be applied for on any day.
 */
function PhoneWindow({ eligibility: e }: { eligibility: AdvanceEligibility }) {
  const w = salaryAdvanceWindow(e)
  const separate = !!e.windows
  const termAnyDay = separate && termLoanWindow(e) === null && !termLoanBlock(e).hidden
  const strip = windowStrip(w, e.today)
  const big = w.isOpen ? w.daysLeft : w.daysUntilOpen
  const unit = w.isOpen ? (big === 1 ? 'day left' : 'days left') : big === 1 ? 'day to go' : 'days to go'
  const rule = separate ? salaryAdvanceRuleText(w, e.salaryAdvance.rules) : w.message
  return (
    <div className="hidden max-md:flex max-md:flex-col max-md:gap-3">
      <div className="max-md:flex max-md:items-center max-md:gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'max-md:grid max-md:size-[42px] max-md:shrink-0 max-md:place-items-center max-md:rounded-[14px]',
            w.isOpen ? 'max-md:bg-approved-bg max-md:text-approved' : 'max-md:bg-waiting-bg max-md:text-waiting',
          )}
        >
          {w.isOpen ? <CalendarCheck2 className="max-md:size-[22px]" /> : <CalendarClock className="max-md:size-[22px]" />}
        </span>
        <div className="max-md:min-w-0 max-md:flex-1">
          {separate && <p className="max-md:text-[10px] max-md:font-extrabold max-md:tracking-[0.06em] max-md:text-muted-foreground max-md:uppercase">Salary Advance window</p>}
          <p className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:leading-5 max-md:font-bold">{windowHeadline(w)}</p>
          {rule && <p className="max-md:mt-0.5 max-md:text-[12px] max-md:leading-[17px] max-md:text-muted-foreground">{rule}</p>}
        </div>
        <p className="max-md:flex max-md:min-w-14 max-md:flex-col max-md:items-center">
          <span
            className={cn(
              'max-md:font-[family-name:var(--font-display)] max-md:text-[26px] max-md:leading-[30px] max-md:font-bold max-md:tabular-nums',
              w.isOpen ? 'max-md:text-approved' : 'max-md:text-waiting',
            )}
          >
            {big}
          </span>
          <span className="max-md:text-[10px] max-md:font-bold max-md:text-muted-foreground">{unit}</span>
        </p>
      </div>
      {strip && (
        <div className="max-md:flex max-md:flex-col max-md:gap-1" aria-hidden="true">
          <div className="max-md:relative max-md:h-2 max-md:rounded max-md:bg-border">
            {/* at least a few points wide, so a 3-day window still reads as a lit stretch */}
            <span
              className="max-md:absolute max-md:inset-y-0 max-md:rounded max-md:bg-success max-md:opacity-85"
              style={{ left: `${strip.startPct}%`, width: `${Math.max(strip.endPct - strip.startPct, 3)}%` }}
            />
            <motion.span
              className={cn(
                'max-md:absolute max-md:top-1/2 max-md:-mt-2 max-md:-ml-2 max-md:size-4 max-md:rounded-full max-md:border-[3px] max-md:bg-card',
                w.isOpen ? 'max-md:border-success' : 'max-md:border-warning',
              )}
              style={{ left: `${strip.todayPct}%` }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.42, ease: EASE_OUT, delay: 0.2 }}
            />
          </div>
          <div className="max-md:relative max-md:flex max-md:h-3.5 max-md:justify-between max-md:text-[10px] max-md:font-semibold max-md:text-muted-foreground">
            <span>1</span>
            <span className="max-md:absolute max-md:-translate-x-1/2 max-md:font-extrabold max-md:text-approved" style={{ left: `${strip.startPct}%` }}>
              {strip.toDay > strip.fromDay ? `${strip.fromDay}–${strip.toDay}` : `${strip.fromDay}`}
            </span>
            <span>{strip.lastDay}</span>
          </div>
        </div>
      )}
      {termAnyDay && (
        <p className="max-md:flex max-md:items-center max-md:gap-2 max-md:border-t max-md:border-input max-md:pt-2.5 max-md:text-[12.5px] max-md:leading-[17px] max-md:text-secondary-foreground">
          <CheckCircle2 className="max-md:size-[15px] max-md:shrink-0 max-md:text-approved" aria-hidden="true" />
          <span>
            <span className="max-md:font-semibold max-md:text-foreground">Term Loan: </span>you can apply on any day.
          </span>
        </p>
      )}
      {e.workflowMessage && (
        <p className="max-md:flex max-md:items-start max-md:gap-2 max-md:rounded-xl max-md:bg-waiting-bg max-md:p-3 max-md:text-[12px] max-md:leading-[17px] max-md:font-semibold max-md:text-waiting">
          <CirclePause className="max-md:mt-px max-md:size-4 max-md:shrink-0" aria-hidden="true" />
          {e.workflowMessage}
        </p>
      )}
    </div>
  )
}

/**
 * What the Salary Advance limit is taken from (2026-11-26): the salary earned from the 1st to the 20th, the working days
 * (present shifts + paid holidays, split when the server says), the monthly salary and the limit; "earned so far" while
 * the 20th is not over. Nothing when the server sends no `earned` (after the window, no salary, an older server).
 */
export function EarnedBasisPanel({ earned, monthlySalary, className }: { earned: EarnedBasis | null | undefined; monthlySalary?: number | null; className?: string }) {
  const view = earnedBasisView(earned, monthlySalary)
  if (!view) return null
  return (
    <section aria-label="What your limit is taken from" className={cn('flex flex-col gap-2 rounded-xl border border-border p-3', className)} data-testid="advance-earned-basis">
      <p className="text-[12.5px] font-semibold">{view.title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {view.figures.map((f) => (
          <div key={f.key} className="min-w-0">
            <dt className="text-[10.5px] font-bold tracking-[0.03em] text-muted-foreground uppercase">{f.label}</dt>
            <dd className={cn('text-[15px] font-bold tabular-nums', f.key === 'limit' && 'text-ring')}>{f.value}</dd>
            {f.hint && <dd className="text-[11px] text-muted-foreground">{f.hint}</dd>}
          </div>
        ))}
      </dl>
      {view.note && (
        <p className="flex items-start gap-1.5 text-[12px] text-waiting">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {view.note}
        </p>
      )}
    </section>
  )
}

/**
 * The Term Loan's months-of-service rule when it is not met yet (2026-11-26): how far along ("5/6 months of service") as a
 * thin bar, and from when. The server's sentence itself is shown by the caller (it is the Term Loan's reason). Only for
 * a loan blocked by the service rule (`termLoanBlock(...).showService`); `hideDate` when the caller already says the date.
 */
export function ServiceProgress({ service, hideDate, className }: { service: TermLoanService | null | undefined; hideDate?: boolean; className?: string }) {
  const view = termLoanServiceView(service)
  const eligibleFrom = hideDate ? null : view?.eligibleFrom
  if (!view || (!view.progress && !eligibleFrom)) return null
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-testid="term-loan-service">
      {view.ratio != null && <ThreadProgress value={Math.round(view.ratio * 100)} label={view.progress ?? 'Months of service'} />}
      <p className="flex flex-wrap justify-between gap-x-3 text-[12px] font-semibold">
        {view.progress && <span>{view.progress}</span>}
        {eligibleFrom && <span>{eligibleFrom}</span>}
      </p>
    </div>
  )
}

/**
 * Why a Term Loan cannot be applied for, as every place says it (shared app behaviour, 2026-11-28): the server's reason,
 * the months-of-service bar only when the service rule blocks it, and the next step by `code` - "You can apply again
 * from 1 December 2026", or a link to the request still waiting / the loan being repaid (`onOpen` opens its details).
 */
export function TermLoanBlockNote({
  eligibility,
  onOpen,
  showReason = true,
}: {
  eligibility: AdvanceEligibility
  onOpen?: (id: number) => void
  /** False when the caller already shows the reason above. */
  showReason?: boolean
}) {
  const block = termLoanBlock(eligibility)
  if (!block.reason) return null
  const action = block.action
  return (
    <>
      {showReason && <p>{block.reason}</p>}
      {block.showService && <ServiceProgress service={eligibility.termLoan.service} hideDate={action?.kind === 'date'} className="mt-2" />}
      {action?.kind === 'date' && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold" data-testid="term-loan-next-date">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          {action.text}
        </p>
      )}
      {action?.kind === 'open' && onOpen && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 min-h-11 w-fit sm:min-h-8 max-md:h-9 max-md:min-h-9"
          onClick={() => onOpen(action.id)}
          data-testid="term-loan-open-request"
        >
          <ClipboardList aria-hidden="true" /> {action.text}
        </Button>
      )}
    </>
  )
}

/** "How it works": the server's rules and approval path, word for word. */
export function RulesCard({ eligibility }: { eligibility: AdvanceEligibility }) {
  if (eligibility.rules.length === 0 && !eligibility.approvalPath) return null
  return (
    <GlassCard className="flex flex-col gap-3 max-md:gap-2.5 max-md:p-3.5!">
      <SectionHeader as="h3" icon={ListChecks} tone="slate" title="How it works" />
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] text-foreground/85 marker:text-brand-blue max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">
        {eligibility.rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {eligibility.approvalPath && (
        <p className="text-[12.5px] text-muted-foreground">
          Who approves: <span className="font-semibold text-foreground">{eligibility.approvalPath}</span>
        </p>
      )}
    </GlassCard>
  )
}

/** A thin repaid-so-far bar with its numbers written next to it. */
function RepaidBar({ a, className }: { a: MyAdvance; className?: string }) {
  const base = a.approvedAmount ?? a.amount
  const ratio = repaidRatio(base, a.deductedTotal)
  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[12.5px]">
        <span>
          Repaid <span className="font-bold tabular-nums">{formatINR(a.deductedTotal)}</span>
          <span className="text-muted-foreground"> of {formatINR(base)}</span>
        </span>
        {a.status === 'approved' && (
          <span className="font-semibold text-rejected tabular-nums">{formatINR(a.balanceDue)} left</span>
        )}
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden="true">
        <motion.span
          className="absolute inset-y-0 left-0 origin-left rounded-full"
          style={{ width: `${ratio * 100}%`, background: 'var(--success)' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        />
      </div>
    </div>
  )
}

/**
 * Where an application stands: while it waits "With HR" / "Under review" (never the steps after HR, owner 2026-11-28 -
 * so not the `approval` block, which only knows HR); once decided, who decided.
 */
function AdvanceState({ a, className }: { a: MyAdvance; className?: string }) {
  const waiting = a.status === 'pending'
  return (
    <ApprovalState
      approval={waiting ? null : a.approval}
      fallback={deciderForAdvance(a)}
      status={a.status}
      pendingLabel={reviewText(a) ?? undefined}
      className={className}
    />
  )
}

/** One application: type, status in words, asked vs approved, repayment progress, next deduction, who decided. */
export function AdvanceCard({ advance: a, onOpen }: { advance: MyAdvance; onOpen: (id: number) => void }) {
  const Icon = TYPE_ICON[a.advanceType]
  const decided = a.status === 'approved' || a.status === 'closed'
  const remark = remarkLine(a)
  return (
    <GlassCard className="flex h-full flex-col gap-3 max-md:relative max-md:p-3.5! max-md:active:opacity-85">
      <div className="flex items-start gap-3 max-md:hidden">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg border',
            a.advanceType === 'term' ? 'border-violet-border bg-violet-bg text-violet' : 'border-info-border bg-info-bg text-info',
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{a.typeLabel}</h3>
          <p className="text-[12.5px] text-muted-foreground">
            {a.appliedBy === 'hr' ? 'Recorded by HR' : 'You applied'}
            {a.createdAt ? ` ${relativeTime(a.createdAt)}` : ''}
          </p>
        </div>
        <StatusPill status={a.status} size="sm">
          {statusText(a)}
        </StatusPill>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 max-md:hidden">
        <div>
          <p className="label-caps text-muted-foreground">{decided ? 'Approved' : 'Asked for'}</p>
          <MoneyText value={decided ? (a.approvedAmount ?? a.amount) : a.requestedAmount} className="metric text-[24px]" />
          {decided && <span className="sr-only">{approvedAmountText(a)}</span>}
        </div>
        {decided && a.approvedLess && (
          <p className="pb-1 text-[12.5px] text-muted-foreground" aria-hidden="true">
            You asked for <span className="font-semibold text-foreground">{formatINR(a.requestedAmount)}</span>
          </p>
        )}
        {/* A Salary Advance approved rounded up to the nearest ₹500 (Automation Method, 2026-11-27). */}
        {decided && a.approvedMore && (
          <p className="pb-1 text-[12.5px] text-muted-foreground" aria-hidden="true">
            Rounded up from <span className="font-semibold text-foreground">{formatINR(a.requestedAmount)}</span> asked
          </p>
        )}
        {a.advanceType === 'term' && a.repaymentMonths && a.emiAmount > 0 && a.status !== 'rejected' && (
          <p className="pb-1 text-[12.5px] text-muted-foreground">
            <span className="font-semibold text-foreground">{formatINR(a.emiAmount)}</span> a month × {a.repaymentMonths}
          </p>
        )}
      </div>

      {decided && <RepaidBar a={a} className="max-md:hidden" />}
      {a.status !== 'rejected' && a.status !== 'closed' && (a.nextDeduction || a.deductionLabel) && (
        <p className="text-[12.5px] text-muted-foreground max-md:hidden">
          {a.nextDeduction ? (
            <>
              Next: <span className="font-semibold text-foreground">{formatINR(a.nextDeduction.amount)}</span> from your{' '}
              {a.nextDeduction.label} salary
            </>
          ) : (
            <>Deducted from {a.deductionLabel} salary</>
          )}
          {a.scheduleIsEstimate && ' (if approved)'}
        </p>
      )}
      {remark && <p className="text-[12.5px] break-words text-muted-foreground max-md:hidden">{remark}</p>}

      <div className="mt-auto flex flex-col gap-3 pt-1 max-md:hidden">
        <AdvanceState a={a} />
        <Button variant="outline" className="min-h-11 self-start sm:min-h-9" onClick={() => onOpen(a.id)}>
          <ClipboardList aria-hidden="true" /> See details
          <span className="sr-only"> of this {a.typeLabel}</span>
        </Button>
      </div>
      <PhoneRecordBody a={a} />
      {/* Phones: the whole card opens the details, as in the app (a real button stretched over the card). */}
      <button type="button" onClick={() => onOpen(a.id)} className="focus-ring hidden max-md:absolute max-md:inset-0 max-md:z-10 max-md:block max-md:rounded-xl">
        <span className="sr-only">See details of this {a.typeLabel}</span>
      </button>
    </GlassCard>
  )
}

/** "25 Oct 2026" in the device's time zone; '' when it is not a date. */
function appliedOn(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : format(d, 'd MMM yyyy')
}

/** A figure of the phone record card: 10.5px uppercase label, 18px Plus Jakarta figure, an optional small line. */
function PhoneFigure({
  label,
  value,
  note,
  align,
  valueClass,
  noteClass,
}: {
  label: string
  value: string
  note?: string
  align?: 'end'
  valueClass?: string
  noteClass?: string
}) {
  return (
    <div className={cn('max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:gap-px', align === 'end' && 'max-md:items-end')}>
      <p className="max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:text-muted-foreground max-md:uppercase">{label}</p>
      <p className={cn('max-md:font-[family-name:var(--font-display)] max-md:text-[18px] max-md:leading-6 max-md:font-bold max-md:tabular-nums', valueClass)}>{value}</p>
      {note && <p className={cn('max-md:text-[11px] max-md:font-semibold max-md:text-muted-foreground', noteClass)}>{note}</p>}
    </div>
  )
}

/** Phones only (< 768px): the mobile app's RecordCard - type, when and why, status; who decided; asked / approved,
 *  EMI and still owed; the repaid bar; and what is deducted next. */
function PhoneRecordBody({ a }: { a: MyAdvance }) {
  const Icon = TYPE_ICON[a.advanceType]
  const decided = a.status === 'approved' || a.status === 'closed'
  const base = a.approvedAmount ?? a.amount
  const ratio = decided ? repaidRatio(base, a.deductedTotal) : 0
  const applied = appliedOn(a.createdAt)
  const meta = [applied && `${a.appliedBy === 'hr' ? 'Recorded' : 'Applied'} ${applied}`, a.purpose].filter(Boolean).join(' · ')
  // The decision's remark (`decisionRemark`, else `notes`): the reason of a rejection in the footer, an approval's remark
  // as its own line above the figures.
  const remark = remarkLine(a)
  const footer =
    a.status === 'rejected'
      ? (remark ?? 'Nothing will be deducted from your salary.')
      : a.deductionLabel
        ? a.status === 'closed'
          ? `Deducted ${a.deductionLabel}`
          : a.nextDeduction
            ? `Next: ${formatINR(a.nextDeduction.amount)} from ${a.nextDeduction.label} salary`
            : `Deduction: ${a.deductionLabel}${a.status === 'pending' ? ' (if approved)' : ''}`
        : null
  return (
    <div className="hidden max-md:flex max-md:flex-col max-md:gap-3">
      <div className="max-md:flex max-md:items-center max-md:gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-[13px]',
            a.advanceType === 'term' ? 'max-md:bg-violet-bg max-md:text-violet' : 'max-md:bg-info-bg max-md:text-info',
          )}
        >
          <Icon className="max-md:size-5" />
        </span>
        <div className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:gap-0.5">
          <h3 className="max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:leading-5 max-md:font-bold">{a.typeLabel}</h3>
          {meta && <p className="max-md:truncate max-md:text-[12px] max-md:text-muted-foreground">{meta}</p>}
        </div>
        <StatusPill status={a.status} size="sm">
          {statusText(a)}
        </StatusPill>
      </div>
      {a.status !== 'pending' && <ApprovalState approval={a.approval} fallback={deciderForAdvance(a)} status={a.status} />}
      {decided && remark && <p className="max-md:line-clamp-2 max-md:text-[12px] max-md:break-words max-md:text-secondary-foreground">{remark}</p>}
      <div className="max-md:flex max-md:gap-3">
        <PhoneFigure
          label={decided ? 'Approved' : 'Asked for'}
          value={formatINR(decided ? base : a.requestedAmount)}
          note={askedNote(a) ?? undefined}
          noteClass="max-md:text-waiting"
        />
        {a.advanceType === 'term' && a.emiAmount > 0 && a.status !== 'rejected' && (
          <PhoneFigure label="Monthly EMI" value={formatINR(a.emiAmount)} note={a.repaymentMonths ? `${a.repaymentMonths} months` : undefined} />
        )}
        {decided && (
          <PhoneFigure
            label="Still owed"
            value={formatINR(a.balanceDue)}
            align="end"
            valueClass={a.balanceDue > 0 ? 'max-md:text-rejected' : 'max-md:text-approved'}
          />
        )}
      </div>
      {decided && (
        <div className="max-md:flex max-md:flex-col max-md:gap-1">
          <div className="max-md:relative max-md:h-1.5 max-md:overflow-hidden max-md:rounded-full max-md:bg-border" aria-hidden="true">
            <motion.span
              className="max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:origin-left max-md:rounded-full"
              style={{ width: `${ratio * 100}%`, background: a.status === 'closed' ? 'var(--success)' : 'var(--ring)' }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.38, ease: EASE_OUT }}
            />
          </div>
          <p className="max-md:text-[12px] max-md:text-muted-foreground max-md:tabular-nums">
            {formatINR(a.deductedTotal)} repaid of {formatINR(base)}
          </p>
        </div>
      )}
      {footer && (
        <p className="max-md:flex max-md:items-center max-md:gap-1.5 max-md:border-t max-md:border-border max-md:pt-2.5 max-md:text-[12.5px] max-md:text-secondary-foreground">
          {a.status === 'rejected' ? (
            <Info className="max-md:size-3.5 max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
          ) : (
            <CalendarDays className="max-md:size-3.5 max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
          )}
          <span className="max-md:line-clamp-2 max-md:flex-1">{footer}</span>
          <ChevronRight className="max-md:size-[18px] max-md:shrink-0 max-md:text-input" aria-hidden="true" />
        </p>
      )}
    </div>
  )
}

const SCHEDULE_ICON: Record<ScheduleRow['state'], LucideIcon> = {
  deducted: CheckCircle2,
  due: Clock,
  upcoming: CalendarClock,
  planned: CircleDashed,
}

function scheduleItems(rows: readonly ScheduleRow[]): TimelineItem[] {
  return rows.map((r) => {
    const look = scheduleLook(r)
    return {
      key: `${r.year}-${r.month}`,
      title: scheduleTitle(r),
      time: <span className="font-semibold text-foreground">{formatINR(r.amount)}</span>,
      description: look.stateLabel,
      icon: SCHEDULE_ICON[r.state],
      tone: look.tone,
      current: look.current,
    }
  })
}

const EVENT_LOOK: Record<AdvanceEvent['kind'], { icon: LucideIcon; tone: TimelineItem['tone'] }> = {
  applied: { icon: Send, tone: 'sapphire' },
  waiting: { icon: Hourglass, tone: 'amber' },
  approved: { icon: CheckCircle2, tone: 'emerald' },
  rejected: { icon: OctagonX, tone: 'rose' },
  deducted: { icon: Wallet, tone: 'emerald' },
  closed: { icon: CheckCircle2, tone: 'emerald' },
}

function eventItems(events: readonly AdvanceEvent[]): TimelineItem[] {
  return events.map((e, i) => ({
    key: `${e.kind}-${i}`,
    title: e.title,
    time: e.at ? formatWhen(e.at) ?? undefined : undefined,
    description: (
      <>
        {e.text}
        {e.by && <span className="block">By {e.by}</span>}
        {e.comment && <span className="mt-0.5 block italic">“{e.comment}”</span>}
      </>
    ),
    icon: EVENT_LOOK[e.kind].icon,
    tone: EVENT_LOOK[e.kind].tone,
    current: e.kind === 'waiting',
  }))
}

function decisionItems(rows: readonly AdvanceDecisionRow[]): TimelineItem[] {
  return rows.map((d, i): TimelineItem => ({
    key: `${d.action}-${i}`,
    title: decisionTitle(d),
    time: d.at ? formatWhen(d.at) ?? undefined : undefined,
    description: (
      <>
        {d.by && <span className="block">By {d.by}</span>}
        {d.remark && <span className="mt-0.5 block italic">“{d.remark}”</span>}
      </>
    ),
    icon: d.action === 'approved' ? CheckCircle2 : d.action === 'rejected' ? OctagonX : Hourglass,
    tone: d.action === 'approved' ? 'emerald' : d.action === 'rejected' ? 'rose' : 'amber',
    current: false,
  }))
}

/** The full story of one application, in a dialog: amounts, who decided, every repayment and every event. */
export function AdvanceDetailDialog({ id, onOpenChange }: { id: number | null; onOpenChange: (open: boolean) => void }) {
  const q = useMyAdvance(id)
  const a = q.data
  const decided = a && (a.status === 'approved' || a.status === 'closed')
  const base = a ? (a.approvedAmount ?? a.amount) : 0
  // A delete the server refused for good (409 in_workflow: HR forwarded it meanwhile; recorded_by_hr; not_pending): its
  // sentence replaces the delete row, which the refreshed application no longer offers. Cleared for another application.
  const [refusal, setRefusal] = React.useState<{ id: number; text: string } | null>(null)
  const refusalText = a && refusal?.id === a.id ? refusal.text : null
  const deleteText = a ? deleteRowText(a) : null
  const remark = a ? decisionRemarkOf(a) : null
  const limitText = a ? limitWhenAppliedText(a) : ''
  return (
    <Dialog open={id != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{a ? `${a.typeLabel} · ${formatINR(decided ? base : a.requestedAmount)}` : 'Application'}</DialogTitle>
          <DialogDescription>
            {a?.createdAt ? `${a.appliedBy === 'hr' ? 'Recorded by HR' : 'Applied'} ${formatWhen(a.createdAt) ?? ''}` : 'Your advance or loan.'}
          </DialogDescription>
        </DialogHeader>
        {!a ? (
          q.isError ? (
            <ErrorState error={q.error} what="this application" onRetry={() => q.refetch()} retrying={q.isFetching} compact />
          ) : (
            <SkeletonList variant="rows" count={3} label="Loading the application" />
          )
        ) : (
          <div className="flex flex-col gap-5 max-md:gap-3.5">
            <AdvanceState a={a} />

            {/* Owner 2026-11-26: the employee's own application can be deleted while it is still with HR (`canWithdraw`:
                never once HR forwarded it for approval - 409 in_workflow - nor once decided, nor one HR recorded). */}
            {refusalText ? (
              <p role="status" className="flex items-start gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting" data-testid="advance-delete-refused">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {refusalText}
              </p>
            ) : a.canWithdraw ? (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 max-md:flex-col max-md:items-stretch"
                data-testid="advance-delete-row"
              >
                <p className="text-[13px] text-muted-foreground">{deleteText}</p>
                <WithdrawButton
                  module="advance"
                  id={a.id}
                  status={a.status}
                  label={`${a.typeLabel} application`}
                  onDone={() => onOpenChange(false)}
                  onRefused={(text) => setRefusal({ id: a.id, text })}
                  className="max-md:w-full"
                />
              </div>
            ) : (
              deleteText && (
                <p className="text-[13px] text-muted-foreground" data-testid="advance-delete-note">
                  {deleteText}
                </p>
              )
            )}

            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              {decided && (
                <RingMeter value={a.deductedTotal} max={base} tone="emerald" label="Repaid so far" size={112}>
                  <span className="metric text-xl">{Math.round(repaidRatio(base, a.deductedTotal) * 100)}%</span>
                  <span className="text-[11px] text-muted-foreground">repaid</span>
                </RingMeter>
              )}
              <dl className="grid w-full flex-1 grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <Fact label="You asked for" value={formatINR(a.requestedAmount)} />
                {a.approvedAmount != null && (
                  <Fact
                    label="Approved"
                    value={formatINR(a.approvedAmount)}
                    hint={a.approvedLess ? 'Less than you asked for' : a.approvedMore ? `Rounded up from ${formatINR(a.requestedAmount)} asked` : undefined}
                  />
                )}
                {decided && <Fact label="Repaid so far" value={formatINR(a.deductedTotal)} />}
                {a.status === 'approved' && <Fact label="Still owed" value={formatINR(a.balanceDue)} strong />}
                {a.advanceType === 'term' && a.emiAmount > 0 && (
                  <Fact label="Each month" value={formatINR(a.emiAmount)} hint={a.repaymentMonths ? `for ${a.repaymentMonths} months` : undefined} />
                )}
                {a.deductionLabel && <Fact label="Deducted from" value={`${a.deductionLabel} salary`} />}
              </dl>
            </div>

            {limitText && <p className="text-[12.5px] text-muted-foreground">{limitText}</p>}

            {/* The decision's remark: the reason of a rejection, or why a different amount was approved. */}
            {remark && (
              <div className="rounded-lg bg-foreground/[0.04] px-3 py-2.5 text-[13.5px]" data-testid="advance-remark">
                <p className="label-caps text-muted-foreground">{a.status === 'rejected' ? 'Reason' : 'Remark'}</p>
                <p className="mt-1 break-words">{remark}</p>
              </div>
            )}

            {a.purpose && (
              <div className="rounded-lg bg-foreground/[0.04] px-3 py-2.5 text-[13.5px]">
                <p className="label-caps text-muted-foreground">What it is for</p>
                <p className="mt-1 break-words">{a.purpose}</p>
              </div>
            )}

            {a.schedule.length > 0 && (
              <section aria-label="Repayments" className="flex flex-col gap-3 max-md:rounded-xl max-md:border max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)]">
                <SectionHeader
                  as="h3"
                  icon={CalendarClock}
                  title="Repayments"
                  description={
                    a.scheduleIsEstimate
                      ? 'An estimate until it is decided: the approved amount or the first month may differ.'
                      : 'Deducted from your salary, month by month.'
                  }
                />
                <Timeline items={scheduleItems(a.schedule)} ariaLabel="Repayments" />
              </section>
            )}

            {a.timeline.length > 0 && (
              <section aria-label="What happened" className="flex flex-col gap-3 max-md:rounded-xl max-md:border max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)]">
                <SectionHeader as="h3" icon={ClipboardList} title="What happened" />
                <Timeline items={eventItems(a.timeline)} ariaLabel="What happened" />
              </section>
            )}

            {/* Every decision, newest first - only when there was more than one (HR reopened it); the story above already
                has a single decision. */}
            {a.history.length > 1 && (
              <section aria-label="Decisions" className="flex flex-col gap-3 max-md:rounded-xl max-md:border max-md:p-3.5 max-md:shadow-[var(--m-shadow-low)]">
                <SectionHeader as="h3" icon={ListChecks} title="Decisions" />
                <Timeline items={decisionItems(a.history)} ariaLabel="Decisions" />
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Fact({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground max-md:text-[10.5px] max-md:font-bold max-md:tracking-[0.03em] max-md:uppercase">{label}</dt>
      <dd className={cn('text-[15px] font-bold tabular-nums break-words max-md:font-[family-name:var(--font-display)] max-md:text-[17px]', strong && 'text-rejected')}>
        {value}
      </dd>
      {hint && <dd className="text-[12px] text-muted-foreground">{hint}</dd>}
    </div>
  )
}

import { motion } from 'framer-motion'
import { Check, ChevronRight, Clock, Hourglass, MapPinned, ShieldAlert, UserCog, UserRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApprovalState, DecisionBadge, GlassCard, StatusPill, Stepper, TONE_SOFT } from '@/components/kit'
import { hodCanAct, hodCanReject } from '@/lib/approval'
import {
  normalizeOutcome,
  outcomeLine,
  waitTone,
  waitingFor,
  type ApprovalCategory,
  type ApprovalItem,
  type ApprovalStatus,
} from '@/lib/approvals-history'
import {
  claimLine,
  empCode,
  empDepartment,
  empInitials,
  empName,
  hasMockedPunch,
  headSteps,
  itemApproval,
  itemReason,
  onDutyPunchLine,
} from '@/lib/approvals-items'
import { claimRaisedBy } from '@/lib/holiday-work'
import { cn } from '@/lib/utils'
import type { PendingHolidayWorkClaim } from '@/types'
import { badgeFor, typeLabel } from './words'
import { CATEGORY_META, TONE_STRIPE } from './categoryMeta'
import { RequestTiming } from './RequestTiming'

const WAIT_TONE = {
  fresh: 'bg-neutral-bg text-neutral border-neutral-border',
  aging: 'bg-waiting-bg text-waiting border-waiting-border',
  old: 'bg-rejected-bg text-rejected border-rejected-border',
} as const

/**
 * One request in a head's list: who (avatar, name, code, department), what, the day(s) it is for, when it was submitted
 * and how far ahead ("Applied 3 days before", RequestTiming), how long it has waited (Pending, coloured by age: under a
 * day grey, 1-2 days amber, 3+ days rose) or WHO decided it (Approved / Rejected: the decider band), the approval path,
 * the reason. Owner 2026-11-25: the list mixes every status (Pending first), so `status` is this row's own and a pending
 * row is highlighted with an amber frame. Clicking the card opens the request; there it is approved straight away or
 * rejected with the reason. The card's Approve / Reject open it too (Reject with the reason box focused).
 */
export function ApprovalRequestCard({
  category,
  status,
  item,
  now,
  busy,
  onOpen,
  onDecide,
}: {
  category: ApprovalCategory
  status: ApprovalStatus
  item: ApprovalItem
  now: Date
  busy?: boolean
  /** Opens the request's details (where the decision is made). */
  onOpen: () => void
  /** Opens the details ready for that decision ('rejected': the reason box is focused). */
  onDecide: (decision: 'approved' | 'rejected') => void
}) {
  const meta = CATEGORY_META[category]
  const TypeIcon = meta.icon
  const name = empName(item)
  const code = empCode(item)
  const dept = empDepartment(item)
  const badge = badgeFor(category, status, item)
  const approval = itemApproval(item)
  const pending = status === 'pending'
  const canApprove = pending && hodCanAct(approval, true)
  const canReject = pending && hodCanReject(approval, true)
  const line = pending ? null : outcomeLine(normalizeOutcome(item.outcome))
  const waited = pending ? waitingFor(item.createdAt, now) : null
  const age = waitTone(item.createdAt, now)
  const punchLine = category === 'on_duty' ? onDutyPunchLine(item) : null
  const mocked = category === 'on_duty' && hasMockedPunch(item)
  const reason = itemReason(category, item)
  const steps = headSteps(category, item)
  // A compensation claim: the overtime it is about, and who raised it (the employee themselves, or HR on their behalf).
  const overtimeLine = category === 'holiday_work' ? claimLine(item) : null
  const raisedBy = category === 'holiday_work' ? claimRaisedBy(item as unknown as PendingHolidayWorkClaim) : null

  return (
    <GlassCard
      padding="none"
      hover
      // The whole card opens the request (pointer); keyboard and screen readers use its Details button.
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return
        onOpen()
      }}
      className={cn(
        'relative flex h-full cursor-pointer flex-col overflow-hidden',
        // Waiting for this head's decision: an amber frame, so it stands out among the decided rows.
        pending && 'border-warning! shadow-[0_2px_14px_-4px_color-mix(in_srgb,var(--warning)_45%,transparent)] ring-1 ring-warning/60 max-md:border-[1.5px]',
      )}
      data-testid={`approval-card-${item.id}`}
      data-pending={pending || undefined}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', TONE_STRIPE[meta.tone])} />
      <div className="flex flex-1 flex-col gap-3 p-4 pl-5 max-md:gap-2.5 max-md:p-3.5! max-md:pl-[18px]! sm:p-5 sm:pl-6">
        {/* Who */}
        <div className="flex items-start gap-3 max-md:items-center max-md:gap-2.5">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-xl text-[14px] font-bold shadow-clay-sm max-md:size-10 max-md:rounded-full max-md:text-[14px] max-md:shadow-none!',
              category === 'resignation' ? 'bg-destructive text-destructive-foreground' : 'bg-brand-gradient text-white',
            )}
          >
            {empInitials(item)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15.5px] leading-5 font-semibold max-md:text-[14.5px]">{name}</h3>
            <p className="truncate text-[12.5px] text-muted-foreground max-md:mt-px max-md:text-[11.5px]">{[code, dept].filter(Boolean).join(' · ') || ' '}</p>
          </div>
          <StatusPill tone={badge.tone} size="sm" dot={false}>
            {badge.label}
          </StatusPill>
        </div>

        {/* What and when */}
        <div className="flex flex-col gap-1.5">
          <span
            className={cn(
              'inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-semibold max-md:gap-[5px] max-md:border-0 max-md:py-1 max-md:text-[12px] max-md:font-bold',
              TONE_SOFT[meta.tone],
            )}
          >
            <TypeIcon className="size-3.5 shrink-0 max-md:size-3" aria-hidden="true" />
            <span className="truncate">{typeLabel(category, item)}</span>
          </span>
          <RequestTiming category={category} item={item} />
          {punchLine && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground tabular-nums">
              <MapPinned className="size-3.5 shrink-0" aria-hidden="true" /> {punchLine}
            </p>
          )}
          {mocked && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rejected">
              <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" /> A punch may have a faked location
            </p>
          )}
          {overtimeLine && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground tabular-nums">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" /> {overtimeLine}
            </p>
          )}
          {raisedBy && (
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground" data-testid="claim-raised-by">
              {raisedBy === 'employee' ? <UserRound className="size-3.5 shrink-0" aria-hidden="true" /> : <UserCog className="size-3.5 shrink-0" aria-hidden="true" />}
              {raisedBy === 'employee' ? 'Raised by the employee' : 'Raised by HR'}
            </p>
          )}
        </div>

        {/* Waiting / who decided */}
        {pending ? (
          <div className="flex flex-wrap items-center gap-2">
            {waited && (
              <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold max-md:border-0 max-md:py-1 max-md:text-[11.5px] max-md:font-bold', WAIT_TONE[age])}>
                <Hourglass className="size-3" aria-hidden="true" /> {waited}
              </span>
            )}
            <ApprovalState approval={approval} />
          </div>
        ) : (
          line && <DecisionBadge text={line.text} tone={line.tone} note={line.note} />
        )}

        {steps.length > 1 && (
          <div className="scrollbar-none -mx-1 overflow-x-auto px-1 pt-1">
            <Stepper steps={steps} />
          </div>
        )}

        {reason && (
          <p className="line-clamp-2 border-l-2 border-foreground/15 pl-3 text-[13.5px] text-foreground/80 italic max-md:border-l-0 max-md:pl-0 max-md:text-[12px] max-md:text-secondary-foreground">“{reason}”</p>
        )}
      </div>

      {/* Actions. Phones: no footer band - the app's two tinted buttons sharing the row (Approve first), Details beside them. */}
      <div className="flex flex-wrap items-center gap-2 border-t hairline bg-foreground/[0.02] px-4 py-3 max-md:flex-nowrap max-md:border-t-0 max-md:bg-transparent max-md:px-3.5! max-md:pt-0 max-md:pb-3.5 max-md:pl-[18px]! sm:px-5">
        <Button variant="ghost" size="sm" onClick={onOpen} className="min-h-11 max-md:-ml-2 max-md:shrink-0 max-md:px-2 max-md:text-[12.5px] max-md:text-primary sm:min-h-8" aria-label={`Details of ${name}'s request`}>
          Details <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
        <div className="ml-auto flex gap-2 max-md:min-w-0 max-md:flex-1 max-md:flex-row-reverse">
          {canReject && (
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => onDecide('rejected')}
              aria-label={`Reject ${name}'s request`}
              title="Opens the request to write the reason for rejecting"
              className="min-h-11 max-md:h-10 max-md:min-h-10 max-md:flex-1 max-md:rounded-xl max-md:border-0 max-md:text-[12.5px] max-md:font-[800] sm:min-h-8"
            >
              <X aria-hidden="true" /> Reject
            </Button>
          )}
          {canApprove && (
            <motion.div whileTap={{ scale: 0.96 }} className="max-md:flex max-md:flex-1">
              <Button
                variant="success"
                size="sm"
                disabled={busy}
                onClick={() => onDecide('approved')}
                aria-label={`Approve ${name}'s request`}
                title="Opens the request to approve it"
                className="min-h-11 max-md:h-10 max-md:min-h-10 max-md:flex-1 max-md:rounded-xl max-md:border-0 max-md:text-[12.5px] max-md:font-[800] sm:min-h-8"
              >
                <Check aria-hidden="true" /> Approve
              </Button>
            </motion.div>
          )}
          {pending && !canApprove && !canReject && <span className="text-[12.5px] text-muted-foreground">Not yours to decide right now</span>}
        </div>
      </div>
    </GlassCard>
  )
}

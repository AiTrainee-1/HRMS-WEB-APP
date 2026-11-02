import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Clock, type LucideIcon } from 'lucide-react'
import { DecisionBadge, GlassCard, Stepper, StatusPill, TONE_SOFT, collapse, deciderFromApproval, waitingSince, type Decider, type Tone } from '@/components/kit'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { hasTrail, waitingText } from '@/lib/approval'
import { approvalPath } from '@/lib/decider'
import { statusGroup } from '@/lib/request-views'
import { cn } from '@/lib/utils'
import type { ApprovalProgress } from '@/types'

// Phones: the 4px left accent in the request's status colour (the app's LeaveCard / ClRequestCard edge). `!` because the
// card's glass border (an index.css class, emitted after the utilities) would otherwise reset the left edge.
const PHONE_EDGE = {
  waiting: 'max-md:border-l-4! max-md:border-l-warning!',
  approved: 'max-md:border-l-4! max-md:border-l-success!',
  rejected: 'max-md:border-l-4! max-md:border-l-destructive!',
  other: 'max-md:border-l-4! max-md:border-l-input!',
} as const

/**
 * One request as a card, the same on every request page: a tinted icon, the title (what it is) and when, a status pill
 * on the right, the reason, the page's own lines (children), then WHO decided it (owner 2026-10-31: prominent) or who it
 * is waiting for, with the approval path one tap away.
 *
 *   waiting  -> amber "Waiting for HR" + "waiting 3 days" + the horizontal path (You -> Department Head -> HR)
 *   decided  -> the green / rose DecisionBadge "Approved by HR (Meena) · 31 Oct, 10:05 AM" (+ the decider's note)
 *
 * Phones (< 768px): the mobile app's request card - a white card with a 4px left edge in the status colour, a 32px icon
 * well beside a 14px title and its 12px date line, the status badge on the right ("Waiting" grey while it waits), the
 * reason in italic quotes, the blue "Waiting for HR" chip (or who decided), and the APPROVAL PROGRESS trail always shown
 * (the app has no "see the steps" toggle). Highlighted cards (the open gate pass) keep their own accent.
 */
export function RequestCard({
  icon: Icon,
  tone = 'sapphire',
  title,
  when,
  pill,
  reason,
  children,
  approval,
  status,
  fallback,
  sentAt,
  comment,
  highlight,
  footer,
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  title: React.ReactNode
  /** The line under the title: the date(s) / time it is for. */
  when?: React.ReactNode
  /** The pill on the right (defaults to nothing; the decision band below says the outcome). */
  pill?: React.ReactNode
  reason?: string | null
  children?: React.ReactNode
  approval?: ApprovalProgress | null
  /** The row's raw status (pending / approved / rejected / pending_hr ...). */
  status: string
  /** Who decided an old request with no approval block (deciderFromFields / deciderFromStamps), when the row says. */
  fallback?: Decider | null
  sentAt?: string | null
  /** The decider's note (HR comment / review comment). */
  comment?: string | null
  /** The stitched seam: the one card to look at first (an open gate pass). */
  highlight?: boolean
  footer?: React.ReactNode
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const panelId = React.useId()
  const s = String(status ?? '').toLowerCase()
  const waiting = /pend|wait|review|submitted|requested|forwarded/.test(s)
  const decider = waiting ? null : (deciderFromApproval(approval) ?? fallback ?? null)
  const waitWords = waiting ? (waitingText(approval) ?? 'Waiting for a decision') : null
  const hasPath = approvalPath(approval, sentAt).length > 0
  const note = comment?.trim() ? `“${comment.trim()}”` : undefined
  const group = waiting ? 'waiting' : statusGroup(status)
  const trail = hasTrail(approval)

  return (
    <GlassCard
      variant={highlight ? 'stitched' : 'plain'}
      tone={tone}
      className={cn('flex h-full flex-col gap-3', 'max-md:gap-2 max-md:p-3.5!', !highlight && PHONE_EDGE[group], className)}
    >
      <div className="flex items-start gap-3 max-md:items-center max-md:gap-2.5">
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl border',
            'max-md:size-8 max-md:rounded-[10px] max-md:border-0 max-md:[&_svg]:size-4',
            TONE_SOFT[tone],
          )}
          aria-hidden="true"
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-5 font-semibold break-words max-md:text-[14px] max-md:leading-[18px]">{title}</h3>
          {when && <p className="mt-0.5 text-[13px] text-muted-foreground max-md:text-[12px] max-md:leading-4">{when}</p>}
        </div>
        {pill && <div className="shrink-0">{pill}</div>}
        {/* Phones: the app's grey "Waiting" badge on the right while nothing has been decided. */}
        {!pill && waiting && (
          <div className="hidden max-md:block max-md:shrink-0">
            <StatusPill tone="neutral" size="sm">
              Waiting
            </StatusPill>
          </div>
        )}
      </div>

      {reason && (
        <p className="text-[13.5px] leading-5 break-words text-foreground/85 max-md:text-[12px] max-md:leading-[17px] max-md:text-muted-foreground max-md:italic">
          {/* Phones: the app quotes the reason. */}
          <span className="hidden max-md:inline" aria-hidden="true">“</span>
          {reason}
          <span className="hidden max-md:inline" aria-hidden="true">”</span>
        </p>
      )}
      {children}

      <div className="mt-auto flex flex-col gap-2.5 max-md:mt-0 max-md:gap-2">
        {waiting ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="waiting" className="max-md:hidden">
              {waitWords}
            </StatusPill>
            {/* Phones: the app's blue WaitingChip. */}
            <StatusPill tone="info" icon={Clock} size="sm" className="hidden max-md:inline-flex max-md:text-[11.5px]">
              {waitWords}
            </StatusPill>
            {sentAt && <span className="text-xs text-muted-foreground max-md:text-[11px]">{waitingSince(sentAt)}</span>}
          </div>
        ) : decider ? (
          <DecisionBadge decider={decider} note={note} />
        ) : (
          note && <p className="text-[12.5px] text-muted-foreground max-md:text-[12px] max-md:text-secondary-foreground">Note: {note}</p>
        )}

        {/* Phones: the app shows the step trail on every card that has one. */}
        {trail && (
          <div className="hidden max-md:flex max-md:flex-col max-md:gap-1">
            <p className="max-md:text-[9.5px] max-md:leading-3 max-md:font-[800] max-md:tracking-[0.05em] max-md:text-muted-foreground">APPROVAL PROGRESS</p>
            <ApprovalTrail approval={approval} className="max-md:text-[11.5px] max-md:leading-4" />
          </div>
        )}

        {hasPath && (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={() => setOpen((v) => !v)}
              className="focus-ring -mx-1 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-md px-1 text-[12.5px] font-semibold text-brand-blue max-md:hidden sm:min-h-8"
            >
              <ChevronDown className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
              {open ? 'Hide the approval steps' : 'See the approval steps'}
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div id={panelId} key="steps" variants={collapse} initial="hidden" animate="show" exit="hidden" className="overflow-hidden max-md:hidden">
                  <div className="rounded-lg bg-foreground/[0.03] p-3">
                    <Stepper approval={approval} sentAt={sentAt} orientation="vertical" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
        {footer}
      </div>
    </GlassCard>
  )
}

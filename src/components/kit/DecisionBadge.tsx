import { motion } from 'framer-motion'
import { BadgeCheck, Hourglass, OctagonX, type LucideIcon } from 'lucide-react'
import { waitingText } from '@/lib/approval'
import { deciderFromApproval, deciderText, type Decider, type DecisionTone } from '@/lib/decider'
import { cn } from '@/lib/utils'
import type { ApprovalProgress } from '@/types'
import { popIn } from './motion'
import { StatusPill } from './StatusPill'

const TONE: Record<DecisionTone, { band: string; icon: LucideIcon }> = {
  approved: { band: 'bg-approved-bg text-approved border-approved-border', icon: BadgeCheck },
  rejected: { band: 'bg-rejected-bg text-rejected border-rejected-border', icon: OctagonX },
  waiting: { band: 'bg-info-bg text-info border-info-border', icon: Hourglass },
}

/**
 * WHO decided a request, prominently (owner 2026-10-31: every decided request must clearly show it):
 *   "Approved by HR (Meena) · 31 Oct, 10:05 AM"            green band
 *   "Rejected by Department Head (Kavya)"                 rose band
 *   "Approved by you · waiting for HR"   (tone="waiting") blue band — a head's own Approvals page
 * Pass a `decider` (lib/decider: deciderFromApproval / deciderFromFields / deciderFromStamps / deciderForAdvance), or
 * the ready `text` + `tone` from decisionLineFor. Renders nothing without one. Optional `note` line underneath.
 */
export function DecisionBadge({
  decider,
  text,
  tone,
  note,
  className,
}: {
  decider?: Decider | null
  /** Ready-made line (e.g. decisionLineFor(...).text); wins over `decider`. */
  text?: string | null
  /** Overrides the colour (default: the decision). */
  tone?: DecisionTone
  note?: React.ReactNode
  className?: string
}) {
  const line = text ?? (decider ? deciderText(decider) : null)
  if (!line) return null
  const t: DecisionTone = tone ?? decider?.decision ?? 'approved'
  const { band, icon: Icon } = TONE[t]
  return (
    <motion.div
      variants={popIn}
      initial="hidden"
      animate="show"
      data-tone={t}
      className={cn('flex w-full items-start gap-2.5 rounded-lg border px-3 py-2', band, className)}
    >
      <Icon className="mt-px size-[18px] shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-5 font-bold break-words">{line}</p>
        {note && <p className="mt-0.5 text-[12px] leading-4 font-medium opacity-90">{note}</p>}
      </div>
    </motion.div>
  )
}

/**
 * Where a request stands, in one element (mirror of the mobile app's WaitingChip): while it waits, an amber pill
 * "Waiting for HR"; once decided, the DecisionBadge naming who decided. `fallback` names the decider of an old request
 * whose `approval` block cannot (deciderFromFields(...)). `pendingLabel` is shown for a waiting request with no
 * `approval` block ("Pending"). Nothing when there is nothing to say.
 */
export function ApprovalState({
  approval,
  fallback,
  status,
  pendingLabel,
  className,
}: {
  approval?: ApprovalProgress | null
  fallback?: Decider | null
  /** The row's raw status, so an old waiting request still gets its pill. */
  status?: string | null
  pendingLabel?: string
  className?: string
}) {
  const waiting = waitingText(approval)
  if (waiting) {
    return (
      <StatusPill tone="waiting" className={className}>
        {waiting}
      </StatusPill>
    )
  }
  const decider = deciderFromApproval(approval) ?? fallback ?? null
  if (decider) return <DecisionBadge decider={decider} className={className} />
  if (pendingLabel && status && /pend|wait|review|submitted|requested|forwarded/i.test(status)) {
    return (
      <StatusPill tone="waiting" className={className}>
        {pendingLabel}
      </StatusPill>
    )
  }
  return null
}

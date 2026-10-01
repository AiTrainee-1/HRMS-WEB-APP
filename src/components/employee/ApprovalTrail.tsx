import { CheckCircle2, Circle, CircleMinus, Clock, XCircle, type LucideIcon } from 'lucide-react'
import { format, isValid, parseISO } from 'date-fns'
import { hasTrail, trailOf } from '@/lib/approval'
import { cn } from '@/lib/utils'
import type { ApprovalProgress, ApprovalRole, ApprovalStepState } from '@/types'

const ICON: Record<ApprovalStepState, LucideIcon> = {
  approved: CheckCircle2,
  rejected: XCircle,
  pending: Clock,
  waiting: Circle,
  skipped: CircleMinus,
}

const TONE: Record<ApprovalStepState, string> = {
  approved: 'text-success',
  rejected: 'text-destructive',
  pending: 'text-warning',
  waiting: 'text-muted-foreground',
  skipped: 'text-muted-foreground',
}

function shortDate(iso: string | null): string | null {
  if (!iso) return null
  const date = parseISO(iso)
  return isValid(date) ? format(date, 'MMM d') : null
}

/**
 * A request's approval steps at a glance, straight from the pipeline HR configured: who has to decide, who did (and
 * when), and who is next. Draws nothing when the status chip already says it all (see hasTrail).
 */
export function ApprovalTrail({
  approval, viewer, multiStepOnly, className,
}: {
  approval: ApprovalProgress | null | undefined
  /** The role reading it: a step held by that role alone is marked "(you)". */
  viewer?: ApprovalRole
  /** Draw nothing for a one-step pipeline, where the card already names who decided. */
  multiStepOnly?: boolean
  className?: string
}) {
  if (!hasTrail(approval) || (multiStepOnly && approval.steps.length < 2)) return null
  return (
    <ol aria-label="Approval steps" className={cn('flex flex-col gap-1 text-xs', className)}>
      {trailOf(approval).map((entry) => {
        const Icon = ICON[entry.state]
        const when = shortDate(entry.at)
        const you = !!viewer && entry.roles.length === 1 && entry.roles[0] === viewer
        return (
          <li key={entry.index} className="flex items-start gap-1.5">
            <Icon className={cn('mt-px size-3.5 shrink-0', TONE[entry.state])} />
            <span className="min-w-0">
              <span className="font-medium">
                {entry.name}
                {you && ' (you)'}
              </span>
              <span className="text-muted-foreground">
                {' · '}
                {entry.status}
                {entry.by && ` by ${entry.by}`}
                {when && ` · ${when}`}
              </span>
              {entry.comment && <span className="block break-words text-muted-foreground italic">“{entry.comment}”</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

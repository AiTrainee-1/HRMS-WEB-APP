import { motion } from 'framer-motion'
import { Check, Minus, X } from 'lucide-react'
import { approvalPath, type PathStep, type PathStepState } from '@/lib/decider'
import { cn } from '@/lib/utils'
import type { ApprovalProgress } from '@/types'
import { EASE_OUT, staggerDelay } from './motion'

export type StepperStep = PathStep

// Solid fills carry their own *-foreground token: near-white on the light theme's deep fills, near-black on the dark
// theme's bright emerald/rose (white on those is under 3:1, so the tick/cross would wash out).
const DOT: Record<PathStepState, string> = {
  done: 'bg-success text-success-foreground border-success',
  current: 'bg-waiting-bg text-waiting border-warning pulse-ring',
  upcoming: 'bg-card text-muted-foreground border-foreground/20 dark:bg-white/[0.04]',
  rejected: 'bg-destructive text-destructive-foreground border-destructive',
  skipped: 'bg-card text-muted-foreground border-dashed border-foreground/25 dark:bg-white/[0.04]',
}

const STATE_WORD: Record<PathStepState, string> = {
  done: 'done',
  current: 'in progress',
  upcoming: 'not yet',
  rejected: 'rejected',
  skipped: 'skipped',
}

/** The thread between two steps: solid when the step before it is done, a stitched dashed line otherwise. */
function Connector({ from, vertical, index }: { from: PathStepState; vertical: boolean; index: number }) {
  const done = from === 'done'
  return (
    <span aria-hidden="true" className={cn('relative', vertical ? 'ml-[13px] w-[2px] flex-1 min-h-4' : 'mt-[13px] h-[2px] flex-1 min-w-4')}>
      <span
        className={cn(
          'absolute inset-0',
          vertical ? 'border-l-2 border-dashed' : 'border-t-2 border-dashed',
          'border-foreground/15',
        )}
      />
      {done && (
        <motion.span
          className={cn('bg-success absolute inset-0 origin-top-left rounded-full')}
          initial={vertical ? { scaleY: 0 } : { scaleX: 0 }}
          animate={vertical ? { scaleY: 1 } : { scaleX: 1 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 + staggerDelay(index, 0.12) }}
        />
      )}
    </span>
  )
}

/**
 * A request's approval path: You → Department Head → HR, each step a dot (done = green tick, current = amber with a
 * breathing ring, rejected = rose cross, skipped = dashed) joined by a thread that fills in green as steps complete.
 * Horizontal for cards (wraps labels under dots), vertical for detail dialogs (shows `detail` and comments).
 * Feed it `approval` (+ `sentAt`) and it builds the steps itself (lib/decider approvalPath), or pass your own `steps`.
 *
 *   <Stepper approval={leave.approval} sentAt={leave.createdAt} />
 *   <Stepper approval={req.approval} sentAt={req.createdAt} orientation="vertical" />
 */
export function Stepper({
  steps,
  approval,
  sentAt,
  orientation = 'horizontal',
  className,
}: {
  steps?: StepperStep[]
  approval?: ApprovalProgress | null
  sentAt?: string | null
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  const list = steps ?? approvalPath(approval, sentAt)
  if (!list.length) return null
  const vertical = orientation === 'vertical'

  return (
    <ol aria-label="Approval steps" className={cn(vertical ? 'flex flex-col' : 'flex items-start', className)}>
      {list.map((s, i) => {
        const Icon = s.state === 'done' ? Check : s.state === 'rejected' ? X : s.state === 'skipped' ? Minus : null
        const last = i === list.length - 1
        return (
          <li
            key={s.key}
            aria-current={s.state === 'current' ? 'step' : undefined}
            className={cn(vertical ? 'flex gap-3' : 'flex flex-1 items-start last:flex-none')}
          >
            <div className={cn(vertical ? 'flex flex-col items-start' : 'flex min-w-0 flex-col items-center gap-1.5')}>
              <span
                className={cn(
                  'relative grid size-7 shrink-0 place-items-center rounded-full border-2 text-[11px] font-bold',
                  DOT[s.state],
                )}
              >
                {Icon ? <Icon className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>}
              </span>
              {vertical && !last && <Connector from={s.state} vertical index={i} />}
              {!vertical && (
                <span className="w-[86px] text-center text-[11.5px] leading-tight font-semibold text-foreground/85 sm:w-28">
                  {s.label}
                  <span className="sr-only">: {STATE_WORD[s.state]}</span>
                  {s.detail && <span className="mt-0.5 block text-[10.5px] font-medium text-muted-foreground">{s.detail}</span>}
                </span>
              )}
            </div>
            {vertical && (
              <div className={cn('min-w-0 flex-1 pt-0.5', !last && 'pb-4')}>
                <p className="text-[13.5px] leading-5 font-semibold">
                  {s.label}
                  <span className="sr-only">: {STATE_WORD[s.state]}</span>
                </p>
                {s.detail && (
                  <p className={cn('text-[12.5px]', s.state === 'rejected' ? 'text-rejected' : s.state === 'current' ? 'text-waiting' : 'text-muted-foreground')}>
                    {s.detail}
                  </p>
                )}
                {s.comment && <p className="mt-1 rounded-md bg-foreground/[0.04] px-2 py-1 text-[12.5px] italic text-foreground/80">“{s.comment}”</p>}
              </div>
            )}
            {!vertical && !last && <Connector from={s.state} vertical={false} index={i} />}
          </li>
        )
      })}
    </ol>
  )
}

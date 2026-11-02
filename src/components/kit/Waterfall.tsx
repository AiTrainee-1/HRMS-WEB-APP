import * as React from 'react'
import { motion } from 'framer-motion'
import { formatINR, spokenINR } from '@/lib/money'
import { cn } from '@/lib/utils'
import { EASE_OUT, staggerDelay } from './motion'

export interface WaterfallStep {
  key: string
  label: React.ReactNode
  /** Rupees. For 'add' / 'subtract' give the size of the change (positive); for 'start' / 'total' the level. */
  amount: number
  /**
   * start    the opening level (Gross salary)              sapphire, from zero
   * add      money in (Overtime, Bonus)                   emerald, steps up
   * subtract money out (PF, ESI, Advance, Late)           rose, steps down
   * total    the result (Net pay)                         emerald; the bar runs from zero to the running level,
   *          the text shows `amount` (send the server's figure; they should agree)
   */
  kind: 'start' | 'add' | 'subtract' | 'total'
  hint?: React.ReactNode
}

const COLOR: Record<WaterfallStep['kind'], string> = {
  start: 'var(--primary)',
  add: 'var(--success)',
  subtract: 'var(--destructive)',
  total: 'var(--success)',
}

/**
 * How a salary gets from gross to net, step by step: each row a floating bar that starts where the previous one ended.
 * Label + amount on top (always written), the bar beneath (phones stay readable). Amounts are rupees.
 *
 *   <Waterfall steps={[
 *     { key: 'g', label: 'Gross salary', amount: 18000, kind: 'start' },
 *     { key: 'ot', label: 'Overtime', amount: 1200, kind: 'add' },
 *     { key: 'pf', label: 'PF', amount: 1800, kind: 'subtract' },
 *     { key: 'n', label: 'Net pay', amount: 17400, kind: 'total' },
 *   ]} />
 */
export function Waterfall({ steps, className, format = (n: number) => formatINR(n) }: { steps: WaterfallStep[]; className?: string; format?: (n: number) => string }) {
  let level = 0
  const rows = steps.map((s) => {
    let from = 0
    let to = 0
    if (s.kind === 'start') {
      from = 0
      to = s.amount
    } else if (s.kind === 'add') {
      from = level
      to = level + Math.abs(s.amount)
    } else if (s.kind === 'subtract') {
      from = level
      to = level - Math.abs(s.amount)
    } else {
      from = 0
      to = level
    }
    level = s.kind === 'total' ? level : to
    return { ...s, from, to }
  })
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.from, r.to)))

  return (
    <ol className={cn('flex flex-col gap-3', className)} aria-label="Salary breakdown">
      {rows.map((r, i) => {
        const lo = Math.max(0, Math.min(r.from, r.to))
        const hi = Math.max(r.from, r.to)
        const sign = r.kind === 'add' ? '+' : r.kind === 'subtract' ? '-' : ''
        const amountText = `${sign}${format(Math.abs(r.amount))}`
        const strong = r.kind === 'start' || r.kind === 'total'
        return (
          <li key={r.key} className={cn(r.kind === 'total' && 'border-t border-dashed border-foreground/15 pt-3')}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={cn('min-w-0 text-[13px]', strong ? 'font-bold' : 'font-medium text-foreground/85')}>{r.label}</span>
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  strong ? 'text-[15px] font-bold' : 'text-[13px] font-semibold',
                  r.kind === 'add' && 'text-approved',
                  r.kind === 'subtract' && 'text-rejected',
                )}
                aria-label={r.kind === 'subtract' ? `minus ${spokenINR(Math.abs(r.amount))}` : undefined}
              >
                {amountText}
              </span>
            </div>
            <div className="relative mt-1.5 h-2.5 rounded-full bg-foreground/[0.05]" aria-hidden="true">
              <motion.span
                className="absolute inset-y-0 origin-left rounded-full"
                style={{ left: `${(lo / scale) * 100}%`, width: `${Math.max(0.6, ((hi - lo) / scale) * 100)}%`, background: COLOR[r.kind] }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: staggerDelay(i, 0.09) }}
              />
            </div>
            {r.hint && <p className="mt-1 text-[12px] text-muted-foreground">{r.hint}</p>}
          </li>
        )
      })}
    </ol>
  )
}

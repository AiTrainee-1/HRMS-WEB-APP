import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/money'
import { EASE_OUT, staggerDelay } from './motion'
import { TONE_COLOR, type Tone } from './tones'

export interface CompareItem {
  key: string
  label: React.ReactNode
  /** The whole: allocated / entitled / planned. */
  total: number
  /** The part: earned / used / worked. May exceed total (shown with an amber tip). */
  value: number
  hint?: React.ReactNode
}

/** A bar that grows from the left; `fraction` 0..1 of its track. */
function GrowBar({ fraction, color, delay, className }: { fraction: number; color: string; delay: number; className?: string }) {
  return (
    <motion.span
      aria-hidden="true"
      className={cn('absolute inset-y-0 left-0 origin-left rounded-full', className)}
      style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, background: color }}
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.6, ease: EASE_OUT, delay }}
    />
  )
}

/**
 * Allocated vs earned (or entitled vs used), one row per item: the track is the total, the fill the value, scaled so
 * rows compare with each other. Over the total, the fill turns amber at the tip. Numbers are always written next to the
 * bars — never rely on bar length alone.
 *
 *   <BarCompare totalLabel="Allocated" valueLabel="Earned" format={(n) => `${n} days`}
 *     items={[{ key: 'cl', label: 'Casual leave', total: 12, value: 7 }]} />
 */
export function BarCompare({
  items,
  totalLabel = 'Allocated',
  valueLabel = 'Earned',
  format = formatCount,
  tone = 'sapphire',
  className,
}: {
  items: CompareItem[]
  totalLabel?: string
  valueLabel?: string
  format?: (n: number) => string
  tone?: Tone
  className?: string
}) {
  const scale = Math.max(1, ...items.map((i) => Math.max(i.total, i.value)))
  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: TONE_COLOR[tone] }} /> {valueLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-foreground/15" /> {totalLabel}
        </span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {items.map((item, i) => {
          const over = item.value > item.total
          return (
            <li key={item.key}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate font-semibold">{item.label}</span>
                <span className="shrink-0 tabular-nums">
                  <span className={cn('font-bold', over && 'text-waiting')}>{format(item.value)}</span>
                  <span className="text-muted-foreground">
                    {' '}
                    of {format(item.total)}
                    <span className="sr-only">
                      {' '}
                      ({valueLabel} of {totalLabel})
                    </span>
                  </span>
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full bg-foreground/[0.09]" style={{ width: `${(item.total / scale) * 100}%` }} />
                <GrowBar fraction={Math.min(item.value, item.total) / scale} color={TONE_COLOR[tone]} delay={staggerDelay(i, 0.08)} />
                {over && (
                  <span
                    className="absolute inset-y-0 rounded-r-full"
                    style={{ left: `${(item.total / scale) * 100}%`, width: `${((item.value - item.total) / scale) * 100}%`, background: 'var(--warning)' }}
                  />
                )}
              </div>
              {item.hint && <p className="mt-1 text-[12px] text-muted-foreground">{item.hint}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export interface BarListItem {
  key: string
  label: React.ReactNode
  value: number
  tone?: Tone
  hint?: React.ReactNode
}

/**
 * Ranked horizontal bars: days by type this month, deductions by kind. The longest bar is the largest value (or `max`).
 * Value written at the end of each row.
 *
 *   <BarList items={[{ key: 'p', label: 'Present', value: 22, tone: 'emerald' }, { key: 'l', label: 'Leave', value: 2, tone: 'amber' }]} />
 */
export function BarList({
  items,
  max,
  format = formatCount,
  className,
}: {
  items: BarListItem[]
  max?: number
  format?: (n: number) => string
  className?: string
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className={cn('flex flex-col gap-2.5', className)}>
      {items.map((item, i) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-[13px] font-medium">{item.label}</span>
          <span className="text-[13px] font-bold tabular-nums">{format(item.value)}</span>
          <div className="relative col-span-2 h-2" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-foreground/[0.06]" />
            <GrowBar fraction={item.value / top} color={TONE_COLOR[item.tone ?? 'sapphire']} delay={staggerDelay(i, 0.06)} />
          </div>
          {item.hint && <span className="col-span-2 text-[12px] text-muted-foreground">{item.hint}</span>}
        </li>
      ))}
    </ul>
  )
}

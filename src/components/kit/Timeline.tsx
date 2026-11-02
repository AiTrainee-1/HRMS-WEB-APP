import * as React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE_OUT, fadeRise } from './motion'
import { TONE_SOFT, type Tone } from './tones'

export interface TimelineItem {
  key: string
  title: React.ReactNode
  /** Right-aligned (or under the title on phones): "10:05 AM", "31 Oct". */
  time?: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  /** The newest / current entry: its dot breathes. */
  current?: boolean
}

/**
 * A vertical history: punches through the day, an advance's events, a notification thread. Each entry is a tinted dot on
 * a single thread that draws itself down the list. Newest first or oldest first is the page's choice — keep the order
 * the person expects (today's punches: oldest first; history: newest first).
 *
 *   <Timeline items={punches.map((p) => ({ key: p.id, title: `Punched ${p.type}`, time: p.time, icon: LogIn, tone: p.type === 'IN' ? 'emerald' : 'amber' }))} />
 */
export function Timeline({ items, className, ariaLabel = 'Timeline' }: { items: TimelineItem[]; className?: string; ariaLabel?: string }) {
  if (!items.length) return null
  return (
    <div className={cn('relative', className)}>
      {/* The thread: one line behind every dot, drawn top to bottom. */}
      <motion.span
        aria-hidden="true"
        className="absolute top-3 bottom-3 left-[15px] w-[2px] origin-top rounded-full bg-linear-to-b from-primary/50 via-foreground/15 to-transparent"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      />
      <ol aria-label={ariaLabel} className="relative flex flex-col gap-4">
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <motion.li key={item.key} variants={fadeRise} initial="hidden" animate="show" custom={i} className="flex gap-3">
              <span
                className={cn(
                  'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border text-[11px]',
                  TONE_SOFT[item.tone ?? 'sapphire'],
                  item.current && 'pulse-ring',
                )}
                aria-hidden="true"
              >
                {Icon ? <Icon className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[13.5px] leading-5 font-semibold">{item.title}</p>
                  {item.time && <p className="text-[12px] text-muted-foreground tabular-nums">{item.time}</p>}
                </div>
                {item.description && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{item.description}</div>}
              </div>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

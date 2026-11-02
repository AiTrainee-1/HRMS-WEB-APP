import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/money'
import { EASE_OUT } from './motion'
import { TONE_COLOR, type Tone } from './tones'

/**
 * A ring (donut) meter: how much of a whole is used/done — leave days used of 12, hours worked of 8, profile complete.
 * The arc draws in from the top. Put the headline in the middle via children (default "value/max").
 *
 *   <RingMeter value={7} max={12} tone="violet" label="Casual leave used"><b className="metric text-2xl">5</b><span>left</span></RingMeter>
 */
export function RingMeter({
  value,
  max,
  size = 104,
  thickness = 10,
  tone = 'sapphire',
  silk,
  label,
  children,
  className,
}: {
  value: number
  max: number
  size?: number
  thickness?: number
  tone?: Tone
  /** Draw the arc in the silk gradient (one signature ring per page at most). */
  silk?: boolean
  /** Screen readers hear "<label>: <value> of <max>". */
  label: string
  children?: React.ReactNode
  className?: string
}) {
  const id = React.useId().replace(/:/g, '')
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const r = (size - thickness) / 2
  const c = size / 2
  return (
    <div
      role="img"
      aria-label={`${label}: ${formatCount(value)} of ${formatCount(max)}`}
      className={cn('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        {silk && (
          <defs>
            <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--silk-1)" />
              <stop offset="55%" stopColor="var(--silk-2)" />
              <stop offset="100%" stopColor="var(--silk-3)" />
            </linearGradient>
          </defs>
        )}
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-foreground/[0.08]" />
        {fraction > 0 && (
          <motion.circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={silk ? `url(#ring-${id})` : TONE_COLOR[tone]}
            strokeWidth={thickness}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: fraction }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          />
        )}
      </svg>
      <div className="relative flex flex-col items-center leading-tight" aria-hidden="true">
        {children ?? (
          <span className="metric text-xl">
            {formatCount(value)}
            <span className="text-sm text-muted-foreground">/{formatCount(max)}</span>
          </span>
        )}
      </div>
    </div>
  )
}

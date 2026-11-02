import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE_OUT } from './motion'
import { useReducedMotion } from './useReducedMotion'

/**
 * A tiny trend line (no axes): last 7 days' hours, the last 6 net pays. Stretches to its box (size it with className,
 * e.g. "h-10 w-full"); draws itself in from the left; a soft area underneath; the latest point marked. Oldest first.
 *
 *   <Sparkline data={[7.5, 8, 8.2, 6, 8.5]} color="var(--success)" className="h-10 w-full" label="Hours this week" />
 */
export function Sparkline({
  data,
  color = 'var(--primary)',
  className,
  label,
  area = true,
  strokeWidth = 2,
}: {
  data: number[]
  /** Any CSS colour; use a TONE_COLOR value or a theme var. */
  color?: string
  className?: string
  /** Screen readers hear "<label>: from <first> to <last>". */
  label: string
  area?: boolean
  strokeWidth?: number
}) {
  const id = React.useId().replace(/:/g, '')
  const reduced = useReducedMotion()
  const values = data.filter((v) => Number.isFinite(v))
  if (values.length < 2) return null

  const W = 100
  const H = 32
  const PAD = 3
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - PAD - ((v - min) / span) * (H - PAD * 2)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const fill = `${line} L${W},${H} L0,${H} Z`
  const [lx, ly] = pts[pts.length - 1]

  return (
    <div className={cn('relative', className)} role="img" aria-label={`${label}: from ${values[0]} to ${values[values.length - 1]}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && (
          <motion.path
            d={fill}
            fill={`url(#spark-${id})`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          />
        )}
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: EASE_OUT }}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
        style={{ left: `${lx}%`, top: `${(ly / H) * 100}%`, background: color }}
      />
    </div>
  )
}

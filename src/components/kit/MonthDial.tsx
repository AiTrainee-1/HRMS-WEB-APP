import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { popIn } from './motion'
import { TONE_COLOR, type Tone } from './tones'

/** none · first half (left) · second half (right) · full. 'left' / 'right' are accepted as aliases. */
export type DialFill = 'none' | 'first' | 'second' | 'full' | 'left' | 'right'

const FILL_WORDS: Record<DialFill, string> = {
  none: 'none taken',
  first: 'first half taken',
  left: 'first half taken',
  second: 'second half taken',
  right: 'second half taken',
  full: 'full day taken',
}

/**
 * One month as a small dial for Casual Leave: empty, the LEFT half filled (first half / morning), the RIGHT half filled
 * (second half / afternoon), or full. A row of 12 reads as the year at a glance. `current` rings this month; `locked`
 * dims a month that can no longer be used. The label sits under the dial; the accessible name says it in words.
 *
 *   <MonthDial label="Oct" fill="first" current title="October" />
 */
export function MonthDial({
  fill,
  label,
  title,
  tone = 'violet',
  size = 40,
  current,
  locked,
  className,
}: {
  fill: DialFill
  /** Short text under the dial ("Oct"). */
  label: string
  /** The full name for screen readers ("October 2026"); defaults to label. */
  title?: string
  tone?: Tone
  size?: number
  current?: boolean
  locked?: boolean
  className?: string
}) {
  const r = 16
  const color = TONE_COLOR[tone]
  const left = fill === 'first' || fill === 'left'
  const right = fill === 'second' || fill === 'right'
  // Semicircles from the top: sweep 0 goes round the left side, sweep 1 round the right.
  const half = (sweep: 0 | 1) => `M20,${20 - r} A${r},${r} 0 0 ${sweep} 20,${20 + r} Z`
  return (
    <div
      role="img"
      aria-label={`${title ?? label}: ${FILL_WORDS[fill]}${current ? ' (this month)' : ''}${locked ? ', closed' : ''}`}
      className={cn('inline-flex flex-col items-center gap-1', locked && 'opacity-45', className)}
    >
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="overflow-visible">
        {current && <circle cx="20" cy="20" r="19" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 2.5" />}
        <circle cx="20" cy="20" r={r} fill="currentColor" className="text-foreground/[0.06]" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="1.5" />
        {fill === 'full' && <motion.circle cx="20" cy="20" r={r} fill={color} variants={popIn} initial="hidden" animate="show" style={{ originX: '20px', originY: '20px' }} />}
        {left && <motion.path d={half(0)} fill={color} variants={popIn} initial="hidden" animate="show" style={{ originX: '20px', originY: '20px' }} />}
        {right && <motion.path d={half(1)} fill={color} variants={popIn} initial="hidden" animate="show" style={{ originX: '20px', originY: '20px' }} />}
        {(left || right) && <line x1="20" y1={20 - r} x2="20" y2={20 + r} stroke={color} strokeWidth="1.5" />}
      </svg>
      <span className={cn('font-label text-[11px] font-semibold', current ? 'text-foreground' : 'text-muted-foreground')} aria-hidden="true">
        {label}
      </span>
    </div>
  )
}

import * as React from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT, useReducedMotion } from '@/components/kit'
import { cn } from '@/lib/utils'

// The tick, drawn inside the 26 x 26 circle.
const TICK = 'M7.5 13.5 L11.3 17.2 L18.7 9.4'
const SPARKS = 6

/** A few dots flying out of the circle once it is ticked. */
function Sparks({ delay }: { delay: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {Array.from({ length: SPARKS }, (_, i) => {
        const angle = (i / SPARKS) * Math.PI * 2 - Math.PI / 2
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 left-1/2 -mt-[2px] -ml-[2px] size-1 rounded-full bg-success"
            initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
            animate={{ x: Math.cos(angle) * 17, y: Math.sin(angle) * 17, opacity: [0, 1, 0], scale: 0.4 }}
            transition={{ duration: 0.5, delay: delay + 0.12, ease: EASE_OUT }}
          />
        )
      })}
    </span>
  )
}

/**
 * The round check of a notification row (owner 2026-11-25, mirror of the mobile app's TodoCheck: "like ticking a
 * to-do"). Clicking it marks the notification read: the circle squeezes and springs back, fills green, the tick draws
 * itself and a few sparks fly out. It animates every time it turns checked - from a click, from "Mark all read" (`delay`
 * makes those ripple down the list) or from opening the notification. Under reduced motion it simply fills. A read
 * notification cannot be made unread again (the server has no such call), so a checked one is not a button.
 */
export function TodoCheck({
  checked,
  onCheck,
  delay = 0,
  label,
  className,
}: {
  checked: boolean
  onCheck: () => void
  /** Wait this many ms before animating (the "Mark all read" ripple). */
  delay?: number
  /** What a screen reader hears, e.g. "Mark as read: Leave update". */
  label: string
  className?: string
}) {
  const reduced = useReducedMotion()
  // Counts the times it turned checked while on screen: each one replays the animation (a fresh key).
  const [burst, setBurst] = React.useState(0)
  const [was, setWas] = React.useState(checked)
  if (was !== checked) {
    setWas(checked)
    if (checked) setBurst((b) => b + 1)
  }
  const animate = burst > 0 && !reduced
  const wait = reduced ? 0 : delay / 1000

  const circle = (
    <motion.span
      key={`pop-${burst}`}
      className="relative grid size-[26px] place-items-center"
      initial={animate ? { scale: 1 } : false}
      animate={animate ? { scale: [1, 0.78, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 0.42, delay: wait, times: [0, 0.3, 0.68, 1], ease: 'easeOut' }}
    >
      <svg viewBox="0 0 26 26" className="size-[26px] overflow-visible" aria-hidden="true">
        <circle
          cx="13"
          cy="13"
          r="11.75"
          strokeWidth="1.6"
          className="transition-[fill,stroke] duration-200"
          style={{
            fill: checked ? 'var(--success)' : 'transparent',
            stroke: checked ? 'var(--success)' : 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)',
            transitionDelay: `${checked ? wait * 1000 : 0}ms`,
          }}
        />
        {checked ? (
          <motion.path
            key={`tick-${burst}`}
            d={TICK}
            fill="none"
            stroke="var(--success-foreground)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={animate ? { pathLength: 0 } : false}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: wait + 0.12, ease: EASE_OUT }}
          />
        ) : (
          // A faint tick on hover says what a click does.
          <path
            d={TICK}
            fill="none"
            stroke="var(--success)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-0 transition-opacity duration-150 group-hover/check:opacity-60 group-focus-visible/check:opacity-60"
          />
        )}
      </svg>
      {animate && <Sparks key={`spark-${burst}`} delay={wait} />}
    </motion.span>
  )

  if (checked) {
    return (
      <span role="img" aria-label="Read" className={cn('grid size-11 shrink-0 place-items-center', className)} data-testid="todo-check" data-checked="true">
        {circle}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onCheck()
      }}
      aria-label={label}
      title="Mark as read"
      className={cn('group/check focus-ring grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-success/10 active:scale-95', className)}
      data-testid="todo-check"
      data-checked="false"
    >
      {circle}
    </button>
  )
}

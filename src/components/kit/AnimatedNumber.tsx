import * as React from 'react'
import { animate } from 'framer-motion'
import { formatCount } from '@/lib/money'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT } from './motion'
import { useReducedMotion } from './useReducedMotion'

/**
 * A number that counts up to its value (from 0 on first show, from the old value when it changes). The animated text
 * is aria-hidden; screen readers get the final value once. Reduced motion: shows the value at once.
 *
 *   <AnimatedNumber value={12} />
 *   <AnimatedNumber value={net} format={(n) => formatINR(Math.round(n))} />
 *   <AnimatedNumber value={8.5} format={(n) => n.toFixed(1)} />
 */
export function AnimatedNumber({
  value,
  format = formatCount,
  duration = DURATION.count,
  className,
}: {
  value: number
  /** Turns the in-between value into text. Called every frame while counting, so keep it cheap. */
  format?: (n: number) => string
  /** Seconds (default 0.9). */
  duration?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLSpanElement>(null)
  const shown = React.useRef<number | null>(null)
  const formatRef = React.useRef(format)
  formatRef.current = format

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const target = Number.isFinite(value) ? value : 0
    const from = shown.current ?? 0
    if (reduced || from === target) {
      el.textContent = formatRef.current(target)
      shown.current = target
      return
    }
    el.textContent = formatRef.current(from)
    const controls = animate(from, target, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        shown.current = v
        el.textContent = formatRef.current(v)
      },
      onComplete: () => {
        shown.current = target
        el.textContent = formatRef.current(target)
      },
    })
    return () => controls.stop()
  }, [value, reduced, duration])

  return (
    <span className={cn('tabular-nums', className)}>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{format(Number.isFinite(value) ? value : 0)}</span>
    </span>
  )
}

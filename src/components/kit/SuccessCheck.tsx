import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EASE_OUT } from './motion'
import { useReducedMotion } from './useReducedMotion'

/**
 * The success micro-animation: a ring closes, then a tick draws itself (about 0.6 s). For "Request sent", "Saved",
 * "Approved" confirmations — in a dialog's success state or a toast-like inline message. Reduced motion: drawn at once.
 *
 *   <SuccessCheck size={56} />  <p>Your leave request was sent to your Department Head.</p>
 */
export function SuccessCheck({
  size = 48,
  tone = 'emerald',
  className,
  label = 'Done',
}: {
  size?: number
  tone?: 'emerald' | 'sapphire'
  className?: string
  /** Read out by screen readers. */
  label?: string
}) {
  const reduced = useReducedMotion()
  const color = tone === 'emerald' ? 'var(--success)' : 'var(--primary)'
  const draw = (delay: number, duration: number) =>
    reduced
      ? { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { pathLength: { delay, duration, ease: EASE_OUT }, opacity: { delay, duration: 0.01 } },
        }
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 52 52"
      className={cn('shrink-0', className)}
      style={{ color }}
    >
      <circle cx="26" cy="26" r="24" fill="currentColor" opacity="0.12" />
      <motion.circle cx="26" cy="26" r="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...draw(0, 0.4)} />
      <motion.path
        d="M15 27 l7 7 l15 -16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...draw(0.3, 0.32)}
      />
    </svg>
  )
}

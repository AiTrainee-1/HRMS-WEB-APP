import type { Transition, Variants } from 'framer-motion'

// The motion language, in one place. Pages use these instead of inventing timings.
//   page enter: fade + 8px rise, 260 ms, children staggered 50 ms (capped at 8, so a long list never waits)
//   hover:      spring lift (CSS .lift on cards; SPRING for framer-driven bits)
//   indicators: shared-layout (layoutId) with SPRING
// Reduced motion: <MotionConfig reducedMotion="user"> (App.tsx) turns transforms off; opacity still fades.

export const EASE_OUT = [0.16, 1, 0.3, 1] as const
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const

/** Seconds (framer) — the CSS twins are --dur-fast / --dur-base / --dur-slow. */
export const DURATION = { fast: 0.14, base: 0.24, enter: 0.26, slow: 0.42, count: 0.9 } as const

export const STAGGER = 0.05
export const STAGGER_CAP = 8

/** Delay for the i-th item of a staggered list, capped. */
export function staggerDelay(index: number, step: number = STAGGER, cap: number = STAGGER_CAP): number {
  return Math.min(Math.max(index, 0), cap) * step
}

/** Snappy spring for active indicators and press feedback. */
export const SPRING: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }
/** Softer spring for larger things (drawers, expanding cards). */
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 260, damping: 30 }

/** Fade + 8px rise. Use with `custom={index}` for a capped stagger. */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.enter, ease: EASE_OUT, delay: staggerDelay(i) },
  }),
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.fast } },
}

/** Fade only (route changes, overlays). */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
}

/** Pop for small things appearing (a badge, a success tick). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 26 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: DURATION.fast } },
}

/** Height-auto collapse for expandable sections: <motion.div variants={collapse} initial="hidden" animate="show" exit="hidden">. */
export const collapse: Variants = {
  hidden: { opacity: 0, height: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  show: { opacity: 1, height: 'auto', transition: { duration: DURATION.slow, ease: EASE_OUT } },
}

/** Props for a staggered list item: <motion.li {...listItem(i)}>. */
export function listItem(index: number) {
  return { variants: fadeRise, initial: 'hidden', animate: 'show', exit: 'exit', custom: index } as const
}

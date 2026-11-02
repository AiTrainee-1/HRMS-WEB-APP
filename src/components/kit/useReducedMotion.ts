import { useSyncExternalStore } from 'react'

// THE reduced-motion gate for everything the kit animates outside Framer Motion's own handling (the weave canvas,
// number counters, chart draw-ins). Framer animations are also gated app-wide by <MotionConfig reducedMotion="user">
// in App.tsx, and CSS animations by the @media block at the end of index.css. Reduced = no movement, instant states.

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function snapshot(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches
}

/** True when the person asked their device for less motion. Re-renders when they change it. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

/** A device that should not run continuous animation even without the preference: 2 or fewer CPU cores, 2 GB or less
 *  memory, or Data Saver on. The weave canvas draws one still frame there. */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if (nav.connection?.saveData) return true
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= 2) return true
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true
  return false
}

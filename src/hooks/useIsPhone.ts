import { useSyncExternalStore } from 'react'

/**
 * The phone view's breakpoint: below Tailwind's `md` (48rem = 768px). The SAME boundary as every `max-md:` class and the
 * `@media (width < 48rem)` blocks in index.css (src/components/kit/MOBILE.md).
 *
 * For BEHAVIOUR only (closing the phone drawer when the window grows past it, ...). Never use it to choose what renders
 * at >= 768px: the desktop markup must not depend on it - phone-only markup is hidden with classes (`hidden max-md:flex`).
 */
export const PHONE_QUERY = '(width < 48rem)'

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function snapshot() {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(PHONE_QUERY).matches
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

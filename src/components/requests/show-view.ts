import type { RequestView, RequestViewsState } from '@/components/kit'

/** Opens one of the four views and brings the list (RequestList with this `id`) into sight - for the KPI tiles at the top
 *  of a request page. Smooth unless the person asked for reduced motion.
 *  On a page with the month switcher the tiles count the month on screen (owner 2026-11-02), so a tile only opens its
 *  view in that month: the month never changes here. */
export function showView<T>(views: RequestViewsState<T>, view: RequestView, listId: string) {
  views.setView(view)
  const el = typeof document !== 'undefined' ? document.getElementById(`${listId}-title`) : null
  if (!el) return
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // After the view's rows render, so the scroll lands on the new list.
  window.requestAnimationFrame(() => el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }))
}

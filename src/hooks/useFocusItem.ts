import * as React from 'react'
import { useSearch } from 'wouter'
import { useReducedMotion } from '@/components/kit/useReducedMotion'
import { monthForRow, type RequestView, type ViewOptions } from '@/lib/request-views'
import { monthOf, sameMonth, type CalMonth } from '@/lib/month-switch'
import { findFocusElement, findFocusRow, flashFocus, focusKey, readFocusParams, viewForRow, type RingRoot } from '@/lib/focus-item'

/** How many more pages (or other lists) a page may load while looking for the item before it says it is not there. */
const MAX_LOADS = 6
/** How many animation frames to wait for the item's element to render (about 10 s: a month switch may have to load
 *  that month from the server first, as On-Duty records do). */
const MAX_FRAMES = 600

export interface FocusItemOptions<T> {
  /** The prefix of the items' `data-focus-key` ("leave" -> "leave:42"); RequestList uses its own `id`. */
  scope: string
  /** Every row the page can show (not only the open view's); undefined while loading. */
  rows: readonly T[] | undefined
  idOf: (row: T) => string | number
  /** Read a row's day: then `date=YYYY-MM-DD` finds the first row of that day when there is no `focus`. */
  dateOf?: (row: T) => string | null | undefined
  /** The page's four views: the one holding the item gets opened. */
  views?: { view: RequestView; setView: (view: RequestView) => void }
  viewOptions?: ViewOptions<T>
  /** Anything else that must change to show the row (a tab, a year, a filter, a detail dialog). Runs once. */
  reveal?: (row: T) => void
  /**
   * A page with the month switcher (`viewOptions.scope`): switches to the row's own month FIRST (monthForRow; never
   * when the month on screen already holds it), then the view, the scroll and the ring. A `date=` link with no row of
   * that day still opens that day's month.
   */
  setMonth?: (month: CalMonth) => void
  /** A paged list: more rows can be loaded; `loadMore` is called (one at a time) before the item counts as missing. */
  hasMore?: boolean
  loadMore?: () => void
  loadingMore?: boolean
  /** false = wait (e.g. the list is not the open tab yet). */
  enabled?: boolean
  /** false = only reveal (a dialog opens instead): no scroll, no ring, focus stays where the dialog puts it. */
  highlight?: boolean
  /** Which link param names the item: `focus` (default) or `highlight` (the Notifications page). */
  param?: 'focus' | 'highlight'
}

export interface FocusItemState<T> {
  /** The id (or day) the link asked for, or null when it asked for nothing. */
  requested: string | null
  /** The row it found, once found. */
  found: T | null
  /** The link asked for an item that is not in the list (old, deleted, or not yours). */
  missing: boolean
  /** How it was asked: by `id`, or by `date` (a day with nothing on it is not an error on every page). */
  missingBy: 'id' | 'date' | null
  /** Hide the "not in this list" note. */
  dismiss: () => void
}

/**
 * Opens what a link points at: reads `?focus=<id>` (or `?date=` / `?highlight=`), finds the row once the data is
 * there, opens the view / tab that holds it (`views` + `viewOptions`, `reveal`), then scrolls to the element carrying
 * `data-focus-key="<scope>:<id>"` and rings it for a moment (static under reduced motion; focus moves to it). Each link
 * is handled once, so the person's own clicks afterwards are never overridden. An item that is not there sets `missing`
 * (show <FocusMissNote>).
 */
export function useFocusItem<T>(options: FocusItemOptions<T>): FocusItemState<T> {
  const search = useSearch()
  const reduced = useReducedMotion()
  const params = React.useMemo(() => readFocusParams(search), [search])
  const id = options.param === 'highlight' ? params.highlight : params.focus
  const date = options.param === 'highlight' || !options.dateOf ? null : params.date
  const key = id ? `id:${id}` : date ? `date:${date}` : null

  const [result, setResult] = React.useState<{ key: string; found: T | null; missing: boolean } | null>(null)
  // The element to ring, once the row is found (a new object per link, so the same item can be pointed at again).
  const [flash, setFlash] = React.useState<{ key: string } | null>(null)
  const handled = React.useRef<string | null>(null)
  const loads = React.useRef<{ key: string | null; n: number }>({ key: null, n: 0 })
  // The latest options and motion preference for the effects below (inline callbacks change every render; reading them
  // through a ref keeps the effects from re-running for that alone).
  const latest = React.useRef(options)
  const reducedRef = React.useRef(reduced)
  React.useLayoutEffect(() => {
    latest.current = options
    reducedRef.current = reduced
  })

  // Ring the item once its element has rendered (the chosen view / tab may need a frame or two): look for it each
  // frame for a short while. Cleaned up on unmount (and by React's StrictMode re-run, which then schedules it again).
  React.useEffect(() => {
    if (!flash) return
    let frame = 0
    let raf = 0
    let unflash: (() => void) | null = null
    const tick = () => {
      const el = findFocusElement(document as unknown as RingRoot, flash.key)
      if (el) {
        unflash = flashFocus(el, { reduced: reducedRef.current })
        return
      }
      if (++frame < MAX_FRAMES) raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(raf)
      unflash?.()
    }
  }, [flash])

  const { rows, enabled, hasMore, loadingMore } = options
  React.useEffect(() => {
    const o = latest.current
    if (!key || handled.current === key || enabled === false || rows === undefined) return
    const row = findFocusRow(rows, { id, date }, o.idOf, o.dateOf)

    if (!row) {
      if (hasMore && o.loadMore) {
        if (loadingMore) return
        if (loads.current.key !== key) loads.current = { key, n: 0 }
        if (loads.current.n < MAX_LOADS) {
          loads.current.n += 1
          o.loadMore()
          return
        }
      }
      handled.current = key
      setResult({ key, found: null, missing: true })
      // A day with nothing on it: still open that day's month, so the person sees the month they were sent to.
      const dayMonth = !id && date ? monthOf(date) : null
      if (o.setMonth && o.viewOptions?.scope && dayMonth && !sameMonth(dayMonth, o.viewOptions.scope)) o.setMonth(dayMonth)
      return
    }

    handled.current = key
    setResult({ key, found: row, missing: false })
    // The month first (a page with the month switcher), then anything else, then the view.
    if (o.setMonth && o.viewOptions?.scope) {
      const m = monthForRow(row, o.viewOptions)
      if (m && !sameMonth(m, o.viewOptions.scope)) o.setMonth(m)
    }
    o.reveal?.(row)
    if (o.views && o.viewOptions) {
      const view = viewForRow(row, o.viewOptions, o.views.view)
      if (view && view !== o.views.view) o.views.setView(view)
    }
    if (o.highlight !== false) setFlash({ key: focusKey(o.scope, o.idOf(row)) })
  }, [key, id, date, rows, enabled, hasMore, loadingMore])

  const mine = result && result.key === key ? result : null
  const dismiss = React.useCallback(() => setResult((r) => (r ? { ...r, missing: false } : r)), [])
  return {
    requested: id ?? date,
    found: mine?.found ?? null,
    missing: !!mine?.missing,
    missingBy: mine?.missing ? (id ? 'id' : 'date') : null,
    dismiss,
  }
}

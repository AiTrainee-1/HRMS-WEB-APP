import * as React from 'react'
import type { CalMonth } from '@/lib/month-switch'
import { defaultView, rowsForView, viewCounts, waitingInOtherMonths, type RequestView, type ViewOptions } from '@/lib/request-views'

export interface RequestViewsState<T> {
  /** The open view. Starts on Waiting when something waits, else This month (decided once, when the rows arrive). */
  view: RequestView
  setView: (view: RequestView) => void
  counts: Record<RequestView, number>
  /** The rows of the open view, in the order they came. */
  rows: T[]
  /** The month switcher's month when the views are month-scoped (`opts.scope`), else null. */
  scope?: CalMonth | null
  /** Rows waiting for a decision in OTHER months than the one shown, and the latest such month (0 / null unscoped). */
  elsewhere?: { count: number; month: CalMonth | null }
}

/**
 * Sorting, counts and the opening view for <StatusViews>. `rows` undefined = still loading (opens on Waiting until the
 * data arrives, then picks once). `opts` may be an inline object; it is read every render (lists are small).
 * With `opts.scope` (the month switcher) every view and count is about that month only; changing the month keeps the
 * person's chosen view.
 */
export function useRequestViews<T>(rows: readonly T[] | undefined, opts: ViewOptions<T>): RequestViewsState<T> {
  const [chosen, setChosen] = React.useState<RequestView | null>(null)
  const list = rows ?? []
  const counts = viewCounts(list, opts)
  // Pick the opening view once, the first render that has data (React allows this state update during render).
  if (chosen === null && rows !== undefined) setChosen(defaultView(counts))
  const view = chosen ?? 'waiting'
  const scope = opts.scope ? { year: opts.scope.year, month: opts.scope.month } : null
  return {
    view,
    setView: setChosen,
    counts,
    rows: rowsForView(list, view, opts),
    scope,
    elsewhere: waitingInOtherMonths(list, opts),
  }
}

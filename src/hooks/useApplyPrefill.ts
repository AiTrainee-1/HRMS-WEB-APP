import * as React from 'react'
import { useLocation, useSearch } from 'wouter'
import { readApplyPrefill, withoutApplyParams, type ApplyPrefill } from '@/lib/day-punches'

/**
 * Opens a request page's apply form from a link (owner 2026-11-24: the attendance day panel's chips):
 * `?apply=YYYY-MM-DD` (+ `&type=` for a permission). Calls `onPrefill` once per link with the checked day (null when the
 * form cannot take it: outside the request window, or in the future without `allowFuture`), then takes the params out
 * of the address (replace), so a reload or Back does not open the form again. Other params (`focus`, `date`) stay.
 */
export function useApplyPrefill(onPrefill: (prefill: ApplyPrefill) => void, opts: { allowFuture?: boolean } = {}) {
  const search = useSearch()
  const [location, navigate] = useLocation()
  const latest = React.useRef(onPrefill)
  React.useLayoutEffect(() => {
    latest.current = onPrefill
  })
  const allowFuture = !!opts.allowFuture
  React.useEffect(() => {
    // "Now" is read when the link is followed: the window moves with the date.
    const prefill = readApplyPrefill(search, new Date(), { allowFuture })
    if (!prefill) return
    const rest = withoutApplyParams(search)
    navigate(rest ? `${location}?${rest}` : location, { replace: true })
    latest.current(prefill)
  }, [search, location, navigate, allowFuture])
}

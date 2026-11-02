import * as React from 'react'
import { currentMonth, type CalMonth } from '@/lib/month-switch'

/**
 * The month a records page's switcher shows (owner 2026-11-02; mirrors the mobile app's src/hooks/useSelectedMonth.ts).
 * Until the employee picks one (or a link names a day: `initial`) it is the current month, read at every render, so a
 * tab left open across midnight on the last day moves on to the new month by itself. How far the arrows go is up to
 * the page's control (`min` / `max`).
 */
export function useSelectedMonth(initial?: CalMonth | null): [CalMonth, (month: CalMonth) => void] {
  const [picked, setPicked] = React.useState<CalMonth | null>(() => (initial ? { year: initial.year, month: initial.month } : null))
  const pick = React.useCallback((month: CalMonth) => setPicked({ year: month.year, month: month.month }), [])
  return [picked ?? currentMonth(), pick]
}

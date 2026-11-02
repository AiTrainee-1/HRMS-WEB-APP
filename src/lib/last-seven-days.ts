// The Dashboard's "Last 7 days" strip (components/dashboard/MonthCard.tsx). Pure, so `npm test` covers it.
//
// The strip ends today, so from the 1st to the 6th of a month it reaches back into last month. The month's attendance
// (GET /attendance/employee/<id>?month=&year=) only holds the asked month's days, so those days come from a second,
// previous-month request (hooks/useLastSevenDays.ts). While that request is loading, or when it failed, a day of last
// month is shown as neutral "not loaded" - never as "No record", which reads as missing attendance.

/** The smallest piece of a day record the strip needs (AttendanceDay has these and more). */
export interface StripRecord {
  date: string
  status: string
}

/** How a strip cell's record was found. */
export type StripCellState = 'record' | 'no_record' | 'loading' | 'unavailable'

export interface StripCell<R extends StripRecord> {
  date: Date
  key: string
  isToday: boolean
  /** The day falls in the month before `now`'s month. */
  lastMonth: boolean
  rec: R | undefined
  state: StripCellState
}

/** Where the previous month's records stand. */
export type PreviousMonthState<R> = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'ready'; records: R[] }

/** "yyyy-MM-dd" of a local date (same as lib/home-attention.ts dateKey; kept local so this file stands alone). */
function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The seven local days ending today, oldest first. */
export function lastSevenDates(now: Date, length = 7): Date[] {
  return Array.from({ length }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (length - 1 - i)))
}

/**
 * The month (1-12) and year the strip also needs, or null when all seven days fall in `now`'s month (the 7th onward).
 * January reaches back to December of the year before.
 */
export function previousMonthNeeded(now: Date, length = 7): { month: number; year: number } | null {
  if (now.getDate() >= length) return null
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { month: prev.getMonth() + 1, year: prev.getFullYear() }
}

/**
 * The strip's cells. `current` is this month's records; `previous` is last month's request state (pass `{status:'idle'}`
 * when it was not needed). A day with no record in a loaded month is 'no_record'; a last-month day whose month is not
 * loaded yet is 'loading', and one whose month failed to load (or was never asked for) is 'unavailable'.
 */
export function lastSevenDays<R extends StripRecord>(now: Date, current: R[], previous: PreviousMonthState<R>, length = 7): StripCell<R>[] {
  const byDate = new Map<string, R>()
  if (previous.status === 'ready') for (const r of previous.records) byDate.set(r.date, r)
  // This month wins if both responses ever carried the same date.
  for (const r of current) byDate.set(r.date, r)
  const dates = lastSevenDates(now, length)
  return dates.map((date, i) => {
    const key = localKey(date)
    const lastMonth = date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()
    const rec = byDate.get(key)
    let state: StripCellState
    if (rec) state = 'record'
    else if (!lastMonth || previous.status === 'ready') state = 'no_record'
    else if (previous.status === 'loading') state = 'loading'
    // 'error', or 'idle' (nothing will load it): still not "No record".
    else state = 'unavailable'
    return { date, key, isToday: i === dates.length - 1, lastMonth, rec, state }
  })
}

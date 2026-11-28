// "Today's unfinished day shows In progress" (owner 2026-11-26). The server counts TODAY's staff day with only a morning
// punch as Present (1 shift) while the shift is still running, and stores it as provisional: it is judged again once the
// shift's end plus its grace has passed (a Half Day, 0.5, when no afternoon punch came). Until then every screen shows
// the day as "In progress" - a neutral colour with a small live dot, the first punch ("In 09:06 · at work"), shifts as
// "—" (never 1), no Present / Half Day verdict, and "Counted after your shift ends at 18:10" - and no monthly total
// counts it.
//
// Every attendance day object (the monthly calendar's records[], the day details, the dashboard's today) carries two
// additive keys from the 2026-11-26 server: `inProgress` (bool) and `provisionalUntil` (ISO datetime or null, the moment
// the day is judged again). An older server sends neither: the day is then in progress only when it is TODAY (factory
// time), has a punch and still carries a `provisionalUntil` in the future; with no key at all it is never in progress.
// An explicit `inProgress` from the server always wins. Pure (no React), unit-tested in day-progress.test.ts.

/** The day keys this file reads (all optional: an older server sends only some of them). */
export interface DayProgressLike {
  date?: string | null
  status?: string | null
  inProgress?: boolean | null
  provisionalUntil?: string | null
  firstPunch?: string | null
  totalPunches?: number | null
}

/** The status key the screens use for a day still in progress (styles, labels); never sent by the server. */
export const IN_PROGRESS_STATUS = 'in_progress'
export const IN_PROGRESS_LABEL = 'In progress'
/** What an in-progress day shows where a finished day shows its shifts (1.00 / 0.50 ...). */
export const IN_PROGRESS_SHIFTS = '—'

/** The factory's offset from UTC (India Standard Time, no daylight saving): the server's own clock. */
const FACTORY_UTC_OFFSET_MS = 330 * 60_000
const pad = (n: number) => String(n).padStart(2, '0')

/** A moment as the factory's calendar day and clock: { day: "YYYY-MM-DD", time: "HH:MM" }. */
function factoryClock(ms: number): { day: string; time: string } {
  const f = new Date(ms + FACTORY_UTC_OFFSET_MS)
  return {
    day: `${f.getUTCFullYear()}-${pad(f.getUTCMonth() + 1)}-${pad(f.getUTCDate())}`,
    time: `${pad(f.getUTCHours())}:${pad(f.getUTCMinutes())}`,
  }
}

/** The factory calendar day ("YYYY-MM-DD") of `now`. */
export function factoryToday(now: Date = new Date()): string {
  return factoryClock(now.getTime()).day
}

/** `provisionalUntil` as milliseconds, or null when missing / not a timestamp. */
function untilMs(day: DayProgressLike): number | null {
  const v = day.provisionalUntil
  if (typeof v !== 'string' || !v.trim()) return null
  const ms = Date.parse(v.trim())
  return Number.isNaN(ms) ? null : ms
}

function hasPunch(day: DayProgressLike): boolean {
  return !!(typeof day.firstPunch === 'string' && day.firstPunch.trim()) || (typeof day.totalPunches === 'number' && day.totalPunches > 0)
}

/**
 * True while the day is still open: the server says so (`inProgress`), or - from a server that does not send the flag -
 * it is today in factory time, has a punch and its `provisionalUntil` is still ahead.
 */
export function isDayInProgress(day: DayProgressLike | null | undefined, now: Date = new Date()): boolean {
  if (!day) return false
  if (typeof day.inProgress === 'boolean') return day.inProgress
  const until = untilMs(day)
  if (until === null || until <= now.getTime()) return false
  return day.date === factoryToday(now) && hasPunch(day)
}

/** The day's status for the screens: 'in_progress' while the day is still open, else the server's own status. */
export function displayStatus<T extends DayProgressLike & { status: string }>(day: T, now: Date = new Date()): string {
  return isDayInProgress(day, now) ? IN_PROGRESS_STATUS : day.status
}

/** "18:10": when the day is counted, in factory time; null when the server did not say. */
export function countedAtTime(day: DayProgressLike): string | null {
  const ms = untilMs(day)
  return ms === null ? null : factoryClock(ms).time
}

/** "09:06" from "09:06" / "09:06:41"; null when there is no first punch. */
function clockOf(value: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim())
  return m ? `${pad(Number(m[1]))}:${m[2]}` : null
}

export interface InProgressView {
  label: string
  /** "In 09:06 · at work"; null when the day has no first punch to show. */
  arrival: string | null
  /** "Counted after your shift ends at 18:10" (or, once that time has passed and the server has not judged the day
   * yet, "Your shift ended at 18:10 · being counted now"). */
  counted: string
  /** Shown where a finished day shows its shifts. */
  shifts: string
}

/** What an in-progress day shows instead of its verdict, or null when the day is not in progress. */
export function inProgressView(day: DayProgressLike | null | undefined, now: Date = new Date()): InProgressView | null {
  if (!day || !isDayInProgress(day, now)) return null
  const first = clockOf(day.firstPunch)
  const at = countedAtTime(day)
  const ms = untilMs(day)
  const counted = !at
    ? 'Counted after your shift ends'
    : ms !== null && ms <= now.getTime()
      ? `Your shift ended at ${at} · being counted now`
      : `Counted after your shift ends at ${at}`
  return { label: IN_PROGRESS_LABEL, arrival: first ? `In ${first} · at work` : null, counted, shifts: IN_PROGRESS_SHIFTS }
}

/** The days a monthly total may count: every day except one still in progress. */
export function settledDays<T extends DayProgressLike>(days: readonly T[] | null | undefined, now: Date = new Date()): T[] {
  return (days ?? []).filter((d) => !isDayInProgress(d, now))
}

/** The month figures of GET /attendance/employee/<id> (`summary`). */
export interface MonthSummaryLike {
  present: number
  absent: number
  onLeave: number
  late: number
  halfShift: number
}

type SummaryDay = DayProgressLike & { status: string; isHalfShift?: boolean }

/**
 * The month's summary without a day still in progress. With no such day it is the server's summary as it came. With one,
 * Present / Half Day / Absent / Leave are counted again from the days (the server's own rules: a half is status
 * half_shift or isHalfShift), leaving the open day out - whether or not the server already left it out. Late stays the
 * server's: a Late-In is decided by the morning punch and is already final.
 */
export function settledSummary<S extends MonthSummaryLike>(
  summary: S | null | undefined,
  days: readonly SummaryDay[] | null | undefined,
  now: Date = new Date(),
): S | null {
  if (!summary) return null
  const list = days ?? []
  if (!list.some((d) => isDayInProgress(d, now))) return summary
  const settled = settledDays(list, now)
  return {
    ...summary,
    present: settled.filter((d) => d.status === 'present').length,
    halfShift: settled.filter((d) => d.status === 'half_shift' || d.isHalfShift === true).length,
    absent: settled.filter((d) => d.status === 'absent').length,
    onLeave: settled.filter((d) => d.status === 'on_leave').length,
  }
}

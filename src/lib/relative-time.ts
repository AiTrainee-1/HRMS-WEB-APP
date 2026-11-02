// Plain-English "how long ago" for employees: "just now", "5 minutes ago", "yesterday", "3 days ago", and the waiting
// line on a pending request: "waiting 3 days". Pure (pass `now` in tests), no locale data, no date library.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A Date from an ISO string / Date / epoch ms; null when it does not parse. A bare "YYYY-MM-DD" is read as LOCAL
 *  midnight (not UTC), so "2026-10-31" is the 31st on every PC. */
export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Whole calendar days from `a` to `b` (local dates), ignoring the time of day. */
export function calendarDaysBetween(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((db - da) / DAY)
}

/** "31 Oct" (this year) or "31 Oct 2025" (another year). */
export function shortDate(d: Date, now: Date = new Date()): string {
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/**
 * "just now" · "5 minutes ago" · "2 hours ago" · "yesterday" · "3 days ago" · "on 12 Oct" (a week or more ago).
 * The future reads "in 5 minutes" · "in 2 hours" · "tomorrow" · "in 3 days" · "on 12 Nov". "" when it does not parse.
 */
export function relativeTime(value: string | number | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(value)
  if (!d) return ''
  const diff = now.getTime() - d.getTime()
  const abs = Math.abs(diff)
  const past = diff >= 0
  if (abs < MINUTE) return 'just now'
  if (abs < HOUR) {
    const n = Math.floor(abs / MINUTE)
    return past ? `${plural(n, 'minute')} ago` : `in ${plural(n, 'minute')}`
  }
  const days = calendarDaysBetween(d, now) // positive when d is in the past
  if (abs < DAY && days === 0) {
    const n = Math.floor(abs / HOUR)
    return past ? `${plural(n, 'hour')} ago` : `in ${plural(n, 'hour')}`
  }
  if (days === 1) return 'yesterday'
  if (days === -1) return 'tomorrow'
  if (days === 0) {
    const n = Math.floor(abs / HOUR)
    return past ? `${plural(n, 'hour')} ago` : `in ${plural(n, 'hour')}`
  }
  if (Math.abs(days) < 7) return days > 0 ? `${plural(days, 'day')} ago` : `in ${plural(-days, 'day')}`
  return `on ${shortDate(d, now)}`
}

/**
 * How long a pending request has waited, for the line under its status: "waiting since today" · "waiting 1 day" ·
 * "waiting 3 days" · "waiting 2 weeks" (14+ days) · "waiting over a month" (31+). Counted in calendar days from the day
 * it was sent. "" when the date does not parse.
 */
export function waitingSince(sentAt: string | number | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(sentAt)
  if (!d) return ''
  const days = Math.max(0, calendarDaysBetween(d, now))
  if (days === 0) return 'waiting since today'
  if (days >= 31) return 'waiting over a month'
  if (days >= 14) return `waiting ${plural(Math.floor(days / 7), 'week')}`
  return `waiting ${plural(days, 'day')}`
}

/** Calendar days a request has waited (0 on the day it was sent); null when the date does not parse. Pages use it to
 *  turn a long wait amber/rose (e.g. >= 3 days). */
export function waitingDays(sentAt: string | number | Date | null | undefined, now: Date = new Date()): number | null {
  const d = toDate(sentAt)
  return d ? Math.max(0, calendarDaysBetween(d, now)) : null
}

/** "Good morning" (before 12) / "Good afternoon" (before 17) / "Good evening". */
export function greetingFor(now: Date = new Date()): string {
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

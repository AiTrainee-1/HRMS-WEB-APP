// How the request pages (Missing Punch, Outpass, Permission, Leave, Casual Leave) sort their rows into the four views
// Waiting / This month / Approved / Rejected (lib/request-views.ts). Mirrors the mobile app's src/lib/myRequests.ts, so
// both apps put a request in the same view. Pure, tested in my-requests.test.ts.
//
// Owner's words (2026-10-31):
//   Missing Punch: waiting, SUBMITTED during the current month, approved, rejected.
//   Outpass:       waiting, outpasses TAKEN during the current month, approved, rejected.
//   Permission:    waiting, permissions TAKEN during the current month, approved, rejected.

import { yearMonthOf, type StatusGroup, type ViewOptions } from './request-views.ts'
import { daysTouchMonth, monthBounds, monthKey, type CalMonth } from './month-switch.ts'
import type { ApprovalProgress, ApprovalRole } from '../types/index.ts'

const IST_OFFSET_MS = 330 * 60 * 1000

/**
 * The India calendar day of a value: "2026-10-07" stays as it is; an ISO date-time with an offset or "Z" (the server
 * sends created/approved times in UTC) becomes the date it was in India. Null when it is not a date.
 */
export function istDateOf(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return null
  // A date-time without an offset is already a wall-clock time: read its date part as it is.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return s.slice(0, 10)
  const ms = Date.parse(s)
  if (Number.isNaN(ms)) return null
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** pending / approved / rejected, the plain three every one of these modules uses (any case). */
export function simpleGroup(status: string | null | undefined): StatusGroup {
  const s = String(status ?? '').toLowerCase()
  if (s === 'pending') return 'waiting'
  if (s === 'approved') return 'approved'
  if (s === 'rejected') return 'rejected'
  return 'other'
}

// ── Missing Punch ──

export type MissingPunchLike = { status: string; date: string; createdAt?: string | null }

export function missingPunchGroup(status: string | null | undefined): StatusGroup {
  const s = String(status ?? '').toLowerCase()
  if (s === 'pending_hod' || s === 'pending_hr' || s === 'pending') return 'waiting'
  return simpleGroup(s)
}

/** "Sent this month" = every request sent this month (India date of createdAt; the punch's own date when absent). */
export function missingPunchViewOptions<T extends MissingPunchLike>(today?: Date): ViewOptions<T> {
  return {
    statusOf: (r) => r.status,
    groupOf: (r) => missingPunchGroup(r.status),
    month: { dateOf: (r) => istDateOf(r.createdAt) ?? r.date, kind: 'submitted' },
    today,
  }
}

// ── Outpass ──

export type OutpassLike = { status: string; createdAt: string; approvedAt?: string | null; exitedAt?: string | null }

/** The day a pass was taken: the day the employee went out, else the day it was approved, else the day it was asked. */
export function outpassDay(r: OutpassLike): string | null {
  return istDateOf(r.exitedAt) ?? istDateOf(r.approvedAt) ?? istDateOf(r.createdAt)
}

/** The day of a pass for the month switcher (2026-11-02): the India day the employee went out, else the day it was asked. */
export function outpassPassDay(r: OutpassLike): string | null {
  return istDateOf(r.exitedAt) ?? istDateOf(r.createdAt)
}

/** The India day of a tea break, for the month switcher: the day the employee went out (the server sends outAt in UTC). */
export function teaBreakDay(r: { outAt: string | null | undefined }): string | null {
  return istDateOf(r.outAt)
}

/** How many breaks GET /tea-break/my-status lists without `?month=` (an older server ignores the param). */
export const TEA_BREAK_RECENT_LIMIT = 10

/**
 * The tea breaks to list for the switcher's month. A server that applied `?month=YYYY-MM` echoes it: then `recent` is
 * that whole month. An older server sends only the latest breaks: then the ones of that month among them, and `partial`
 * when older breaks of that month may be missing (a full list that reaches back no further than the month's first day).
 */
export function teaBreaksForMonth<T extends { outAt: string | null | undefined }>(
  reply: { recent: readonly T[]; month?: string | null } | null | undefined,
  m: CalMonth,
): { rows: T[]; partial: boolean } {
  const recent = reply?.recent ?? []
  if (reply?.month === monthKey(m)) return { rows: recent.slice(), partial: false }
  const rows = recent.filter((r) => daysTouchMonth(teaBreakDay(r), m))
  const oldest = recent.length ? teaBreakDay(recent[recent.length - 1]) : null
  const partial = recent.length >= TEA_BREAK_RECENT_LIMIT && !!oldest && oldest >= monthBounds(m).first
  return { rows, partial }
}

/** "Taken this month" = approved passes whose day (outpassDay) is in this month. */
export function outpassViewOptions<T extends OutpassLike>(today?: Date): ViewOptions<T> {
  return {
    statusOf: (r) => r.status,
    groupOf: (r) => simpleGroup(r.status),
    month: { dateOf: outpassDay, kind: 'taken' },
    today,
  }
}

// ── Permission ──

export type PermissionLike = { status: string; date: string }

/** "Taken this month" = approved permissions for a day in this month (an Overdue / Excess one is still approved). */
export function permissionViewOptions<T extends PermissionLike>(today?: Date): ViewOptions<T> {
  return {
    statusOf: (r) => r.status,
    groupOf: (r) => simpleGroup(r.status),
    month: { dateOf: (r) => r.date, kind: 'taken' },
    today,
  }
}

/** Permissions of a month that count against the monthly limit (pending + approved), by the day they are for. */
export function permissionsUsedIn<T extends PermissionLike>(rows: readonly T[], year: number, month0: number): number {
  return rows.filter((r) => {
    const ym = yearMonthOf(r.date)
    return !!ym && ym[0] === year && ym[1] === month0 + 1 && simpleGroup(r.status) !== 'rejected'
  }).length
}

// ── Grouping a long list by month ──

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export type MonthSection<T> = { key: string; title: string; rows: T[] }

/** Rows grouped under "October 2026" headings, newest month first, keeping the rows' own order inside a month. Rows
 *  without a usable date go last under "Earlier". */
export function monthSections<T>(rows: readonly T[], dateOf: (row: T) => string | null | undefined): MonthSection<T>[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const ym = yearMonthOf(dateOf(r))
    const key = ym ? `${ym[0]}-${String(ym[1]).padStart(2, '0')}` : 'earlier'
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === 'earlier' ? 1 : b === 'earlier' ? -1 : b.localeCompare(a)))
    .map(([key, list]) => ({
      key,
      title: key === 'earlier' ? 'Earlier' : `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
      rows: list,
    }))
}

/** Newest first by a date (YYYY-MM-DD or ISO); equal dates keep their order. */
export function newestFirst<T>(rows: readonly T[], dateOf: (row: T) => string | null | undefined): T[] {
  return rows
    .map((r, i) => ({ r, i, d: String(dateOf(r) ?? '') }))
    .sort((a, b) => b.d.localeCompare(a.d) || a.i - b.i)
    .map((x) => x.r)
}

// ── Who a request waits for, in a sentence ──

const ROLE_PHRASE: Record<ApprovalRole, string> = { hod: 'your Department Head', hr: 'HR' }

/** "your Department Head" / "HR" / "your Department Head or HR"; null when it is not waiting on anyone named. */
export function waitingPhrase(a: ApprovalProgress | null | undefined): string | null {
  if (!a || a.currentStep == null || !Array.isArray(a.waitingFor) || !a.waitingFor.length) return null
  const roles = [...a.waitingFor].filter((r) => r in ROLE_PHRASE).sort()
  return roles.map((r) => ROLE_PHRASE[r]).join(' or ') || null
}

// ── Dates in words ──

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ymd(value: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** "Mon, 5 Oct 2026" for a YYYY-MM-DD (no time-zone shift); the input itself when it is not a date. */
export function dayText(value: string): string {
  const p = ymd(value)
  if (!p) return value
  const d = new Date(p[0], p[1] - 1, p[2])
  return `${WEEKDAYS[d.getDay()]}, ${p[2]} ${SHORT_MONTHS[p[1] - 1]} ${p[0]}`
}

/** One day: "Mon, 5 Oct 2026"; a range: "5 - 7 Oct 2026", "30 Sep - 2 Oct 2026", "29 Dec 2026 - 2 Jan 2027". */
export function dayRangeText(start: string, end?: string | null): string {
  const a = ymd(start)
  const b = end ? ymd(end) : null
  if (!a) return start
  if (!b || end === start || end! < start) return dayText(start)
  if (a[0] !== b[0]) return `${a[2]} ${SHORT_MONTHS[a[1] - 1]} ${a[0]} - ${b[2]} ${SHORT_MONTHS[b[1] - 1]} ${b[0]}`
  if (a[1] !== b[1]) return `${a[2]} ${SHORT_MONTHS[a[1] - 1]} - ${b[2]} ${SHORT_MONTHS[b[1] - 1]} ${b[0]}`
  return `${a[2]} - ${b[2]} ${SHORT_MONTHS[a[1] - 1]} ${a[0]}`
}

/** "10:05 AM" for an "HH:mm" (or "HH:mm:ss") clock; the input itself otherwise. */
export function clockText(hhmm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''))
  if (!m) return String(hhmm ?? '')
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}

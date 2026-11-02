// Geo Punch / On-Duty -> "View Records": every On-Duty request the employee made, in the four views (Waiting / Sent this
// month / Approved / Rejected), plus the "See route" drawing. Pure (no React), unit-tested in onduty-records.test.ts.
// Mirrors the mobile app's src/lib/myRequests.ts (On-Duty part) and src/components/onduty/OnDutyRecords.tsx.
//
// GET /on-duty-sessions/mine?page=&pageSize=  (backend/api/mobile_requests_views.py::my_on_duty_sessions)
//   -> { items, total, page, pageSize, hasMore, counts: { waiting, month, approved, rejected } }
// GET /tracking/journeys/<id>                  (geo_tracking/views.py::journey_detail; an employee reads their OWN only)
//   -> { track, summary: { distanceM, travelS, stopS, stopCount, ... }, segments, path: [[lat, lng, ms], ...], punches }

import type { ApprovalProgress } from '../types/index.ts'
import type { RequestView, StatusGroup, ViewOptions } from './request-views.ts'

export interface OnDutyRecordPunch {
  punchNumber: number
  punchType: 'IN' | 'OUT'
  punchDate: string | null
  /** "HH:MM" */
  punchTime: string | null
  status: 'approved' | 'rejected' | 'pending'
  isMocked: boolean
}

export interface OnDutyJourneyRef {
  id: number
  status: string
  distanceM: number
}

export interface OnDutyRecord {
  id: number
  destination: string
  branchName: string | null
  /** YYYY-MM-DD, the India day it was sent (a session never runs past its day). */
  date: string | null
  /** What the employee sees elsewhere ("active" while still with an approver). */
  status: string
  /** The true HRMS state the four views sort by: pending_hod | pending_hr | active | completed | rejected. */
  approvalStatus: string
  isProvisional: boolean
  employeeEndedAt: string | null
  completedAt: string | null
  completionReason: string | null
  createdAt: string | null
  hodReviewedBy: string | null
  hodReviewComment: string | null
  hodReviewedAt: string | null
  hrReviewedBy: string | null
  hrReviewComment: string | null
  hrReviewedAt: string | null
  punches: OnDutyRecordPunch[]
  punchCount: number
  journey: OnDutyJourneyRef | null
  approval: ApprovalProgress | null
}

export interface OnDutyRecordsPage {
  items: OnDutyRecord[]
  page: number
  total: number
  hasMore: boolean
  /** Over ALL of the employee's requests (not only this page) - or over the asked month's only when `month` is set;
   *  null when the server did not send them. */
  counts: Record<RequestView, number> | null
  /** "YYYY-MM" when the server applied `?month=` (it echoes it; an older server ignores the param and sends null). */
  month: string | null
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const orNull = (v: unknown): string | null => str(v) || null
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function readPunch(raw: unknown): OnDutyRecordPunch | null {
  if (!isObject(raw)) return null
  const n = num(raw.punchNumber)
  if (n === null || n < 1 || n > 4) return null
  return {
    punchNumber: n,
    punchType: raw.punchType === 'OUT' ? 'OUT' : raw.punchType === 'IN' ? 'IN' : n % 2 ? 'IN' : 'OUT',
    punchDate: orNull(raw.punchDate),
    punchTime: orNull(raw.punchTime),
    status: raw.status === 'approved' || raw.status === 'rejected' ? raw.status : 'pending',
    isMocked: raw.isMocked === true,
  }
}

export function readOnDutyRecord(raw: unknown): OnDutyRecord | null {
  if (!isObject(raw)) return null
  const id = num(raw.id)
  if (id === null) return null
  const punches = (Array.isArray(raw.punches) ? raw.punches : []).map(readPunch).filter((p): p is OnDutyRecordPunch => p !== null)
  const j = isObject(raw.journey) ? raw.journey : null
  const jid = j ? num(j.id) : null
  return {
    id,
    destination: str(raw.destination) || 'On-Duty',
    branchName: orNull(raw.branchName),
    date: orNull(raw.date),
    status: str(raw.status),
    approvalStatus: str(raw.approvalStatus) || str(raw.status),
    isProvisional: raw.isProvisional === true,
    employeeEndedAt: orNull(raw.employeeEndedAt),
    completedAt: orNull(raw.completedAt),
    completionReason: orNull(raw.completionReason),
    createdAt: orNull(raw.createdAt),
    hodReviewedBy: orNull(raw.hodReviewedBy),
    hodReviewComment: orNull(raw.hodReviewComment),
    hodReviewedAt: orNull(raw.hodReviewedAt),
    hrReviewedBy: orNull(raw.hrReviewedBy),
    hrReviewComment: orNull(raw.hrReviewComment),
    hrReviewedAt: orNull(raw.hrReviewedAt),
    punches,
    punchCount: num(raw.punchCount) ?? punches.filter((p) => p.status !== 'rejected').length,
    journey: j && jid !== null ? { id: jid, status: str(j.status), distanceM: Math.max(0, num(j.distanceM) ?? 0) } : null,
    approval: isObject(raw.approval) && Array.isArray(raw.approval.steps) ? (raw.approval as unknown as ApprovalProgress) : null,
  }
}

const nn = (v: unknown): number => {
  const x = num(v)
  return x !== null && x > 0 ? Math.floor(x) : 0
}

/** One page of GET /on-duty-sessions/mine, or null when the reply is not that shape. */
export function normalizeOnDutyPage(raw: unknown, requestedPage = 1): OnDutyRecordsPage | null {
  if (!isObject(raw) || !Array.isArray(raw.items)) return null
  const items = raw.items.map(readOnDutyRecord).filter((r): r is OnDutyRecord => r !== null)
  const c = isObject(raw.counts) ? raw.counts : null
  return {
    items,
    page: nn(raw.page) || requestedPage,
    total: num(raw.total) ?? items.length,
    hasMore: raw.hasMore === true,
    counts: c ? { waiting: nn(c.waiting), month: nn(c.month), approved: nn(c.approved), rejected: nn(c.rejected) } : null,
    month: typeof raw.month === 'string' && /^\d{4}-\d{2}$/.test(raw.month.trim()) ? raw.month.trim() : null,
  }
}

/** The day an On-Duty request is for, for the month switcher: the session date (the India day it was sent when the
 *  server gave no date). */
export function onDutyDay(r: Pick<OnDutyRecord, 'date' | 'createdAt'>): string | null {
  return r.date ?? istDateOf(r.createdAt)
}

/**
 * An older server ignores `?month=` and pages through everything, newest first: whether the pages loaded so far reach
 * back past the start of `monthFirst` ("YYYY-MM-01"), so every record of that month is among them. True when there is
 * nothing more to load.
 */
export function monthCovered(rows: readonly Pick<OnDutyRecord, 'date' | 'createdAt'>[], monthFirst: string, hasMore: boolean): boolean {
  if (!hasMore) return true
  const last = rows.length ? onDutyDay(rows[rows.length - 1]) : null
  return !!last && last < monthFirst
}

const IST_OFFSET_MS = 330 * 60 * 1000

/** The India calendar day of a value: "2026-10-07" stays; an ISO date-time with an offset or "Z" becomes its date in
 *  India. Null when it is not a date. */
export function istDateOf(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (!/^\d{4}-\d{2}-\d{2}T/.test(s)) return null
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return s.slice(0, 10)
  const ms = Date.parse(s)
  if (Number.isNaN(ms)) return null
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Sorted by the TRUE approval state (`approvalStatus`), never by `status` (a request still with an approver reads
 *  "active" to the employee): pending_hod / pending_hr -> waiting; active / completed -> approved; rejected. */
export function onDutyGroup(row: Pick<OnDutyRecord, 'approvalStatus' | 'status'>): StatusGroup {
  const s = String(row.approvalStatus || row.status || '').toLowerCase()
  if (s === 'pending_hod' || s === 'pending_hr') return 'waiting'
  if (s === 'active' || s === 'completed') return 'approved'
  if (s === 'rejected') return 'rejected'
  return 'other'
}

/** "Sent this month" = every On-Duty request sent this month (India date). */
export function onDutyViewOptions(today?: Date): ViewOptions<OnDutyRecord> {
  return {
    statusOf: (r) => r.approvalStatus || r.status,
    groupOf: onDutyGroup,
    month: { dateOf: (r) => r.date ?? istDateOf(r.createdAt), kind: 'submitted' },
    today,
  }
}

/** The one-line state of a request in View Records, in plain English. */
export function onDutyRowDetail(row: Pick<OnDutyRecord, 'approvalStatus' | 'status' | 'completionReason'>): string {
  const group = onDutyGroup(row)
  const ended = String(row.status).toLowerCase() === 'completed' || String(row.approvalStatus).toLowerCase() === 'completed'
  const how =
    row.completionReason === 'auto_4th_punch'
      ? ' (all 4 punches)'
      : row.completionReason === 'auto_day_end'
        ? ' (closed at day end)'
        : row.completionReason === 'manual'
          ? ' (marked done)'
          : ''
  if (group === 'waiting') return ended ? 'Day ended, waiting for approval' : 'Day in progress, waiting for approval'
  if (group === 'approved') return ended ? `Day completed${how}` : 'Day in progress'
  if (group === 'rejected') return 'Punches recorded under it do not count'
  return ''
}

/** The four punch cells of a day, slot 1..4 (null for a slot with no punch). */
export function punchCells(punches: readonly OnDutyRecordPunch[]): (OnDutyRecordPunch | null)[] {
  return [1, 2, 3, 4].map((n) => punches.find((p) => p.punchNumber === n) ?? null)
}

/** "1.2 km" / "850 m". */
export function formatDistance(m: number | null | undefined): string {
  const v = typeof m === 'number' && Number.isFinite(m) && m > 0 ? m : 0
  if (v < 1000) return `${Math.round(v)} m`
  return `${(v / 1000).toFixed(v < 10_000 ? 1 : 0)} km`
}

/** "2 h 15 m" / "40 m" / "under a minute". */
export function formatDuration(seconds: number | null | undefined): string {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0
  if (s < 60) return s ? 'under a minute' : '0 m'
  const minutes = Math.round(s / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${m} m` : `${m} m`
}

// ---- the route ("See route") ---------------------------------------------------------------------------------------

export interface JourneyStop {
  key: string
  startedAt: string | null
  durationS: number
  lat: number
  lng: number
  address: string
}

export interface Journey {
  distanceM: number
  travelS: number
  stopS: number
  stopCount: number
  durationS: number
  /** [lat, lng] in time order. */
  path: [number, number][]
  stops: JourneyStop[]
  startedAt: string | null
  endedAt: string | null
}

/** GET /tracking/journeys/<id>, or null when it is not that shape. */
export function normalizeJourney(raw: unknown): Journey | null {
  if (!isObject(raw)) return null
  const summary = isObject(raw.summary) ? raw.summary : {}
  const track = isObject(raw.track) ? raw.track : {}
  if (!Array.isArray(raw.path) && !Array.isArray(raw.segments)) return null
  const path: [number, number][] = (Array.isArray(raw.path) ? raw.path : [])
    .map((p): [number, number] | null => {
      if (!Array.isArray(p)) return null
      const lat = num(p[0])
      const lng = num(p[1])
      return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lat, lng] : null
    })
    .filter((p): p is [number, number] => p !== null)
  const stops: JourneyStop[] = (Array.isArray(raw.segments) ? raw.segments : [])
    .filter((s): s is Record<string, unknown> => isObject(s) && s.kind === 'stop')
    .map((s, i) => ({
      key: String(num(s.id) ?? i),
      startedAt: orNull(s.startedAt),
      durationS: Math.max(0, num(s.durationS) ?? 0),
      lat: num(s.centerLat) ?? num(s.startLat) ?? NaN,
      lng: num(s.centerLng) ?? num(s.startLng) ?? NaN,
      address: str(s.address),
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  return {
    distanceM: Math.max(0, num(summary.distanceM) ?? 0),
    travelS: Math.max(0, num(summary.travelS) ?? 0),
    stopS: Math.max(0, num(summary.stopS) ?? 0),
    stopCount: Math.max(0, num(summary.stopCount) ?? stops.length),
    durationS: Math.max(0, num(summary.durationS) ?? 0),
    path,
    stops,
    startedAt: orNull(track.startedAt),
    endedAt: orNull(track.endedAt),
  }
}

export interface ProjectedRoute {
  /** SVG polyline points "x,y x,y ..." inside the box. */
  points: string
  start: [number, number] | null
  end: [number, number] | null
  stops: { key: string; x: number; y: number }[]
}

/**
 * The route drawn in a `width` x `height` box with `pad` margin: an equirectangular projection (longitude scaled by the
 * cosine of the latitude, so a short city route keeps its shape), keeping the aspect ratio and centred. Long paths are
 * thinned to at most `maxPoints` vertices (first and last always kept).
 */
export function projectRoute(
  path: readonly [number, number][],
  stops: readonly Pick<JourneyStop, 'key' | 'lat' | 'lng'>[],
  width: number,
  height: number,
  pad = 16,
  maxPoints = 400,
): ProjectedRoute {
  const all = [...path, ...stops.map((s): [number, number] => [s.lat, s.lng])]
  if (!all.length) return { points: '', start: null, end: null, stops: [] }
  const midLat = all.reduce((sum, p) => sum + p[0], 0) / all.length
  const k = Math.cos((midLat * Math.PI) / 180) || 1
  const xs = all.map((p) => p[1] * k)
  const ys = all.map((p) => p[0])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = maxX - minX
  const spanY = maxY - minY
  const innerW = Math.max(1, width - 2 * pad)
  const innerH = Math.max(1, height - 2 * pad)
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min(spanX ? innerW / spanX : Infinity, spanY ? innerH / spanY : Infinity)
  const offX = pad + (innerW - spanX * scale) / 2
  const offY = pad + (innerH - spanY * scale) / 2
  const at = (lat: number, lng: number): [number, number] => [
    Math.round((offX + (lng * k - minX) * scale) * 10) / 10,
    // North is up: a larger latitude is a smaller y.
    Math.round((offY + (maxY - lat) * scale) * 10) / 10,
  ]
  const step = path.length > maxPoints ? Math.ceil(path.length / maxPoints) : 1
  const thinned = path.filter((_, i) => i % step === 0 || i === path.length - 1)
  const xy = thinned.map((p) => at(p[0], p[1]))
  return {
    points: xy.map((p) => `${p[0]},${p[1]}`).join(' '),
    start: xy[0] ?? null,
    end: xy.length > 1 ? xy[xy.length - 1] : null,
    stops: stops.map((s) => {
      const [x, y] = at(s.lat, s.lng)
      return { key: s.key, x, y }
    }),
  }
}

/** Google Maps directions from the first point to the last, through up to 8 stops; null without a path. */
export function routeMapLink(path: readonly [number, number][], stops: readonly Pick<JourneyStop, 'lat' | 'lng'>[] = []): string | null {
  if (path.length < 2) return null
  const fmt = (p: readonly [number, number]) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`
  const origin = fmt(path[0])
  const destination = fmt(path[path.length - 1])
  const way = stops.slice(0, 8).map((s) => fmt([s.lat, s.lng]))
  const params = new URLSearchParams({ api: '1', origin, destination, travelmode: 'driving' })
  if (way.length) params.set('waypoints', way.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

// ---- month headings for long lists ---------------------------------------------------------------------------------

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export interface MonthSection<T> {
  key: string
  /** "October 2026", or "Earlier" for rows without a date. */
  title: string
  rows: T[]
}

/** Rows split under month headings, keeping their order. */
export function monthSections<T>(rows: readonly T[], dateOf: (row: T) => string | null | undefined): MonthSection<T>[] {
  const out: MonthSection<T>[] = []
  const byKey = new Map<string, MonthSection<T>>()
  for (const row of rows) {
    const m = /^(\d{4})-(\d{2})/.exec(String(dateOf(row) ?? ''))
    const key = m ? `${m[1]}-${m[2]}` : 'none'
    let section = byKey.get(key)
    if (!section) {
      section = { key, title: m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : 'Earlier', rows: [] }
      byKey.set(key, section)
      out.push(section)
    }
    section.rows.push(row)
  }
  return out
}

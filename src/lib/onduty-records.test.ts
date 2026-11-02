// Run with `npm test`. Geo Punch / On-Duty -> View Records: the GET /on-duty-sessions/mine contract
// (backend/api/mobile_requests_views.py), the four views, and the "See route" drawing (GET /tracking/journeys/<id>).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { rowsForView, viewCounts } from './request-views.ts'
import {
  formatDistance,
  formatDuration,
  monthSections,
  istDateOf,
  monthCovered,
  normalizeJourney,
  normalizeOnDutyPage,
  onDutyDay,
  onDutyGroup,
  onDutyRowDetail,
  onDutyViewOptions,
  projectRoute,
  punchCells,
  routeMapLink,
} from './onduty-records.ts'

const row = (over: Record<string, unknown>) => ({
  id: 1,
  destination: 'ABC Mills',
  date: '2026-10-20',
  status: 'active',
  approvalStatus: 'pending_hod',
  punches: [],
  ...over,
})

describe('normalizeOnDutyPage', () => {
  test('reads a real page, with the server counts', () => {
    const p = normalizeOnDutyPage({
      items: [
        row({ punches: [{ punchNumber: 1, punchType: 'IN', punchTime: '09:05', status: 'approved' }, { punchNumber: 9 }], journey: { id: 4, distanceM: 1234.6 } }),
        { nope: 1 },
      ],
      page: 1,
      total: 1,
      hasMore: false,
      counts: { waiting: 1, month: 1, approved: 0, rejected: 0 },
    })
    assert.ok(p)
    assert.equal(p.items.length, 1)
    assert.equal(p.items[0].punches.length, 1)
    assert.equal(p.items[0].punchCount, 1)
    assert.deepEqual(p.items[0].journey, { id: 4, status: '', distanceM: 1234.6 })
    assert.deepEqual(p.counts, { waiting: 1, month: 1, approved: 0, rejected: 0 })
  })

  test('not the contract: null', () => {
    assert.equal(normalizeOnDutyPage(null), null)
    assert.equal(normalizeOnDutyPage({ items: {} }), null)
  })
})

describe('views', () => {
  test('sorted by the TRUE approval state, never by the employee-facing status', () => {
    assert.equal(onDutyGroup({ status: 'active', approvalStatus: 'pending_hr' }), 'waiting')
    assert.equal(onDutyGroup({ status: 'completed', approvalStatus: 'completed' }), 'approved')
    assert.equal(onDutyGroup({ status: 'active', approvalStatus: 'active' }), 'approved')
    assert.equal(onDutyGroup({ status: 'rejected', approvalStatus: 'rejected' }), 'rejected')
  })

  test('"Sent this month" counts every status sent this month (India date)', () => {
    const p = normalizeOnDutyPage({
      items: [
        row({ id: 1, date: '2026-10-20', approvalStatus: 'pending_hod' }),
        row({ id: 2, date: '2026-10-02', approvalStatus: 'rejected' }),
        row({ id: 3, date: '2026-09-30', approvalStatus: 'completed' }),
      ],
    })!
    const opts = onDutyViewOptions(new Date(2026, 9, 31))
    assert.deepEqual(viewCounts(p.items, opts), { waiting: 1, month: 2, approved: 1, rejected: 1 })
    assert.deepEqual(
      rowsForView(p.items, 'month', opts).map((r) => r.id),
      [1, 2],
    )
  })

  test('India date of a UTC time', () => {
    assert.equal(istDateOf('2026-10-31T20:00:00Z'), '2026-11-01')
    assert.equal(istDateOf('2026-10-31'), '2026-10-31')
    assert.equal(istDateOf('nope'), null)
  })

  test('the one-line state', () => {
    assert.equal(onDutyRowDetail({ status: 'active', approvalStatus: 'pending_hod', completionReason: null }), 'Day in progress, waiting for approval')
    assert.equal(onDutyRowDetail({ status: 'completed', approvalStatus: 'completed', completionReason: 'auto_4th_punch' }), 'Day completed (all 4 punches)')
    assert.equal(onDutyRowDetail({ status: 'rejected', approvalStatus: 'rejected', completionReason: null }), 'Punches recorded under it do not count')
  })

  test('month headings keep the order', () => {
    const s = monthSections([{ d: '2026-10-20' }, { d: '2026-10-02' }, { d: '2026-09-30' }, { d: null }], (r) => r.d)
    assert.deepEqual(
      s.map((x) => [x.title, x.rows.length]),
      [
        ['October 2026', 2],
        ['September 2026', 1],
        ['Earlier', 1],
      ],
    )
  })

  test('the four punch cells', () => {
    const cells = punchCells([{ punchNumber: 3, punchType: 'IN', punchDate: null, punchTime: '14:00', status: 'pending', isMocked: false }])
    assert.deepEqual(
      cells.map((c) => c?.punchNumber ?? null),
      [null, null, 3, null],
    )
  })
})

describe('route', () => {
  test('normalises a journey; stops only from stop segments with a place', () => {
    const j = normalizeJourney({
      summary: { distanceM: 5400, travelS: 3600, stopS: 1200, stopCount: 1, durationS: 4800 },
      track: { startedAt: '2026-10-20T03:30:00Z' },
      path: [[11.0, 77.0, 1], [11.01, 77.01, 2], ['x', 1], [200, 1]],
      segments: [
        { id: 1, kind: 'travel' },
        { id: 2, kind: 'stop', centerLat: 11.005, centerLng: 77.005, durationS: 1200, address: 'Avinashi Rd' },
        { id: 3, kind: 'stop' },
      ],
    })
    assert.ok(j)
    assert.equal(j.path.length, 2)
    assert.equal(j.stops.length, 1)
    assert.equal(j.stops[0].address, 'Avinashi Rd')
    assert.equal(normalizeJourney({ nothing: true }), null)
  })

  test('projection fits the box, north up, keeps first and last', () => {
    const r = projectRoute(
      [
        [11.0, 77.0],
        [11.1, 77.0],
      ],
      [],
      200,
      100,
      10,
    )
    assert.ok(r.start && r.end)
    // The northern end (11.1) is at the top.
    assert.ok(r.end[1] < r.start[1])
    assert.equal(r.start[1], 90)
    assert.equal(r.end[1], 10)
    assert.equal(projectRoute([], [], 100, 100).points, '')
  })

  test('a long path is thinned', () => {
    const path = Array.from({ length: 1000 }, (_, i): [number, number] => [11 + i / 1e4, 77])
    const r = projectRoute(path, [], 300, 200, 10, 100)
    const count = r.points.split(' ').length
    assert.ok(count <= 101, String(count))
  })

  test('map link and words', () => {
    assert.match(routeMapLink([[11, 77], [11.1, 77.1]]) ?? '', /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=11\.000000%2C77\.000000/)
    assert.equal(routeMapLink([[11, 77]]), null)
    assert.equal(formatDistance(850), '850 m')
    assert.equal(formatDistance(5400), '5.4 km')
    assert.equal(formatDuration(4800), '1 h 20 m')
    assert.equal(formatDuration(0), '0 m')
  })
})

describe('the month switcher (2026-11-02)', () => {
  test('a server that applied ?month= echoes it; an older one does not', () => {
    assert.equal(normalizeOnDutyPage({ items: [], month: '2026-09' })?.month, '2026-09')
    assert.equal(normalizeOnDutyPage({ items: [] })?.month, null)
    assert.equal(normalizeOnDutyPage({ items: [], month: 'Sep' })?.month, null)
  })

  test('the day a request is for: the session date, else the India day it was sent', () => {
    assert.equal(onDutyDay({ date: '2026-10-20', createdAt: '2026-10-20T03:00:00Z' }), '2026-10-20')
    assert.equal(onDutyDay({ date: null, createdAt: '2026-10-31T19:00:00Z' }), '2026-11-01')
    assert.equal(onDutyDay({ date: null, createdAt: null }), null)
  })

  test('an older server: the pages loaded so far cover a month once they reach back past its first day', () => {
    const r = (date: string) => ({ date, createdAt: null })
    const loaded = [r('2026-11-02'), r('2026-10-15'), r('2026-10-01')]
    assert.equal(monthCovered(loaded, '2026-11-01', true), true)
    // the 1st itself may go on on the next page
    assert.equal(monthCovered(loaded, '2026-10-01', true), false)
    assert.equal(monthCovered(loaded, '2026-09-01', true), false)
    // nothing more to load: covered whatever the month
    assert.equal(monthCovered(loaded, '2026-09-01', false), true)
    assert.equal(monthCovered([], '2026-09-01', true), false)
  })
})

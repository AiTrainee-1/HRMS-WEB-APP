// Run with `npm test`. The four request views (lib/request-views.ts) - the same vectors as the mobile app's
// requestViews.test.ts, so both apps sort requests alike, plus the web's legacy pending_hod / pending_hr spellings.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultView,
  emptyViewText,
  inMonthScope,
  monthEmptyText,
  monthForRow,
  rowsForView,
  rowsInScope,
  scopeToRow,
  statusGroup,
  viewCounts,
  waitingInOtherMonths,
  yearMonthOf,
  type ViewOptions,
} from './request-views.ts'

type Row = { id: number; status: string; date: string; createdAt: string }
const today = new Date(2026, 9, 31) // 31 Oct 2026
const rows: Row[] = [
  { id: 1, status: 'pending', date: '2026-10-30', createdAt: '2026-10-29T10:00:00+05:30' },
  { id: 2, status: 'approved', date: '2026-10-05', createdAt: '2026-09-30T23:30:00+05:30' },
  { id: 3, status: 'approved', date: '2026-09-12', createdAt: '2026-09-10T09:00:00+05:30' },
  { id: 4, status: 'rejected', date: '2026-10-20', createdAt: '2026-10-19T09:00:00+05:30' },
  { id: 5, status: 'hod_approved', date: '2026-11-02', createdAt: '2026-10-31T08:00:00+05:30' },
]
const taken: ViewOptions<Row> = { statusOf: (r) => r.status, month: { dateOf: (r) => r.date, kind: 'taken' }, today }
const submitted: ViewOptions<Row> = { statusOf: (r) => r.status, month: { dateOf: (r) => r.createdAt, kind: 'submitted' }, today }

test('every module spelling falls in the right group', () => {
  for (const s of ['pending', 'PENDING', 'hod_approved', 'in_review', 'pending_hod', 'pending_hr']) assert.equal(statusGroup(s), 'waiting', s)
  for (const s of ['approved', 'out', 'returned', 'completed']) assert.equal(statusGroup(s), 'approved', s)
  for (const s of ['rejected', 'cancelled', 'expired']) assert.equal(statusGroup(s), 'rejected', s)
  assert.equal(statusGroup(''), 'other')
  assert.equal(statusGroup(null), 'other')
})

test('waiting, approved and rejected follow the status', () => {
  assert.deepEqual(rowsForView(rows, 'waiting', taken).map((r) => r.id), [1, 5])
  assert.deepEqual(rowsForView(rows, 'approved', taken).map((r) => r.id), [2, 3])
  assert.deepEqual(rowsForView(rows, 'rejected', taken).map((r) => r.id), [4])
})

test('"taken this month" is approved rows whose day is in this month', () => {
  assert.deepEqual(rowsForView(rows, 'month', taken).map((r) => r.id), [2])
})

test('"submitted this month" is every row sent this month, read without time-zone shifts', () => {
  // row 2 was sent at 23:30 IST on 30 Sep: still September even though it is 18:00 UTC
  assert.deepEqual(rowsForView(rows, 'month', submitted).map((r) => r.id), [1, 4, 5])
})

test('counts and the opening view', () => {
  assert.deepEqual(viewCounts(rows, taken), { waiting: 2, month: 1, approved: 2, rejected: 1 })
  assert.equal(defaultView({ waiting: 0, month: 3, approved: 1, rejected: 0 }), 'month')
  assert.equal(defaultView({ waiting: 1, month: 0, approved: 0, rejected: 0 }), 'waiting')
})

test('a page can overrule the group of a row', () => {
  const opts: ViewOptions<Row> = { ...taken, groupOf: (r) => (r.id === 4 ? 'approved' : null) }
  assert.deepEqual(rowsForView(rows, 'approved', opts).map((r) => r.id), [2, 3, 4])
})

test('yearMonthOf reads only the date part', () => {
  assert.deepEqual(yearMonthOf('2026-10-07'), [2026, 10])
  assert.deepEqual(yearMonthOf('2026-10-07T23:59:00-08:00'), [2026, 10])
  assert.equal(yearMonthOf('07/10/2026'), null)
  assert.equal(yearMonthOf(undefined), null)
})

// ── The month switcher (`scope`, 2026-11-02) - the mobile app's requestViews.test.ts vectors ──

type Leave = { id: number; status: string; start: string; end: string }
const leaves: Leave[] = [
  { id: 1, status: 'pending', start: '2026-09-30', end: '2026-10-02' },
  { id: 2, status: 'approved', start: '2026-09-12', end: '2026-09-12' },
  { id: 3, status: 'rejected', start: '2026-09-20', end: '2026-09-21' },
  { id: 4, status: 'approved', start: '2026-10-15', end: '2026-10-15' },
  { id: 5, status: 'pending', start: '2026-11-03', end: '2026-11-03' },
  { id: 6, status: 'mystery', start: '2026-09-01', end: '2026-09-01' },
]
const scoped = (year: number, month: number): ViewOptions<Leave> => ({
  statusOf: (r) => r.status,
  month: { dateOf: (r) => r.start, kind: 'taken' },
  today: new Date(2026, 10, 2),
  scope: { year, month, daysOf: (r) => [r.start, r.end] },
})

test('a month scope: every view lists and counts that month only; the second view is every row of it', () => {
  const sep = scoped(2026, 9)
  assert.deepEqual(rowsForView(leaves, 'waiting', sep).map((r) => r.id), [1])
  assert.deepEqual(rowsForView(leaves, 'approved', sep).map((r) => r.id), [2])
  assert.deepEqual(rowsForView(leaves, 'rejected', sep).map((r) => r.id), [3])
  // every row of September, whatever its status (an unknown status included)
  assert.deepEqual(rowsForView(leaves, 'month', sep).map((r) => r.id), [1, 2, 3, 6])
  assert.deepEqual(viewCounts(leaves, sep), { waiting: 1, month: 4, approved: 1, rejected: 1 })
  // the 30 Sep - 2 Oct leave is in October too
  assert.deepEqual(viewCounts(leaves, scoped(2026, 10)), { waiting: 1, month: 2, approved: 1, rejected: 0 })
  assert.deepEqual(viewCounts(leaves, scoped(2026, 3)), { waiting: 0, month: 0, approved: 0, rejected: 0 })
  assert.equal(defaultView(viewCounts(leaves, scoped(2026, 10))), 'waiting')
  assert.deepEqual(rowsInScope(leaves, sep).map((r) => r.id), [1, 2, 3, 6])
  assert.equal(inMonthScope(leaves[3], sep.scope!), false)
})

/** The same options without the month switcher. */
const unscoped = <T,>(opts: ViewOptions<T>): ViewOptions<T> => ({ ...opts, scope: undefined })

test('without a scope nothing changes', () => {
  // "taken this month" (November) = approved rows of November: none
  assert.deepEqual(viewCounts(leaves, unscoped(scoped(2026, 9))), { waiting: 2, month: 0, approved: 2, rejected: 1 })
})

test('the KPI tiles follow the month on screen: the four views\' counts of that month, "Taken" = its approved ones', () => {
  // Every month together would say 2 waiting / 2 approved; the tiles show the month's own figures instead.
  const sep = viewCounts(leaves, scoped(2026, 9))
  assert.deepEqual({ waiting: sep.waiting, taken: sep.approved, rejected: sep.rejected, all: sep.month }, { waiting: 1, taken: 1, rejected: 1, all: 4 })
  const oct = viewCounts(leaves, scoped(2026, 10))
  assert.deepEqual({ waiting: oct.waiting, taken: oct.approved, rejected: oct.rejected, all: oct.month }, { waiting: 1, taken: 1, rejected: 0, all: 2 })
  // a month with nothing: every tile 0 (a tile never sends the person to another month)
  assert.deepEqual(viewCounts(leaves, scoped(2026, 3)), { waiting: 0, month: 0, approved: 0, rejected: 0 })
  // what a "Taken" tile counts is exactly what the Approved view lists in that month
  assert.equal(rowsForView(leaves, 'approved', scoped(2026, 10)).length, oct.approved)
})

test('the month a focused row needs, and which views list it there', () => {
  const nov = scoped(2026, 11)
  assert.deepEqual(monthForRow(leaves[1], nov), { year: 2026, month: 9 })
  // a range that touches the month on screen keeps it
  assert.deepEqual(monthForRow(leaves[0], scoped(2026, 10)), { year: 2026, month: 10 })
  assert.deepEqual(monthForRow(leaves[0], nov), { year: 2026, month: 9 })
  assert.equal(monthForRow(leaves[1], unscoped(nov)), null)
  const moved = scopeToRow(leaves[1], nov)
  assert.deepEqual([moved.scope?.year, moved.scope?.month], [2026, 9])
  assert.deepEqual(rowsForView([leaves[1]], 'approved', moved).map((r) => r.id), [2])
  const plain = unscoped(nov)
  assert.equal(scopeToRow(leaves[1], plain), plain)
})

test('waiting rows of other months are counted, with the latest month that has one', () => {
  assert.deepEqual(waitingInOtherMonths(leaves, scoped(2026, 11)), { count: 1, month: { year: 2026, month: 10 } })
  assert.deepEqual(waitingInOtherMonths(leaves, scoped(2026, 10)), { count: 1, month: { year: 2026, month: 11 } })
  assert.deepEqual(waitingInOtherMonths(leaves, scoped(2026, 8)), { count: 2, month: { year: 2026, month: 11 } })
  assert.deepEqual(waitingInOtherMonths(leaves, unscoped(scoped(2026, 8))), { count: 0, month: null })
})

test('empty states name the month', () => {
  const today = new Date(2026, 10, 2)
  const sep = { year: 2026, month: 9 }
  assert.equal(monthEmptyText('waiting', 'leave requests', sep, 0, today).title, 'No leave requests in September 2026')
  assert.match(monthEmptyText('waiting', 'leave requests', sep, 0, today).subtitle, /another month/)
  assert.match(monthEmptyText('month', 'leave requests', { year: 2026, month: 11 }, 0, today).subtitle, /this month/)
  assert.equal(monthEmptyText('month', 'leave requests', sep, 3, today).title, 'No leave requests in September 2026')
  assert.equal(monthEmptyText('waiting', 'leave requests', sep, 3, today).title, 'Nothing waiting in September 2026')
  assert.equal(monthEmptyText('approved', 'leave requests', sep, 3, today).title, 'Nothing approved in September 2026')
  assert.equal(monthEmptyText('rejected', 'leave requests', sep, 3, today).title, 'Nothing rejected in September 2026')
})

test('empty-state wording', () => {
  assert.equal(emptyViewText('waiting', 'leave requests'), 'None of your leave requests are waiting for a decision.')
  assert.equal(emptyViewText('month', 'missing punch requests', 'submitted'), 'You have not sent any missing punch requests this month.')
  assert.equal(emptyViewText('month', 'outpasses'), 'No approved outpasses this month.')
})

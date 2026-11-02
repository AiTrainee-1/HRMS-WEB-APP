// Run with `npm test`. The per-module view rules (lib/my-requests.ts), the mobile app's myRequests vectors.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rowsForView, viewCounts } from './request-views.ts'
import {
  istDateOf,
  missingPunchGroup,
  missingPunchViewOptions,
  monthSections,
  newestFirst,
  outpassDay,
  outpassPassDay,
  outpassViewOptions,
  permissionViewOptions,
  permissionsUsedIn,
  teaBreakDay,
  teaBreaksForMonth,
  TEA_BREAK_RECENT_LIMIT,
  waitingPhrase,
} from './my-requests.ts'
import type { ApprovalProgress } from '../types/index.ts'

const today = new Date(2026, 9, 31)

test('India day of a value', () => {
  assert.equal(istDateOf('2026-10-07'), '2026-10-07')
  assert.equal(istDateOf('2026-09-30T20:00:00Z'), '2026-10-01') // 1:30 AM in India
  assert.equal(istDateOf('2026-10-07T23:10:00'), '2026-10-07')
  assert.equal(istDateOf('2026-10-07T09:00:00+05:30'), '2026-10-07')
  assert.equal(istDateOf('nope'), null)
  assert.equal(istDateOf(null), null)
})

test('missing punch: both pending spellings wait; "this month" = sent this month, any status', () => {
  assert.equal(missingPunchGroup('pending_hod'), 'waiting')
  assert.equal(missingPunchGroup('pending_hr'), 'waiting')
  assert.equal(missingPunchGroup('approved'), 'approved')
  const rows = [
    { id: 1, status: 'pending_hod', date: '2026-10-20', createdAt: '2026-10-21T04:00:00Z' },
    { id: 2, status: 'rejected', date: '2026-09-29', createdAt: '2026-10-01T03:00:00Z' },
    { id: 3, status: 'approved', date: '2026-09-28', createdAt: '2026-09-29T03:00:00Z' },
  ]
  const opts = missingPunchViewOptions<(typeof rows)[number]>(today)
  assert.deepEqual(viewCounts(rows, opts), { waiting: 1, month: 2, approved: 1, rejected: 1 })
  assert.deepEqual(rowsForView(rows, 'month', opts).map((r) => r.id), [1, 2])
})

test('outpass: taken this month by the day it was used', () => {
  const rows = [
    { id: 1, status: 'approved', createdAt: '2026-09-30T10:00:00Z', approvedAt: '2026-09-30T11:00:00Z', exitedAt: '2026-10-01T04:00:00Z' },
    { id: 2, status: 'approved', createdAt: '2026-09-20T10:00:00Z', approvedAt: '2026-09-20T11:00:00Z', exitedAt: null },
    { id: 3, status: 'pending', createdAt: '2026-10-30T10:00:00Z' },
    { id: 4, status: 'rejected', createdAt: '2026-10-10T10:00:00Z' },
  ]
  assert.equal(outpassDay(rows[0]), '2026-10-01')
  const opts = outpassViewOptions<(typeof rows)[number]>(today)
  assert.deepEqual(viewCounts(rows, opts), { waiting: 1, month: 1, approved: 2, rejected: 1 })
})

test('permission: taken this month = approved for a day of this month; used counts pending + approved', () => {
  const rows = [
    { id: 1, status: 'approved', date: '2026-10-03' },
    { id: 2, status: 'pending', date: '2026-10-28' },
    { id: 3, status: 'rejected', date: '2026-10-12' },
    { id: 4, status: 'approved', date: '2026-09-30' },
  ]
  const opts = permissionViewOptions<(typeof rows)[number]>(today)
  assert.deepEqual(rowsForView(rows, 'month', opts).map((r) => r.id), [1])
  assert.equal(permissionsUsedIn(rows, 2026, 9), 2)
  assert.equal(permissionsUsedIn(rows, 2026, 8), 1)
})

test('month sections, newest month first; newest-first sort keeps ties stable', () => {
  const rows = [
    { id: 1, d: '2026-09-02' },
    { id: 2, d: '2026-10-05' },
    { id: 3, d: null },
    { id: 4, d: '2026-10-01T10:00:00Z' },
  ]
  const s = monthSections(rows, (r) => r.d)
  assert.deepEqual(s.map((x) => x.title), ['October 2026', 'September 2026', 'Earlier'])
  assert.deepEqual(s[0].rows.map((r) => r.id), [2, 4])
  assert.deepEqual(newestFirst(rows, (r) => r.d).map((r) => r.id), [2, 4, 1, 3])
})

test('who it waits for, in a sentence', () => {
  const base: ApprovalProgress = {
    workflow: 'missing_punch', label: 'Missing Punch', enabled: true, steps: [], currentStep: 0, waitingFor: ['hod'],
    canAct: { hod: true, hr: false },
  }
  assert.equal(waitingPhrase(base), 'your Department Head')
  assert.equal(waitingPhrase({ ...base, waitingFor: ['hr', 'hod'] }), 'your Department Head or HR')
  assert.equal(waitingPhrase({ ...base, currentStep: null }), null)
  assert.equal(waitingPhrase(null), null)
})

test('dates and clocks in words', async () => {
  const { dayText, dayRangeText, clockText } = await import('./my-requests.ts')
  assert.equal(dayText('2026-10-05'), 'Mon, 5 Oct 2026')
  assert.equal(dayRangeText('2026-10-05', '2026-10-05'), 'Mon, 5 Oct 2026')
  assert.equal(dayRangeText('2026-10-05', '2026-10-07'), '5 - 7 Oct 2026')
  assert.equal(dayRangeText('2026-09-30', '2026-10-02'), '30 Sep - 2 Oct 2026')
  assert.equal(dayRangeText('2026-12-29', '2027-01-02'), '29 Dec 2026 - 2 Jan 2027')
  assert.equal(dayRangeText('2026-10-05', null), 'Mon, 5 Oct 2026')
  assert.equal(clockText('13:05'), '1:05 PM')
  assert.equal(clockText('00:10:00'), '12:10 AM')
  assert.equal(clockText(''), '')
})

// ── The month switcher's days (2026-11-02) ──

test('the day of a pass for the month switcher: the India day it went out, else the day it was asked', () => {
  // went out at 00:30 IST on 1 Nov (19:00 UTC on 31 Oct)
  assert.equal(outpassPassDay({ status: 'out', createdAt: '2026-10-31T18:00:00Z', approvedAt: '2026-10-31T18:20:00Z', exitedAt: '2026-10-31T19:00:00Z' }), '2026-11-01')
  // approved but never used: the day it was asked (not the day it was approved)
  assert.equal(outpassPassDay({ status: 'approved', createdAt: '2026-10-30T10:00:00+05:30', approvedAt: '2026-10-31T10:00:00+05:30' }), '2026-10-30')
  assert.equal(teaBreakDay({ outAt: '2026-10-31T19:00:00Z' }), '2026-11-01')
  assert.equal(teaBreakDay({ outAt: null }), null)
})

test('the tea breaks of a month: the whole month from a server that filters, else what the latest breaks hold', () => {
  const nov = { year: 2026, month: 11 }
  const oct = { year: 2026, month: 10 }
  const log = (id: number, outAt: string) => ({ id: String(id), outAt })
  // a server that applied ?month= echoes it: every break it sent is listed
  const filtered = { month: '2026-10', recent: [log(1, '2026-10-30T05:00:00Z'), log(2, '2026-10-02T05:00:00Z')] }
  assert.deepEqual(teaBreaksForMonth(filtered, oct), { rows: filtered.recent, partial: false })
  // an older server: the latest breaks only, filtered here by the India day
  const short = { recent: [log(1, '2026-11-02T05:00:00Z'), log(2, '2026-10-31T19:00:00Z'), log(3, '2026-10-30T05:00:00Z')] }
  assert.deepEqual(teaBreaksForMonth(short, nov).rows.map((r) => r.id), ['1', '2'])
  // fewer than the limit = everything there is: nothing missing
  assert.equal(teaBreaksForMonth(short, oct).partial, false)
  // a full list that reaches back no further than the month may miss older breaks of it
  const full = { recent: Array.from({ length: TEA_BREAK_RECENT_LIMIT }, (_, i) => log(i, `2026-11-${String(20 - i).padStart(2, '0')}T05:00:00Z`)) }
  assert.equal(teaBreaksForMonth(full, nov).partial, true)
  assert.equal(teaBreaksForMonth(full, oct).partial, true)
  assert.deepEqual(teaBreaksForMonth(full, oct).rows, [])
  const reachesBack = { recent: [...full.recent.slice(0, 9), log(99, '2026-10-29T05:00:00Z')] }
  assert.equal(teaBreaksForMonth(reachesBack, nov).partial, false)
  // a reply for another month than the one asked is read like an older server's
  assert.deepEqual(teaBreaksForMonth(filtered, nov), { rows: [], partial: false })
  assert.deepEqual(teaBreaksForMonth(undefined, nov), { rows: [], partial: false })
})

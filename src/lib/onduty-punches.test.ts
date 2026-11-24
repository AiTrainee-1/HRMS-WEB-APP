// Run with `npm test`. The four named On-Duty punches, the end review and the durations (lib/onduty-punches.ts), the
// mobile app's vectors (src/lib/onDutyPunches.test.ts) without its offline queue.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPunchTiles, clock12, durationText, endSummary, isOpenSession, joinNames } from './onduty-punches.ts'

const slot = (n: number, extra: object = {}) => ({
  punchNumber: n,
  punchType: (n % 2 ? 'IN' : 'OUT') as 'IN' | 'OUT',
  status: 'available',
  available: true,
  ...extra,
})

test('names and expected times come from the server, with the usual day as the fallback', () => {
  const tiles = buildPunchTiles({
    slots: [slot(1, { name: 'Morning Punch', expectedTime: '08:30', expectedSource: 'shift' }), slot(2), slot(3), slot(4)],
    canPunch: true,
  })
  assert.deepEqual(tiles.map((t) => t.name), ['Morning Punch', 'Lunch Out', 'Lunch In', 'Night Punch'])
  assert.equal(tiles[0].expected, '8:30 AM')
  assert.equal(tiles[0].expectedFromShift, true)
  assert.equal(tiles[3].expected, '6:00 PM')
  assert.equal(tiles[1].expectedFromShift, false)
  assert.deepEqual(tiles.map((t) => t.kind), ['IN', 'OUT', 'IN', 'OUT'])
})

test('no slots at all (an older server): four open tiles with the defaults', () => {
  const tiles = buildPunchTiles({ slots: undefined, canPunch: true })
  assert.equal(tiles.length, 4)
  assert.ok(tiles.every((t) => t.state === 'open' && t.selectable))
})

test('every open punch is selectable, in any order (the Night Punch before the others)', () => {
  const tiles = buildPunchTiles({ slots: [slot(1), slot(2), slot(3), slot(4)], canPunch: true })
  assert.ok(tiles.every((t) => t.selectable))
  const ended = buildPunchTiles({ slots: [slot(1), slot(2), slot(3), slot(4)], canPunch: false })
  assert.ok(ended.every((t) => !t.selectable))
  assert.equal(ended[0].statusLabel, 'Not recorded')
})

test('done, waiting, approved and rejected punches read as such', () => {
  const tiles = buildPunchTiles({
    slots: [
      slot(1, { available: false, status: 'recorded', punchTime: '09:02:00', punchSource: 'biometric' }),
      slot(2, { available: false, status: 'pending', punchTime: '13:05:00' }),
      slot(3),
      slot(4, { available: false, status: 'approved', punchTime: '18:10:00' }),
    ],
    verifications: [{ punchNumber: 3, punchTime: '14:00:00', status: 'rejected', hrReviewComment: 'Blurred photo' }],
    canPunch: true,
  })
  assert.equal(tiles[0].state, 'done')
  assert.equal(tiles[0].statusLabel, 'Recorded by the biometric')
  assert.equal(tiles[0].doneStatus, 'recorded')
  assert.equal(tiles[0].time, '9:02 AM')
  assert.equal(tiles[1].statusLabel, 'Waiting for HR')
  assert.equal(tiles[2].state, 'open')
  assert.match(tiles[2].note ?? '', /Blurred photo/)
  assert.equal(tiles[3].statusLabel, 'Approved')
  assert.equal(tiles[3].time, '6:10 PM')
  assert.equal(tiles[3].selectable, false)
})

test('the source of a punch recorded another way', () => {
  const tiles = buildPunchTiles({ slots: [slot(1, { available: false, status: 'recorded', punchSource: 'geo_office' })], canPunch: true })
  assert.equal(tiles[0].statusLabel, 'Recorded by Office Geo Punch')
})

test('the end summary names what is missing and how long the day ran', () => {
  const tiles = buildPunchTiles({
    slots: [slot(1, { available: false, status: 'pending' }), slot(2), slot(3), slot(4)],
    canPunch: true,
  })
  const s = endSummary(tiles, '2026-11-24T09:00:00Z', Date.parse('2026-11-24T12:30:00Z'))
  assert.equal(s.done.length, 1)
  assert.equal(s.missingNames, 'Lunch Out, Lunch In and Night Punch')
  assert.equal(durationText(s.durationMs), '3 h 30 min')
  assert.equal(endSummary(tiles, null, 0).durationMs, null)
  assert.equal(durationText(40_000), 'less than a minute')
  assert.equal(durationText(60 * 60_000), '1 h')
  assert.equal(durationText(null), '—')
  assert.equal(joinNames(['A', 'B']), 'A and B')
})

test('clock12', () => {
  assert.equal(clock12('00:05'), '12:05 AM')
  assert.equal(clock12('12:00:59'), '12:00 PM')
  assert.equal(clock12('bad'), null)
  assert.equal(clock12(null), null)
})

test('an open session: not ended and not decided against', () => {
  assert.equal(isOpenSession({ approvalStatus: 'pending_hod', employeeEndedAt: null }), true)
  assert.equal(isOpenSession({ approvalStatus: 'active' }), true)
  assert.equal(isOpenSession({ approvalStatus: 'pending_hr', employeeEndedAt: '2026-11-24T10:00:00Z' }), false)
  assert.equal(isOpenSession({ approvalStatus: 'completed' }), false)
  assert.equal(isOpenSession(null), false)
})

// Run with `npm test`. Today's unfinished day shows "In progress" (owner 2026-11-26): the server's provisional Present /
// 1 shift for a day whose shift is still running is never shown as final, and no monthly total counts it.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  IN_PROGRESS_SHIFTS,
  IN_PROGRESS_STATUS,
  countedAtTime,
  displayStatus,
  factoryToday,
  inProgressView,
  isDayInProgress,
  settledDays,
  settledSummary,
} from './day-progress.ts'

// 26 Nov 2026, 11:30 factory time (IST = UTC+5:30).
const NOW = new Date('2026-11-26T06:00:00Z')
const UNTIL = '2026-11-26T18:10:00+05:30'

const today = (extra: Record<string, unknown> = {}) => ({
  date: '2026-11-26',
  status: 'present',
  firstPunch: '09:06',
  totalPunches: 1,
  ...extra,
})

describe('isDayInProgress', () => {
  test('the server flag wins whatever else the day says', () => {
    assert.equal(isDayInProgress(today({ inProgress: true }), NOW), true)
    assert.equal(isDayInProgress(today({ inProgress: false, provisionalUntil: UNTIL }), NOW), false)
    // a past day the server still calls open (the refresh has not run yet) is shown as open
    assert.equal(isDayInProgress(today({ date: '2026-11-25', inProgress: true }), NOW), true)
  })

  test('an older server (no flag, no provisionalUntil): never in progress', () => {
    assert.equal(isDayInProgress(today(), NOW), false)
    assert.equal(isDayInProgress(today({ inProgress: null, provisionalUntil: null }), NOW), false)
    assert.equal(isDayInProgress(null, NOW), false)
    assert.equal(isDayInProgress(undefined, NOW), false)
  })

  test('no flag: today with a punch and provisionalUntil still ahead is in progress', () => {
    assert.equal(isDayInProgress(today({ provisionalUntil: UNTIL }), NOW), true)
  })

  test('no flag: provisionalUntil passed, not today, no punch or a bad timestamp: not in progress', () => {
    assert.equal(isDayInProgress(today({ provisionalUntil: '2026-11-26T11:00:00+05:30' }), NOW), false)
    assert.equal(isDayInProgress(today({ provisionalUntil: UNTIL }), new Date('2026-11-26T12:40:00Z')), false)
    assert.equal(isDayInProgress(today({ date: '2026-11-25', provisionalUntil: UNTIL }), NOW), false)
    // an absent birthday is provisional until midnight, but has no punch: not an unfinished shift
    assert.equal(isDayInProgress(today({ status: 'absent', firstPunch: null, totalPunches: 0, provisionalUntil: '2026-11-27T00:00:00+05:30' }), NOW), false)
    assert.equal(isDayInProgress(today({ provisionalUntil: 'soon' }), NOW), false)
  })

  test('"today" is the factory day, whatever the browser zone', () => {
    // 20:00 UTC on the 25th is already 01:30 on the 26th in the factory
    const lateNight = new Date('2026-11-25T20:00:00Z')
    assert.equal(factoryToday(lateNight), '2026-11-26')
    assert.equal(isDayInProgress(today({ provisionalUntil: UNTIL }), lateNight), true)
  })
})

describe('displayStatus', () => {
  test('in_progress for an open day, the server status otherwise', () => {
    assert.equal(displayStatus(today({ inProgress: true }), NOW), IN_PROGRESS_STATUS)
    assert.equal(displayStatus(today({ inProgress: true, status: 'half_shift' }), NOW), IN_PROGRESS_STATUS)
    assert.equal(displayStatus(today({ inProgress: false }), NOW), 'present')
    assert.equal(displayStatus(today({ status: 'absent' }), NOW), 'absent')
  })
})

describe('inProgressView', () => {
  test('first punch, shifts as a dash (never 1), counted after the shift ends', () => {
    assert.deepEqual(inProgressView(today({ inProgress: true, provisionalUntil: UNTIL, shiftsEarned: 1 }), NOW), {
      label: 'In progress',
      arrival: 'In 09:06 · at work',
      counted: 'Counted after your shift ends at 18:10',
      shifts: IN_PROGRESS_SHIFTS,
    })
    assert.equal(IN_PROGRESS_SHIFTS, '—')
  })

  test('the time is factory time, even from a UTC timestamp, and seconds on the punch are dropped', () => {
    const v = inProgressView(today({ inProgress: true, firstPunch: '9:06:41', provisionalUntil: '2026-11-26T12:40:00Z' }), NOW)
    assert.equal(v?.arrival, 'In 09:06 · at work')
    assert.equal(v?.counted, 'Counted after your shift ends at 18:10')
  })

  test('no provisionalUntil: no time is guessed', () => {
    assert.equal(inProgressView(today({ inProgress: true }), NOW)?.counted, 'Counted after your shift ends')
  })

  test('the moment has passed but the server still says open: being counted now', () => {
    const after = new Date('2026-11-26T12:45:00Z')
    assert.equal(
      inProgressView(today({ inProgress: true, provisionalUntil: UNTIL }), after)?.counted,
      'Your shift ended at 18:10 · being counted now',
    )
  })

  test('no first punch: no arrival line', () => {
    assert.equal(inProgressView(today({ inProgress: true, firstPunch: null }), NOW)?.arrival, null)
  })

  test('null for a finished day', () => {
    assert.equal(inProgressView(today(), NOW), null)
    assert.equal(inProgressView(today({ inProgress: false, provisionalUntil: UNTIL }), NOW), null)
    assert.equal(inProgressView(null, NOW), null)
  })

  test('countedAtTime', () => {
    assert.equal(countedAtTime({ provisionalUntil: UNTIL }), '18:10')
    assert.equal(countedAtTime({ provisionalUntil: null }), null)
    assert.equal(countedAtTime({}), null)
  })
})

describe('monthly totals leave the open day out', () => {
  const records = [
    { date: '2026-11-24', status: 'present' },
    { date: '2026-11-25', status: 'half_shift', isHalfShift: true },
    { date: '2026-11-23', status: 'absent' },
    { date: '2026-11-22', status: 'on_leave' },
    { date: '2026-11-21', status: 'present', isHalfShift: false },
    today({ inProgress: true, provisionalUntil: UNTIL }),
    { date: '2026-11-27', status: 'future' },
  ]

  test('settledDays drops only the open day', () => {
    const left = settledDays(records, NOW)
    assert.equal(left.length, records.length - 1)
    assert.ok(!left.some((d) => d.date === '2026-11-26'))
    assert.deepEqual(settledDays(null, NOW), [])
  })

  test('the server summary as it came when no day is open', () => {
    const summary = { present: 9, absent: 1, onLeave: 1, late: 2, halfShift: 1 }
    const closed = records.map((r) => (r.date === '2026-11-26' ? { ...r, inProgress: false } : r))
    assert.equal(settledSummary(summary, closed, NOW), summary)
    assert.equal(settledSummary(null, records, NOW), null)
  })

  test('with an open day the counts are taken again from the days, without it (late stays the server one)', () => {
    // the server counted today as present (3), or had already left it out (2): either way the answer is 2
    for (const present of [3, 2]) {
      const s = settledSummary({ present, absent: 1, onLeave: 1, late: 4, halfShift: 1, workingDays: 6 }, records, NOW)
      assert.deepEqual(s, { present: 2, absent: 1, onLeave: 1, late: 4, halfShift: 1, workingDays: 6 })
    }
  })

  test('an open day the server calls Half Day is not counted as one either', () => {
    const list = [{ date: '2026-11-25', status: 'present' }, today({ status: 'half_shift', isHalfShift: true, inProgress: true })]
    const s = settledSummary({ present: 1, absent: 0, onLeave: 0, late: 0, halfShift: 1 }, list, NOW)
    assert.deepEqual(s, { present: 1, absent: 0, onLeave: 0, late: 0, halfShift: 0 })
  })
})

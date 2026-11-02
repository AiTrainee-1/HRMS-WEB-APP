// Run with `npm test`. The Missing Punch time picker (lib/punch-time-picker.ts), the mobile app's vectors plus the web's
// shift adapter.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  barPosition,
  buildTimeChips,
  clampMinutes,
  dayBarRange,
  from12h,
  hourCells,
  minuteCells,
  nowMinutesIfToday,
  nudge,
  parseClock,
  shiftTimesFrom,
  slotTargets,
  slotTimeHint,
  startTimeFor,
  timeProblem,
  to12h,
  to12hLabel,
  toHHmm,
} from './punch-time-picker.ts'

test('clock parsing in every spelling', () => {
  assert.equal(parseClock('09:00'), 540)
  assert.equal(parseClock('9:05:00'), 545)
  assert.equal(parseClock('1:45 pm'), 825)
  assert.equal(parseClock('12:10 AM'), 10)
  assert.equal(parseClock('12:10 PM'), 730)
  assert.equal(parseClock('24:00'), null)
  assert.equal(parseClock('13:00 PM'), null)
  assert.equal(parseClock('9:61'), null)
  assert.equal(parseClock(null), null)
})

test('12-hour round trips and clamping', () => {
  assert.deepEqual(to12h(0), { hour12: 12, minute: 0, meridiem: 'AM' })
  assert.deepEqual(to12h(13 * 60 + 5), { hour12: 1, minute: 5, meridiem: 'PM' })
  assert.equal(from12h(12, 30, 'AM'), 30)
  assert.equal(from12h(12, 30, 'PM'), 750)
  assert.equal(to12hLabel(18 * 60), '6:00 PM')
  assert.equal(toHHmm(545), '09:05')
  assert.equal(clampMinutes(-5), 0)
  assert.equal(clampMinutes(2000), 1439)
  assert.equal(nudge(1438, 5), 1439)
  assert.equal(nudge(2, -5), 0)
})

test('slot targets from the shift, else the usual times', () => {
  const t = slotTargets({ startTime: '08:30', endTime: '17:30', firstHalfEnd: '12:30', lunchDurationMinutes: 30 })
  assert.deepEqual(t.morning_in, { minutes: 510, fromShift: true })
  assert.deepEqual(t.lunch_out, { minutes: 750, fromShift: true })
  assert.deepEqual(t.lunch_in, { minutes: 780, fromShift: true })
  assert.deepEqual(t.evening_out, { minutes: 1050, fromShift: true })
  const d = slotTargets(null)
  assert.equal(d.morning_in.minutes, 540)
  assert.equal(d.lunch_out.minutes, 780)
  assert.equal(d.lunch_in.minutes, 825)
  assert.equal(d.lunch_in.fromShift, false)
})

test('the web shift adapter: CL shift halves first, assignment times as the fallback', () => {
  assert.deepEqual(shiftTimesFrom({ start: '09:00', end: '18:00', firstHalfEnd: '13:00', secondHalfStart: '13:45' }), {
    startTime: '09:00', endTime: '18:00', firstHalfEnd: '13:00', lunchDurationMinutes: 45,
  })
  // halves meet = the server split the shift in the middle: no lunch to show
  assert.deepEqual(shiftTimesFrom({ start: '09:00', end: '18:00', firstHalfEnd: '13:30', secondHalfStart: '13:30' }), {
    startTime: '09:00', endTime: '18:00', firstHalfEnd: null, lunchDurationMinutes: null,
  })
  assert.deepEqual(shiftTimesFrom(null, { startTime: '08:00', endTime: '—' }), {
    startTime: '08:00', endTime: null, firstHalfEnd: null, lunchDurationMinutes: null,
  })
  assert.equal(shiftTimesFrom(null, null), null)
})

test('chips: the chosen slot first, future times disabled, Now only today', () => {
  const shift = { startTime: '09:00', endTime: '18:00' }
  const chips = buildTimeChips(shift, 'evening_out', 14 * 60)
  assert.deepEqual(chips.map((c) => c.key), ['evening_out', 'morning_in', 'lunch_out', 'lunch_in', 'now'])
  assert.equal(chips[0].suggested, true)
  assert.equal(chips[0].disabled, true)
  assert.equal(chips[1].disabled, false)
  assert.equal(chips[4].minutes, 840)
  assert.equal(buildTimeChips(shift, 'morning_in', null).some((c) => c.key === 'now'), false)
})

test('start time, grids and problems respect "not in the future today"', () => {
  const shift = { startTime: '09:00', endTime: '18:00' }
  assert.equal(startTimeFor(shift, 'evening_out', 10 * 60), 600)
  assert.equal(startTimeFor(shift, 'evening_out', null), 1080)
  const hours = hourCells('PM', 13 * 60 + 20)
  assert.equal(hours.find((h) => h.hour12 === 12)?.disabled, false)
  assert.equal(hours.find((h) => h.hour12 === 1)?.disabled, false)
  assert.equal(hours.find((h) => h.hour12 === 2)?.disabled, true)
  const mins = minuteCells(1, 'PM', 13 * 60 + 20)
  assert.equal(mins.find((m) => m.minute === 20)?.disabled, false)
  assert.equal(mins.find((m) => m.minute === 25)?.disabled, true)
  assert.equal(timeProblem(null, null), 'Pick the time of the punch you missed.')
  assert.equal(timeProblem(15 * 60, 14 * 60), 'That time has not come yet today. Pick 2:00 PM or earlier.')
  assert.equal(timeProblem(13 * 60, 14 * 60), null)
  assert.equal(nowMinutesIfToday('2026-10-31', new Date(2026, 9, 31, 9, 15)), 555)
  assert.equal(nowMinutesIfToday('2026-10-30', new Date(2026, 9, 31, 9, 15)), null)
})

test('a far-off time gets a gentle hint, never a block', () => {
  const shift = { startTime: '09:00', endTime: '18:00' }
  assert.equal(slotTimeHint('morning_in', 9 * 60 + 20, shift), null)
  assert.equal(
    slotTimeHint('morning_in', 15 * 60, shift),
    'This is far from your usual shift start (9:00 AM). Please check the time and the punch you picked.',
  )
})

test('the day bar range and positions', () => {
  assert.deepEqual(dayBarRange([540, 1080, 600]), { start: 480, end: 1140 })
  assert.deepEqual(dayBarRange([]), { start: 480, end: 1140 })
  assert.deepEqual(dayBarRange([10]), { start: 0, end: 120 })
  assert.equal(barPosition(810, { start: 480, end: 1140 }), 0.5)
  assert.equal(barPosition(0, { start: 480, end: 1140 }), 0)
  assert.equal(barPosition(2000, { start: 480, end: 1140 }), 1)
})

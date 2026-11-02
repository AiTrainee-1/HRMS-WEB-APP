// Run with `npm test`. Today's punches as a story (lib/home-punches.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  axisNow,
  barFraction,
  dayBarModel,
  dayOffOf,
  hourText,
  minutesOf,
  pickShiftDay,
  presenceLine,
  presenceLineFor,
  punchA11y,
  punchMeta,
  punchStory,
  punchTimeline,
  shiftProgress,
  shiftProgressAt,
  shiftProgressToday,
  shiftStatusText,
  shiftTitle,
  shiftWindow,
  spanText,
  to12h,
  visiblePunches,
  type TimelinePunch,
} from './home-punches.ts'

const p = (time: string, type: 'IN' | 'OUT', sourceLabel = 'Biometric') => ({ time, type, sourceLabel })

describe('clock text', () => {
  test('minutesOf / to12h', () => {
    assert.equal(minutesOf('09:05'), 545)
    assert.equal(minutesOf('18:00:30'), 1080)
    assert.equal(minutesOf('—'), null)
    assert.equal(minutesOf('25:00'), null)
    assert.equal(to12h('09:05'), '9:05 AM')
    assert.equal(to12h('00:10'), '12:10 AM')
    assert.equal(to12h('12:00'), '12:00 PM')
    assert.equal(to12h('18:01:59'), '6:01 PM')
    assert.equal(to12h('later'), 'later')
  })
})

describe('punchStory', () => {
  test('a full day reads as arrived, stepped out, came back, left', () => {
    const steps = punchStory([p('09:02', 'IN'), p('13:00', 'OUT'), p('13:40', 'IN'), p('18:02', 'OUT')], { shiftEnd: '18:00' })
    assert.deepEqual(steps.map((s) => s.label), ['Arrived', 'Stepped out', 'Came back', 'Left for the day'])
    assert.equal(steps[0].time, '9:02 AM')
    assert.equal(steps[0].source, 'Biometric')
  })
  test('a last OUT early in the day is not called "left"', () => {
    const steps = punchStory([p('09:00', 'IN'), p('13:00', 'OUT')], { shiftEnd: '18:00' })
    assert.equal(steps[1].label, 'Punched out')
    assert.equal(punchStory([p('09:00', 'IN'), p('13:00', 'OUT')], { shiftEnd: '18:00', dayIsOver: true })[1].label, 'Left for the day')
    assert.equal(punchStory([p('09:00', 'IN'), p('17:10', 'OUT')], { shiftEnd: '18:00' })[1].label, 'Left for the day')
    assert.equal(punchStory([p('09:00', 'IN'), p('17:10', 'OUT')], {})[1].label, 'Punched out')
  })
  test('odd days', () => {
    assert.deepEqual(punchStory([p('09:00', 'IN'), p('09:01', 'IN')]).map((s) => s.label), ['Arrived', 'Punched in again'])
    assert.deepEqual(punchStory([p('18:00', 'OUT')]).map((s) => s.kind), ['out'])
    assert.deepEqual(punchStory(null), [])
  })
})

describe('presenceLine', () => {
  test('words for the hero', () => {
    assert.equal(presenceLine([]), 'No punch yet today')
    assert.equal(presenceLine(punchStory([p('09:02', 'IN')])), 'In since 9:02 AM')
    assert.equal(presenceLine(punchStory([p('09:02', 'IN'), p('13:00', 'OUT')], { shiftEnd: '18:00' })), 'Punched out at 1:00 PM')
    assert.equal(presenceLine(punchStory([p('09:02', 'IN'), p('13:00', 'OUT'), p('13:30', 'IN')])), 'Back in since 1:30 PM')
    assert.equal(presenceLine(punchStory([p('09:02', 'IN'), p('18:05', 'OUT')], { shiftEnd: '18:00' })), 'Left at 6:05 PM')
  })
})

describe('shiftProgress', () => {
  test('day and night shifts', () => {
    assert.equal(shiftProgress('09:00', '17:00', 13 * 60), 0.5)
    assert.equal(shiftProgress('09:00', '17:00', 8 * 60), 0)
    assert.equal(shiftProgress('09:00', '17:00', 20 * 60), 1)
    assert.equal(shiftProgress('22:00', '06:00', 2 * 60), 0.5)
    assert.equal(shiftProgress('—', '17:00', 600), null)
  })
})

// ── Phone view: the mobile app's Home panel (same rules as uktextiles-employee-app src/lib/homePunches.ts) ──

const tp = (time: string, type: 'IN' | 'OUT', extra: Partial<TimelinePunch> = {}): TimelinePunch => ({ time, type, sourceLabel: 'Biometric', ...extra })

describe('phone panel: punches on the shift day axis', () => {
  test('labelled by what they are, the same as punchStory on a day shift', () => {
    const day = [tp('09:02', 'IN'), tp('13:00', 'OUT'), tp('13:40', 'IN'), tp('18:02', 'OUT')]
    const opts = { shiftStart: '09:00', shiftEnd: '18:00' }
    assert.deepEqual(punchTimeline(day, opts).map((s) => s.label), punchStory(day, opts).map((s) => s.label))
    assert.deepEqual(punchTimeline([tp('09:02', 'IN'), tp('13:00', 'OUT')], opts).map((s) => s.label), ['Arrived', 'Punched out'])
    assert.deepEqual(punchTimeline(null), [])
  })
  test('night shift crossing midnight', () => {
    const night = punchTimeline([tp('22:01', 'IN'), tp('02:00', 'OUT', { nextDay: true }), tp('02:30', 'IN', { nextDay: true }), tp('06:03', 'OUT', { nextDay: true })], {
      shiftStart: '22:00',
      shiftEnd: '06:00',
    })
    assert.deepEqual(night.map((s) => s.label), ['Arrived', 'Stepped out', 'Came back', 'Left for the day'])
    assert.deepEqual(night.map((s) => s.minutes), [1321, 1560, 1590, 1803])
    assert.equal(punchTimeline([tp('22:01', 'IN'), tp('05:58', 'OUT')], { shiftStart: '22:00', shiftEnd: '06:00' })[1].minutes, 1798)
    // A 23:00 break on the night is not "left for the day".
    assert.equal(punchTimeline([tp('22:01', 'IN'), tp('23:00', 'OUT')], { shiftStart: '22:00', shiftEnd: '06:00' })[1].label, 'Punched out')
    assert.equal(punchMeta(night[3]), 'Biometric · next day')
    assert.equal(punchA11y(night[0]), 'Arrived at 10:01 PM, from Biometric')
  })
  test('more than four punches fold to the latest four', () => {
    const steps = punchTimeline(['08:58', '11:00', '11:15', '13:00', '13:45', '18:05'].map((t, i) => tp(t, i % 2 ? 'OUT' : 'IN')), { shiftEnd: '18:00' })
    const folded = visiblePunches(steps, false)
    assert.equal(folded.earlier, 2)
    assert.deepEqual(folded.shown.map((s) => s.label), ['Came back', 'Stepped out', 'Came back', 'Left for the day'])
    assert.equal(visiblePunches(steps, true).shown.length, 6)
  })
})

describe('phone panel: shift, day off, night carry-over, presence', () => {
  test('shift window, title, progress and its line', () => {
    assert.deepEqual(shiftWindow('22:00:00', '06:00:00'), { start: 1320, end: 1800, overnight: true })
    assert.equal(shiftTitle('A'), 'Shift A')
    assert.equal(shiftTitle('General Shift'), 'General Shift')
    assert.equal(shiftProgressToday('22:00', '06:00', 2 * 60), 0.5)
    assert.equal(shiftProgressToday('22:00', '06:00', 21 * 60), 0)
    assert.equal(shiftProgressAt(shiftWindow('22:00', '06:00')!, axisNow(7 * 60, true)), 1)
    assert.equal(spanText(65), '1 h 5 min')
    assert.equal(shiftStatusText(0.4, { start: '09:00', nowMinutes: 720, graceMinutes: 11 }), '40% of the shift done · 11 min grace')
    assert.equal(shiftStatusText(0, { start: '09:00', nowMinutes: 515 }), 'Starts in 25 min')
    assert.equal(shiftStatusText(1, { start: '09:00', nowMinutes: 1200 }), 'Shift time is over')
  })
  test('day off from raw statuses', () => {
    assert.equal(dayOffOf({ date: 'x', status: 'present' }), null)
    assert.equal(dayOffOf({ date: 'x', status: 'on_leave' })?.title, 'On leave today')
    assert.equal(dayOffOf({ date: 'x', status: 'present', isCasualLeave: true })?.kind, 'casual_leave')
    assert.equal(dayOffOf({ date: 'x', status: 'holiday', dayKind: 'holiday', holidayName: 'Diwali' })?.title, 'Holiday today (Diwali)')
    assert.equal(dayOffOf({ date: 'x', status: 'holiday', dayKind: 'weekly_off' })?.short, 'Weekly off')
  })
  test('a night worker after midnight sees last night', () => {
    const records = [
      { date: '2026-11-01', status: 'present', punches: [tp('22:01', 'IN'), tp('05:30', 'OUT', { nextDay: true })] },
      { date: '2026-11-02', status: 'absent', punches: [] as TimelinePunch[] },
    ]
    const opts = { today: '2026-11-02', yesterday: '2026-11-01', shiftStart: '22:00', shiftEnd: '06:00' }
    assert.equal(pickShiftDay(records, { ...opts, nowMinutes: 120 }).carried, true)
    assert.equal(pickShiftDay(records, { ...opts, nowMinutes: 9 * 60 }).carried, false)
    assert.equal(pickShiftDay(records, { ...opts, shiftStart: '09:00', shiftEnd: '18:00', nowMinutes: 120 }).carried, false)
  })
  test('presence with and without punches', () => {
    assert.equal(presenceLineFor(punchTimeline([tp('09:02', 'IN')])), 'In since 9:02 AM')
    assert.equal(presenceLineFor([], { shiftStart: '09:00', shiftEnd: '18:00', nowMinutes: 8 * 60 }), 'No punch yet today')
    assert.equal(presenceLineFor([], { shiftStart: '09:00', shiftEnd: '18:00', nowMinutes: 19 * 60 }), 'No punch recorded today')
    assert.equal(presenceLineFor([], { dayOff: dayOffOf({ date: 'x', status: 'on_leave' }) }), 'On leave today')
  })
})

describe('phone panel: the day bar', () => {
  test('axis, shift window, inside, now, ticks', () => {
    const steps = punchTimeline([tp('09:02', 'IN'), tp('13:00', 'OUT'), tp('13:40', 'IN')], { shiftStart: '09:00', shiftEnd: '18:00' })
    const m = dayBarModel(steps, { shiftStart: '09:00', shiftEnd: '18:00', nowAxis: 15 * 60 })
    assert.deepEqual([m.lo, m.hi], [480, 1140])
    assert.deepEqual(m.shift, { from: 540, to: 1080 })
    assert.deepEqual(m.inside, [{ from: 542, to: 780 }, { from: 820, to: 900 }])
    assert.equal(m.now, 900)
    assert.deepEqual(m.ticks, [540, 720, 900, 1080])
    assert.equal(barFraction(m, 810), 0.5)
  })
  test('a night runs past midnight', () => {
    const steps = punchTimeline([tp('22:01', 'IN'), tp('02:00', 'OUT', { nextDay: true })], { shiftStart: '22:00', shiftEnd: '06:00' })
    const m = dayBarModel(steps, { shiftStart: '22:00', shiftEnd: '06:00', nowAxis: axisNow(180, true) })
    assert.deepEqual([m.lo, m.hi], [1260, 1860])
    assert.deepEqual(m.inside, [{ from: 1321, to: 1560 }])
    assert.deepEqual(m.ticks.map(hourText), ['10 PM', '12 AM', '2 AM', '4 AM', '6 AM'])
  })
})

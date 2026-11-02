// Run with `npm test`. The month switcher's rules (lib/month-switch.ts) - the same rules as the mobile app's
// monthSwitch.test.ts, plus the web's monthViewHint and the KPI tile wording (inMonthText, monthTileLabel).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canGoBack,
  canGoForward,
  clampMonth,
  compareMonths,
  currentMonth,
  daysTouchMonth,
  inMonthText,
  isCurrentMonth,
  laterMonth,
  latestMonthOf,
  monthBounds,
  monthKey,
  monthLabel,
  monthOf,
  monthsOfDays,
  monthTileLabel,
  monthToShow,
  monthViewHint,
  monthViewLabel,
  parseMonthKey,
  sameMonth,
  shiftMonth,
} from './month-switch.ts'

const nov = { year: 2026, month: 11 }
const sep = { year: 2026, month: 9 }
const today = new Date(2026, 10, 2) // 2 Nov 2026

test('the current month and its key', () => {
  assert.deepEqual(currentMonth(today), nov)
  assert.equal(monthKey(sep), '2026-09')
  assert.deepEqual(parseMonthKey('2026-09'), sep)
  assert.equal(parseMonthKey('2026-13'), null)
  assert.equal(parseMonthKey('2026-9'), null)
  assert.equal(parseMonthKey(null), null)
})

test('a month is read from the text, never shifted by time zone', () => {
  assert.deepEqual(monthOf('2026-09-30'), sep)
  assert.deepEqual(monthOf('2026-09-30T23:30:00+05:30'), sep)
  assert.deepEqual(monthOf('2026-10-01T00:10:00Z'), { year: 2026, month: 10 })
  assert.equal(monthOf('30/09/2026'), null)
  assert.equal(monthOf(undefined), null)
})

test('stepping, comparing and clamping months', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 })
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth(nov, -14), { year: 2025, month: 9 })
  assert.ok(compareMonths(sep, nov) < 0)
  assert.equal(compareMonths(nov, { year: 2026, month: 11 }), 0)
  assert.ok(sameMonth(nov, { year: 2026, month: 11 }))
  assert.equal(sameMonth(nov, null), false)
  assert.deepEqual(laterMonth(sep, nov), nov)
  assert.deepEqual(clampMonth({ year: 2027, month: 2 }, null, nov), nov)
  assert.deepEqual(clampMonth({ year: 2020, month: 2 }, sep, nov), sep)
})

test('the arrows: back without limit unless a minimum, forward up to the maximum', () => {
  assert.equal(canGoBack({ year: 2001, month: 1 }), true)
  assert.equal(canGoBack(sep, sep), false)
  assert.equal(canGoBack(nov, sep), true)
  assert.equal(canGoForward(nov, nov), false)
  assert.equal(canGoForward(sep, nov), true)
})

test('labels: "This month" for the current month, "All in Sep" for another', () => {
  assert.equal(monthLabel(sep), 'September 2026')
  assert.equal(monthViewLabel(nov, today), 'This month')
  assert.equal(monthViewLabel(sep, today), 'All in Sep')
  assert.equal(isCurrentMonth(nov, today), true)
  assert.equal(monthViewHint('leave requests', sep), 'All your leave requests for September 2026, whatever their status.')
})

test('the KPI tiles name the month on screen: "this month" now, the month and year otherwise', () => {
  assert.equal(inMonthText(nov, today), 'this month')
  assert.equal(inMonthText(sep, today), 'in September 2026')
  // the same month of another year is not "this month"
  assert.equal(inMonthText({ year: 2025, month: 11 }, today), 'in November 2025')
  assert.equal(monthTileLabel('Taken', nov, today), 'Taken this month')
  assert.equal(monthTileLabel('Taken', sep, today), 'Taken in Sep 2026')
  assert.equal(monthTileLabel('Taken', { year: 2025, month: 12 }, today), 'Taken in Dec 2025')
})

test('a record touches a month by its day, or any day of its range', () => {
  assert.deepEqual(monthBounds({ year: 2026, month: 2 }), { first: '2026-02-01', last: '2026-02-28' })
  assert.equal(daysTouchMonth('2026-09-30', sep), true)
  assert.equal(daysTouchMonth('2026-10-01', sep), false)
  // 30 Sep - 2 Oct is in both months
  assert.equal(daysTouchMonth(['2026-09-30', '2026-10-02'], sep), true)
  assert.equal(daysTouchMonth(['2026-09-30', '2026-10-02'], { year: 2026, month: 10 }), true)
  assert.equal(daysTouchMonth(['2026-09-30', '2026-10-02'], nov), false)
  // a range written backwards is its first day only; a missing end is a single day
  assert.equal(daysTouchMonth(['2026-10-05', '2026-09-01'], sep), false)
  assert.equal(daysTouchMonth(['2026-09-05', null], sep), true)
  assert.equal(daysTouchMonth(null, sep), false)
  assert.deepEqual(monthsOfDays(['2026-09-30', '2026-10-02']), { first: sep, last: { year: 2026, month: 10 } })
})

test('the month to open for a record: keep the one on screen when it holds it, else its first month', () => {
  assert.deepEqual(monthToShow(['2026-09-30', '2026-10-02'], { year: 2026, month: 10 }), { year: 2026, month: 10 })
  assert.deepEqual(monthToShow(['2026-09-30', '2026-10-02'], nov), sep)
  assert.equal(monthToShow(null, nov), null)
})

test('the latest month of a list (where the › arrow may stop when a record lies after this month)', () => {
  const rows = [{ d: '2026-10-04' }, { d: '2026-12-01' }, { d: '2025-07-09' }, { d: '' }]
  assert.deepEqual(latestMonthOf(rows, (r) => r.d), { year: 2026, month: 12 })
  assert.equal(latestMonthOf([] as { d: string }[], (r) => r.d), null)
  assert.deepEqual(laterMonth(nov, latestMonthOf([{ d: '2026-10-04' }], (r) => r.d) ?? nov), nov)
})

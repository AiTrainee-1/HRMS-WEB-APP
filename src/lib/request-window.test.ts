// Run with `npm test` (Node's built-in test runner, which runs .ts directly). Asserts every shared vector (the same 83
// the backend and the Mobile App assert), then a few properties the vectors cannot express.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  GRACE_DAYS,
  checkRequestDate,
  checkRequestRange,
  getRequestWindow,
  isIsoDate,
  windowHint,
  windowMessage,
} from './request-window.ts'
import { REQUEST_WINDOW_VECTORS as V } from './request-window.vectors.ts'

/** A local Date at 13:30 on the given YYYY-MM-DD (the device clock, as the forms read it). */
function at(day: string, hour = 13, minute = 30): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, hour, minute)
}

describe('shared vectors', () => {
  test('the vector file is the full set', () => {
    assert.equal(V.graceDays, GRACE_DAYS)
    assert.equal(V.windows.length + V.dates.length + V.ranges.length, 83)
  })

  for (const v of V.windows) {
    test(`window on ${v.today}`, () => {
      const w = getRequestWindow(at(v.today))
      assert.deepEqual(
        { today: w.today, min: w.min, max: w.max, graceOpen: w.graceOpen, currentMonth: w.currentMonth, previousMonth: w.previousMonth },
        { today: v.today, min: v.min, max: v.max, graceOpen: v.graceOpen, currentMonth: v.currentMonth, previousMonth: v.previousMonth },
      )
      assert.equal(windowMessage(w), v.message)
      assert.equal(windowHint(w), v.hint)
    })
  }

  for (const v of V.dates) {
    test(`date ${JSON.stringify(v.date)} on ${v.today}`, () => {
      assert.equal(checkRequestDate(v.date, at(v.today)), v.error)
      assert.equal(checkRequestDate(v.date, at(v.today), { noFuture: true }), v.errorNoFuture)
    })
  }

  for (const v of V.ranges) {
    test(`range ${JSON.stringify(v.start)}..${JSON.stringify(v.end)} on ${v.today}`, () => {
      assert.equal(checkRequestRange(v.start, v.end, at(v.today)), v.error)
    })
  }
})

describe('beyond the vectors', () => {
  test('the time of day does not move the window', () => {
    for (const day of ['2026-10-02', '2026-10-03', '2026-01-01', '2026-10-31']) {
      const morning = getRequestWindow(at(day, 0, 0))
      const night = getRequestWindow(at(day, 23, 59))
      assert.deepEqual(morning, night, day)
    }
  })

  test('the window follows the clock it is given, so the grace closes when the 3rd begins', () => {
    assert.equal(checkRequestDate('2026-09-30', at('2026-10-02', 23, 59)), null)
    assert.equal(checkRequestDate('2026-09-30', at('2026-10-03', 0, 0)), 'You can only request dates in October 2026.')
  })

  test('isIsoDate accepts real calendar dates only', () => {
    assert.equal(isIsoDate('2028-02-29'), true)
    assert.equal(isIsoDate('2026-02-29'), false)
    assert.equal(isIsoDate('2026-13-01'), false)
    assert.equal(isIsoDate('2026-10-1'), false)
    assert.equal(isIsoDate(''), false)
    assert.equal(isIsoDate(null), false)
    assert.equal(isIsoDate(undefined), false)
  })
})

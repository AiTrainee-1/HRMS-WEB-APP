// Run with `npm test`. The Dashboard's "Last 7 days" strip (lib/last-seven-days.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { lastSevenDates, lastSevenDays, previousMonthNeeded, type StripRecord } from './last-seven-days.ts'

const rec = (date: string, status = 'present'): StripRecord => ({ date, status })

describe('lastSevenDates', () => {
  test('seven local days ending today, oldest first', () => {
    const keys = lastSevenDates(new Date(2026, 10, 3, 9, 30)).map((d) => `${d.getMonth() + 1}/${d.getDate()}`)
    assert.deepEqual(keys, ['10/28', '10/29', '10/30', '10/31', '11/1', '11/2', '11/3'])
  })
})

describe('previousMonthNeeded', () => {
  test('the 1st to the 6th reach into last month', () => {
    assert.deepEqual(previousMonthNeeded(new Date(2026, 10, 1)), { month: 10, year: 2026 })
    assert.deepEqual(previousMonthNeeded(new Date(2026, 10, 6, 23, 59)), { month: 10, year: 2026 })
  })
  test('the 7th onward stays inside the month', () => {
    assert.equal(previousMonthNeeded(new Date(2026, 10, 7)), null)
    assert.equal(previousMonthNeeded(new Date(2026, 9, 31)), null)
  })
  test('January reaches back to December of the year before', () => {
    assert.deepEqual(previousMonthNeeded(new Date(2027, 0, 2)), { month: 12, year: 2026 })
  })
  test('March 1st reaches back to February (no day overflow)', () => {
    assert.deepEqual(previousMonthNeeded(new Date(2026, 2, 1)), { month: 2, year: 2026 })
  })
})

describe('lastSevenDays', () => {
  const now = new Date(2026, 10, 2, 10, 0) // 2 Nov 2026
  const current = [rec('2026-11-01', 'holiday'), rec('2026-11-02', 'future')]
  const previous = [rec('2026-10-27', 'present'), rec('2026-10-28', 'on_leave'), rec('2026-10-29', 'absent'), rec('2026-10-30', 'present')]

  test('last month days come from the previous month once it is loaded', () => {
    const cells = lastSevenDays(now, current, { status: 'ready', records: previous })
    assert.deepEqual(
      cells.map((c) => [c.key, c.state, c.rec?.status ?? null, c.lastMonth]),
      [
        ['2026-10-27', 'record', 'present', true],
        ['2026-10-28', 'record', 'on_leave', true],
        ['2026-10-29', 'record', 'absent', true],
        ['2026-10-30', 'record', 'present', true],
        // Loaded month, really nothing on that day: the only honest "No record".
        ['2026-10-31', 'no_record', null, true],
        ['2026-11-01', 'record', 'holiday', false],
        ['2026-11-02', 'record', 'future', false],
      ],
    )
    assert.deepEqual(
      cells.map((c) => c.isToday),
      [false, false, false, false, false, false, true],
    )
  })

  test('while last month loads, its days are "loading", never "No record"', () => {
    const cells = lastSevenDays(now, current, { status: 'loading' })
    assert.deepEqual(
      cells.map((c) => c.state),
      ['loading', 'loading', 'loading', 'loading', 'loading', 'record', 'record'],
    )
  })

  test('a failed last month leaves its days "unavailable", this month unaffected', () => {
    const cells = lastSevenDays(now, [rec('2026-11-02')], { status: 'error' })
    assert.deepEqual(
      cells.map((c) => c.state),
      ['unavailable', 'unavailable', 'unavailable', 'unavailable', 'unavailable', 'no_record', 'record'],
    )
  })

  test('the 7th onward needs nothing from last month', () => {
    const cells = lastSevenDays(new Date(2026, 10, 7), [rec('2026-11-03')], { status: 'idle' })
    assert.equal(cells[0].key, '2026-11-01')
    assert.ok(cells.every((c) => !c.lastMonth))
    assert.deepEqual(
      cells.map((c) => c.state),
      ['no_record', 'no_record', 'record', 'no_record', 'no_record', 'no_record', 'no_record'],
    )
  })

  test("this month's record wins over a same-date record in last month's response", () => {
    const cells = lastSevenDays(now, [rec('2026-11-01', 'present')], { status: 'ready', records: [rec('2026-11-01', 'absent')] })
    assert.equal(cells[5].rec?.status, 'present')
  })

  test('crosses the year boundary', () => {
    const cells = lastSevenDays(new Date(2027, 0, 1), [], { status: 'ready', records: [rec('2026-12-31', 'holiday')] })
    assert.equal(cells[0].key, '2026-12-26')
    assert.equal(cells[5].key, '2026-12-31')
    assert.equal(cells[5].state, 'record')
    assert.equal(cells[6].key, '2027-01-01')
    assert.equal(cells[6].lastMonth, false)
  })
})

// Run with `npm test`. The Compensation year timeline (lib/compensation-history.ts).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupByMonth, monthLabel, monthSummary, normalizeHistory, otPayLine, sourceCounts } from './compensation-history.ts'

const reply = {
  isStaff: true,
  year: 2026,
  years: [2025],
  balance: { shifts: '1.5', creditedThisYear: 2, takenThisYear: 0.5, alternativeDaysAvailable: 1 },
  totals: { items: 4, givenByHr: 2, company: 1, automatic: 1, shiftsGivenByHr: 1.5, otPay: 384.62 },
  otPayByMonth: [
    { month: '2026-03', label: 'March 2026', amount: 384.62, shifts: 0.5, slipId: 77 },
    { month: '2026-04', amount: 'bad' },
  ],
  items: [
    { key: 'a', kind: 'ot_shift_pay', date: '2026-03-12', status: 'assigned', statusLabel: 'Assigned by HR', shifts: 0.5, source: 'hr', title: 'Paid' },
    { key: 'a', kind: 'holiday_work', date: '2026-03-01', status: 'approved', shifts: 1, source: 'hr' },
    { key: 'b', kind: 'ot_allowance', date: '2026-02-03', status: 'used', minutes: 30, source: 'automatic' },
    { key: 'c', kind: 'window_late_in', date: '2026-02-10', status: 'applied', source: 'company', time: '09:30' },
    { key: 'd', kind: 'ot_shift', date: 'not-a-date', source: 'weird' },
    'junk',
  ],
}

test('normalizeHistory reads defensively and keeps keys unique', () => {
  assert.equal(normalizeHistory({ year: 2026 }), null)
  assert.equal(normalizeHistory('<html>'), null)
  const h = normalizeHistory(reply)!
  assert.deepEqual(h.years, [2026, 2025])
  assert.equal(h.balance?.shifts, 1.5)
  assert.equal(h.otPayByMonth.length, 1)
  assert.equal(h.items.length, 5)
  assert.deepEqual(h.items.map((i) => i.key), ['a', 'a#1', 'b', 'c', 'd'])
  const d = h.items[4]
  assert.equal(d.source, 'hr')
  assert.equal(d.date, null)
  assert.equal(d.month, null)
  assert.equal(h.items[1].statusLabel, 'Approved')
  assert.equal(h.items[2].givenByHr, false)
  assert.equal(normalizeHistory({ ...reply, isStaff: false, items: [], message: 'Compensation is for staff employees only.' })?.message, 'Compensation is for staff employees only.')
})

test('sourceCounts and groupByMonth (newest month first, OT pay months with the HR filter)', () => {
  const h = normalizeHistory(reply)!
  assert.deepEqual(sourceCounts(h.items), { all: 5, hr: 3, automatic: 1, company: 1 })
  const all = groupByMonth(h.items, h.otPayByMonth)
  assert.deepEqual(all.map((g) => g.month), ['2026-03', '2026-02'])
  assert.equal(all[0].hrShifts, 1.5)
  assert.equal(all[0].otPay?.slipId, 77)
  assert.deepEqual(all[0].items.map((i) => i.key), ['a', 'a#1'])
  const auto = groupByMonth(h.items, h.otPayByMonth, 'automatic')
  assert.deepEqual(auto.map((g) => g.month), ['2026-02'])
  assert.equal(auto[0].otPay, null)
  const company = groupByMonth(h.items, h.otPayByMonth, 'company')
  assert.equal(company[0].items[0].time, '09:30')
})

test('wording', () => {
  assert.equal(monthLabel('2026-03'), 'March 2026')
  assert.equal(monthLabel('2026-13'), '')
  const h = normalizeHistory(reply)!
  assert.equal(otPayLine(h.otPayByMonth[0]), 'Overtime pay in your March 2026 salary: ₹384.62 (0.50 shift)')
  assert.equal(monthSummary(groupByMonth(h.items, h.otPayByMonth)[0]), '2 items · 1.50 shifts given by HR · ₹384.62 overtime pay')
})

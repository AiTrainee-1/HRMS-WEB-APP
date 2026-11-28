// Run with `npm test`. Casual Leave "Balance in detail" (lib/cl-summary.ts). The vectors are the backend's own
// (api/tests_employee_app_transparency.py, 20 November 2026): monthly with carry forward, days of service without carry
// forward, the yearly allocation, and a year with no balance kept.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clDays,
  clMonthTable,
  clNumber,
  pickClSummary,
  readClSummary,
  summaryLines,
  summaryMonthName,
  summaryTiles,
  summaryWorthShowing,
  type CLSummary,
} from './cl-summary.ts'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November']

/** Monthly 1 day with carry forward: Mar 1 used, Jun ½ used, Nov 1 used + 1 waiting (Dec 1 approved ahead). */
const carryRows = MONTHS.map((name, i) => {
  const used = i === 2 ? 1 : i === 5 ? 0.5 : i === 10 ? 1 : 0
  const pending = i === 10 ? 1 : 0
  return { month: `2026-${String(i + 1).padStart(2, '0')}`, label: `${name} 2026`, used, pending, allocated: 1, lapsed: 0 }
})
let running = 0
const carryMonthRows = carryRows.map((r) => {
  const carriedIn = running
  running = carriedIn + r.allocated - r.used - r.pending
  return { ...r, carriedIn, balance: running }
})

const carryRaw = {
  applicable: true,
  year: 2026,
  tracked: true,
  asOf: '2026-11',
  monthLabel: 'November 2026',
  startsOn: '2026-01-01',
  cutOver: '2026-01-01',
  mode: 'monthly_carry',
  allocation: 'monthly',
  perMonth: 1,
  perYear: null,
  carryForward: true,
  yearEnd: 'lapse',
  yearEndCap: null,
  halfDayAllowed: true,
  policyText: 'Every staff employee with 6 months of service earns 1 day a month. Unused days carry forward to later months of the year with no monthly limit; a month\'s days cannot be used before that month.',
  totalEligible: 12,
  allocatedSoFar: 11,
  carriedFromLastYear: 0,
  carriedForward: 8.5,
  allocatedThisMonth: 1,
  usedThisMonth: 1,
  pendingThisMonth: 1,
  utilized: 3.5,
  pending: 1,
  available: 7.5,
  maxUsableThisMonth: 7.5,
  remainingAfterApproved: 8.5,
  remainingAfterPending: 7.5,
  remainingForYear: 7.5,
  lapsed: 0,
  leftAtYearEnd: 7.5,
  personalText: 'For 2026 you get 12 days of Casual Leave (1 day a month). You have used 3.5, 1 is waiting for approval. You can use up to 7.5 days in November.',
  monthRows: carryMonthRows,
}

/** 90 days of service (from 29 Sep), no carry forward: Oct ½ used, Nov 1 waiting. */
const noCarryRaw = {
  ...carryRaw,
  startsOn: '2026-09-29',
  mode: 'monthly',
  carryForward: false,
  policyText: 'Every staff employee with 90 days of service gets 1 day a month, for that month only (unused days end with the month).',
  totalEligible: 4,
  allocatedSoFar: 3,
  carriedForward: 0,
  utilized: 0.5,
  pending: 1,
  available: 0,
  maxUsableThisMonth: 0,
  remainingAfterApproved: 1,
  remainingAfterPending: 0,
  remainingForYear: 1,
  lapsed: 1.5,
  monthRows: [
    { month: '2026-09', label: 'September 2026', carriedIn: 0, allocated: 1, used: 0, pending: 0, balance: 1, lapsed: 1 },
    { month: '2026-10', label: 'October 2026', carriedIn: 0, allocated: 1, used: 0.5, pending: 0, balance: 0.5, lapsed: 0.5 },
    { month: '2026-11', label: 'November 2026', carriedIn: 0, allocated: 1, used: 0, pending: 1, balance: 0, lapsed: 0 },
  ],
}

const s = (raw: unknown): CLSummary => readClSummary(raw)!

test('readClSummary reads the block defensively', () => {
  const c = s(carryRaw)
  assert.equal(c.year, 2026)
  assert.equal(c.asOf, '2026-11')
  assert.equal(c.carryForward, true)
  assert.equal(c.monthRows.length, 11)
  assert.deepEqual([c.monthRows[10].carriedIn, c.monthRows[10].balance], [8.5, 7.5])
  // a month's carry-in is the month before's balance (the vectors are consistent)
  for (let i = 1; i < c.monthRows.length; i++) assert.equal(c.monthRows[i].carriedIn, c.monthRows[i - 1].balance)
  // strings read as numbers; rows without a 'YYYY-MM' month are dropped; a missing asOf falls back to December
  const odd = s({ ...carryRaw, utilized: '3.5', asOf: undefined, monthLabel: '', monthRows: [{ month: 'Nov' }, ...carryMonthRows.slice(0, 1)] })
  assert.equal(odd.utilized, 3.5)
  assert.equal(odd.asOf, '2026-12')
  assert.equal(odd.monthLabel, 'December 2026')
  assert.equal(odd.monthRows.length, 1)
  assert.equal(readClSummary(null), null)
  assert.equal(readClSummary({ applicable: true }), null)
})

test('pickClSummary: the summary of the year on screen, staff only', () => {
  const now = s(carryRaw)
  const last = s({ ...carryRaw, year: 2025, asOf: '2025-12' })
  assert.equal(pickClSummary(2026, undefined, now), now)
  assert.equal(pickClSummary(2025, last, now), last)
  assert.equal(pickClSummary(2026, last, now), now)
  assert.equal(pickClSummary(2024, last, now), null)
  assert.equal(pickClSummary(2026, s({ ...carryRaw, applicable: false })), null)
  assert.equal(pickClSummary(2026, s({ ...carryRaw, tracked: false, monthRows: [] })), null)
  assert.equal(pickClSummary(2026), null)
})

test('summaryTiles: monthly with carry forward', () => {
  const t = summaryTiles(s(carryRaw))
  assert.deepEqual(
    t.map((x) => [x.key, x.label, x.value, x.spoken, x.tone]),
    [
      ['total', 'Total for 2026', '12', '12 days', 'primary'],
      ['used', 'Used', '3½', '3½ days', 'used'],
      ['available', 'Available', '7½', '7½ days', 'free'],
      ['carried', 'Carried forward', '8½', '8½ days', 'plain'],
      ['given', 'Given in November', '1', '1 day', 'plain'],
      ['usable', 'Usable in November', '7½', '7½ days', 'free'],
    ],
  )
  // no carry forward: no "Carried forward"; the yearly allocation: no "Given in ..."
  assert.equal(summaryTiles(s(noCarryRaw)).some((x) => x.key === 'carried'), false)
  const yearly = s({ ...carryRaw, mode: 'yearly', allocation: 'yearly', perMonth: null, perYear: 12, carriedForward: 12, allocatedThisMonth: 0 })
  assert.deepEqual(summaryTiles(yearly).map((x) => x.key), ['total', 'used', 'available', 'carried', 'usable'])
})

test('summaryLines: usable now after approved / after waiting (the month shown), the year apart', () => {
  assert.deepEqual(
    summaryLines(s(carryRaw)).map((l) => [l.label, l.value]),
    [
      ['Waiting for approval', '1 day'],
      ['Usable now, after approved requests', '8½ days'],
      ['Usable now, after approved and waiting requests', '7½ days'],
    ],
  )
  // no carry forward: lapsed days, and the rest of the year when it differs from what is usable now
  assert.deepEqual(
    summaryLines(s(noCarryRaw)).map((l) => [l.key, l.label, l.value]),
    [
      ['pending', 'Waiting for approval', '1 day'],
      ['afterApproved', 'Usable now, after approved requests', '1 day'],
      ['afterPending', 'Usable now, after approved and waiting requests', '0 days'],
      ['lapsed', 'Lapsed (unused in past months)', '1½ days'],
      ['year', 'Left for the rest of 2026', '1 day'],
    ],
  )
  // nothing waiting: one "usable now" line; carried in from last year
  assert.deepEqual(
    summaryLines(s({ ...carryRaw, pending: 0, remainingAfterPending: 8.5, remainingForYear: 8.5, carriedFromLastYear: 3 })).map((l) => l.key),
    ['afterApproved', 'lastYear'],
  )
  assert.equal(summaryLines(s({ ...carryRaw, carriedFromLastYear: 3 })).find((l) => l.key === 'lastYear')?.label, 'Carried in from 2025')
})

test('clNumber / clDays', () => {
  assert.deepEqual([7.5, 0.5, 3, 0, 1.25, -1].map(clNumber), ['7½', '½', '3', '0', '1.25', '-1'])
  assert.deepEqual([1, 0.5, 2.5, 0].map(clDays), ['1 day', '½ day', '2½ days', '0 days'])
  assert.equal(summaryMonthName(s(carryRaw)), 'November')
})

test('summaryWorthShowing: staff with a balance kept', () => {
  assert.equal(summaryWorthShowing(s(carryRaw)), true)
  assert.equal(summaryWorthShowing(s({ ...carryRaw, applicable: false })), false)
  assert.equal(summaryWorthShowing(s({ ...carryRaw, tracked: false, monthRows: [] })), false)
  assert.equal(summaryWorthShowing(null), false)
})

test('clMonthTable: only the columns that say something', () => {
  const t = clMonthTable(s(carryRaw))!
  assert.deepEqual(t.columns.map((c) => c.label), ['In', 'Given', 'Used', 'Waiting', 'Left'])
  assert.equal(t.rows.length, 11)
  const nov = t.rows[10]
  assert.deepEqual([nov.label, nov.short, nov.current, nov.cells], ['November 2026', 'Nov', true, ['8½', '1', '1', '1', '7½']])
  assert.deepEqual(t.rows[5].cells, ['4', '1', '½', '0', '4½'])
  assert.equal(t.rows.filter((r) => r.current).length, 1)
  // no carry forward: no "In", a "Lapsed" column (some month lapsed)
  const n = clMonthTable(s(noCarryRaw))!
  assert.deepEqual(n.columns.map((c) => c.key), ['allocated', 'used', 'pending', 'balance', 'lapsed'])
  assert.deepEqual(n.rows.map((r) => r.cells), [['1', '0', '0', '1', '1'], ['1', '½', '0', '½', '½'], ['1', '0', '1', '0', '0']])
  // nothing waiting and nothing lapsed in any month: neither column
  const quiet = clMonthTable(s({ ...noCarryRaw, monthRows: noCarryRaw.monthRows.map((r) => ({ ...r, pending: 0, lapsed: 0 })) }))!
  assert.deepEqual(quiet.columns.map((c) => c.key), ['allocated', 'used', 'balance'])
  assert.equal(clMonthTable(s({ ...carryRaw, monthRows: [] })), null)
})

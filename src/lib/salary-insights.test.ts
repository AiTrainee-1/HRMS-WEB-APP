// Run with `npm test`. The Salary pages' reading of GET /my/salary-insights and the slip breakdown (lib/salary-insights.ts).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  attendanceFacts,
  compareRows,
  cycleText,
  isProductionInsights,
  latestPeriod,
  lossSentence,
  moneyWentRows,
  normalizeInsights,
  normalizePeriod,
  periodLoss,
  periodsNewestFirst,
  slipCycleLabel,
  slipPdfFileName,
  slipPeriodLabel,
  sortSlipsNewestFirst,
  waterfallFor,
} from './salary-insights.ts'

const staffPeriod = {
  slipId: 41,
  slipNumber: 'SS/2026/02/0041',
  kind: 'staff',
  month: 2,
  year: 2026,
  period: { label: 'February 2026', shortLabel: 'Feb', start: null, end: null, cycle: null, cycleLabel: null },
  hasDetails: true,
  allocated: 24000,
  earnedGross: 21000,
  absentLoss: 3000,
  lateDeduction: 250,
  permissionDeduction: 0,
  attendanceLoss: 3250,
  otPay: '500.00',
  pf: 1800,
  esi: 0,
  tds: 0,
  statutory: 1800,
  advance: 1000,
  otherDeductions: 0,
  totalDeductions: 3050,
  netPayable: 18450,
  counts: { workingDays: 24, paidDays: 21, presentDays: 20, absentDays: 3, lateMarks: 4, freeLateMarks: 3, billableLateMarks: 1, dailyRate: 1000 },
  notes: {},
  steps: [
    { key: 'allocated', label: 'Monthly salary', amount: 24000, op: 'start', note: 'Your full salary for the month, as set by HR.' },
    { key: 'absent_loss', label: 'Not paid: days not worked', amount: 3000, op: 'minus', note: '3 days not paid.' },
    { key: 'earned', label: 'Salary earned', amount: 21000, op: 'subtotal', note: '₹1,000 a day x 21 days paid.' },
    { key: 'ot_pay', label: 'Overtime pay', amount: 500, op: 'plus', note: 'Overtime HR gave you as pay.' },
    { key: 'late', label: 'Late deduction', amount: 250, op: 'minus', note: '1 late mark charged.' },
    { key: 'permission', label: 'Permission deduction', amount: null, op: 'minus', note: 'Not recorded on this slip.' },
    { key: 'bogus', label: 'Bogus', amount: 1, op: 'times', note: '' },
    { key: 'net', label: 'Final payable salary', amount: 18450, op: 'total', note: 'What this slip pays you.' },
  ],
  reconciles: true,
  payroll: { status: 'paid', statusLabel: 'Paid', bonus: 0, deductionChange: 0, net: 18450 },
}

test('normalizePeriod reads numbers defensively and drops unknown steps', () => {
  const p = normalizePeriod(staffPeriod)
  assert.ok(p)
  assert.equal(p.otPay, 500)
  assert.equal(p.steps.length, 7)
  assert.equal(p.steps.find((s) => s.key === 'permission')?.amount, null)
  assert.equal(p.counts.halfDays, null)
  assert.equal(p.payroll?.hrChanged, false)
  assert.equal(normalizePeriod({ kind: 'staff' }), null)
  assert.equal(normalizePeriod('nope'), null)
})

test('hrChanged follows the server flag, else bonus / deduction change', () => {
  assert.equal(normalizePeriod({ ...staffPeriod, payroll: { bonus: 500 } })?.payroll?.hrChanged, true)
  assert.equal(normalizePeriod({ ...staffPeriod, payroll: { bonus: 500, hrChanged: false } })?.payroll?.hrChanged, false)
  assert.equal(normalizePeriod({ ...staffPeriod, payroll: null })?.payroll, null)
})

test('normalizeInsights: null for a non-contract reply, years sorted newest first and include the year', () => {
  assert.equal(normalizeInsights('<html>'), null)
  assert.equal(normalizeInsights({ periods: [] }), null)
  const i = normalizeInsights({ year: 2026, years: [2024, 2025], periods: [staffPeriod, { bad: 1 }], summary: { netPayable: 18450 } })
  assert.ok(i)
  assert.deepEqual(i.years, [2026, 2025, 2024])
  assert.equal(i.periods.length, 1)
  assert.equal(i.summary.allocated, null)
  assert.equal(i.employmentType, 'staff')
})

test('lossSentence names what attendance cost, in rupees the Indian way', () => {
  const p = normalizePeriod(staffPeriod)!
  assert.equal(lossSentence(p), 'You lost ₹3,250 in February 2026: ₹3,000 for 3 days not paid, ₹250 late deduction.')
  const none = normalizePeriod({ ...staffPeriod, attendanceLoss: 0, absentLoss: 0, lateDeduction: 0 })!
  assert.equal(lossSentence(none), 'You lost nothing to attendance in February 2026.')
})

test('production pay: the server reason, never an allocated number', () => {
  const prod = normalizePeriod({
    ...staffPeriod,
    kind: 'production',
    allocated: null,
    absentLoss: null,
    attendanceLoss: null,
    permissionDeduction: null,
    lateDeduction: 120,
    period: { label: '5 Oct - 11 Oct 2026', shortLabel: '5-11 Oct', cycle: 'weekly', cycleLabel: 'Weekly' },
    notes: { allocated: 'Production pay is per shift, so there is no fixed salary to compare with.' },
  })!
  assert.equal(
    lossSentence(prod),
    'Production pay is per shift, so there is no fixed salary to compare with. Late arrivals cost you ₹120 in 5 Oct - 11 Oct 2026.',
  )
  assert.equal(cycleText(prod), 'Weekly pay')
  assert.equal(periodLoss(prod), 120)
  assert.equal(isProductionInsights({ employmentType: 'production', periods: [] }), true)
  assert.equal(isProductionInsights({ employmentType: 'staff', periods: [prod] }), true)
  const row = compareRows([prod])[0]
  assert.equal(row.hasAllocated, false)
  assert.equal(row.total, row.value)
})

test('latest / newest-first / compare rows', () => {
  const a = normalizePeriod({ ...staffPeriod, slipId: 1, period: { label: 'January 2026', shortLabel: 'Jan' } })!
  const b = normalizePeriod(staffPeriod)!
  assert.equal(latestPeriod([a, b])?.slipId, 41)
  assert.equal(latestPeriod([]), null)
  assert.deepEqual(periodsNewestFirst([a, b]).map((p) => p.slipId), [41, 1])
  const rows = compareRows([a, b])
  assert.deepEqual(rows.map((r) => [r.label, r.total, r.value]), [['Jan', 24000, 21000], ['Feb', 24000, 21000]])
})

test('moneyWentRows keeps only what has money, server figures only', () => {
  const rows = moneyWentRows({
    periods: 2,
    allocated: 48000,
    allocatedPeriods: 2,
    earnedGross: 42000,
    absentLoss: 6000,
    lateDeduction: 500,
    permissionDeduction: null,
    attendanceLoss: 6500,
    otPay: 0,
    statutory: 3600,
    advance: 0,
    otherDeductions: 0,
    totalDeductions: 4100,
    netPayable: 37900,
  })
  assert.deepEqual(rows.map((r) => [r.key, r.value]), [['net', 37900], ['absent', 6000], ['late', 500], ['statutory', 3600]])
})

test('waterfallFor maps ops to the kit and keeps unrecorded lines aside with their reason', () => {
  const p = normalizePeriod(staffPeriod)!
  const { chart, missing } = waterfallFor(p.steps)
  assert.deepEqual(chart.map((s) => s.kind), ['start', 'subtract', 'total', 'add', 'subtract', 'total'])
  assert.equal(chart[0].hint, 'Your full salary for the month, as set by HR.')
  assert.equal(missing.length, 1)
  assert.equal(missing[0].note, 'Not recorded on this slip.')
})

test('attendanceFacts lists only what the slip recorded', () => {
  const p = normalizePeriod(staffPeriod)!
  const facts = attendanceFacts(p)
  assert.deepEqual(facts.map((f) => f.key), ['workingDays', 'paidDays', 'presentDays', 'absentDays', 'dailyRate', 'lateMarks'])
  assert.equal(facts.find((f) => f.key === 'lateMarks')?.hint, '3 free, 1 charged')
  assert.equal(facts.find((f) => f.key === 'dailyRate')?.value, '₹1,000')
})

test('slip labels, order and unique PDF names', () => {
  assert.equal(slipPeriodLabel({ id: 1, month: 10, year: 2026, periodStart: '2026-10-05', periodEnd: '2026-10-11' }), '5 Oct - 11 Oct 2026')
  assert.equal(slipPeriodLabel({ id: 1, month: 12, year: 2026, periodStart: '2026-12-28', periodEnd: '2027-01-03' }), '28 Dec 2026 - 3 Jan 2027')
  assert.equal(slipPeriodLabel({ id: 1, month: 10, year: 2026 }), 'October 2026')
  assert.equal(slipPeriodLabel({ id: 1, month: 10, year: 2026, weekNumber: 2 }), 'Week 2 of October 2026')
  assert.equal(slipCycleLabel({ id: 1, month: 10, year: 2026, payCycle: 'weekly' }), 'Weekly pay')
  assert.equal(slipCycleLabel({ id: 1, month: 10, year: 2026 }), null)
  const sorted = sortSlipsNewestFirst([
    { id: 1, month: 10, year: 2026, periodStart: '2026-10-05' },
    { id: 2, month: 10, year: 2026, periodStart: '2026-10-12' },
    { id: 3, month: 9, year: 2026 },
  ])
  assert.deepEqual(sorted.map((s) => s.id), [2, 1, 3])
  assert.equal(slipPdfFileName({ id: 7, slipNumber: 'SS/2026/10 w2' }), 'salary-slip-SS-2026-10-w2.pdf')
  assert.equal(slipPdfFileName({ id: 7, month: 3, year: 2026 }), 'salary-slip-2026-03-7.pdf')
})

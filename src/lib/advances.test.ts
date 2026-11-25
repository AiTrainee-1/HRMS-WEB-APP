// Run with `npm test`. Salary Advance / Term Loan rules and the reading of /my/advances (lib/advances.ts). The EMI and
// schedule vectors are the server's (mobile_settlement_views.schedule_plan / whole_rupee_emi).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  amountOf,
  countdownText,
  daysInMonthOf,
  filterByType,
  formatAmountInput,
  limitMeter,
  normalizeAdvance,
  normalizeAdvances,
  normalizeEligibility,
  opensOnText,
  planSummary,
  purposeProblem,
  recordTotals,
  repaidRatio,
  salaryAdvanceProblem,
  salaryAdvanceWindow,
  scheduleLook,
  scheduleTitle,
  statusText,
  termAmountProblem,
  termEmi,
  termLoanWindow,
  termPlan,
  typeCounts,
  windowChip,
  windowDeadline,
  windowHeadline,
  windowProgress,
  windowStrip,
} from './advances.ts'

test('amount box: live Indian grouping, digits only', () => {
  assert.equal(formatAmountInput('125000'), '1,25,000')
  assert.equal(formatAmountInput('₹ 0012,5a00'), '12,500')
  assert.equal(formatAmountInput(''), '')
  assert.equal(formatAmountInput('1234567890123'), '12,34,56,789')
  assert.equal(amountOf('1,25,000'), 125000)
  assert.ok(Number.isNaN(amountOf('')))
})

test('salary advance limit meter and messages', () => {
  assert.deepEqual(limitMeter(NaN, 12000), { ratio: 0, state: 'empty', left: 12000 })
  assert.deepEqual(limitMeter(6000, 12000), { ratio: 0.5, state: 'ok', left: 6000 })
  assert.equal(limitMeter(10500, 12000).state, 'near')
  assert.deepEqual(limitMeter(13000, 12000), { ratio: 1, state: 'over', left: 0 })
  assert.equal(limitMeter(100, null).state, 'empty')
  assert.equal(salaryAdvanceProblem('', 12000, 20000), 'Enter the amount.')
  assert.equal(salaryAdvanceProblem('0', 12000, 20000), 'The amount must be more than ₹0.')
  assert.equal(
    salaryAdvanceProblem('13,000', 12000, 20000),
    'The most you can ask for is ₹12,000 (60% of your monthly salary of ₹20,000).',
  )
  assert.equal(salaryAdvanceProblem('12000', 12000, 20000), null)
  assert.equal(purposeProblem(' a '), 'Tell HR briefly what the money is for.')
  assert.equal(purposeProblem('x'.repeat(301)), 'Keep the purpose under 300 characters.')
  assert.equal(purposeProblem('School fees'), null)
})

test('term loan EMI rounds up, last instalment smaller, schedule crosses the year', () => {
  assert.equal(termEmi(10000, 3), 3334)
  assert.equal(termEmi(0, 3), 0)
  const plan = termPlan(10000, 3, 11, 2026)
  assert.deepEqual(plan.map((p) => [p.label, p.amount]), [['Nov 2026', 3334], ['Dec 2026', 3334], ['Jan 2027', 3332]])
  assert.equal(planSummary(plan), '3 EMIs of ₹3,334 (last ₹3,332), Nov 2026 to Jan 2027')
  assert.equal(planSummary(termPlan(5000, 1, 11, 2026)), '1 deduction of ₹5,000 in November 2026')
  assert.equal(planSummary(termPlan(6000, 3, 11, 2026)), '3 EMIs of ₹2,000, Nov 2026 to Jan 2027')
  // 1000 over 12 months: EMI 84, the 12th month gets what is left (76)
  const small = termPlan(1000, 12, 1, 2027)
  assert.equal(small.length, 12)
  assert.equal(small[11].amount, 76)
  assert.equal(termAmountProblem('999', 1000), 'A Term Loan starts from ₹1,000.')
  assert.equal(termAmountProblem('1000', 1000), null)
  assert.equal(termAmountProblem('2,00,00,000', 1000, 10000000), 'The amount cannot be more than ₹1,00,00,000.')
})

test('window headline, progress, deadline and countdown', () => {
  const open = {
    isOpen: true,
    opensOn: '2026-10-20',
    closesOn: '2026-10-31',
    nextOpensOn: '2026-11-20',
    daysUntilOpen: 0,
    daysLeft: 1,
    message: '',
    alwaysOpen: false,
    opensOnDay: null,
    closesOnDay: null,
  }
  assert.equal(windowHeadline(open), 'Open now: last day today')
  assert.equal(windowHeadline({ ...open, daysLeft: 6 }), 'Open now: 6 days left')
  const closed = { ...open, isOpen: false, opensOn: '2026-11-20', closesOn: '2026-11-30', daysUntilOpen: 5, daysLeft: 0 }
  assert.equal(windowHeadline(closed), 'Opens on 20 Nov: in 5 days')
  assert.equal(windowHeadline({ ...closed, daysUntilOpen: 1 }), 'Opens on 20 Nov: tomorrow')
  assert.equal(windowProgress(open), 1)
  assert.ok(windowProgress(closed) > 0.7 && windowProgress(closed) <= 0.8)
  // closes at the end of 31 Oct IST = 1 Nov 00:00 IST = 31 Oct 18:30 UTC
  assert.equal(windowDeadline(open), Date.parse('2026-10-31T18:30:00Z'))
  assert.equal(windowDeadline(closed), Date.parse('2026-11-19T18:30:00Z'))
  assert.ok(Number.isNaN(windowDeadline({ ...open, closesOn: '' })))
  const now = Date.parse('2026-10-28T10:00:00Z')
  assert.equal(countdownText(now, now + (3 * 24 + 4) * 3600_000 + 59_000), '3 days 4 hours')
  assert.equal(countdownText(now, now + 3600_000 + 60_000), '1 hour 1 minute')
  assert.equal(countdownText(now, now + 12 * 60_000), '12 minutes')
  assert.equal(countdownText(now, now + 30_000), 'less than a minute')
  assert.equal(countdownText(now, now - 1), '')
})

const pendingRow = {
  id: 9,
  advanceType: 'term',
  status: 'pending',
  amount: 10000,
  requestedAmount: 10000,
  approvedAmount: null,
  schedule: [{ month: 11, year: 2026, label: 'Nov 2026', amount: 3334, state: 'planned' }, { month: 'x' }],
  timeline: [{ kind: 'applied', at: '2026-10-25T10:00:00+05:30', title: 'Applied', text: 'You asked for ₹10,000 over 3 months.' }, { kind: 'odd' }],
  appliedBy: 'employee',
  approval: { currentStep: 1, waitingFor: ['hr'] },
}

const approvedRow = {
  id: 4,
  advanceType: 'general',
  status: 'approved',
  amount: 8000,
  requestedAmount: 10000,
  approvedAmount: 8000,
  approvedLess: true,
  balanceDue: 8000,
  deductedTotal: 0,
  approvedBy: 'Meena',
  schedule: [{ month: 10, year: 2026, label: 'Oct 2026', amount: 8000, state: 'due' }],
}

test('normalizeAdvance / normalizeAdvances', () => {
  assert.equal(normalizeAdvances({ results: [] }), null)
  const rows = normalizeAdvances([pendingRow, approvedRow, { no: 'id' }])!
  assert.equal(rows.length, 2)
  const p = rows[0]
  assert.equal(p.typeLabel, 'Term Loan')
  assert.equal(p.schedule.length, 1)
  assert.equal(p.timeline.length, 1)
  assert.equal(p.balanceDue, 0)
  assert.equal(p.appliedBy, 'employee')
  assert.ok(p.approval)
  const a = normalizeAdvance(approvedRow)!
  assert.equal(a.approvedLess, true)
  assert.equal(a.approval, null)
  assert.equal(statusText(a), 'Approved')
  assert.equal(statusText({ ...a, deductedTotal: 100 }), 'Repaying')
  assert.equal(statusText({ status: 'closed' }), 'Fully repaid')
  assert.equal(statusText({ status: 'pending' }), 'Waiting for HR')
})

test('record totals, type filter and repayment looks', () => {
  const rows = normalizeAdvances([pendingRow, approvedRow, { ...approvedRow, id: 5, status: 'closed', balanceDue: 0, deductedTotal: 5000 }])!
  assert.deepEqual(recordTotals(rows), { owed: 8000, repaid: 5000, waiting: 1, active: 1 })
  assert.deepEqual(typeCounts(rows), { all: 3, general: 2, term: 1 })
  assert.deepEqual(filterByType(rows, 'term').map((r) => r.id), [9])
  assert.equal(repaidRatio(8000, 2000), 0.25)
  assert.equal(repaidRatio(0, 2000), 0)
  assert.deepEqual(scheduleLook({ state: 'due' }), { stateLabel: 'This month', tone: 'amber', current: true })
  assert.equal(scheduleLook({ state: 'planned' }).tone, 'slate')
  assert.equal(scheduleTitle({ state: 'deducted', label: 'Nov 2026' }), 'Deducted from Nov 2026 salary')
})

test('normalizeEligibility keeps the server reasons and falls back sensibly', () => {
  assert.equal(normalizeEligibility({ window: {} }), null)
  const e = normalizeEligibility({
    today: '2026-10-25',
    window: { isOpen: true, opensOn: '2026-10-20', closesOn: '2026-10-31', daysLeft: 7 },
    monthlySalary: null,
    salaryAdvance: { canApply: false, reason: 'You are paid per shift, so there is no monthly salary to take it from.', limit: null },
    termLoan: { canApply: true },
    rules: ['One Salary Advance per month.', 3],
  })!
  assert.equal(e.salaryAdvance.reason, 'You are paid per shift, so there is no monthly salary to take it from.')
  assert.equal(e.salaryAdvance.deductionLabel, 'October 2026')
  assert.equal(e.termLoan.firstDeductionLabel, 'November 2026')
  assert.equal(e.termLoan.minAmount, 1000)
  assert.equal(e.termLoan.maxMonths, 12)
  assert.deepEqual(e.rules, ['One Salary Advance per month.'])
})

// ---- owner 2026-11-25: a Salary Advance only from the 20th to the 22nd, a Term Loan on any day ----------------------

const saClosed = {
  isOpen: false,
  opensOn: '2026-12-20',
  closesOn: '2026-12-22',
  nextOpensOn: '2026-12-20',
  daysUntilOpen: 25,
  daysLeft: 0,
  message: 'Salary Advance applications open on 20 December and close on 22 December.',
  alwaysOpen: false,
  opensOnDay: 20,
  closesOnDay: 22,
}
const saOpen = { ...saClosed, isOpen: true, opensOn: '2026-11-20', closesOn: '2026-11-22', daysUntilOpen: 0, daysLeft: 2 }
const termAny = {
  isOpen: true,
  opensOn: '2026-11-25',
  closesOn: '',
  nextOpensOn: '',
  daysUntilOpen: 0,
  daysLeft: 0,
  message: 'Term Loan applications are open on any day.',
  alwaysOpen: true,
  opensOnDay: null,
  closesOnDay: null,
}

test('each form has its own window; an older server shares one', () => {
  const current = { window: saClosed, windows: { general: saClosed, term: termAny } }
  assert.equal(salaryAdvanceWindow(current), saClosed)
  assert.equal(termLoanWindow(current), null) // a Term Loan: any day
  const older = { window: saOpen }
  assert.equal(salaryAdvanceWindow(older), saOpen)
  assert.equal(termLoanWindow(older), saOpen)
})

test('normalizeEligibility reads each form\'s window', () => {
  const e = normalizeEligibility({
    today: '2026-11-25',
    window: { ...saClosed, closesOn: '2026-12-22' },
    windows: { general: saClosed, term: { ...termAny, closesOn: null, nextOpensOn: null, daysLeft: null } },
    salaryAdvance: { canApply: false, reason: 'A Salary Advance can be applied for only from the 20th to the 22nd of each month.', deductionLabel: 'December 2026' },
    termLoan: { canApply: true },
  })!
  assert.equal(e.windows?.general.opensOnDay, 20)
  assert.equal(e.windows?.term.alwaysOpen, true)
  assert.equal(e.windows?.term.closesOn, '')
  assert.equal(termLoanWindow(e), null)
  assert.equal(salaryAdvanceWindow(e).closesOnDay, 22)
  // after the 22nd the Salary Advance comes out of next month's salary (the server's own label)
  assert.equal(e.salaryAdvance.deductionLabel, 'December 2026')
  // an older server: no `windows`
  const old = normalizeEligibility({ today: '2026-10-25', window: { isOpen: true }, salaryAdvance: {}, termLoan: {} })!
  assert.equal(old.windows, null)
  assert.equal(old.window.alwaysOpen, false)
})

test('the chip and the disabled button say when a Salary Advance opens', () => {
  assert.deepEqual(windowChip(saClosed), { open: false, text: 'Opens 20 Dec · in 25 days' })
  assert.deepEqual(windowChip({ ...saClosed, daysUntilOpen: 1 }), { open: false, text: 'Opens 20 Dec · tomorrow' })
  assert.deepEqual(windowChip(saOpen), { open: true, text: 'Open · 2 days left' })
  assert.deepEqual(windowChip({ ...saOpen, daysLeft: 1 }), { open: true, text: 'Last day today' })
  assert.deepEqual(windowChip(termAny), { open: true, text: 'Any day' })
  assert.deepEqual(windowChip(null), { open: true, text: 'Any day' })
  assert.equal(opensOnText(saClosed), 'Opens on 20 Dec')
  assert.equal(opensOnText(saOpen), '')
  assert.equal(opensOnText(termAny), '')
  assert.equal(windowHeadline(termAny), 'Open every day')
  assert.equal(windowHeadline(saClosed), 'Opens on 20 Dec: in 25 days')
  assert.equal(windowHeadline(saOpen), 'Open now: 2 days left')
  assert.ok(Number.isNaN(windowDeadline(termAny)))
  // closes at the end of 22 Nov IST
  assert.equal(windowDeadline(saOpen), Date.parse('2026-11-22T18:30:00Z'))
})

test('the month strip lights the 20th to the 22nd', () => {
  assert.equal(daysInMonthOf('2026-11-25'), 30)
  assert.equal(daysInMonthOf('2027-02-03'), 28)
  assert.equal(daysInMonthOf('2028-02-03'), 29)
  const s = windowStrip(saClosed, '2026-11-25')!
  assert.equal(s.lastDay, 30)
  assert.deepEqual([s.fromDay, s.toDay], [20, 22])
  assert.ok(Math.abs(s.startPct - (19 / 29) * 100) < 1e-9)
  assert.ok(Math.abs(s.endPct - (21 / 29) * 100) < 1e-9)
  assert.ok(s.todayPct > s.endPct) // the 25th: past this month's window
  assert.equal(windowStrip(termAny, '2026-11-25'), null)
  // an older server's 20th-to-month-end window
  const old = windowStrip({ ...saClosed, opensOn: '2026-11-20', closesOn: '2026-11-30', opensOnDay: null, closesOnDay: null }, '2026-11-05')!
  assert.deepEqual([old.fromDay, old.toDay, old.endPct], [20, 30, 100])
  // never off the strip
  assert.equal(windowStrip(saOpen, '2026-11-01')!.todayPct, 0)
})

test('progress through the 3-day window', () => {
  assert.equal(windowProgress(termAny), 1)
  assert.equal(windowProgress({ ...saOpen, daysLeft: 1 }), 1)
  assert.ok(Math.abs(windowProgress({ ...saOpen, daysLeft: 3 }) - 1 / 3) < 1e-9)
  assert.ok(windowProgress(saClosed) >= 0 && windowProgress(saClosed) < 1)
})

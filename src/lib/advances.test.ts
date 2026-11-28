// Run with `npm test`. Salary Advance / Term Loan rules and the reading of /my/advances (lib/advances.ts). The EMI and
// schedule vectors are the server's (mobile_settlement_views.schedule_plan / whole_rupee_emi).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  amountOf,
  applyForms,
  applyRefusal,
  approvalNoteText,
  approvedAmountText,
  askedNote,
  countdownText,
  daysInMonthOf,
  daysText,
  decisionRemarkOf,
  decisionTitle,
  defaultTermMonths,
  deleteRowText,
  earnedBasisView,
  filterByType,
  formatAmountInput,
  limitMeter,
  limitWhenAppliedText,
  longDate,
  normalizeAdvance,
  normalizeAdvances,
  normalizeEarned,
  normalizeEligibility,
  normalizeSalaryAdvanceRules,
  normalizeService,
  normalizeTermLoanRules,
  opensOnText,
  ordinal,
  planSummary,
  purposeProblem,
  recordTotals,
  remarkLine,
  repaidRatio,
  reviewSentence,
  reviewText,
  salaryAdvanceBasisText,
  salaryAdvanceDays,
  salaryAdvanceDaysOf,
  salaryAdvanceDaysText,
  salaryAdvancePercent,
  salaryAdvanceProblem,
  salaryAdvanceRuleText,
  salaryAdvanceThroughDay,
  salaryAdvanceWindow,
  scheduleLook,
  scheduleTitle,
  statusText,
  termAmountProblem,
  termEmi,
  termLoanBlock,
  termLoanLimitText,
  termLoanServiceMonths,
  termLoanServiceView,
  termLoanWindow,
  termMonthChoices,
  termPlan,
  typeCounts,
  windowChip,
  windowDeadline,
  windowHeadline,
  windowProgress,
  windowStrip,
  workingDaysHint,
  type AdvanceEligibility,
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
  assert.equal(salaryAdvanceProblem('', 12000, 24000), 'Enter the amount.')
  assert.equal(salaryAdvanceProblem('0', 12000, 24000), 'The amount must be more than ₹0.')
  // 2026-11-26: 50% of the salary EARNED from the 1st to the 20th (the server's over_limit sentence)
  assert.equal(
    salaryAdvanceProblem('13,000', 12000, 24000),
    'The most you can ask for is ₹12,000 (50% of the ₹24,000 you earned from the 1st to the 20th).',
  )
  assert.equal(
    salaryAdvanceProblem('7,000', 6458, 12916.67, 50, 20),
    'The most you can ask for is ₹6,458 (50% of the ₹12,916.67 you earned from the 1st to the 20th).',
  )
  // without the earned figure (an older server) only the limit is named
  assert.equal(salaryAdvanceProblem('13000', 12000, null), 'The most you can ask for is ₹12,000.')
  assert.equal(salaryAdvanceProblem('12000', 12000, 24000), null)
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
  // the server's own cap on any amount (parse_amount, MAX_AMOUNT ₹99,99,999) comes before the minimum and the limit
  assert.equal(termAmountProblem('2,00,00,000', 1000, 10000000), 'The amount cannot be more than ₹99,99,999.')
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
  // 2026-11-27: Settings' default is 6 months (12 is only the absolute most); a missing value must never offer 7-12
  assert.equal(e.termLoan.maxMonths, 6)
  assert.deepEqual(e.rules, ['One Salary Advance per month.'])
  // an older server: normal method, applying available, no rules / codes
  assert.equal(e.method, 'normal')
  assert.equal(e.applyAvailable, true)
  assert.equal(e.applyUnavailableReason, null)
  assert.equal(e.salaryAdvance.rules, null)
  assert.equal(e.termLoan.rules, null)
  assert.equal(e.termLoan.code, null)
  assert.equal(e.termLoan.limit, null)
  assert.equal(e.termLoan.open, null)
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

// ---- owner 2026-11-26: Salary Advance on the 21st and 22nd, 50% of the salary earned 1st-20th; Term Loan after 6 months --

const earnedRaw = {
  month: 11,
  year: 2026,
  throughDay: 20,
  through: '2026-11-20',
  fixedSalary: 26000,
  dailyRate: 1000,
  companyDays: 26,
  workingDays: 15.5,
  paidDays: 16.5,
  earnedAmount: 16500,
  workingSalary: 16500,
  percent: 50,
  limit: 8250,
  final: true,
}

const serviceShort = {
  eligible: false,
  joinDate: '2026-06-01',
  serviceMonths: 5,
  requiredMonths: 6,
  eligibleFrom: '2026-12-01',
  reason: 'A Term Loan needs 6 months of service. You can apply from 1 December 2026 (5/6 months of service).',
}

test('ordinals and the Salary Advance days come from the server', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 11, 12, 13, 20, 21, 22, 23, 31].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '20th', '21st', '22nd', '23rd', '31st'],
  )
  const w = { ...saClosed, opensOn: '2026-12-21', closesOn: '2026-12-22', opensOnDay: 21, closesOnDay: 22 }
  assert.deepEqual(salaryAdvanceDays(w), { from: 21, to: 22 })
  assert.equal(salaryAdvanceDaysText(w), 'the 21st and 22nd')
  assert.equal(salaryAdvanceRuleText(w), 'Salary Advance: apply on the 21st and 22nd of each month.')
  // a server that says other days is followed
  assert.equal(salaryAdvanceDaysText(saClosed), 'the 20th to the 22nd')
  assert.equal(salaryAdvanceDaysText({ ...w, opensOnDay: 22 }), 'the 22nd')
  // no days at all: the rule since 2026-11-26
  assert.equal(salaryAdvanceDaysText(null), 'the 21st and 22nd')
  assert.equal(salaryAdvanceDaysText({ ...w, opensOn: '', closesOn: '', opensOnDay: null, closesOnDay: null }), 'the 21st and 22nd')
  // the strip lights the 21st and 22nd
  const s = windowStrip(w, '2026-11-25')!
  assert.deepEqual([s.fromDay, s.toDay], [21, 22])
})

test('normalizeEligibility reads earned, service and the 50% default', () => {
  const e = normalizeEligibility({
    today: '2026-11-21',
    window: { ...saOpen, opensOnDay: 21 },
    monthlySalary: 26000,
    salaryAdvance: { canApply: true, percent: 50, limit: 8250, limitBasis: 'earned_1_to_20', earned: earnedRaw },
    termLoan: { canApply: false, reason: serviceShort.reason, service: serviceShort },
    rules: ['Salary Advance: apply on the 21st and 22nd of each month. Term Loan: apply on any day.'],
  })!
  assert.equal(e.salaryAdvance.limitBasis, 'earned_1_to_20')
  assert.equal(e.salaryAdvance.earned?.earnedAmount, 16500)
  assert.equal(e.salaryAdvance.earned?.workingDays, 15.5)
  assert.equal(e.salaryAdvance.earned?.final, true)
  assert.equal(e.termLoan.service?.eligible, false)
  assert.equal(e.termLoan.service?.serviceMonths, 5)
  assert.equal(e.termLoan.reason, serviceShort.reason)
  // an older server: no earned / service, and the percent falls back to the current rule
  const old = normalizeEligibility({ today: '2026-10-25', window: { isOpen: true }, salaryAdvance: { earned: null }, termLoan: {} })!
  assert.equal(old.salaryAdvance.earned, null)
  assert.equal(old.salaryAdvance.limitBasis, null)
  assert.equal(old.termLoan.service, null)
  assert.equal(old.salaryAdvance.percent, 50)
  // null-safe readers
  assert.equal(normalizeEarned(null), null)
  assert.equal(normalizeEarned({ month: 11 }), null)
  assert.equal(normalizeEarned({ workingSalary: 100, limit: 50 })?.earnedAmount, 100)
  assert.equal(normalizeEarned({ earnedAmount: 100, limit: 50 })?.final, false)
  assert.equal(normalizeService({ eligible: 'yes' }), null)
  assert.equal(normalizeService({ eligible: true })?.requiredMonths, 6)
})

test('what the limit is taken from: earned 1st-20th, working days, monthly salary, 50% limit', () => {
  assert.equal(earnedBasisView(null), null)
  assert.equal(earnedBasisView(undefined, 26000), null)
  const v = earnedBasisView(normalizeEarned(earnedRaw), 26000)!
  assert.equal(v.title, 'Earned from the 1st to the 20th of November 2026')
  assert.equal(v.note, null)
  assert.deepEqual(
    v.figures.map((f) => [f.key, f.label, f.value]),
    [
      ['earned', 'Earned 1st–20th', '₹16,500'],
      ['days', 'Working days', '15.5'],
      ['salary', 'Monthly salary', '₹26,000'],
      ['limit', '50% limit', '₹8,250'],
    ],
  )
  assert.equal(v.figures[1].hint, 'present shifts; 16.5 paid with holidays')
  // before the 20th is over: earned so far
  const soFar = earnedBasisView(normalizeEarned({ ...earnedRaw, final: false, paidDays: 15.5, fixedSalary: null }), 30000)!
  assert.equal(soFar.title, 'Earned so far (the 1st to the 20th of November 2026)')
  assert.equal(soFar.figures[0].label, 'Earned so far (1st–20th)')
  assert.match(soFar.note ?? '', /earned so far/)
  assert.equal(soFar.figures[1].hint, 'present shifts')
  // the monthly salary falls back to the reply's monthlySalary
  assert.equal(soFar.figures.find((f) => f.key === 'salary')?.value, '₹30,000')
  assert.equal(daysText(18), '18')
  assert.equal(daysText(18.25), '18.25')
  assert.equal(daysText(0.1 + 0.2), '0.3')
})

test('Term Loan: 6 months of service', () => {
  assert.equal(termLoanServiceView(null), null)
  assert.equal(termLoanServiceView({ ...serviceShort, eligible: true, reason: null }), null)
  assert.deepEqual(termLoanServiceView(serviceShort), {
    reason: serviceShort.reason,
    progress: '5/6 months of service',
    ratio: 5 / 6,
    eligibleFrom: 'Eligible from 1 December 2026',
  })
  // no joining date recorded: the server's sentence only
  const noJoin = termLoanServiceView({
    eligible: false,
    joinDate: null,
    serviceMonths: null,
    requiredMonths: 6,
    eligibleFrom: null,
    reason: 'Your joining date is not recorded, so a Term Loan cannot be checked. Please contact HR.',
  })!
  assert.equal(noJoin.progress, null)
  assert.equal(noJoin.ratio, null)
  assert.equal(noJoin.eligibleFrom, null)
  assert.match(noJoin.reason, /joining date/)
  assert.equal(termLoanServiceView({ ...serviceShort, reason: null })!.reason, 'A Term Loan needs 6 months of service.')
  assert.equal(longDate('2026-12-01'), '1 December 2026')
  assert.equal(longDate('x'), '')
})

// ---- 2026-11-27/28: Settings-driven rules, Term Loan codes, the Automation Method, production employees ----------------
// Shapes copied from backend api/mobile_settlement_views.py (eligibility_json, my_advance_json) and
// tests_mobile_settlement.py EmployeeAppContractTests.

const saRulesRaw = {
  percent: 50,
  windowFromDay: 21,
  windowToDay: 22,
  earnedThroughDay: 20,
  perMonth: 1,
  rejectedAllowsReapply: true,
  windowText: 'the 21st and 22nd of each month',
}
const tlRulesRaw = {
  limitPercent: 100,
  effectivePercent: 100,
  allowAboveSalary: false,
  maxMonths: 6,
  absoluteMaxMonths: 12,
  minAmount: 1000,
  perYear: 1,
  minServiceMonths: 6,
  reapplyNextMonth: true,
  oneOpenAtATime: true,
  staffOnly: true,
}
const earnedNow = {
  month: 11,
  year: 2026,
  throughDay: 20,
  through: '2026-11-20',
  fixedSalary: 26000,
  dailyRate: 1000,
  companyDays: 26,
  workingDays: 16.5,
  presentShifts: 15.5,
  holidayDays: 1,
  paidDays: 16.5,
  earnedAmount: 16500,
  percent: 50,
  limit: 8250,
  final: true,
}
const saWin = {
  isOpen: true,
  opensOn: '2026-11-21',
  closesOn: '2026-11-22',
  nextOpensOn: '2026-12-21',
  daysUntilOpen: 0,
  daysLeft: 2,
  message: 'Salary Advance applications are open until 22 Nov (the 21st and 22nd of each month). You can apply for a Term Loan on any day.',
  type: 'general',
  label: 'Salary Advance',
  alwaysOpen: false,
  opensOnDay: 21,
  closesOnDay: 22,
}
const tlWin = { ...termAny, opensOn: '2026-11-21', closesOn: null, nextOpensOn: null, daysLeft: null, type: 'term', label: 'Term Loan' }

type ReplyOver = { termLoan?: Record<string, unknown>; salaryAdvance?: Record<string, unknown> } & Record<string, unknown>

/** A staff employee in the Salary Advance window, the Automation Method on, a Term Loan possible. */
function staffReply(over: ReplyOver = {}) {
  const { termLoan, salaryAdvance, ...top } = over
  return {
    today: '2026-11-21',
    window: saWin,
    windows: { general: saWin, term: tlWin },
    method: 'automation',
    applyAvailable: true,
    applyUnavailableReason: null,
    workflowEnabled: true,
    workflowMessage: null,
    employeeActive: true,
    monthlySalary: 26000,
    salaryAdvance: {
      canApply: true,
      reason: null,
      percent: 50,
      limit: 8250,
      rules: saRulesRaw,
      deductionMonth: 11,
      deductionYear: 2026,
      deductionLabel: 'November 2026',
      existing: null,
      limitBasis: 'earned_1_to_20',
      earned: earnedNow,
      ...salaryAdvance,
    },
    termLoan: {
      canApply: true,
      reason: null,
      minMonths: 1,
      maxMonths: 6,
      minAmount: 1000,
      maxAmount: 26000,
      firstDeductionMonth: 12,
      firstDeductionYear: 2026,
      firstDeductionLabel: 'December 2026',
      pending: null,
      activeCount: 0,
      service: { requiredMonths: 6, eligible: true, joinDate: '2020-01-01', serviceMonths: 82, eligibleFrom: '2020-07-01', reason: null },
      limit: 26000,
      limitPercent: 100,
      monthlySalary: 26000,
      approvedThisYear: 0,
      perYear: 1,
      open: null,
      rejectedThisMonth: false,
      nextEligibleOn: null,
      code: null,
      rules: tlRulesRaw,
      ...termLoan,
    },
    rules: ['Salary Advance: apply on the 21st and 22nd of each month. Term Loan: apply on any day.'],
    approvalPath: 'Employee → HR → Under review',
    ...top,
  }
}

const elig = (over: ReplyOver = {}): AdvanceEligibility => normalizeEligibility(staffReply(over))!

test('normalizeEligibility reads the method, applyAvailable, the Settings rules and every Term Loan field', () => {
  const e = elig()
  assert.equal(e.method, 'automation')
  assert.equal(e.applyAvailable, true)
  assert.equal(e.applyUnavailableReason, null)
  assert.deepEqual(e.salaryAdvance.rules, {
    percent: 50,
    windowFromDay: 21,
    windowToDay: 22,
    earnedThroughDay: 20,
    perMonth: 1,
    rejectedAllowsReapply: true,
    windowText: 'the 21st and 22nd of each month',
  })
  assert.equal(e.termLoan.rules?.staffOnly, true)
  assert.equal(e.termLoan.rules?.maxMonths, 6)
  assert.equal(e.termLoan.limit, 26000)
  assert.equal(e.termLoan.limitPercent, 100)
  assert.equal(e.termLoan.monthlySalary, 26000)
  assert.equal(e.termLoan.approvedThisYear, 0)
  assert.equal(e.termLoan.perYear, 1)
  assert.equal(e.termLoan.code, null)
  assert.equal(e.termLoan.maxMonths, 6)
  assert.equal(e.approvalPath, 'Employee → HR → Under review')
  // a normal-method server
  assert.equal(elig({ method: 'normal' }).method, 'normal')
  assert.equal(elig({ method: 'something new' }).method, 'normal')
  // codes the app knows are kept, anything else falls back to the reason alone
  assert.equal(elig({ termLoan: { canApply: false, code: 'below_minimum', reason: 'x' } }).termLoan.code, 'below_minimum')
  assert.equal(elig({ termLoan: { canApply: false, code: 'brand_new_rule', reason: 'x' } }).termLoan.code, null)
  // the months come from Settings when the top-level number is missing, never above 12, never below the minimum
  assert.equal(elig({ termLoan: { maxMonths: null, rules: { ...tlRulesRaw, maxMonths: 9 } } }).termLoan.maxMonths, 9)
  assert.equal(elig({ termLoan: { maxMonths: 20 } }).termLoan.maxMonths, 12)
  assert.equal(elig({ termLoan: { minMonths: 3, maxMonths: 2 } }).termLoan.maxMonths, 3)
  // the minimum and the % fall back to Settings
  assert.equal(elig({ termLoan: { minAmount: null, rules: { ...tlRulesRaw, minAmount: 0 } } }).termLoan.minAmount, 0)
  assert.equal(elig({ termLoan: { limitPercent: null, rules: { ...tlRulesRaw, effectivePercent: 80 } } }).termLoan.limitPercent, 80)
  // open (only when Settings allows one at a time) and pending (always) are both read
  const blocked = elig({ termLoan: { canApply: false, code: 'pending', pending: { id: 41, amount: 9000 }, open: { id: 41, status: 'pending', amount: 9000 } } })
  assert.deepEqual(blocked.termLoan.pending, { id: 41, amount: 9000 })
  assert.deepEqual(blocked.termLoan.open, { id: 41, status: 'pending', amount: 9000 })
  // null-safe readers
  assert.equal(normalizeSalaryAdvanceRules(null), null)
  assert.equal(normalizeTermLoanRules('x'), null)
  assert.equal(normalizeTermLoanRules({})?.staffOnly, false)
})

test('a production employee: applyAvailable false with the server reason; no forms; the Term Loan is staff only', () => {
  const reason = 'Loan & Advance is for staff on a monthly salary. Your earlier requests stay here.'
  const e = elig({
    applyAvailable: false,
    applyUnavailableReason: reason,
    monthlySalary: null,
    window: { ...saWin, message: 'Salary Advance applications are open until 22 Nov (the 21st and 22nd of each month).' },
    salaryAdvance: { canApply: false, reason: 'You are paid per shift, so there is no monthly salary to take it from.', limit: null, earned: null },
    termLoan: { canApply: false, code: 'staff_only', reason: 'A Term Loan is for staff employees only.', limit: null, monthlySalary: null, maxAmount: 0 },
  })
  assert.equal(e.applyAvailable, false)
  assert.equal(e.applyUnavailableReason, reason)
  assert.deepEqual(applyForms(e), [])
  assert.equal(termLoanBlock(e).hidden, true)
  // an older (27 Nov) server without applyAvailable: the Salary Advance card stays, the Term Loan is not offered
  const older = normalizeEligibility({
    ...staffReply({ termLoan: { canApply: false, code: 'staff_only', reason: 'A Term Loan is for staff employees only.' } }),
    applyAvailable: undefined,
  })!
  assert.equal(older.applyAvailable, true)
  assert.deepEqual(applyForms(older), ['general'])
  // the reason is only read when applying is not available
  assert.equal(elig({ applyAvailable: true, applyUnavailableReason: 'stale' }).applyUnavailableReason, null)
  // a staff employee: both forms
  assert.deepEqual(applyForms(elig()), ['general', 'term'])
})

test('the Salary Advance rules in words come from Settings, then the window, then the defaults', () => {
  const e = elig()
  assert.equal(salaryAdvanceThroughDay(e), 20)
  assert.equal(salaryAdvancePercent(e), 50)
  assert.equal(salaryAdvanceBasisText(e), '50% of the salary you earned from the 1st to the 20th')
  assert.equal(salaryAdvanceDaysOf(e), 'the 21st and 22nd')
  // Settings changed: 40% of the 1st-18th, applied for on the 19th to the 21st
  const changed = elig({ salaryAdvance: { rules: { ...saRulesRaw, percent: 40, earnedThroughDay: 18, windowFromDay: 19, windowToDay: 21 } } })
  assert.equal(salaryAdvanceBasisText(changed), '40% of the salary you earned from the 1st to the 18th')
  assert.equal(salaryAdvanceDaysOf(changed), 'the 19th to the 21st')
  assert.equal(
    salaryAdvanceRuleText(salaryAdvanceWindow(changed), changed.salaryAdvance.rules),
    'Salary Advance: apply on the 19th to the 21st of each month.',
  )
  // Settings' days win over the window's own days
  assert.deepEqual(salaryAdvanceDays(saClosed, { windowFromDay: 23, windowToDay: 23 }), { from: 23, to: 23 })
  assert.deepEqual(salaryAdvanceDays(saClosed, { windowFromDay: null, windowToDay: null }), { from: 20, to: 22 })
  // no rules: the earned figures' day, then the 20th; the reply's percent, then 50
  const noRules = elig({ salaryAdvance: { rules: null, earned: { ...earnedNow, throughDay: 19 }, percent: 45 } })
  assert.equal(salaryAdvanceThroughDay(noRules), 19)
  assert.equal(salaryAdvancePercent(noRules), 45)
  assert.equal(salaryAdvanceThroughDay(elig({ salaryAdvance: { rules: null, earned: null } })), 20)
  assert.equal(salaryAdvanceThroughDay(null), 20)
  assert.equal(salaryAdvancePercent(undefined), 50)
  assert.equal(salaryAdvanceDaysOf(null), 'the 21st and 22nd')
  // the server's cap on any amount
  assert.equal(salaryAdvanceProblem('1,00,00,000', null, null), 'The amount cannot be more than ₹99,99,999.')
})

test('earned basis: working days = present shifts + paid holidays (current server) and the older meaning', () => {
  const now = normalizeEarned(earnedNow)!
  assert.equal(now.presentShifts, 15.5)
  assert.equal(now.holidayDays, 1)
  const v = earnedBasisView(now, 26000)!
  assert.deepEqual(
    v.figures.find((f) => f.key === 'days'),
    { key: 'days', label: 'Working days', value: '16.5', hint: '15.5 present + 1 holiday' },
  )
  assert.equal(workingDaysHint({ workingDays: 18, presentShifts: 16, holidayDays: 2, paidDays: 18 }), '16 present + 2 holidays')
  assert.equal(workingDaysHint({ workingDays: 18, presentShifts: 18, holidayDays: 0, paidDays: 18 }), 'present shifts')
  // holidayDays missing but paidDays given: the difference
  assert.equal(workingDaysHint({ workingDays: 18, presentShifts: 17.5, holidayDays: null, paidDays: 18 }), '17.5 present + 0.5 holidays')
  // an older server: workingDays = present shifts, paidDays apart (unchanged wording)
  assert.equal(workingDaysHint({ workingDays: 15.5, presentShifts: null, holidayDays: null, paidDays: 16.5 }), 'present shifts; 16.5 paid with holidays')
  assert.equal(normalizeEarned({ earnedAmount: 1, limit: 0 })?.presentShifts, null)
})

test('Term Loan limit, minimum and over-limit wording mirror the server', () => {
  const t = elig().termLoan
  assert.equal(termLoanLimitText(t), 'Up to ₹26,000 (100% of your monthly salary)')
  assert.equal(termLoanLimitText({ ...t, limitPercent: null }), 'Up to ₹26,000')
  assert.equal(termLoanLimitText({ ...t, limit: null }), null)
  // the server's over_limit sentence (apply_for)
  assert.equal(
    termAmountProblem('30,000', t.minAmount, t.limit, t.limitPercent, t.monthlySalary),
    'The most you can ask for is ₹26,000 (100% of your monthly salary of ₹26,000).',
  )
  assert.equal(termAmountProblem('30,000', 1000, 26000), 'The most you can ask for is ₹26,000.')
  assert.equal(termAmountProblem('26,000', t.minAmount, t.limit, t.limitPercent, t.monthlySalary), null)
  assert.equal(termAmountProblem('500', 1000, 26000, 100, 26000), 'A Term Loan starts from ₹1,000.')
  // Settings may set the minimum to ₹0: ₹0 is still refused, like the server
  assert.equal(termAmountProblem('0', 0, 26000), 'The amount must be more than ₹0.')
  assert.equal(termAmountProblem('', 0, 26000), 'Enter the amount.')
  // no limit known (older server): only the minimum is checked here
  assert.equal(termAmountProblem('5,00,000', 1000, null), null)
})

test('Term Loan months: 1 to the Settings most (6 by default), the form starts on 6 or fewer', () => {
  assert.deepEqual(termMonthChoices({ minMonths: 1, maxMonths: 6 }), [1, 2, 3, 4, 5, 6])
  assert.equal(defaultTermMonths({ minMonths: 1, maxMonths: 6 }), 6)
  assert.deepEqual(termMonthChoices({ minMonths: 1, maxMonths: 3 }), [1, 2, 3])
  assert.equal(defaultTermMonths({ minMonths: 1, maxMonths: 3 }), 3)
  assert.equal(termMonthChoices({ minMonths: 1, maxMonths: 12 }).length, 12)
  assert.equal(defaultTermMonths({ minMonths: 1, maxMonths: 12 }), 6)
  assert.equal(termMonthChoices({ minMonths: 1, maxMonths: 40 }).length, 12)
  assert.deepEqual(termMonthChoices({ minMonths: 0, maxMonths: 2 }), [1, 2])
  assert.equal(defaultTermMonths({ minMonths: 8, maxMonths: 10 }), 8)
  assert.equal(termLoanServiceMonths(elig()), 6)
  // 0 months of service in Settings is kept (never `|| 6`)
  assert.equal(termLoanServiceMonths(elig({ termLoan: { service: { ...serviceShort, requiredMonths: 0, eligible: true } } })), 0)
  assert.equal(termLoanServiceMonths(elig({ termLoan: { service: null, rules: { ...tlRulesRaw, minServiceMonths: 3 } } })), 3)
  assert.equal(termLoanServiceMonths(null), 6)
})

test('Term Loan block: the server reason, and the next step by code (shared app behaviour)', () => {
  // eligible: nothing to say
  assert.deepEqual(termLoanBlock(elig()), { hidden: false, reason: null, action: null, showService: false })
  // service: the bar and the date it opens
  const service = termLoanBlock(
    elig({ termLoan: { canApply: false, code: 'service', reason: serviceShort.reason, service: serviceShort, nextEligibleOn: '2026-12-01' } }),
  )
  assert.equal(service.reason, serviceShort.reason)
  assert.equal(service.showService, true)
  assert.deepEqual(service.action, { kind: 'date', text: 'You can apply again from 1 December 2026' })
  // service without nextEligibleOn: the service's own date; without a joining date: the reason only
  assert.deepEqual(
    termLoanBlock(elig({ termLoan: { canApply: false, code: 'service', reason: 'x', service: serviceShort, nextEligibleOn: null } })).action,
    { kind: 'date', text: 'You can apply again from 1 December 2026' },
  )
  assert.equal(
    termLoanBlock(
      elig({ termLoan: { canApply: false, code: 'service', reason: 'x', service: { ...serviceShort, eligibleFrom: null }, nextEligibleOn: null } }),
    ).action,
    null,
  )
  // yearly / rejected this month: the date, never the service bar (even when the service rule is not met either)
  const yearly = termLoanBlock(
    elig({ termLoan: { canApply: false, code: 'yearly', reason: 'A Term Loan can be given once a year.', nextEligibleOn: '2027-01-01', service: serviceShort } }),
  )
  assert.deepEqual(yearly.action, { kind: 'date', text: 'You can apply again from 1 January 2027' })
  assert.equal(yearly.showService, false)
  assert.deepEqual(
    termLoanBlock(elig({ termLoan: { canApply: false, code: 'rejected_this_month', reason: 'r', nextEligibleOn: '2026-12-01' } })).action,
    { kind: 'date', text: 'You can apply again from 1 December 2026' },
  )
  // pending: the waiting request (pending.id; open.id when only that is sent)
  assert.deepEqual(
    termLoanBlock(elig({ termLoan: { canApply: false, code: 'pending', reason: 'r', pending: { id: 41, amount: 9000 } } })).action,
    { kind: 'open', id: 41, text: 'See your waiting request' },
  )
  assert.deepEqual(
    termLoanBlock(elig({ termLoan: { canApply: false, code: 'pending', reason: 'r', pending: null, open: { id: 42, status: 'pending', amount: 1 } } })).action,
    { kind: 'open', id: 42, text: 'See your waiting request' },
  )
  // active: the loan being repaid (open.id); none sent -> the reason only
  assert.deepEqual(
    termLoanBlock(elig({ termLoan: { canApply: false, code: 'active', reason: 'r', open: { id: 7, status: 'approved', amount: 20000 } } })).action,
    { kind: 'open', id: 7, text: 'See the loan being repaid' },
  )
  assert.equal(termLoanBlock(elig({ termLoan: { canApply: false, code: 'active', reason: 'r', open: null } })).action, null)
  // no salary / limit below the minimum (2026-11-28): the reason only
  const below = termLoanBlock(elig({ termLoan: { canApply: false, code: 'below_minimum', reason: 'Your Term Loan limit is ₹800.', limit: 800 } }))
  assert.deepEqual(below, { hidden: false, reason: 'Your Term Loan limit is ₹800.', action: null, showService: false })
  assert.equal(termLoanBlock(elig({ termLoan: { canApply: false, code: 'no_salary', reason: 'r' } })).action, null)
  // staff only: not offered at all
  assert.equal(termLoanBlock(elig({ termLoan: { canApply: false, code: 'staff_only', reason: 'r' } })).hidden, true)
  // the account / switched-off workflow blocks both forms: code null, the reason only (no service bar with rules present)
  const common = termLoanBlock(
    elig({ termLoan: { canApply: false, code: null, reason: 'Advance requests are switched off right now.', service: serviceShort } }),
  )
  assert.equal(common.reason, 'Advance requests are switched off right now.')
  assert.equal(common.showService, false)
  // a server before codes and rules (26 Nov): the service bar whenever the service rule is not met
  const legacy = termLoanBlock(
    elig({ termLoan: { canApply: false, code: undefined, rules: undefined, reason: serviceShort.reason, service: serviceShort } }),
  )
  assert.equal(legacy.showService, true)
  assert.equal(legacy.action, null)
  // no reason sent: a plain one
  assert.equal(termLoanBlock(elig({ termLoan: { canApply: false, reason: null } })).reason, 'You cannot apply for a Term Loan right now.')
})

const waitingWithHr = {
  id: 31,
  advanceType: 'general',
  typeLabel: 'Salary Advance',
  status: 'pending',
  statusLabel: 'Waiting for HR',
  reviewStatus: 'with_hr',
  reviewLabel: 'With HR',
  inWorkflow: false,
  canWithdraw: true,
  amount: 4800,
  requestedAmount: 4800,
  approvedAmount: null,
  approvedLess: false,
  approvedMore: false,
  appliedBy: 'employee',
  decisionRemark: '',
  decidedAt: null,
  history: [],
  earnings: {
    month: 11,
    year: 2026,
    throughDay: 20,
    fixedSalary: 26000,
    workingDays: 16.5,
    presentShifts: 15.5,
    holidayDays: 1,
    paidDays: 16.5,
    earnedAmount: 16500,
    workingSalary: 16500,
    percent: 50,
    limit: 8250 as number | null,
  },
  termLimit: null,
}
const underReview = {
  ...waitingWithHr,
  id: 32,
  statusLabel: 'Under review',
  reviewStatus: 'under_review',
  reviewLabel: 'Under review',
  inWorkflow: true,
  canWithdraw: false,
}
const roundedUp = {
  ...waitingWithHr,
  id: 33,
  status: 'approved',
  statusLabel: 'Approved',
  reviewStatus: null,
  reviewLabel: null,
  canWithdraw: false,
  amount: 5000,
  requestedAmount: 4800,
  approvedAmount: 5000,
  approvedMore: true,
  decisionRemark: 'Rounded to the nearest ₹500.',
  decidedAt: '2026-11-25T10:00:00+05:30',
  history: [
    { id: 2, action: 'approved', requestedAmount: 4800, approvedAmount: 5000, startMonth: 11, startYear: 2026, remark: 'Rounded to the nearest ₹500.', by: 'Meena', at: '2026-11-25T10:00:00+05:30' },
    { id: 1, action: 'reopened', requestedAmount: 4800, approvedAmount: null, remark: '', by: 'Meena', at: '2026-11-24T10:00:00+05:30' },
    { id: 0, action: 'odd' },
  ],
}

test('a waiting application: "With HR" (deletable) or "Under review" (not), never the steps after HR', () => {
  const hr = normalizeAdvance(waitingWithHr)!
  assert.equal(hr.reviewStatus, 'with_hr')
  assert.equal(hr.reviewLabel, 'With HR')
  assert.equal(hr.canWithdraw, true)
  assert.equal(hr.inWorkflow, false)
  assert.equal(statusText(hr), 'With HR')
  assert.equal(reviewText(hr), 'With HR')
  assert.equal(deleteRowText(hr), 'Still with HR, so you can delete this request.')
  const ur = normalizeAdvance(underReview)!
  assert.equal(ur.reviewStatus, 'under_review')
  assert.equal(ur.inWorkflow, true)
  assert.equal(ur.canWithdraw, false)
  assert.equal(statusText(ur), 'Under review')
  assert.match(deleteRowText(ur) ?? '', /under review, so it can no longer be deleted/)
  // an older server: no reviewLabel -> the server's statusLabel -> "Waiting for HR"; Withdraw for the employee's own
  const old = normalizeAdvance({ id: 5, status: 'pending', statusLabel: 'Waiting for HR', appliedBy: 'employee' })!
  assert.equal(old.reviewLabel, null)
  assert.equal(old.canWithdraw, true)
  assert.equal(statusText(old), 'Waiting for HR')
  assert.equal(reviewText({ status: 'pending' }), 'Waiting for HR')
  // one HR recorded: never deletable by the employee
  const byHr = normalizeAdvance({ id: 6, status: 'pending', appliedBy: 'hr' })!
  assert.equal(byHr.canWithdraw, false)
  assert.equal(deleteRowText(byHr), 'HR recorded this request, so only HR can change it.')
  // a decided application is never deletable, whatever a server says; no review label either
  const decided = normalizeAdvance({ ...waitingWithHr, status: 'approved', canWithdraw: true, reviewLabel: 'With HR', reviewStatus: 'with_hr' })!
  assert.equal(decided.canWithdraw, false)
  assert.equal(decided.reviewLabel, null)
  assert.equal(decided.reviewStatus, null)
  assert.equal(reviewText(decided), null)
  assert.equal(deleteRowText(decided), null)
  // an older server that only flags inWorkflow: not deletable
  assert.equal(normalizeAdvance({ id: 7, status: 'pending', appliedBy: 'employee', inWorkflow: true })!.canWithdraw, false)
})

test('approved amount above or below the ask, the remark and the decisions', () => {
  const up = normalizeAdvance(roundedUp)!
  assert.equal(up.approvedMore, true)
  assert.equal(up.approvedLess, false)
  assert.equal(approvedAmountText(up), 'Approved ₹5,000 (rounded up from ₹4,800 asked)')
  assert.equal(askedNote(up), 'rounded up from ₹4,800 asked')
  const less = normalizeAdvance(approvedRow)!
  assert.equal(approvedAmountText(less), 'Approved ₹8,000 of ₹10,000 asked')
  assert.equal(askedNote(less), 'of ₹10,000 asked')
  const same = normalizeAdvance({ ...roundedUp, amount: 4800, approvedAmount: 4800, approvedMore: false })!
  assert.equal(approvedAmountText(same), 'Approved ₹4,800')
  assert.equal(askedNote(same), null)
  assert.equal(approvedAmountText(normalizeAdvance(waitingWithHr)!), null)
  // an older server without the flags: worked out from the amounts
  const oldUp = normalizeAdvance({ id: 9, status: 'approved', amount: 5000, requestedAmount: 4800, approvedAmount: 5000 })!
  assert.equal(oldUp.approvedMore, true)
  const oldLess = normalizeAdvance({ id: 9, status: 'closed', amount: 4000, requestedAmount: 4800 })!
  assert.equal(oldLess.approvedAmount, 4000)
  assert.equal(oldLess.approvedLess, true)
  // the remark: decisionRemark, else notes; "Reason" on a rejection, "Remark" on an approval; none while waiting
  assert.equal(decisionRemarkOf(up), 'Rounded to the nearest ₹500.')
  assert.equal(remarkLine(up), 'Remark: Rounded to the nearest ₹500.')
  const rejected = normalizeAdvance({ id: 10, status: 'rejected', decisionRemark: 'Two advances already this year.', amount: 3000 })!
  assert.equal(remarkLine(rejected), 'Reason: Two advances already this year.')
  const oldRejected = normalizeAdvance({ id: 11, status: 'rejected', decisionRemark: '', notes: 'Not eligible this month.', amount: 3000 })!
  assert.equal(remarkLine(oldRejected), 'Reason: Not eligible this month.')
  assert.equal(remarkLine(normalizeAdvance({ id: 12, status: 'rejected', amount: 1 })!), null)
  assert.equal(decisionRemarkOf(normalizeAdvance({ ...waitingWithHr, notes: 'internal' })!), null)
  // the decisions, newest first; unknown actions dropped
  assert.equal(up.history.length, 2)
  assert.deepEqual(up.history.map(decisionTitle), ['Approved ₹5,000', 'Reopened by HR'])
  assert.equal(up.history[1].remark, null)
  assert.equal(decisionTitle({ action: 'rejected', approvedAmount: null }), 'Rejected')
  assert.equal(decisionTitle({ action: 'approved', approvedAmount: null }), 'Approved')
  assert.equal(up.decidedAt, '2026-11-25T10:00:00+05:30')
})

test('the limit an application was asked against', () => {
  const sa = normalizeAdvance(waitingWithHr)!
  assert.equal(sa.earnings?.earnedAmount, 16500)
  assert.equal(
    limitWhenAppliedText(sa),
    'Your limit was 50% of the ₹16,500 you earned from the 1st to the 20th of November 2026 (16.5 working days): ₹8,250.',
  )
  const tl = normalizeAdvance({ id: 20, advanceType: 'term', status: 'pending', amount: 20000, termLimit: 26000 })!
  assert.equal(tl.termLimit, 26000)
  assert.equal(limitWhenAppliedText(tl), 'Your Term Loan limit when you applied: ₹26,000.')
  assert.equal(limitWhenAppliedText({ ...tl, termLimit: null }), '')
  assert.equal(limitWhenAppliedText({ ...sa, earnings: null, salaryAtRequest: 26000 }), 'Your monthly salary when you applied: ₹26,000.')
  assert.equal(limitWhenAppliedText({ ...sa, earnings: null, salaryAtRequest: null }), '')
  // the kept figures without a limit are not shown (nothing to name)
  assert.equal(normalizeAdvance({ ...waitingWithHr, earnings: { ...waitingWithHr.earnings, limit: null } })!.earnings, null)
})

test('copy follows the method: never "a smaller amount" under the Automation Method', () => {
  assert.equal(reviewSentence('normal'), 'HR approves every application.')
  assert.equal(reviewSentence('automation'), 'HR reviews every application first; then it is under review for approval.')
  assert.equal(approvalNoteText('normal', 'general'), 'HR may approve a smaller amount or change the month deductions start.')
  const autoSa = approvalNoteText('automation', 'general')
  assert.match(autoSa, /rounded to the nearest ₹500 within your limit/)
  assert.doesNotMatch(autoSa, /smaller/)
  assert.doesNotMatch(approvalNoteText('automation', 'term'), /smaller|₹500/)
  assert.equal(scheduleLook({ state: 'planned' }).stateLabel, 'Planned (until it is decided)')
})

test('a refused application: the server sentence, next to the field it names; any answer goes back to the form', () => {
  const overLimit = 'The most you can ask for is ₹8,250 (50% of the ₹16,500 you earned from the 1st to the 20th).'
  assert.deepEqual(applyRefusal({ status: 400, message: 'x', data: { error: overLimit, code: 'over_limit', field: 'amount' } }), {
    text: overLimit,
    code: 'over_limit',
    field: 'amount',
    toForm: true,
  })
  const duplicate = 'You already have a Salary Advance for November 2026. Only one is allowed each month.'
  assert.deepEqual(applyRefusal({ status: 409, data: { error: duplicate, code: 'duplicate' } }), {
    text: duplicate,
    code: 'duplicate',
    field: null,
    toForm: true,
  })
  assert.equal(
    applyRefusal({ status: 400, data: { error: 'A Term Loan is repaid in 1 to 6 months.', code: 'invalid', field: 'repaymentMonths' } }).field,
    'repaymentMonths',
  )
  assert.equal(applyRefusal({ status: 400, data: { error: 'Tell HR briefly what the money is for.', code: 'invalid', field: 'purpose' } }).field, 'purpose')
  assert.equal(applyRefusal({ status: 400, data: { error: 'x', code: 'invalid', field: 'somethingElse' } }).field, null)
  assert.equal(applyRefusal({ status: 403, data: { error: 'A Term Loan needs 6 months of service.', code: 'service' } }).toForm, true)
  assert.equal(applyRefusal({ status: 400, data: { error: 'r', code: 'below_minimum' } }).code, 'below_minimum')
  // no body: the error's message, then a plain sentence
  assert.equal(applyRefusal({ status: 400, message: 'Bad request' }).text, 'Bad request')
  assert.equal(applyRefusal({ status: 400 }).text, 'Your application could not be sent. Please try again.')
  // the server failed: stay on the confirmation so Send can be tried again
  assert.equal(applyRefusal({ status: 500, data: { error: 'Server error' } }).toForm, false)
  // nothing answered
  assert.deepEqual(applyRefusal({ message: 'Network Error' }), {
    text: 'Could not send your application. Check your connection and try again.',
    code: null,
    field: null,
    toForm: false,
  })
  assert.equal(applyRefusal(null).toForm, false)
})

// Run with `npm test`. Dashboard rules (lib/home-attention.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  advanceAttention,
  calendarDaysUntil,
  casualLeaveAttention,
  dayCountText,
  dayMonth,
  daysLeftInMonth,
  formatSpan,
  formatTicker,
  inDaysText,
  lastSalary,
  monthSnapshot,
  onDutyAttention,
  openKind,
  outpassAttention,
  parseLocalDate,
  pendingRequestsAttention,
  pickOpenPass,
  readAdvanceEligibility,
  readPendingRequests,
  readSalaryPeriods,
  sortAttention,
  waitedText,
} from './home-attention.ts'

const now = new Date(2026, 9, 31, 15, 0, 0) // 31 Oct 2026, 3 PM local
const nowMs = now.getTime()
const iso = (offsetMin: number) => new Date(nowMs + offsetMin * 60_000).toISOString()

describe('dates', () => {
  test('parseLocalDate reads local midnight', () => {
    const d = parseLocalDate('2026-11-05')!
    assert.equal(d.getDate(), 5)
    assert.equal(d.getMonth(), 10)
    assert.equal(parseLocalDate('soon'), null)
    assert.equal(parseLocalDate(null), null)
  })
  test('calendarDaysUntil and inDaysText', () => {
    assert.equal(calendarDaysUntil('2026-10-31', now), 0)
    assert.equal(calendarDaysUntil('2026-11-01', now), 1)
    assert.equal(calendarDaysUntil('2026-11-05', now), 5)
    assert.equal(calendarDaysUntil('2026-10-01', now), 0)
    assert.equal(inDaysText(0), 'Today')
    assert.equal(inDaysText(1), 'Tomorrow')
    assert.equal(inDaysText(5), 'In 5 days')
  })
  test('daysLeftInMonth', () => {
    assert.equal(daysLeftInMonth(now), 0)
    assert.equal(daysLeftInMonth(new Date(2026, 9, 25)), 6)
    assert.equal(daysLeftInMonth(new Date(2026, 1, 1)), 27)
  })
  test('dayMonth', () => {
    assert.equal(dayMonth('2026-11-20'), '20 Nov')
    assert.equal(dayMonth(''), '')
  })
})

describe('gate pass', () => {
  const base = { id: 1, status: 'approved', createdAt: iso(-120) }
  test('openKind', () => {
    assert.equal(openKind({ ...base, status: 'pending' }, nowMs), null)
    assert.equal(openKind({ ...base, exitedAt: iso(-10) }, nowMs), 'out')
    assert.equal(openKind({ ...base, exitedAt: iso(-10), enteredAt: iso(-2) }, nowMs), null)
    assert.equal(openKind({ ...base, expiresAt: iso(20) }, nowMs), 'ready')
    assert.equal(openKind({ ...base, expiresAt: iso(-1) }, nowMs), null)
  })
  test('pickOpenPass prefers a pass that is out', () => {
    const ready = { ...base, id: 2, approvedAt: iso(-5), expiresAt: iso(55) }
    const out = { ...base, id: 3, exitedAt: iso(-30) }
    assert.equal(pickOpenPass([ready, out], nowMs)?.id, 3)
    assert.equal(pickOpenPass([ready], nowMs)?.id, 2)
    assert.equal(pickOpenPass([], nowMs), null)
    assert.equal(pickOpenPass(undefined, nowMs), null)
  })
  test('rows for each state', () => {
    const ready = outpassAttention({ ...base, expiresAt: iso(30) }, nowMs)!
    assert.equal(ready.title, 'Gate pass ready')
    assert.match(ready.detail, /30:00 left to go out/)
    assert.equal(ready.tone, 'active')
    assert.ok(Math.abs((ready.progress ?? 0) - 0.5) < 0.01)

    const outNoReturn = outpassAttention({ ...base, exitedAt: iso(-25) }, nowMs)!
    assert.equal(outNoReturn.title, 'Out on a gate pass')
    assert.equal(outNoReturn.detail, 'Out for 25 min')
    assert.equal(outNoReturn.progress, null)

    const outBack = outpassAttention({ ...base, exitedAt: iso(-30), expectedReturnAt: iso(30) }, nowMs)!
    assert.match(outBack.detail, /^Back by .*: 30:00 left$/)
    assert.ok(Math.abs((outBack.progress ?? 0) - 0.5) < 0.01)

    const late = outpassAttention({ ...base, exitedAt: iso(-60), expectedReturnAt: iso(-5) }, nowMs)!
    assert.equal(late.title, 'Return time passed')
    assert.equal(late.tone, 'urgent')
    assert.match(late.detail, /late by 5:00$/)

    assert.equal(outpassAttention(null, nowMs), null)
    assert.equal(outpassAttention({ ...base, expiresAt: iso(-1) }, nowMs), null)
  })
  test('formatSpan / formatTicker', () => {
    assert.equal(formatSpan(45_000), '45 s')
    assert.equal(formatSpan(12 * 60_000), '12 min')
    assert.equal(formatSpan(65 * 60_000), '1 h 05 min')
    assert.equal(formatTicker(65_000), '1:05')
    assert.equal(formatTicker(3_725_000), '1:02:05')
    assert.equal(formatTicker(-65_000), '1:05')
  })
})

describe('On-Duty', () => {
  test('running sessions only', () => {
    assert.equal(onDutyAttention(null), null)
    assert.equal(onDutyAttention({ status: 'completed' }), null)
    const row = onDutyAttention({ status: 'active', destination: 'Client site', isProvisional: true })!
    assert.equal(row.title, 'On-Duty in progress')
    assert.equal(row.detail, 'Client site · waiting for approval')
    assert.equal(row.href, '/employee/attendance-request')
    assert.equal(onDutyAttention({ status: 'active' })!.detail, 'Open it to add your punches')
  })
})

describe('pending requests', () => {
  test('readPendingRequests is defensive', () => {
    assert.equal(readPendingRequests('<html>'), null)
    assert.deepEqual(readPendingRequests({ items: [] }), [])
    const items = readPendingRequests({ items: [{ module: 'leave', moduleLabel: 'Leave', stage: 'Waiting for HR', submittedAt: iso(-60) }, { id: 1 }, null] })!
    assert.equal(items.length, 1)
    assert.equal(items[0].moduleLabel, 'Leave')
  })
  test('one and many', () => {
    assert.equal(pendingRequestsAttention([], nowMs), null)
    const one = pendingRequestsAttention([{ module: 'leave', moduleLabel: 'Leave', title: '', stage: 'Waiting for HR', submittedAt: null }], nowMs)!
    assert.equal(one.title, '1 request waiting for an answer')
    assert.equal(one.detail, 'Leave: Waiting for HR')
    assert.equal(one.href, '/employee/hod?tab=requests')
    const many = pendingRequestsAttention(
      [
        { module: 'leave', moduleLabel: 'Leave', title: '', stage: 's', submittedAt: iso(-60) },
        { module: 'permission', moduleLabel: 'Permission', title: '', stage: 's', submittedAt: iso(-3 * 24 * 60) },
      ],
      nowMs,
    )!
    assert.equal(many.title, '2 requests waiting for an answer')
    assert.equal(many.detail, 'Oldest: Permission, waiting 3 days')
  })
  test('waitedText', () => {
    assert.equal(waitedText(iso(-1), nowMs), 'Sent just now')
    assert.equal(waitedText(iso(-12), nowMs), 'Waiting 12 min')
    assert.equal(waitedText(iso(-180), nowMs), 'Waiting 3 h')
    assert.equal(waitedText(iso(-24 * 60), nowMs), 'Waiting 1 day')
    assert.equal(waitedText(null, nowMs), '')
  })
})

describe('advances', () => {
  const reply = (over: Record<string, unknown> = {}) => ({
    window: { isOpen: true, closesOn: '2026-11-05', daysLeft: 6 },
    workflowEnabled: true,
    employeeActive: true,
    salaryAdvance: { canApply: true },
    termLoan: { canApply: true },
    ...over,
  })
  test('open window', () => {
    const row = advanceAttention(readAdvanceEligibility(reply()))!
    assert.equal(row.title, 'Advance & loan applications are open')
    assert.equal(row.detail, 'Open until 5 Nov')
    assert.equal(row.tone, 'money')
  })
  test('only one kind, last day, closed, workflow off', () => {
    assert.equal(advanceAttention(readAdvanceEligibility(reply({ termLoan: { canApply: false } })))!.title, 'Salary Advance applications are open')
    assert.equal(
      advanceAttention(readAdvanceEligibility(reply({ window: { isOpen: true, closesOn: '2026-10-31', daysLeft: 1 } })))!.detail,
      'Open today only: last day',
    )
    assert.equal(advanceAttention(readAdvanceEligibility(reply({ window: { isOpen: false, closesOn: '', daysLeft: 0 } }))), null)
    // 2026-11-25: each form has its own window; only the Salary Advance's 20th-22nd is news (a Term Loan is open every day)
    const general = { isOpen: true, closesOn: '2026-11-22', daysLeft: 2 }
    const term = { isOpen: true, alwaysOpen: true, closesOn: null, daysLeft: null }
    assert.equal(
      advanceAttention(readAdvanceEligibility(reply({ windows: { general, term } })))!.title,
      'Salary Advance applications are open',
    )
    assert.equal(advanceAttention(readAdvanceEligibility(reply({ windows: { general, term } })))!.detail, 'Open until 22 Nov')
    assert.equal(
      advanceAttention(readAdvanceEligibility(reply({ windows: { general: { ...general, isOpen: false }, term } }))),
      null,
    )
    assert.equal(advanceAttention(readAdvanceEligibility(reply({ workflowEnabled: false }))), null)
    assert.equal(advanceAttention(readAdvanceEligibility(reply({ salaryAdvance: null, termLoan: null }))), null)
    assert.equal(readAdvanceEligibility({}), null)
  })
})

describe('casual leave reminder', () => {
  const month = { month: '2026-10', label: 'October 2026', eligible: true, left: 'full' }
  test('only in the last week, only when something is left', () => {
    assert.equal(casualLeaveAttention([month], new Date(2026, 9, 20)), null)
    const row = casualLeaveAttention([month], now)!
    assert.equal(row.title, "October's Casual Leave not used yet")
    assert.equal(row.detail, '1 day left · the month ends today')
    assert.equal(casualLeaveAttention([{ ...month, left: 'one_half' }], new Date(2026, 9, 29))!.detail, 'Half a day left · the month ends in 2 days')
    assert.equal(casualLeaveAttention([{ ...month, left: 'nothing' }], now), null)
    assert.equal(casualLeaveAttention([{ ...month, eligible: false }], now), null)
    assert.equal(casualLeaveAttention([{ ...month, month: '2026-09' }], now), null)
  })
  test('an older server without `left`', () => {
    assert.equal(casualLeaveAttention([{ month: '2026-10', label: 'October 2026', eligible: true }], now)!.detail, '1 day left · the month ends today')
  })
  test('the yearly balance: unused days carry over, so only the last week of December reminds', () => {
    const nov = { month: '2026-11', label: 'November 2026', eligible: true, left: 'full', rule: 'yearly_balance', remaining: 11 }
    assert.equal(casualLeaveAttention([nov], new Date(2026, 10, 28)), null) // end of November: nothing lapses
    const dec = { ...nov, month: '2026-12', label: 'December 2026', remaining: 2.5 }
    assert.equal(casualLeaveAttention([dec], new Date(2026, 11, 20)), null) // not the last week yet
    const row = casualLeaveAttention([dec], new Date(2026, 11, 28))!
    assert.equal(row.title, 'Your 2026 Casual Leave lapses soon')
    assert.equal(row.detail, '2½ days left · unused days lapse on 31 Dec (in 3 days)')
    assert.equal(casualLeaveAttention([{ ...dec, remaining: 0.5 }], new Date(2026, 11, 31))!.detail, '½ day left · unused days lapse on 31 Dec (today)')
    assert.equal(casualLeaveAttention([{ ...dec, remaining: 0, left: 'nothing' }], new Date(2026, 11, 30)), null)
    assert.equal(casualLeaveAttention([{ ...dec, eligible: false }], new Date(2026, 11, 30)), null)
  })
})

test('sortAttention orders by urgency and drops nulls', () => {
  const rows = sortAttention([
    pendingRequestsAttention([{ module: 'leave', moduleLabel: 'Leave', title: '', stage: 's', submittedAt: null }], nowMs),
    null,
    onDutyAttention({ status: 'active' }),
  ])
  assert.deepEqual(rows.map((r) => r.key), ['onDuty', 'pending'])
})

describe('last salary', () => {
  const period = (over: Record<string, unknown> = {}) => ({
    slipId: 7,
    year: 2026,
    month: 9,
    period: { label: 'September 2026' },
    allocated: 24000,
    earnedGross: 21000,
    attendanceLoss: 3000,
    netPayable: 19500,
    ...over,
  })
  test('the newest period, loss and ratio', () => {
    const periods = readSalaryPeriods({ periods: [period(), period({ slipId: 6, month: 8, period: { label: 'August 2026' } })] })!
    const s = lastSalary(periods)!
    assert.equal(s.slipId, 7)
    assert.equal(s.periodLabel, 'September 2026')
    assert.equal(s.net, 19500)
    assert.equal(s.lossAmount, 3000)
    assert.equal(s.lossKind, 'loss')
    assert.equal(s.paidRatio, 0.875)
  })
  test('nothing lost, production, HR change, empty', () => {
    assert.equal(lastSalary(readSalaryPeriods({ periods: [period({ attendanceLoss: 0 })] }))!.lossKind, 'none')
    const prod = lastSalary(readSalaryPeriods({ periods: [period({ allocated: null, lateDeduction: 120, period: { label: '2 Feb - 8 Feb', cycleLabel: 'Weekly' } })] }))!
    assert.equal(prod.lossLabel, 'late')
    assert.equal(prod.lossAmount, 120)
    assert.equal(prod.paidRatio, null)
    assert.equal(prod.periodLabel, '2 Feb - 8 Feb · Weekly')
    assert.equal(lastSalary(readSalaryPeriods({ periods: [period({ payroll: { bonus: 500 } })] }))!.hrChanged, true)
    assert.equal(lastSalary([]), null)
    assert.equal(readSalaryPeriods({ nope: 1 }), null)
  })
})

describe('month snapshot', () => {
  test('counts only working days so far', () => {
    const s = monthSnapshot(
      [
        { date: '2026-10-01', status: 'present' },
        { date: '2026-10-02', status: 'holiday' },
        { date: '2026-10-03', status: 'half_shift' },
        { date: '2026-10-04', status: 'absent' },
        { date: '2026-10-05', status: 'on_leave' },
        { date: '2026-11-01', status: 'future' },
      ],
      '2026-10-31',
    )
    assert.equal(s.workingDays, 4)
    assert.equal(s.presentDays, 1.5)
    assert.equal(s.absentDays, 1)
    assert.equal(s.leaveDays, 1)
    assert.equal(s.attendancePercent, 38)
    assert.equal(monthSnapshot([], '2026-10-31').attendancePercent, null)
  })
  test('dayCountText', () => {
    assert.equal(dayCountText(21), '21')
    assert.equal(dayCountText(21.5), '21.5')
    assert.equal(dayCountText(20.74), '20.5')
  })
})

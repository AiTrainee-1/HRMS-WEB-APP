// Run with `npm test`. The Leave form rules (lib/leave-form.ts), mirroring the mobile app's leaveForm.test.ts.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PLAIN_LEAVE_TYPE,
  REASON_CATEGORIES,
  buildLeaveBody,
  isReasonCategory,
  leaveDayForMonth,
  leaveDaysText,
  leaveFormProblem,
  leaveTitle,
  reasonCategoryLabel,
} from './leave-form.ts'

test('the four reason categories, in the owner order', () => {
  assert.deepEqual(REASON_CATEGORIES.map((c) => c.label), ['Sick Leave', 'Emergency', 'Personal', 'Other Reasons'])
  assert.equal(isReasonCategory('sick'), true)
  assert.equal(isReasonCategory('casual'), false)
  assert.equal(isReasonCategory('toString'), false)
  assert.equal(reasonCategoryLabel('other'), 'Other Reasons')
  assert.equal(reasonCategoryLabel(''), null)
})

test('the body is what the mobile app sends: plain "Leave" + reasonCategory, never a Casual Leave type', () => {
  const single = buildLeaveBody({ employeeId: '7', reasonCategory: 'sick', mode: 'single', startDate: '2026-10-05', reason: '  Fever and cold ' })
  assert.deepEqual(single, { employeeId: '7', type: PLAIN_LEAVE_TYPE, reasonCategory: 'sick', startDate: '2026-10-05', endDate: '2026-10-05', reason: 'Fever and cold' })
  const range = buildLeaveBody({ employeeId: '7', reasonCategory: 'personal', mode: 'range', startDate: '2026-10-05', endDate: '2026-10-07', reason: 'Family function' })
  assert.equal(range.endDate, '2026-10-07')
  assert.equal(range.isHalfDay, undefined)
  const half = buildLeaveBody({ employeeId: '7', reasonCategory: 'emergency', mode: 'half', startDate: '2026-10-05', endDate: '2026-10-09', halfDaySlot: 'afternoon', reason: 'Bank work' })
  assert.equal(half.endDate, '2026-10-05')
  assert.equal(half.isHalfDay, true)
  assert.equal(half.halfDaySlot, 'afternoon')
  assert.equal(half.type, 'Leave')
})

test('card titles: category first, old types kept, the old "casual" default is plain Leave', () => {
  assert.equal(leaveTitle({ reasonCategory: 'sick' }), 'Sick Leave')
  assert.equal(leaveTitle({ reasonCategory: 'emergency', isHalfDay: true }), 'Emergency · Half day')
  assert.equal(leaveTitle({ type: 'Annual Leave' }), 'Annual Leave')
  assert.equal(leaveTitle({ type: 'casual' }), 'Leave')
  assert.equal(leaveTitle({ type: '' , isHalfDay: true }), 'Half-day leave')
})

test('"taken this month" day of a leave range', () => {
  const today = new Date(2026, 9, 31)
  assert.equal(leaveDayForMonth('2026-09-30', '2026-10-02', today), '2026-10-01')
  assert.equal(leaveDayForMonth('2026-10-12', '2026-10-13', today), '2026-10-12')
  assert.equal(leaveDayForMonth('2026-09-01', '2026-09-03', today), '2026-09-01')
  assert.equal(leaveDayForMonth('2026-11-02', null, today), '2026-11-02')
})

test('days text and the form problems', () => {
  assert.equal(leaveDaysText(1), '1 day')
  assert.equal(leaveDaysText(3), '3 days')
  assert.equal(leaveDaysText(0.5, true), '½ day')
  assert.equal(leaveDaysText(0), '')
  assert.equal(leaveFormProblem({ reasonCategory: '', reason: 'Going home', mode: 'single' }), 'Choose why you need leave.')
  assert.equal(leaveFormProblem({ reasonCategory: 'sick', reason: 'Fever', mode: 'half' }), 'Choose the morning or the afternoon.')
  assert.equal(leaveFormProblem({ reasonCategory: 'sick', reason: 'abc ', mode: 'single' }), 'Please give a reason (at least 5 letters).')
  assert.equal(leaveFormProblem({ reasonCategory: 'sick', reason: 'x'.repeat(301), mode: 'single' }), 'The reason is too long (300 letters at most).')
  assert.equal(leaveFormProblem({ reasonCategory: 'sick', reason: 'Fever and cold', mode: 'half', halfDaySlot: 'morning' }), null)
})

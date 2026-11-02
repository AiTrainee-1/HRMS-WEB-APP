// Run with `npm test`. Where a notification leads, and the words for "this page could not load".
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { loadErrorMessage } from './load-error.ts'
import { dayLabel, groupByDay, isApprovalNudge, notificationTarget, timeOfDay } from './notifications.ts'

describe('notificationTarget', () => {
  test('a compensation notification opens the Compensation page', () => {
    assert.deepEqual(notificationTarget('compensation'), { href: '/employee/compensation', label: 'View compensation' })
  })

  test('a holiday-work notification (sent to the Department Head) opens Manager Approvals', () => {
    assert.deepEqual(notificationTarget('holiday_work'), { href: '/employee/approvals', label: 'Open approvals' })
  })

  test('an approval reminder opens Approvals for a head, and nothing for someone known not to be one', () => {
    assert.deepEqual(notificationTarget('approval_reminder'), { href: '/employee/approvals', label: 'Open approvals' })
    assert.deepEqual(notificationTarget('approval_reminder', { isManager: true }), { href: '/employee/approvals', label: 'Open approvals' })
    assert.equal(notificationTarget('approval_reminder', { isManager: false }), null)
    assert.equal(notificationTarget('holiday_work', { isManager: false }), null)
  })

  test("each request kind opens the employee's own page", () => {
    assert.equal(notificationTarget('leave')?.href, '/employee/leave')
    assert.equal(notificationTarget('permission')?.href, '/employee/permissions')
    assert.equal(notificationTarget('casual_leave')?.href, '/employee/casual-leave')
    assert.equal(notificationTarget('missing_punch')?.href, '/employee/missing-punch')
    assert.equal(notificationTarget('on_duty')?.href, '/employee/attendance-request?mode=onduty')
    assert.equal(notificationTarget('outpass')?.href, '/employee/outpass')
    assert.equal(notificationTarget('attendance')?.href, '/employee/attendance')
    assert.equal(notificationTarget('salary_slip')?.href, '/employee/salary')
    assert.equal(notificationTarget('offer_letter')?.href, '/employee/documents')
    assert.equal(notificationTarget('chat')?.href, '/employee/chat')
  })

  test('"... is waiting for your approval" opens Approvals for a head, the own page otherwise', () => {
    const msg = "Suresh Raj's leave is waiting for your approval."
    assert.equal(notificationTarget('leave', { isManager: true }, msg)?.href, '/employee/approvals')
    assert.equal(notificationTarget('leave', { isManager: false }, msg)?.href, '/employee/leave')
    assert.equal(notificationTarget('leave', { isManager: true }, 'Your leave was approved.')?.href, '/employee/leave')
    assert.equal(isApprovalNudge('leave', msg), true)
    assert.equal(isApprovalNudge('approval_reminder', 'anything'), true)
    assert.equal(isApprovalNudge('leave', 'Your leave was approved.'), false)
  })

  test('anything odd has no link', () => {
    for (const type of ['general', 'visitors', 'other', '', 'Compensation', 'constructor', '__proto__', 'toString', null, undefined]) {
      assert.equal(notificationTarget(type), null, String(type))
    }
  })
})

describe('groupByDay', () => {
  const now = new Date(2026, 9, 31, 15, 0)
  const iso = (d: Date) => d.toISOString()
  test('today, yesterday, a weekday this week, a date, a date last year', () => {
    assert.equal(dayLabel(new Date(2026, 9, 31, 9), now), 'Today')
    assert.equal(dayLabel(new Date(2026, 9, 30, 23), now), 'Yesterday')
    assert.equal(dayLabel(new Date(2026, 9, 27), now), 'Tuesday')
    assert.equal(dayLabel(new Date(2026, 9, 12), now), '12 Oct')
    assert.equal(dayLabel(new Date(2025, 9, 12), now), '12 Oct 2025')
  })

  test('newest day first, newest first within a day, undated last', () => {
    const rows = [
      { id: 'a', at: iso(new Date(2026, 9, 30, 9)) },
      { id: 'b', at: iso(new Date(2026, 9, 31, 8)) },
      { id: 'c', at: 'not a date' },
      { id: 'd', at: iso(new Date(2026, 9, 31, 12)) },
    ]
    const groups = groupByDay(rows, (r) => r.at, now)
    assert.deepEqual(
      groups.map((g) => [g.label, g.items.map((r) => r.id)]),
      [
        ['Today', ['d', 'b']],
        ['Yesterday', ['a']],
        ['Earlier', ['c']],
      ],
    )
  })

  test('timeOfDay', () => {
    assert.equal(timeOfDay(new Date(2026, 9, 31, 0, 5).toISOString()), '12:05 AM')
    assert.equal(timeOfDay(new Date(2026, 9, 31, 13, 30).toISOString()), '1:30 PM')
    assert.equal(timeOfDay('x'), '')
  })
})

describe('loadErrorMessage', () => {
  test('no answer at all is a connection problem, never a raw "Network Error"', () => {
    assert.match(loadErrorMessage({ message: 'Network Error' }, 'your compensation'), /could not reach the server/)
    assert.match(loadErrorMessage(new Error('boom'), 'your compensation'), /could not reach the server/)
    assert.match(loadErrorMessage(null, 'x'), /could not reach the server/)
    assert.match(loadErrorMessage(undefined, 'x'), /could not reach the server/)
  })

  test('a route an older server does not have says so', () => {
    assert.equal(
      loadErrorMessage({ status: 404, message: 'Not Found' }, 'your compensation'),
      'Your compensation is not available on the server yet. Please try again later, or contact HR.',
    )
  })

  test('a server problem is not shown in its own technical words', () => {
    for (const status of [500, 502, 503]) {
      assert.equal(loadErrorMessage({ status, message: 'IntegrityError at /x' }, 'x'), 'The server had a problem. Please try again in a moment.')
    }
  })

  test('another refusal shows the server\'s sentence, or a plain one when there is none', () => {
    assert.equal(loadErrorMessage({ status: 403, message: 'Please sign in as an employee to see this.' }, 'x'), 'Please sign in as an employee to see this.')
    assert.equal(loadErrorMessage({ status: 400, message: '  ' }, 'your details'), 'We could not load your details. Please try again.')
    // A 200 whose body was not the contract carries our own sentence.
    assert.equal(loadErrorMessage({ status: 200, message: 'The server sent an answer this page could not read.' }, 'x'), 'The server sent an answer this page could not read.')
  })
})

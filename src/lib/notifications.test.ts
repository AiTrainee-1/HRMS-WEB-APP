// Run with `npm test`. Where a notification leads, and the words for "this page could not load".
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { loadErrorMessage } from './load-error.ts'
import { notificationTarget } from './notifications.ts'

describe('notificationTarget', () => {
  test('a compensation notification opens the Compensation page', () => {
    assert.deepEqual(notificationTarget('compensation'), { href: '/employee/compensation', label: 'View compensation' })
  })

  test('a holiday-work notification (sent to the Department Head) opens Manager Approvals', () => {
    assert.deepEqual(notificationTarget('holiday_work'), { href: '/employee/approvals', label: 'Open approvals' })
  })

  test('every other type, and anything odd, has no link', () => {
    for (const type of ['leave', 'permission', 'chat', '', 'Compensation', 'constructor', '__proto__', 'toString', null, undefined]) {
      assert.equal(notificationTarget(type), null, String(type))
    }
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

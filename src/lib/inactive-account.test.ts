// Run with `npm test`. An inactive HRMS account (owner 2026-11-25): covered on every signed-in page, signed out after a
// 30-second countdown; the resignation flow keeps its own screen.
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  INACTIVE_LOGOUT_SECONDS,
  accountStatusOf,
  countdownAt,
  countdownSentence,
  shouldBlock,
  statusPollMs,
  type GateInput,
} from './inactive-account.ts'

test('the status is read from accountStatus, else the raw employee status, else unknown', () => {
  assert.equal(accountStatusOf({ accountStatus: 'inactive', employeeStatus: 'inactive' }), 'inactive')
  assert.equal(accountStatusOf({ accountStatus: 'active' }), 'active')
  assert.equal(accountStatusOf({ employeeStatus: 'terminated' }), 'inactive')
  assert.equal(accountStatusOf({ employeeStatus: ' Active ' }), 'active')
  // an older server says nothing: never block on a guess
  assert.equal(accountStatusOf({ role: 'employee', employeeId: '4', name: 'Asha' }), null)
  assert.equal(accountStatusOf(null), null)
  assert.equal(accountStatusOf('inactive'), null)
})

const base: GateInput = {
  signedIn: true,
  status: 'inactive',
  resignationSettled: true,
  resignationApproved: false,
  path: '/employee/dashboard',
}

test('an inactive account is covered on every signed-in page', () => {
  assert.equal(shouldBlock(base), true)
  assert.equal(shouldBlock({ ...base, path: '/employee/settlement' }), true)
  assert.equal(shouldBlock({ ...base, path: '/' }), true)
  // a page whose name merely starts like a sign-in page is still covered
  assert.equal(shouldBlock({ ...base, path: '/employee-login-help' }), true)
})

test('nothing is covered for an active account, signed out, an unknown status, or the sign-in pages', () => {
  assert.equal(shouldBlock({ ...base, status: 'active' }), false)
  assert.equal(shouldBlock({ ...base, status: null }), false)
  assert.equal(shouldBlock({ ...base, signedIn: false }), false)
  assert.equal(shouldBlock({ ...base, path: '/employee-login' }), false)
  assert.equal(shouldBlock({ ...base, path: '/set-password' }), false)
  assert.equal(shouldBlock({ ...base, path: '/verify/E123' }), false)
})

test('the resignation flow keeps its own screen', () => {
  assert.equal(shouldBlock({ ...base, resignationApproved: true }), false)
  assert.equal(shouldBlock({ ...base, resignationSettled: false }), false)
  assert.equal(shouldBlock({ ...base, path: '/account-deactivated' }), false)
  // the resignation page itself is covered like any other
  assert.equal(shouldBlock({ ...base, path: '/employee/resignation' }), true)
})

test('the 30-second countdown follows the clock', () => {
  assert.equal(INACTIVE_LOGOUT_SECONDS, 30)
  const start = 1_000_000
  const deadline = start + 30_000
  assert.deepEqual(countdownAt(deadline, start), { secondsLeft: 30, remaining: 1, done: false })
  assert.deepEqual(countdownAt(deadline, start + 200), { secondsLeft: 30, remaining: 29_800 / 30_000, done: false })
  assert.equal(countdownAt(deadline, start + 15_000).secondsLeft, 15)
  assert.equal(countdownAt(deadline, start + 15_000).remaining, 0.5)
  assert.equal(countdownAt(deadline, start + 29_001).secondsLeft, 1)
  assert.deepEqual(countdownAt(deadline, deadline), { secondsLeft: 0, remaining: 0, done: true })
  // back in a tab that was hidden after the time ran out
  assert.deepEqual(countdownAt(deadline, deadline + 60_000), { secondsLeft: 0, remaining: 0, done: true })
  // a clock that moved backwards never shows more than the whole time
  assert.equal(countdownAt(deadline, start - 10_000).remaining, 1)
})

test('the sentence under the ring', () => {
  assert.equal(countdownSentence(30), 'You will be signed out automatically in 30 seconds.')
  assert.equal(countdownSentence(1), 'You will be signed out automatically in 1 second.')
  assert.equal(countdownSentence(0), 'Signing you out now…')
})

test('asked every minute, every 10 seconds while inactive', () => {
  assert.equal(statusPollMs('active'), 60_000)
  assert.equal(statusPollMs(null), 60_000)
  assert.equal(statusPollMs('inactive'), 10_000)
})

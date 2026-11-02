import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onSignOut, runSignOutCleanups, signOutCleanupCount } from './session-cleanup.ts'

test('runs every registered cleanup, on every sign-out, until unregistered', () => {
  const calls: string[] = []
  const offA = onSignOut(() => calls.push('a'))
  const offB = onSignOut(() => calls.push('b'))
  assert.deepEqual(runSignOutCleanups(), [])
  assert.deepEqual(calls, ['a', 'b'])
  runSignOutCleanups()
  assert.deepEqual(calls, ['a', 'b', 'a', 'b'])
  offA()
  runSignOutCleanups()
  assert.deepEqual(calls, ['a', 'b', 'a', 'b', 'b'])
  offB()
  assert.equal(signOutCleanupCount(), 0)
})

test('a throwing cleanup does not stop the others and its error is returned', () => {
  const calls: string[] = []
  const boom = new Error('boom')
  const off1 = onSignOut(() => {
    throw boom
  })
  const off2 = onSignOut(() => calls.push('after'))
  const errors = runSignOutCleanups()
  assert.deepEqual(errors, [boom])
  assert.deepEqual(calls, ['after'])
  off1()
  off2()
})

test('unregistering twice and registering the same function twice are harmless', () => {
  const fn = () => {}
  const off = onSignOut(fn)
  onSignOut(fn)
  assert.equal(signOutCleanupCount(), 1)
  off()
  off()
  assert.equal(signOutCleanupCount(), 0)
})

test('a cleanup that unregisters itself while running does not skip the next one', () => {
  const calls: string[] = []
  const offSelf = onSignOut(() => {
    calls.push('self')
    offSelf()
  })
  const offNext = onSignOut(() => calls.push('next'))
  runSignOutCleanups()
  assert.deepEqual(calls, ['self', 'next'])
  offNext()
  assert.equal(signOutCleanupCount(), 0)
})

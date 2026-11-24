import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_SERVER_ERROR_TRIES,
  classifySend,
  countOps,
  dueOps,
  newOpId,
  nextTryDelayMs,
  serverMessage,
  syncState,
  type QueuedOp,
} from './offline-ops.ts'

function op(over: Partial<QueuedOp>): QueuedOp {
  return {
    id: 'op-1',
    employeeId: '7',
    kind: 'leave.apply',
    label: 'Leave',
    method: 'POST',
    url: '/leave-requests',
    body: {},
    files: [],
    invalidate: [],
    meta: {},
    idempotencyKey: 'op-1',
    createdAt: 1,
    status: 'pending',
    attempts: 0,
    lastError: null,
    lastTriedAt: null,
    nextTryAt: 0,
    ...over,
  }
}

describe('what one answer means', () => {
  test('only a 2xx takes it off the device', () => {
    assert.deepEqual(classifySend({ status: 201 }), { kind: 'done' })
    assert.deepEqual(classifySend({ status: 200 }), { kind: 'done' })
  })

  test('no answer, busy or down: try again later', () => {
    for (const outcome of [{ noResponse: true }, { status: 0 }, { status: 408 }, { status: 429 }, { status: 503 }]) {
      assert.equal(classifySend(outcome).kind, 'retry', JSON.stringify(outcome))
    }
    assert.equal(classifySend({ status: 409, data: { code: 'request_in_progress' } }).kind, 'retry')
  })

  test('a refusal stays saved as failed, with the server sentence', () => {
    assert.deepEqual(classifySend({ status: 400, data: { error: 'Reason is required' } }), { kind: 'failed', message: 'Reason is required' })
    assert.equal(classifySend({ status: 409, data: { error: 'Already decided' } }).kind, 'failed')
  })

  test('a 500 is retried a few times, then marked failed', () => {
    assert.equal(classifySend({ status: 500 }, 0).kind, 'retry')
    assert.equal(classifySend({ status: 500 }, MAX_SERVER_ERROR_TRIES - 1).kind, 'failed')
  })

  test('401 stops the sync (signed out)', () => {
    assert.deepEqual(classifySend({ status: 401 }), { kind: 'auth' })
  })

  test('an HTML 404 from a Wi-Fi login page is not the server refusing it', () => {
    assert.equal(classifySend({ status: 404, data: '<html>' }).kind, 'retry')
    assert.equal(classifySend({ status: 404, data: { error: 'Not found' } }).kind, 'failed')
  })

  test('server sentence fallbacks', () => {
    assert.equal(serverMessage({ detail: 'Nope' }), 'Nope')
    assert.equal(serverMessage('<html>', 400), 'The server could not accept this (error 400).')
  })
})

describe('when and in which order', () => {
  test('backoff: 30 s, 1 min, 2 min ... at most 15 min', () => {
    assert.equal(nextTryDelayMs(1), 30_000)
    assert.equal(nextTryDelayMs(2), 60_000)
    assert.equal(nextTryDelayMs(3), 120_000)
    assert.equal(nextTryDelayMs(20), 15 * 60_000)
  })

  test('oldest first, only the employee own, only due and pending', () => {
    const ops = [
      op({ id: 'b', createdAt: 2 }),
      op({ id: 'a', createdAt: 1 }),
      op({ id: 'c', createdAt: 3, nextTryAt: 999 }),
      op({ id: 'd', createdAt: 0, status: 'failed' }),
      op({ id: 'e', createdAt: 0, employeeId: '8' }),
    ]
    assert.deepEqual(dueOps(ops, '7', 10).map((o) => o.id), ['a', 'b'])
    assert.deepEqual(dueOps(ops, '7', 10, true).map((o) => o.id), ['a', 'b', 'c'])
    assert.deepEqual(countOps(ops, '7'), { pending: 3, failed: 1 })
  })

  test('ids are unique enough and readable', () => {
    assert.match(newOpId(1000, () => 0.5), /^op-rs-i{16}$/)
    assert.notEqual(newOpId(), newOpId())
  })

  test('the status shown', () => {
    assert.equal(syncState({ online: false, syncing: false, pending: 3 }), 'offline')
    assert.equal(syncState({ online: true, syncing: true, pending: 3 }), 'syncing')
    assert.equal(syncState({ online: true, syncing: false, pending: 3 }), 'pending')
    assert.equal(syncState({ online: true, syncing: false, pending: 0 }), 'online')
  })
})

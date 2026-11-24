import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPunchTiles } from './onduty-punches.ts'
import { queuedOtCount, queuedPunchNumbers, withQueuedPunches, type QueuedOnDutyLike } from './onduty-queued.ts'

const op = (kind: string, meta: Record<string, unknown>, status: 'pending' | 'failed' = 'pending'): QueuedOnDutyLike => ({ kind, status, meta })

describe('On-Duty punches saved offline', () => {
  const ops = [
    op('onDuty.punch', { punchNumber: 1, sessionId: 5, time: '9:04 am' }),
    op('onDuty.punch', { punchNumber: 2, sessionId: 9, time: '1:00 pm' }),
    op('onDuty.punch', { punchNumber: 3, sessionId: 5 }, 'failed'),
    op('onDuty.otPunch', { sessionId: 5 }),
    op('onDuty.otPunch', { sessionId: 9 }),
    op('leave.apply', {}),
  ]

  test('only this session, only waiting ones', () => {
    assert.deepEqual([...queuedPunchNumbers(ops, 5).entries()], [[1, '9:04 am']])
    assert.equal(queuedOtCount(ops, 5), 1)
  })

  test('a saved punch shows as taken and cannot be chosen again', () => {
    const tiles = buildPunchTiles({ slots: [], canPunch: true })
    const shown = withQueuedPunches(tiles, queuedPunchNumbers(ops, 5))
    assert.equal(shown[0].state, 'done')
    assert.equal(shown[0].selectable, false)
    assert.equal(shown[0].statusLabel, 'Saved · waiting to sync')
    assert.equal(shown[0].time, '9:04 am')
    assert.equal(shown[1].state, 'open')
    assert.equal(shown[2].selectable, true)
  })

  test('the server state wins once it has the punch', () => {
    const tiles = buildPunchTiles({
      slots: [{ punchNumber: 1, available: false, status: 'approved', punchTime: '09:04' }] as never,
      canPunch: true,
    })
    const shown = withQueuedPunches(tiles, queuedPunchNumbers(ops, 5))
    assert.equal(shown[0].statusLabel, 'Approved')
  })
})

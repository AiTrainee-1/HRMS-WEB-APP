// Run with `npm test`. The "already asked for this day" reminder (lib/missing-punch-overlap.ts), the mobile app's vectors.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { overlapNotice, punchOverlap, shortDay, stateWords } from './missing-punch-overlap.ts'
import type { ApprovalProgress } from '../types/index.ts'

const waitingHod: ApprovalProgress = {
  workflow: 'missing_punch', label: 'Missing Punch', enabled: true, steps: [], currentStep: 0, waitingFor: ['hod'],
  canAct: { hod: true, hr: false },
}

const rows = [
  { id: 5, date: '2026-10-30', punchSlot: 'lunch_out', status: 'pending_hod', approval: waitingHod },
  { id: 4, date: '2026-10-30', punchSlot: 'morning_in', status: 'approved' },
  { id: 3, date: '2026-10-30', punchSlot: 'evening_out', status: 'rejected' },
  { id: 2, date: '2026-10-29', punchSlot: 'lunch_out', status: 'pending_hr' },
  { id: 1, date: '2026-10-30', punchSlot: null, punchType: 'OUT', status: 'pending_hr' },
]

test('words', () => {
  assert.equal(shortDay('2026-10-30'), '30 Oct')
  assert.equal(stateWords(rows[0]), 'waiting for your Department Head')
  assert.equal(stateWords(rows[1]), 'approved')
  assert.equal(stateWords(rows[4]), 'waiting for approval')
})

test('same punch vs the day\'s other punches; rejected and other days ignored', () => {
  const { same, others } = punchOverlap(rows, '2026-10-30', 'lunch_out')
  assert.deepEqual(same.map((r) => r.id), [5])
  assert.deepEqual(others.map((r) => r.id), [4, 1])
})

test('the reminder lines never block and name each other punch once', () => {
  const n = overlapNotice(rows, '2026-10-30', 'lunch_out')
  assert.equal(n.repeat, 'You already sent a request for Lunch out on 30 Oct (waiting for your Department Head). Send another only if something changed.')
  assert.equal(n.also, 'Also asked for this day: Morning in (approved), Check-out (waiting for approval)')
  const free = overlapNotice(rows, '2026-10-30', 'evening_out')
  assert.equal(free.repeat, null) // the evening one was rejected
  assert.deepEqual(overlapNotice([], '2026-10-30', 'morning_in'), { repeat: null, also: null })
  const twice = overlapNotice([rows[0], { ...rows[0], id: 9, status: 'approved' }], '2026-10-30', 'lunch_out')
  assert.equal(twice.repeat, 'You already sent 2 requests for Lunch out on 30 Oct (approved). Send another only if something changed.')
})

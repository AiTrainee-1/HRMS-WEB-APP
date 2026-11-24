// Run with `npm test`. The overtime (OT) punches after the four (lib/onduty-overtime.ts), the mobile app's vectors.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { otRows, otSummary, overtimeStage } from './onduty-overtime.ts'

test('server OT punches in order, rejected ones left out, numbered from 1', () => {
  const rows = otRows([
    { sequence: 2, punchTime: '20:15:00', status: 'pending' },
    { sequence: 1, punchTime: '19:05:00', status: 'approved' },
    { sequence: 3, punchTime: '20:30:00', status: 'rejected' },
  ])
  assert.deepEqual(rows.map((r) => [r.number, r.time, r.state, r.label]), [
    [1, '7:05 PM', 'approved', 'Approved'],
    [2, '8:15 PM', 'pending', 'Waiting for approval'],
  ])
  assert.deepEqual(otRows(undefined), [])
})

test('the OT summary', () => {
  assert.equal(otSummary(80), '1 h 20 min past your Night Punch time')
  assert.equal(otSummary(0), null)
  assert.equal(otSummary(null), null)
})

test('after the four: choose first, then OT; nothing while the four are not in or the day is closed', () => {
  assert.equal(overtimeStage({ allFourIn: true, open: true, continued: false, otCount: 0 }), 'choose')
  assert.equal(overtimeStage({ allFourIn: true, open: true, continued: true, otCount: 0 }), 'overtime')
  assert.equal(overtimeStage({ allFourIn: true, open: true, continued: false, otCount: 2 }), 'overtime')
  assert.equal(overtimeStage({ allFourIn: false, open: true, continued: true, otCount: 0 }), 'none')
  assert.equal(overtimeStage({ allFourIn: true, open: false, continued: true, otCount: 1 }), 'none')
})

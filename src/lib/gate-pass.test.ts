// Run with `npm test`. What the gate pass card says (lib/gate-pass.ts), the mobile app's vectors plus the web's rows.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gatePassApprovalText, gatePassFileName, gatePassPurpose, gatePassView, personFromEmployee } from './gate-pass.ts'

test('a pass waiting for approval never shows a QR, even if one was sent (On-Duty or manual)', () => {
  for (const source of ['on_duty', 'manual']) {
    const v = gatePassView({ id: 1, status: 'pending', source, qrToken: 'P.abc', returnQrToken: 'R.abc' })
    assert.equal(v.state, 'waiting')
    assert.equal(v.qr, null)
    assert.equal(v.awaitingApproval, true)
    assert.equal(v.title, 'Pending approval')
  }
})

test('approved with a QR is valid; rejected never shows one', () => {
  const valid = gatePassView({ id: 3, status: 'approved', source: 'manual', qrToken: 'P.x' })
  assert.equal(valid.state, 'valid')
  assert.deepEqual(valid.qr, { value: 'P.x', caption: 'SHOW THIS QR AT THE GATE', kind: 'exit' })
  const rejected = gatePassView({ id: 4, status: 'rejected', source: 'on_duty', qrToken: 'P.x' })
  assert.equal(rejected.state, 'rejected')
  assert.equal(rejected.qr, null)
  assert.equal(rejected.title, 'On-Duty not approved')
})

test('out, return QR, back in', () => {
  assert.equal(gatePassView({ id: 5, status: 'approved', exitedAt: '2026-11-24T10:00:00Z' }).state, 'out')
  const ret = gatePassView({ id: 5, status: 'approved', exitedAt: 'x', returnQrToken: 'R.y' })
  assert.equal(ret.state, 'return-ready')
  assert.equal(ret.qr?.kind, 'return')
  assert.equal(gatePassView({ id: 5, status: 'approved', exitedAt: 'x', enteredAt: 'y' }).state, 'returned')
})

test('an approved pass without a QR any more is not valid now', () => {
  const v = gatePassView({ id: 6, status: 'approved', source: 'on_duty' })
  assert.equal(v.state, 'expired')
  assert.equal(v.title, 'Not valid now')
  assert.equal(v.live, false)
})

test('file name, purpose and approval rows', () => {
  assert.equal(gatePassFileName({ id: 77 }), 'gate-pass-OUT-77.png')
  assert.equal(gatePassPurpose({ source: 'on_duty', passType: 'official' }), 'On-Duty (official work outside)')
  assert.equal(gatePassPurpose({ source: 'manual', passType: 'personal' }), 'Personal Emergency')
  assert.equal(gatePassPurpose({ source: 'manual' }), 'Gate pass')
  assert.equal(gatePassApprovalText({ id: 1, status: 'approved', approvedBy: 'Ravi' }, '24 Nov 2026, 9:00 AM', null), 'Approved by Ravi · 24 Nov 2026, 9:00 AM')
  assert.equal(gatePassApprovalText({ id: 1, status: 'rejected', approvedBy: 'Ravi' }, null, null), 'Not approved (Ravi)')
  assert.equal(gatePassApprovalText({ id: 1, status: 'pending', source: 'on_duty' }, null, 'Waiting for HR'), 'Waiting for the On-Duty approval')
  assert.equal(gatePassApprovalText({ id: 1, status: 'pending', source: 'manual' }, null, 'Waiting for HR'), 'Waiting for HR')
  assert.equal(gatePassApprovalText({ id: 1, status: 'pending' }, null, null), 'Waiting for approval')
})

test('the person on the card from the employee record', () => {
  assert.equal(personFromEmployee(null), null)
  assert.deepEqual(
    personFromEmployee({ firstName: 'Anu', lastName: 'K', employeeCode: 'E12', departmentName: 'Weaving', designationTitle: 'Supervisor', photoUrl: '' }),
    { name: 'Anu K', employeeCode: 'E12', department: 'Weaving', designation: 'Supervisor', photoUrl: null },
  )
})

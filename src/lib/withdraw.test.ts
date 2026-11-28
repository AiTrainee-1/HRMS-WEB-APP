// Run with `npm test`. Withdraw a waiting Leave / Permission / Casual Leave request (owner 2026-11-24), and delete a
// waiting Salary Advance / Term Loan application (module "advance", 2026-11-26).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  canWithdraw,
  isFinalWithdrawRefusal,
  showWithdraw,
  withdrawDoneText,
  withdrawErrorText,
  withdrawId,
  withdrawQuestion,
} from './withdraw.ts'

describe('withdraw', () => {
  test('only a request still waiting can be withdrawn', () => {
    assert.equal(canWithdraw('pending'), true)
    assert.equal(canWithdraw(' Pending '), true)
    for (const s of ['approved', 'rejected', 'withdrawn', 'pending_hr', '', null, undefined, 3]) assert.equal(canWithdraw(s), false, String(s))
  })

  test('ids: numbers or numeric strings', () => {
    assert.equal(withdrawId(42), 42)
    assert.equal(withdrawId('17'), 17)
    for (const id of [0, -1, 1.5, 'abc', '', null, undefined, '12; x']) assert.equal(withdrawId(id), null, String(id))
  })

  test('a Casual Leave HR wrote through an attendance edit has no Withdraw', () => {
    assert.equal(showWithdraw({ id: '5', status: 'pending' }), true)
    assert.equal(showWithdraw({ id: '5', status: 'pending', source: 'employee' }), true)
    assert.equal(showWithdraw({ id: '5', status: 'pending', source: 'hr_edit' }), false)
    assert.equal(showWithdraw({ id: '5', status: 'approved' }), false)
    assert.equal(showWithdraw({ id: null, status: 'pending' }), false)
  })

  test('the words', () => {
    assert.match(withdrawQuestion('leave'), /^Your leave request will be taken back/)
    assert.match(withdrawQuestion('permission', 'permission for 28 Nov'), /^Your permission for 28 Nov/)
    assert.equal(withdrawDoneText('casual_leave', { message: 'Your casual leave request was withdrawn.' }), 'Your casual leave request was withdrawn.')
    assert.equal(withdrawDoneText('casual_leave', {}), 'Your Casual Leave request was withdrawn.')
    assert.equal(withdrawDoneText('leave', null), 'Your leave request was withdrawn.')
  })

  test('an advance application: only while it waits for HR, worded as a delete', () => {
    assert.equal(showWithdraw({ id: 12, status: 'pending' }), true)
    for (const status of ['approved', 'rejected', 'closed']) assert.equal(showWithdraw({ id: 12, status }), false, status)
    assert.equal(
      withdrawQuestion('advance', 'Salary Advance application'),
      'Your Salary Advance application will be deleted and HR will not be asked to decide it. You can apply again later.',
    )
    assert.match(withdrawQuestion('advance'), /^Your advance application will be deleted/)
    assert.equal(
      withdrawDoneText('advance', { withdrawn: true, module: 'advance', id: 12, message: 'Your Term Loan application was withdrawn.' }),
      'Your Term Loan application was withdrawn.',
    )
    assert.equal(withdrawDoneText('advance', {}), 'Your advance application was withdrawn.')
    const notPending = 'This Salary Advance application is already approved: only a request that is still waiting for an answer can be withdrawn.'
    assert.equal(withdrawErrorText({ status: 409, data: { error: notPending, code: 'not_pending', status: 'approved' } }), notPending)
  })

  test("a refusal shows the server's sentence", () => {
    assert.equal(
      withdrawErrorText({ status: 409, message: 'x', data: { error: 'This leave request is already approved.', code: 'not_pending' } }),
      'This leave request is already approved.',
    )
    assert.match(withdrawErrorText({ message: 'Network Error' }), /reach the server/)
    assert.match(withdrawErrorText({ status: 500, data: '<html>' }), /could not be withdrawn/)
    assert.match(withdrawErrorText(null), /could not be withdrawn/)
  })

  test('an advance HR already forwarded (409 in_workflow): the server sentence, and the refusal is final', () => {
    const inWorkflow = 'HR has already forwarded this request for approval, so it can no longer be deleted. Please contact HR.'
    const err = { status: 409, message: inWorkflow, data: { error: inWorkflow, code: 'in_workflow' } }
    assert.equal(withdrawErrorText(err), inWorkflow)
    assert.equal(isFinalWithdrawRefusal(err), true)
    const recordedByHr = { status: 409, data: { code: 'recorded_by_hr' } }
    assert.equal(isFinalWithdrawRefusal(recordedByHr), true)
    assert.equal(isFinalWithdrawRefusal({ status: 404 }), true)
    // worth trying again: no answer, a server failure, a refusal that is not about this request
    for (const e of [{}, { status: 500 }, { status: 403 }, { status: 400 }, null, undefined]) assert.equal(isFinalWithdrawRefusal(e), false)
  })
})

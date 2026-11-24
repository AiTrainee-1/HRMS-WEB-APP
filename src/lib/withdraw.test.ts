// Run with `npm test`. Withdraw a waiting Leave / Permission / Casual Leave request (owner 2026-11-24).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { canWithdraw, showWithdraw, withdrawDoneText, withdrawErrorText, withdrawId, withdrawQuestion } from './withdraw.ts'

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

  test("a refusal shows the server's sentence", () => {
    assert.equal(
      withdrawErrorText({ status: 409, message: 'x', data: { error: 'This leave request is already approved.', code: 'not_pending' } }),
      'This leave request is already approved.',
    )
    assert.match(withdrawErrorText({ message: 'Network Error' }), /reach the server/)
    assert.match(withdrawErrorText({ status: 500, data: '<html>' }), /could not be withdrawn/)
    assert.match(withdrawErrorText(null), /could not be withdrawn/)
  })
})

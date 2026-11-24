// Run with `npm test`. The Reject rule (lib/reject-remark.ts): a reason of at least 3 characters, approving needs none.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  REJECT_REMARK_MAX,
  REJECT_REMARK_MESSAGE,
  REJECT_REMARK_MIN,
  cleanRejectRemark,
  isRemarkRequiredError,
  rejectRemarkProblem,
} from './reject-remark.ts'

test('the message names the minimum, in the words the server uses', () => {
  assert.equal(REJECT_REMARK_MIN, 3)
  assert.equal(REJECT_REMARK_MESSAGE, 'Write the reason for rejecting (at least 3 characters).')
})

test('cleanRejectRemark trims, collapses spaces and line breaks, and caps the length', () => {
  assert.equal(cleanRejectRemark('  Was   on\n\n leave  '), 'Was on leave')
  assert.equal(cleanRejectRemark('\t'), '')
  assert.equal(cleanRejectRemark(null), '')
  assert.equal(cleanRejectRemark(undefined), '')
  assert.equal(cleanRejectRemark('x'.repeat(REJECT_REMARK_MAX + 50)).length, REJECT_REMARK_MAX)
})

test('rejectRemarkProblem: empty, blank or short reasons are refused; 3 characters after cleaning pass', () => {
  for (const bad of ['', '   ', '\n\n', 'no', '  ok  ', 'n\n\n', null, undefined]) {
    assert.equal(rejectRemarkProblem(bad), REJECT_REMARK_MESSAGE, JSON.stringify(bad))
  }
  // "a  b" collapses to "a b": 3 characters, enough.
  for (const ok of ['abc', ' a    b ', 'Not on the roster that day']) {
    assert.equal(rejectRemarkProblem(ok), null, JSON.stringify(ok))
  }
})

test('isRemarkRequiredError reads the server code off the error or its response body', () => {
  const refused = Object.assign(new Error(REJECT_REMARK_MESSAGE), { status: 400, data: { error: REJECT_REMARK_MESSAGE, code: 'remark_required' } })
  assert.equal(isRemarkRequiredError(refused), true)
  assert.equal(isRemarkRequiredError({ code: 'remark_required' }), true)
  // Other refusals (not this head's turn, already decided) and network failures are not about the reason.
  assert.equal(isRemarkRequiredError(Object.assign(new Error('Already decided'), { status: 400, data: { code: 'already_decided' } })), false)
  assert.equal(isRemarkRequiredError(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })), false)
  assert.equal(isRemarkRequiredError(Object.assign(new Error('x'), { data: 'oops' })), false)
  assert.equal(isRemarkRequiredError(null), false)
  assert.equal(isRemarkRequiredError('remark_required'), false)
})

// Run with `npm test`. What the sign-in page says for each refused password sign-in (owner 2026-11-25): the server's
// 401 { error, code } -> a title of its own, the server's sentence, and the field to mark.
import test from 'node:test'
import assert from 'node:assert/strict'

import { GENERIC_LOGIN_TITLE, loginFailure } from './login-errors.ts'

/** What lib/api client throws: an ApiError keeps the server's body in `data`. */
const apiError = (status: number, data: unknown) => Object.assign(new Error('x'), { status, data })

test('an unknown employee code: its own title, the server sentence, the code field marked', () => {
  const f = loginFailure(apiError(401, { error: 'This employee code does not exist in HRMS.', code: 'unknown_employee' }))
  assert.deepEqual(f, {
    kind: 'unknown_employee',
    title: 'Employee code not found',
    message: 'This employee code does not exist in HRMS.',
    field: 'identifier',
    fieldNote: 'Check this employee code',
  })
})

test('a wrong password: its own title, the password field marked', () => {
  const f = loginFailure(apiError(401, { error: 'Incorrect password.', code: 'wrong_password' }))
  assert.equal(f.kind, 'wrong_password')
  assert.equal(f.title, 'Incorrect password')
  assert.equal(f.message, 'Incorrect password.')
  assert.equal(f.field, 'password')
  assert.equal(f.fieldNote, 'This password is not correct')
})

test('no password set yet: its own title, no field marked', () => {
  const f = loginFailure(apiError(401, { error: 'No password set. Please set your password first.', code: 'no_password' }))
  assert.equal(f.kind, 'no_password')
  assert.equal(f.title, 'Password not set')
  assert.equal(f.message, 'No password set. Please set your password first.')
  assert.equal(f.field, null)
})

test('the code is read whatever its case, and an axios error or a plain body works too', () => {
  assert.equal(loginFailure(apiError(401, { error: 'Nope', code: ' WRONG_PASSWORD ' })).kind, 'wrong_password')
  assert.equal(loginFailure({ response: { data: { error: 'Nope', code: 'unknown_employee' } } }).kind, 'unknown_employee')
  assert.equal(loginFailure({ error: 'Nope', code: 'no_password' }).kind, 'no_password')
})

test('a code missing from the server sentence still gets a sentence', () => {
  assert.equal(loginFailure(apiError(401, { code: 'unknown_employee' })).message, 'This employee code does not exist in HRMS.')
  assert.equal(loginFailure(apiError(401, { code: 'wrong_password' })).message, 'Incorrect password.')
})

test('an older server (no code) or anything else: the generic notice with the server words', () => {
  const old = loginFailure(apiError(401, { error: 'Invalid credentials' }))
  assert.equal(old.kind, 'other')
  assert.equal(old.title, GENERIC_LOGIN_TITLE)
  assert.equal(old.message, 'Invalid credentials')
  assert.equal(old.field, null)
  assert.equal(loginFailure(apiError(403, { detail: 'Account locked', code: 'locked' })).message, 'Account locked')
  // nothing usable at all: the error's own message, else a plain sentence
  assert.equal(loginFailure(apiError(401, null), 'Request failed').message, 'Request failed')
  assert.equal(loginFailure(null).message, 'Invalid credentials. Please try again.')
})

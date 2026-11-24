import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { RENEW_WHEN_LEFT_MS, readClaims, renewalDue } from './token-claims.ts'

function token(claims: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(claims)}.sig`
}

const NOW = Date.UTC(2026, 10, 24, 10, 0, 0)
const DAY = 24 * 3600 * 1000

describe('reading a sign-in token', () => {
  test('reads the claims, including a non-ASCII name', () => {
    const claims = readClaims(token({ role: 'employee', name: 'Sélvi', kind: 'employee_session' }))
    assert.equal(claims?.name, 'Sélvi')
    assert.equal(claims?.kind, 'employee_session')
  })

  test('anything that is not a JWT reads as nothing', () => {
    assert.equal(readClaims(null), null)
    assert.equal(readClaims(''), null)
    assert.equal(readClaims('abc'), null)
    assert.equal(readClaims('a.%%%.c'), null)
  })
})

describe('when the sign-in is renewed', () => {
  test('a fresh 180-day session is left alone', () => {
    const t = token({ role: 'employee', kind: 'employee_session', exp: (NOW + 179 * DAY) / 1000 })
    assert.equal(renewalDue(t, NOW), false)
  })

  test('a session with less than 170 days left is renewed', () => {
    const t = token({ role: 'employee', kind: 'employee_session', exp: (NOW + RENEW_WHEN_LEFT_MS - DAY) / 1000 })
    assert.equal(renewalDue(t, NOW), true)
  })

  test('an old 7-day token (no session kind) is renewed at once, so the server upgrades it', () => {
    assert.equal(renewalDue(token({ role: 'employee', exp: (NOW + 6 * DAY) / 1000 }), NOW), true)
  })

  test('never for anything but an employee token', () => {
    assert.equal(renewalDue(token({ role: 'hr', exp: 1 }), NOW), false)
    assert.equal(renewalDue('not-a-token', NOW), false)
    assert.equal(renewalDue(null, NOW), false)
  })
})

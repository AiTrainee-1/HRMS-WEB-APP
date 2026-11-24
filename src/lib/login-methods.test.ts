import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { codesForChannel, keepCodeChannel, loginChannelStates } from './login-methods.ts'
import { purposeCodes } from './otp-channel.ts'

const BOTH = { passwordLogin: true, otpLogin: true, otpChannels: { login: ['whatsapp', 'sms'] } }
const SMS_ONLY = { passwordLogin: true, otpLogin: true, otpChannels: { login: ['sms'] } }
const NONE = { passwordLogin: true, otpLogin: false, otpChannels: { login: [] } }

describe('the sign-in methods', () => {
  test('both channels on: both options open, WhatsApp first', () => {
    const states = loginChannelStates(BOTH)
    assert.deepEqual(
      states.map((s) => [s.channel, s.enabled, s.label]),
      [
        ['whatsapp', true, 'WhatsApp OTP'],
        ['sms', true, 'SMS OTP'],
      ],
    )
    assert.ok(states.every((s) => s.lockedReason === null))
  })

  test('a channel HR switched off is locked, with the reason', () => {
    const [wa, sms] = loginChannelStates(SMS_ONLY)
    assert.equal(wa.enabled, false)
    assert.match(wa.lockedReason ?? '', /Not enabled\. WhatsApp sign-in codes are switched off by HR/)
    assert.equal(sms.enabled, true)
    assert.ok(loginChannelStates(NONE).every((s) => !s.enabled))
  })

  test('before the server answers, both are locked as "checking"', () => {
    for (const s of loginChannelStates(null, false)) {
      assert.equal(s.enabled, false)
      assert.equal(s.lockedReason, 'Checking if it is available...')
    }
  })

  test('an older server (codes on, no channel named): both open, the server picks', () => {
    const old = { otpLogin: true, passwordLogin: true }
    assert.ok(loginChannelStates(old).every((s) => s.enabled))
    const codes = purposeCodes(old, 'login')
    assert.deepEqual(codesForChannel(codes, 'sms'), codes)
  })

  test('the code form only offers the chosen channel', () => {
    const codes = purposeCodes(BOTH, 'login')
    assert.deepEqual(codesForChannel(codes, 'sms').channels, ['sms'])
    assert.equal(codesForChannel(purposeCodes(SMS_ONLY, 'login'), 'whatsapp').available, false)
  })

  test('a chosen channel switched off meanwhile sends the page back to the password form', () => {
    assert.equal(keepCodeChannel('whatsapp', BOTH), 'whatsapp')
    assert.equal(keepCodeChannel('whatsapp', SMS_ONLY), null)
    assert.equal(keepCodeChannel(null, BOTH), null)
  })
})

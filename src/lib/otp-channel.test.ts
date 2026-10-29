// Run with `npm test`. The words and rules of the one-time-code screens: which channel the server names (SMS or
// WhatsApp), the neutral wording for an older server that names none, what to say when a code cannot be sent.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import {
  EXPIRED_NOTICE,
  OTP_LENGTH_BY_CHANNEL,
  activateIntro,
  cleanSeconds,
  codeLabel,
  describeOtpFailure,
  digitsOnly,
  enterCodeMessage,
  expiryText,
  formatDuration,
  loginIntro,
  normalizeChannel,
  otpLength,
  resetBadge,
  resetIntro,
  resetUnavailable,
  resolveChannel,
  sendButtonLabel,
  sendHint,
  sentNotice,
  sentNoticeParts,
  switchToCodeLabel,
  type OtpChannel,
} from './otp-channel.ts'

const CHANNELS: Array<OtpChannel | null> = ['sms', 'whatsapp', null]

/** Every sentence of the screens, for one channel (or none). */
function allWords(channel: OtpChannel | null): string[] {
  return [
    sendButtonLabel(channel),
    sendHint(channel),
    sentNotice(channel, '••••1234', 300),
    sentNotice(channel, '', 300),
    loginIntro(channel),
    switchToCodeLabel(channel),
    resetBadge(channel),
    resetIntro(channel),
    resetUnavailable(channel),
    activateIntro(channel),
  ]
}

describe('normalizeChannel / resolveChannel', () => {
  test('knows sms and whatsapp, in any case', () => {
    assert.equal(normalizeChannel('sms'), 'sms')
    assert.equal(normalizeChannel('whatsapp'), 'whatsapp')
    assert.equal(normalizeChannel(' SMS '), 'sms')
    assert.equal(normalizeChannel('WhatsApp'), 'whatsapp')
  })

  test('anything else is "not known": the key missing (older server), another channel, or junk', () => {
    for (const value of [undefined, null, '', ' ', 'email', 'telegram', 'sms2', 0, 1, true, {}, [], ['sms']]) {
      assert.equal(normalizeChannel(value), null, String(value))
    }
  })

  test('resolveChannel takes the first known one, so the request answer beats login-options', () => {
    assert.equal(resolveChannel('sms', 'whatsapp'), 'sms')
    assert.equal(resolveChannel(undefined, 'whatsapp'), 'whatsapp')
    assert.equal(resolveChannel('push', null, 'sms'), 'sms')
    assert.equal(resolveChannel(undefined, null), null)
    assert.equal(resolveChannel(), null)
  })
})

describe('the words follow the channel', () => {
  test('SMS: names SMS everywhere and never says WhatsApp', () => {
    for (const text of allWords('sms')) assert.doesNotMatch(text, /whatsapp/i, text)
    assert.match(sendButtonLabel('sms'), /SMS/)
    assert.match(sendHint('sms'), /SMS/)
    assert.equal(sendHint('sms'), "We'll send a 4-digit code by SMS to the mobile number registered with HR.")
    assert.match(loginIntro('sms'), /SMS/)
    assert.match(switchToCodeLabel('sms'), /SMS/)
    assert.match(resetBadge('sms'), /SMS/)
    assert.match(resetIntro('sms'), /SMS/)
    assert.match(resetUnavailable('sms'), /SMS/)
    assert.match(activateIntro('sms'), /SMS/)
  })

  test('WhatsApp: still says WhatsApp, as before, and never SMS', () => {
    for (const text of allWords('whatsapp')) assert.doesNotMatch(text, /\bSMS\b/, text)
    assert.equal(sendButtonLabel('whatsapp'), 'Send code on WhatsApp')
    assert.equal(sendHint('whatsapp'), "We'll send a 6-digit code to the WhatsApp number registered with HR.")
    assert.equal(loginIntro('whatsapp'), 'Sign in with a one-time code sent to your registered WhatsApp number.')
    assert.equal(switchToCodeLabel('whatsapp'), 'Sign in with a WhatsApp code')
    assert.equal(resetBadge('whatsapp'), 'Reset with WhatsApp')
    assert.equal(resetIntro('whatsapp'), "Enter your employee code and we'll WhatsApp you a code. Enter it here to choose a new password.")
    assert.equal(resetUnavailable('whatsapp'), "Resetting with WhatsApp isn't available right now.")
    assert.equal(activateIntro('whatsapp'), 'New to the portal? Confirm your WhatsApp number, then choose a password.')
  })

  test('not known (older server): neutral, names neither channel, still says what happens', () => {
    for (const text of allWords(null)) {
      assert.doesNotMatch(text, /whatsapp/i, text)
      assert.doesNotMatch(text, /\bSMS\b/, text)
    }
    assert.equal(sendButtonLabel(null), 'Send code')
    assert.equal(switchToCodeLabel(null), 'Sign in with a code')
    assert.equal(resetBadge(null), 'Reset with a code')
    assert.match(sendHint(null), /6-digit code/)
    assert.match(loginIntro(null), /one-time code/)
  })

  test('every channel has every sentence, non-empty, and the three forms differ', () => {
    for (const channel of CHANNELS) for (const text of allWords(channel)) assert.ok(text.trim().length > 0)
    for (const fn of [sendButtonLabel, sendHint, loginIntro, switchToCodeLabel, resetBadge, resetIntro, resetUnavailable, activateIntro]) {
      assert.equal(new Set(CHANNELS.map((c) => fn(c))).size, 3, fn.name)
    }
  })

  test('the hint names the digits of the channel: 4 by SMS, 6 on WhatsApp and when not known', () => {
    assert.match(sendHint('sms'), /4-digit/)
    assert.match(sendHint('whatsapp'), /6-digit/)
    assert.match(sendHint(null), /6-digit/)
  })

  test('the hint follows the server codeLength when it sent one', () => {
    assert.match(sendHint('sms', 4), /4-digit/)
    assert.match(sendHint('whatsapp', 6), /6-digit/)
    assert.match(sendHint('sms', 6), /6-digit/)
    assert.match(sendHint(null, 4), /4-digit/)
  })
})

describe('the "code sent" notice', () => {
  test('names the channel and the masked phone, then the expiry', () => {
    assert.equal(sentNotice('sms', '••••1234', 300), 'Code sent by SMS to ••••1234. It expires in 5 minutes.')
    assert.equal(sentNotice('whatsapp', '••••1234', 300), 'Code sent to WhatsApp number ••••1234. It expires in 5 minutes.')
    assert.equal(sentNotice(null, '••••1234', 300), 'Code sent to ••••1234. It expires in 5 minutes.')
  })

  test('the parts the screen bolds around the phone join back into the same sentence', () => {
    for (const channel of CHANNELS) {
      const { before, after } = sentNoticeParts(channel, true)
      assert.equal(`${before}••••1234${after} It expires in 5 minutes.`, sentNotice(channel, '••••1234', 300))
    }
  })

  test('a missing phone or expiry (an odd server) never prints "undefined" or "NaN"', () => {
    assert.equal(sentNotice('sms', undefined, undefined), 'Code sent by SMS.')
    assert.equal(sentNotice('whatsapp', null, 'soon'), 'Code sent on WhatsApp.')
    assert.equal(sentNotice(null, '  ', -5), 'Code sent.')
    assert.equal(sentNotice('sms', '••••1234', Number.NaN), 'Code sent by SMS to ••••1234.')
    for (const channel of CHANNELS) {
      for (const phone of [undefined, null, '', 42]) assert.doesNotMatch(sentNotice(channel, phone, undefined), /undefined|NaN|null/)
    }
  })

  test('the expiry reads in minutes, and never promises more time than the server gave', () => {
    assert.equal(expiryText(300), 'It expires in 5 minutes.')
    assert.equal(expiryText(60), 'It expires in 1 minute.')
    assert.equal(expiryText(90), 'It expires in 1 minute.')
    assert.equal(expiryText(45), 'It expires in 45 seconds.')
    assert.equal(expiryText(1), 'It expires in 1 second.')
    assert.equal(expiryText(900), 'It expires in 15 minutes.')
    assert.equal(expiryText(0), '')
    assert.equal(expiryText(undefined), '')
    assert.equal(formatDuration(120), '2 minutes')
  })

  test('the expired line says what to do', () => {
    assert.match(EXPIRED_NOTICE, /expired/)
    assert.match(EXPIRED_NOTICE, /Resend code/)
  })
})

describe('cleanSeconds', () => {
  test('a whole number of seconds, or 0', () => {
    assert.equal(cleanSeconds(60), 60)
    assert.equal(cleanSeconds(59.9), 59)
    assert.equal(cleanSeconds('45'), 45)
    for (const value of [0, -1, Number.NaN, Infinity, undefined, null, '', ' ', 'abc', {}, [], true]) {
      assert.equal(cleanSeconds(value), 0, String(value))
    }
  })
})

describe('the code length: 4 digits by SMS, 6 on WhatsApp', () => {
  test('the table', () => {
    assert.deepEqual(OTP_LENGTH_BY_CHANNEL, { sms: 4, whatsapp: 6 })
  })

  test('the server codeLength first, else the channel, else six', () => {
    assert.equal(otpLength(4, 'sms'), 4)
    assert.equal(otpLength(6, 'whatsapp'), 6)
    assert.equal(otpLength('4', 'sms'), 4)
    assert.equal(otpLength(undefined, 'sms'), 4)
    assert.equal(otpLength(undefined, 'whatsapp'), 6)
    assert.equal(otpLength(null, 'SMS'), 4)
    assert.equal(otpLength(undefined, undefined), 6)
    assert.equal(otpLength(undefined, 'carrier-pigeon'), 6)
    assert.equal(otpLength(6, 'sms'), 6)
    assert.equal(otpLength(4, 'whatsapp'), 4)
  })

  test('a nonsense codeLength is ignored and the channel decides', () => {
    for (const bad of [0, 1, 3, 9, 100, -4, 4.5, Number.NaN, Number.POSITIVE_INFINITY, '', 'abc', {}, [], true]) {
      assert.equal(otpLength(bad, 'sms'), 4, String(bad))
      assert.equal(otpLength(bad, 'whatsapp'), 6, String(bad))
      assert.equal(otpLength(bad, null), 6, String(bad))
    }
  })

  test('the label and the "enter the code" sentence carry the length', () => {
    assert.equal(codeLabel(4), '4-digit code')
    assert.equal(codeLabel(6), '6-digit code')
    assert.equal(enterCodeMessage(4), 'Enter the 4-digit code.')
    assert.equal(enterCodeMessage(6), 'Enter the 6-digit code.')
  })

  test('the code box keeps four digits for SMS (a pasted six-digit text is cut) and six for WhatsApp', () => {
    const sms = otpLength(undefined, 'sms')
    assert.equal(digitsOnly('4829', sms), '4829')
    assert.equal(digitsOnly('48 29', sms), '4829')
    assert.equal(digitsOnly('Your code is 4829.', sms), '4829')
    assert.equal(digitsOnly('482913', sms), '4829')
    const wa = otpLength(undefined, 'whatsapp')
    assert.equal(digitsOnly('482913', wa), '482913')
    assert.equal(digitsOnly('123 456', wa), '123456')
  })
})

describe('digitsOnly (what the code box keeps)', () => {
  test('keeps digits only', () => {
    assert.equal(digitsOnly('123456'), '123456')
    assert.equal(digitsOnly('12a3b4-5 6'), '123456')
    assert.equal(digitsOnly('abc'), '')
    assert.equal(digitsOnly(''), '')
  })

  test('a pasted "123 456" or "123-456" keeps all six digits', () => {
    assert.equal(digitsOnly('123 456'), '123456')
    assert.equal(digitsOnly('123-456'), '123456')
    assert.equal(digitsOnly('  123456\n'), '123456')
    assert.equal(digitsOnly('Your code is 123456.'), '123456')
  })

  test('never more than six digits', () => {
    assert.equal(digitsOnly('1234567890'), '123456')
    assert.equal(digitsOnly('12345678', 4), '1234')
  })

  test('not a string: empty', () => {
    for (const value of [undefined, null, 123456, {}, []]) assert.equal(digitsOnly(value), '')
  })
})

describe('describeOtpFailure: asking for a code', () => {
  const failure = (status: number | undefined, data?: unknown) => describeOtpFailure({ status, message: 'axios text', data }, 'request')

  test('a cooldown (429 with retryAfterSeconds) keeps the server sentence and gives the countdown', () => {
    const f = failure(429, { error: 'Please wait 45 seconds before asking for another code.', retryAfterSeconds: 45 })
    assert.equal(f.message, 'Please wait 45 seconds before asking for another code.')
    assert.equal(f.retryAfterSeconds, 45)
  })

  test('the hourly limit (429 without a number) keeps the server sentence and starts no countdown', () => {
    const f = failure(429, { error: 'Too many codes requested. Please try again in an hour, or contact HR.' })
    assert.equal(f.message, 'Too many codes requested. Please try again in an hour, or contact HR.')
    assert.equal(f.retryAfterSeconds, 0)
  })

  test('a 502 "could not send" shows the server sentence, whichever channel it names', () => {
    for (const error of [
      "We couldn't send the code by SMS. Please try again in a moment or contact HR.",
      "We couldn't send the code on WhatsApp. Please try again in a moment or contact HR.",
    ]) {
      assert.equal(failure(502, { error }).message, error)
    }
  })

  test('a 503 "SMS temporarily unavailable" shows the server sentence (it already points to the password / HR)', () => {
    const error = 'SMS is temporarily unavailable. Please use your password or contact HR.'
    assert.equal(failure(503, { error }).message, error)
  })

  test('a 403 "turned off" shows the server sentence', () => {
    const error = 'SMS codes are turned off. Please use your password or contact HR.'
    assert.equal(failure(403, { error }).message, error)
  })

  test('the other refusals keep their sentence: not registered, no mobile number, already has a password', () => {
    assert.equal(failure(404, { error: 'You are not registered. Please contact HR.' }).message, 'You are not registered. Please contact HR.')
    assert.equal(failure(400, { error: 'No mobile number is registered for this employee. Please contact HR.' }).message, 'No mobile number is registered for this employee. Please contact HR.')
    assert.match(failure(409, { error: 'This account already has a password. Please sign in, or use Forgot password.' }).message, /already has a password/)
  })

  test('the per-address limit (a framework "throttled" detail) becomes a plain sentence and a countdown', () => {
    const f = failure(429, { detail: 'Request was throttled. Expected available in 37 seconds.' })
    assert.equal(f.message, 'Too many attempts. Please wait 37 seconds and try again, or contact HR.')
    assert.equal(f.retryAfterSeconds, 37)
    const g = failure(429, { detail: 'Request was throttled.' })
    assert.equal(g.message, 'Too many attempts. Please wait a minute and try again, or contact HR.')
    assert.equal(g.retryAfterSeconds, 0)
    assert.doesNotMatch(f.message + g.message, /throttled/i)
  })

  test('the message key wins over detail and error, like the API client', () => {
    assert.equal(failure(503, { error: 'database_unavailable', message: 'Database server is currently unavailable.' }).message, 'Database server is currently unavailable.')
  })

  test('no answer at all is a connection problem, never "Network Error"', () => {
    const f = failure(undefined)
    assert.match(f.message, /could not reach the server|couldn't reach the server/)
    assert.doesNotMatch(f.message, /axios|Network Error/)
    assert.equal(f.retryAfterSeconds, 0)
  })

  test('a gateway page with no sentence (HTML body, empty body) gets a plain one that names HR', () => {
    for (const status of [502, 503, 504]) {
      for (const data of ['<html>Bad gateway</html>', '', undefined, null, {}]) {
        const f = failure(status, data)
        assert.equal(f.message, "We couldn't send the code right now. Please try again in a moment, or contact HR.", `${status} ${String(data)}`)
      }
    }
  })

  test('another server error never shows its technical text', () => {
    const f = failure(500, { error: 'IntegrityError at /api/auth/otp/request' })
    assert.doesNotMatch(f.message, /IntegrityError/)
    assert.match(f.message, /contact HR/)
  })

  test('403 and 429 with no sentence still point somewhere', () => {
    assert.match(failure(403, '').message, /password or contact HR/)
    assert.match(failure(429, '').message, /contact HR/)
  })
})

describe('describeOtpFailure: sending the code back', () => {
  const failure = (status: number | undefined, data?: unknown) => describeOtpFailure({ status, message: 'axios text', data }, 'verify')

  test('the generic "incorrect or expired" sentence passes through unchanged', () => {
    const error = 'That code is incorrect or has expired. Please request a new one.'
    assert.equal(failure(400, { error }).message, error)
  })

  test('too many wrong attempts passes through', () => {
    const error = 'Too many wrong attempts. Please request a new code.'
    assert.equal(failure(429, { error }).message, error)
  })

  test('no answer, or a technical 500, is plain', () => {
    assert.match(failure(undefined).message, /reach the server/)
    assert.equal(failure(500, '<html>oops</html>').message, 'That did not work. Please try again.')
  })
})

describe('the code never leaves the box', () => {
  /** The code-entry component without its comments, so a sentence in a comment cannot trip the checks. */
  const source = readFileSync(new URL('../components/auth/OtpFlow.tsx', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  test('OtpFlow does not log, store or put the code in a URL', () => {
    for (const forbidden of [/console\./, /localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/, /history\.(push|replace)State/, /navigator\.credentials/]) {
      assert.doesNotMatch(source, forbidden)
    }
  })

  test('the code box asks the keyboard for the SMS code, digits only, as many characters as the code has', () => {
    assert.match(source, /autoComplete="one-time-code"/)
    assert.match(source, /inputMode="numeric"/)
    assert.match(source, /pattern="\[0-9\]\*"/)
    assert.match(source, /maxLength=\{length\}/)
    assert.doesNotMatch(source, /6-digit|\{6\}|!== 6/) // no length is hard-wired: it comes from otpLength
  })
})

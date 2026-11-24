// Run with `npm test`. WhatsApp codes and SMS codes are switched on separately by HR (WhatsApp Control / SMS Control):
// which ways a code can go for each page (login-options `otpChannels` + `channels`, or an older server's one
// `otpChannel`), which one the main button uses (and remembering the pick), what goes into POST /auth/otp/request, the
// "Send by SMS instead" offer, a channel switched off meanwhile (400 channel_unavailable) and the sign-in form after a reload.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import {
  OTP_CHANNELS,
  channelChoices,
  channelName,
  channelUnavailable,
  chooseButtonLabel,
  chooseHint,
  codeLengthFor,
  describeOtpFailure,
  fallbackChannels,
  fallbackOffer,
  nextLoginMode,
  normalizeChannelList,
  preferredChannel,
  purposeCodes,
  requestChannel,
  sendButtonLabel,
  singleChannel,
  switchToCodeLabel,
  unknownCodes,
  type CodeOptionsSource,
} from './otp-channel.ts'
import { OTP_CHANNEL_STORAGE_KEY, readRememberedChannel, rememberChannel } from './otp-preference.ts'

/** login-options from a server with independent channels (both on for sign-in, SMS only for a reset, none to activate). */
const NEW_SERVER: CodeOptionsSource = {
  otpLogin: true,
  otpReset: true,
  otpActivate: false,
  passwordLogin: true,
  otpChannel: 'whatsapp',
  codeLength: 6,
  otpChannels: { login: ['whatsapp', 'sms'], reset: ['sms'], activate: [] },
  channels: { whatsapp: { name: 'WhatsApp', codeLength: 6 }, sms: { name: 'SMS', codeLength: 4 } },
}

describe('reading login-options', () => {
  test('normalizeChannelList keeps known channels once, in the server order', () => {
    assert.deepEqual(normalizeChannelList(['whatsapp', 'sms']), ['whatsapp', 'sms'])
    assert.deepEqual(normalizeChannelList(['SMS', ' whatsapp ', 'sms', 'email', 7, null]), ['sms', 'whatsapp'])
    assert.deepEqual(normalizeChannelList('whatsapp'), [])
    assert.deepEqual(normalizeChannelList(undefined), [])
    assert.deepEqual(OTP_CHANNELS, ['whatsapp', 'sms'])
    assert.equal(channelName('whatsapp'), 'WhatsApp')
    assert.equal(channelName('sms'), 'SMS')
  })

  test('a new server: each purpose has its own list; an empty list means no code for it', () => {
    assert.deepEqual(purposeCodes(NEW_SERVER, 'login'), {
      available: true,
      channels: ['whatsapp', 'sms'],
      choosable: true,
      lengths: { whatsapp: 6, sms: 4 },
      neutralLength: 6,
    })
    assert.deepEqual(purposeCodes(NEW_SERVER, 'reset').channels, ['sms'])
    assert.equal(purposeCodes(NEW_SERVER, 'reset').available, true)
    assert.equal(purposeCodes(NEW_SERVER, 'activate').available, false)
    assert.equal(purposeCodes(NEW_SERVER, 'activate').choosable, true)
  })

  test('only WhatsApp on, only SMS on, neither: either one alone is enough', () => {
    const only = (list: string[]) => purposeCodes({ ...NEW_SERVER, otpChannels: { login: list } }, 'login')
    assert.deepEqual(only(['whatsapp']).channels, ['whatsapp'])
    assert.equal(only(['whatsapp']).available, true)
    assert.deepEqual(only(['sms']).channels, ['sms'])
    assert.equal(only(['sms']).available, true)
    assert.equal(only([]).available, false)
    assert.equal(only(['email']).available, false)
  })

  test('the list wins over the old purpose switch', () => {
    assert.equal(purposeCodes({ ...NEW_SERVER, otpLogin: true, otpChannels: { login: [] } }, 'login').available, false)
  })

  test('each channel has its own length: from `channels`, else the channel default', () => {
    const codes = purposeCodes(
      { otpChannels: { login: ['whatsapp', 'sms'] }, channels: { whatsapp: { codeLength: 8 }, sms: { codeLength: 'x' } } },
      'login',
    )
    assert.deepEqual(codes.lengths, { whatsapp: 8, sms: 4 })
    assert.equal(codeLengthFor(codes, 'whatsapp'), 8)
    assert.equal(codeLengthFor(codes, 'sms'), 4)
    assert.equal(codeLengthFor(codes, null), 6)
  })

  test('an older server (one otpChannel for everything): its purpose switch and its one channel, nothing to choose', () => {
    const old = { otpLogin: true, otpReset: false, otpActivate: true, passwordLogin: true, otpChannel: 'sms', codeLength: 4 }
    assert.deepEqual(purposeCodes(old, 'login'), {
      available: true,
      channels: ['sms'],
      choosable: false,
      lengths: { whatsapp: 6, sms: 4 },
      neutralLength: 4,
    })
    assert.equal(purposeCodes(old, 'reset').available, false)
    assert.deepEqual(purposeCodes(old, 'reset').channels, [])
  })

  test('a server from before the SMS channel (no channel at all): a code, neutral words, 6 digits', () => {
    const codes = purposeCodes({ otpLogin: true, otpReset: true, otpActivate: true, passwordLogin: true }, 'activate')
    assert.equal(codes.available, true)
    assert.deepEqual(codes.channels, [])
    assert.equal(codes.choosable, false)
    assert.equal(codes.neutralLength, 6)
    assert.equal(singleChannel(codes), null)
  })

  test('no answer: purposeCodes(null) offers nothing; unknownCodes offers a neutral code and never names a channel', () => {
    assert.equal(purposeCodes(null, 'login').available, false)
    const unknown = unknownCodes()
    assert.equal(unknown.available, true)
    assert.deepEqual(unknown.channels, [])
    assert.equal(requestChannel(unknown, 'sms'), undefined)
    assert.equal(codeLengthFor(unknown, null), 6)
  })
})

describe('picking a channel', () => {
  test('one way on offer is named; two leave the page words neutral (the employee picks)', () => {
    assert.equal(singleChannel(purposeCodes(NEW_SERVER, 'reset')), 'sms')
    assert.equal(singleChannel(purposeCodes(NEW_SERVER, 'login')), null)
    assert.equal(switchToCodeLabel(singleChannel(purposeCodes(NEW_SERVER, 'login'))), 'Sign in with a code')
    assert.equal(sendButtonLabel(singleChannel(purposeCodes(NEW_SERVER, 'reset'))), 'Send code by SMS')
  })

  test('the main button is the channel picked last time while still on offer; else the server first', () => {
    assert.equal(preferredChannel(['whatsapp', 'sms'], 'sms'), 'sms')
    assert.equal(preferredChannel(['whatsapp', 'sms'], null), 'whatsapp')
    assert.equal(preferredChannel(['whatsapp', 'sms'], 'fax'), 'whatsapp')
    assert.equal(preferredChannel(['whatsapp'], 'sms'), 'whatsapp')
    assert.equal(preferredChannel([], 'sms'), null)
    assert.deepEqual(channelChoices(['whatsapp', 'sms'], 'sms'), ['sms', 'whatsapp'])
    assert.deepEqual(channelChoices(['whatsapp', 'sms'], undefined), ['whatsapp', 'sms'])
    assert.deepEqual(channelChoices([], 'sms'), [])
  })

  test('"Send code by WhatsApp" / "Send code by SMS", and a hint naming both with their digits', () => {
    assert.equal(chooseButtonLabel('whatsapp'), 'Send code by WhatsApp')
    assert.equal(chooseButtonLabel('sms'), 'Send code by SMS')
    assert.equal(
      chooseHint(purposeCodes(NEW_SERVER, 'login')),
      'Choose how to get your code: WhatsApp (6 digits) or SMS (4 digits). It goes to the mobile number registered with HR.',
    )
  })

  test('the request names the channel only to a server that takes one', () => {
    const login = purposeCodes(NEW_SERVER, 'login')
    assert.equal(requestChannel(login, 'sms'), 'sms')
    assert.equal(requestChannel(login, null), undefined)
    assert.equal(requestChannel(purposeCodes({ otpLogin: true, otpChannel: 'whatsapp' }, 'login'), 'whatsapp'), undefined)
  })
})

describe('remembering the pick (browser storage may fail)', () => {
  function fakeStorage(initial: Record<string, string> = {}) {
    const data = { ...initial }
    return {
      data,
      getItem: (k: string) => (k in data ? data[k] : null),
      setItem: (k: string, v: string) => {
        data[k] = v
      },
    }
  }
  const broken = {
    getItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }

  test('reads back a known channel; anything else is no preference', () => {
    const s = fakeStorage()
    assert.equal(readRememberedChannel(s), null)
    rememberChannel('sms', s)
    assert.equal(s.data[OTP_CHANNEL_STORAGE_KEY], 'sms')
    assert.equal(readRememberedChannel(s), 'sms')
    assert.equal(readRememberedChannel(fakeStorage({ [OTP_CHANNEL_STORAGE_KEY]: 'telegram' })), null)
  })

  test('storage that throws, or none at all, never breaks the page', () => {
    assert.equal(readRememberedChannel(broken), null)
    assert.doesNotThrow(() => rememberChannel('whatsapp', broken))
    assert.equal(readRememberedChannel(null), null)
    assert.doesNotThrow(() => rememberChannel('whatsapp', null))
    // In Node there is no browser storage: the defaults quietly do nothing.
    assert.equal(readRememberedChannel(), null)
    assert.doesNotThrow(() => rememberChannel('sms'))
  })
})

describe('after a code went out', () => {
  test('"Send by SMS instead": otherChannels without the one used, limited to what is still on offer', () => {
    assert.deepEqual(fallbackChannels(['sms'], 'whatsapp'), ['sms'])
    assert.deepEqual(fallbackChannels(['whatsapp', 'sms'], 'whatsapp'), ['sms'])
    assert.deepEqual(fallbackChannels(undefined, 'whatsapp'), [])
    assert.deepEqual(fallbackChannels(['sms'], 'whatsapp', ['whatsapp']), [])
    assert.deepEqual(fallbackChannels(['sms'], 'whatsapp', ['whatsapp', 'sms']), ['sms'])
    assert.deepEqual(fallbackOffer('sms'), { prefix: "Didn't get it? ", action: 'Send by SMS instead' })
    assert.deepEqual(fallbackOffer('whatsapp'), { prefix: "Didn't get it? ", action: 'Send by WhatsApp instead' })
  })
})

describe('a channel switched off meanwhile (400 channel_unavailable)', () => {
  const apiError = (status: number, data?: unknown) => ({ status, data, message: 'x' })

  test('the server sentence and what is still on offer (ApiError or axios-style)', () => {
    const sentence = 'Codes by SMS are switched off. Use WhatsApp instead.'
    assert.deepEqual(
      channelUnavailable(apiError(400, { code: 'channel_unavailable', availableChannels: ['whatsapp'], message: sentence })),
      { available: ['whatsapp'], message: sentence },
    )
    assert.deepEqual(
      channelUnavailable({ response: { status: 400, data: { code: 'channel_unavailable', availableChannels: [], error: sentence } } }),
      { available: [], message: sentence },
    )
  })

  test('without a sentence a plain one; any other failure is not channel_unavailable', () => {
    assert.equal(
      channelUnavailable(apiError(400, { code: 'channel_unavailable', availableChannels: ['whatsapp', 'sms'] }))?.message,
      'That way of sending codes is not available right now. Use WhatsApp or SMS instead.',
    )
    assert.equal(channelUnavailable(apiError(400, { code: 'channel_unavailable' }))?.message, 'Codes cannot be sent right now.')
    assert.equal(channelUnavailable(apiError(400, { error: 'No mobile number.' })), null)
    assert.equal(channelUnavailable(apiError(503, { code: 'channel_unavailable' })), null)
    assert.equal(channelUnavailable(new Error('offline')), null)
    assert.equal(channelUnavailable(undefined), null)
    // The general wording still shows the server's sentence for it.
    assert.equal(describeOtpFailure(apiError(400, { code: 'channel_unavailable', message: 'Switched off.' }), 'request').message, 'Switched off.')
  })
})

describe('the sign-in form after login-options (re)load', () => {
  test('first load: the code form when codes work, else the password', () => {
    assert.equal(nextLoginMode('password', null, true, true), 'otp')
    assert.equal(nextLoginMode('password', null, false, true), 'password')
  })
  test('a reload keeps what the employee chose', () => {
    assert.equal(nextLoginMode('password', true, true, true), 'password')
    assert.equal(nextLoginMode('otp', true, true, true), 'otp')
  })
  test('a reload follows HR: codes off -> password; back on -> code form; password sign-in off -> code form', () => {
    assert.equal(nextLoginMode('otp', true, false, true), 'password')
    assert.equal(nextLoginMode('password', false, true, true), 'otp')
    assert.equal(nextLoginMode('password', true, true, false), 'otp')
  })
})

describe('the pages follow the switches', () => {
  const strip = (path: string) =>
    readFileSync(new URL(path, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

  test('every code page reads login-options through the refreshing hook, never once on mount', () => {
    for (const page of ['../pages/auth/Login.tsx', '../pages/auth/ForgotPassword.tsx', '../pages/auth/SetPassword.tsx']) {
      const source = strip(page)
      assert.match(source, /useLoginOptions\(/, page)
      assert.doesNotMatch(source, /authApi\s*\.\s*loginOptions\(/, page)
      assert.match(source, /onChannelsChanged=\{/, page)
      assert.doesNotMatch(source, /otpChannel\b/, page)
    }
  })

  test('the hook asks again on focus, on a visible tab and when back online', () => {
    const hook = strip('../hooks/useLoginOptions.ts')
    assert.match(hook, /addEventListener\('focus'/)
    assert.match(hook, /addEventListener\('visibilitychange'/)
    assert.match(hook, /addEventListener\('online'/)
  })

  test('OtpFlow sends the picked channel and reloads the options on channel_unavailable', () => {
    const flow = strip('../components/auth/OtpFlow.tsx')
    assert.match(flow, /requestOtp\(.*requestChannel\(codes, via\)\)/)
    assert.match(flow, /channelUnavailable\(err\)/)
    assert.match(flow, /onChannelsChanged\?\.\(\)/)
  })
})

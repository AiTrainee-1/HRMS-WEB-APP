// Run with `npm test`. The sign-in / sign-out transitions (lib/auth-transition.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  createOverlayStore,
  firstNameOf,
  once,
  pickVoice,
  signInTimeline,
  signOutTimeline,
  spokenWelcome,
  totalMs,
  welcomeLine,
  welcomeVoiceOn,
} from './auth-transition.ts'

describe('timing', () => {
  test('about 2 s in, about 2.3 s out; reduced motion is shorter', () => {
    const inMs = totalMs(signInTimeline(false))
    const outMs = totalMs(signOutTimeline(false))
    assert.ok(inMs >= 1800 && inMs <= 2300, String(inMs))
    assert.ok(outMs >= 2000 && outMs <= 2600, String(outMs))
    assert.ok(totalMs(signInTimeline(true)) < inMs)
    assert.ok(totalMs(signOutTimeline(true)) < outMs)
  })
  test('once: runs exactly once, when called or when the fallback fires', () => {
    let timers: (() => void)[] = []
    let cancelled = 0
    const schedule = (cb: () => void) => {
      timers.push(cb)
      return timers.length
    }
    const cancel = () => {
      cancelled += 1
    }
    let runs = 0
    const run = once(() => (runs += 1), 1000, schedule, cancel)
    run()
    run()
    timers.forEach((t) => t())
    assert.equal(runs, 1)
    assert.equal(cancelled, 1)

    timers = []
    runs = 0
    once(() => (runs += 1), 1000, schedule, cancel)
    timers.forEach((t) => t()) // the overlay never said "covered": the fallback still navigates
    assert.equal(runs, 1)
  })
})

describe('words', () => {
  test('first names', () => {
    assert.equal(firstNameOf('PRIYA raman'), 'Priya')
    assert.equal(firstNameOf('  meena  '), 'Meena')
    assert.equal(firstNameOf(''), '')
    assert.equal(firstNameOf(null), '')
    assert.equal(firstNameOf('1234'), '')
    assert.equal(welcomeLine('Priya'), 'Welcome back, Priya')
    assert.equal(welcomeLine(''), 'Welcome back')
    assert.equal(spokenWelcome('Priya'), 'Welcome back, Priya.')
  })
  test('the spoken welcome is on unless turned off', () => {
    assert.equal(welcomeVoiceOn(null), true)
    assert.equal(welcomeVoiceOn('on'), true)
    assert.equal(welcomeVoiceOn('off'), false)
  })
  test('voice: Indian English first, then a local English one, else none', () => {
    const voices = [
      { lang: 'hi-IN', name: 'Hindi' },
      { lang: 'en-US', name: 'US remote', localService: false },
      { lang: 'en-GB', name: 'UK local', localService: true },
    ]
    assert.equal(pickVoice(voices)?.name, 'UK local')
    assert.equal(pickVoice([...voices, { lang: 'en_IN', name: 'India' }])?.name, 'India')
    assert.equal(pickVoice([{ lang: 'ta-IN', name: 'Tamil' }]), null)
    assert.equal(pickVoice([]), null)
  })
})

describe('the overlay store', () => {
  test('nothing listening: open says so and the caller goes on without it', () => {
    const store = createOverlayStore<{ n: number }>()
    assert.equal(store.open({ n: 1 }), false)
    assert.equal(store.current(), null)
  })
  test('open, current, close, notify', () => {
    const store = createOverlayStore<{ n: number }>()
    let calls = 0
    const stop = store.subscribe(() => (calls += 1))
    assert.equal(store.hasListener(), true)
    assert.equal(store.open({ n: 2 }), true)
    assert.deepEqual(store.current(), { n: 2 })
    store.close()
    store.close()
    assert.equal(store.current(), null)
    assert.equal(calls, 2)
    stop()
    assert.equal(store.hasListener(), false)
  })
})

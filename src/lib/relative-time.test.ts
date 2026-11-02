// Run with `npm test`. Plain-English times (lib/relative-time.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { greetingFor, relativeTime, shortDate, toDate, waitingDays, waitingSince } from './relative-time.ts'

const now = new Date(2026, 9, 31, 15, 0, 0) // 31 Oct 2026, 3:00 PM local
const at = (d: number, h = 9, m = 0, month = 9, y = 2026) => new Date(y, month, d, h, m)

describe('relativeTime', () => {
  test('the past', () => {
    assert.equal(relativeTime(new Date(now.getTime() - 20_000), now), 'just now')
    assert.equal(relativeTime(new Date(now.getTime() - 60_000), now), '1 minute ago')
    assert.equal(relativeTime(new Date(now.getTime() - 5 * 60_000), now), '5 minutes ago')
    assert.equal(relativeTime(at(31, 13), now), '2 hours ago')
    assert.equal(relativeTime(at(30, 20), now), 'yesterday')
    assert.equal(relativeTime(at(28), now), '3 days ago')
    assert.equal(relativeTime(at(12), now), 'on 12 Oct')
    assert.equal(relativeTime(at(12, 9, 0, 9, 2025), now), 'on 12 Oct 2025')
  })
  test('the future', () => {
    assert.equal(relativeTime(new Date(now.getTime() + 10 * 60_000), now), 'in 10 minutes')
    assert.equal(relativeTime(at(31, 18), now), 'in 3 hours')
    assert.equal(relativeTime(at(1, 9, 0, 10), now), 'tomorrow')
    assert.equal(relativeTime(at(3, 9, 0, 10), now), 'in 3 days')
  })
  test('bad input is empty, not "Invalid Date"', () => {
    assert.equal(relativeTime('nope', now), '')
    assert.equal(relativeTime(null, now), '')
  })
})

describe('waitingSince', () => {
  test('calendar days since it was sent', () => {
    assert.equal(waitingSince(at(31, 8), now), 'waiting since today')
    assert.equal(waitingSince(at(30, 23), now), 'waiting 1 day')
    assert.equal(waitingSince('2026-10-28', now), 'waiting 3 days')
    assert.equal(waitingSince('2026-10-14', now), 'waiting 2 weeks')
    assert.equal(waitingSince('2026-09-01', now), 'waiting over a month')
    assert.equal(waitingSince('', now), '')
  })
  test('a future date (clock skew) counts as today', () => {
    assert.equal(waitingSince(at(31, 18), now), 'waiting since today')
    assert.equal(waitingDays(at(1, 9, 0, 10), now), 0)
  })
  test('waitingDays', () => {
    assert.equal(waitingDays('2026-10-28', now), 3)
    assert.equal(waitingDays('x', now), null)
  })
})

test('a bare date is local midnight, never shifted by UTC', () => {
  const d = toDate('2026-10-31')!
  assert.equal(d.getDate(), 31)
  assert.equal(d.getHours(), 0)
  assert.equal(shortDate(d, now), '31 Oct')
})

test('greeting by the hour', () => {
  assert.equal(greetingFor(at(31, 7)), 'Good morning')
  assert.equal(greetingFor(at(31, 12)), 'Good afternoon')
  assert.equal(greetingFor(at(31, 19)), 'Good evening')
})

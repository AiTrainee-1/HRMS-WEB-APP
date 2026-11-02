// Run with `npm test`. The open gate pass and its clock (lib/outpass-open.ts), the mobile app's vectors plus the web's
// "back by" helper.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  expectedReturnIso,
  formatSpan,
  formatSpanShort,
  formatTicker,
  formatTickerShort,
  openKind,
  openPassClock,
  outpassRowLabel,
  passTypeLabel,
  pickOpenPass,
} from './outpass-open.ts'

const NOW = Date.parse('2026-10-31T06:00:00Z')
const iso = (minFromNow: number) => new Date(NOW + minFromNow * 60_000).toISOString()

test('open kinds', () => {
  assert.equal(openKind({ id: 1, status: 'approved', exitedAt: iso(-30), createdAt: iso(-90) }, NOW), 'out')
  assert.equal(openKind({ id: 1, status: 'approved', exitedAt: iso(-30), enteredAt: iso(-5), createdAt: iso(-90) }, NOW), null)
  assert.equal(openKind({ id: 1, status: 'approved', expiresAt: iso(20), createdAt: iso(-90) }, NOW), 'ready')
  assert.equal(openKind({ id: 1, status: 'approved', expiresAt: iso(-1), createdAt: iso(-90) }, NOW), null)
  assert.equal(openKind({ id: 1, status: 'pending', expiresAt: iso(20), createdAt: iso(-90) }, NOW), null)
})

test('an "out" pass beats a newer "ready" one; newest wins within a kind', () => {
  const items = [
    { id: 1, status: 'approved', approvedAt: iso(-5), expiresAt: iso(55), createdAt: iso(-10) },
    { id: 2, status: 'approved', exitedAt: iso(-60), createdAt: iso(-120) },
    { id: 3, status: 'approved', exitedAt: iso(-20), createdAt: iso(-100) },
  ]
  assert.equal(pickOpenPass(items, NOW)?.id, 3)
  assert.equal(pickOpenPass(items.slice(0, 1), NOW)?.id, 1)
  assert.equal(pickOpenPass([], NOW), null)
})

test('clocks: out with and without a return time, late, ready', () => {
  const out = openPassClock({ id: 1, status: 'approved', exitedAt: iso(-30), expectedReturnAt: iso(30), createdAt: iso(-60) }, NOW)
  assert.deepEqual(out, { kind: 'out', elapsedMs: 30 * 60_000, returnInMs: 30 * 60_000, overdue: false, progress: 0.5 })
  const late = openPassClock({ id: 1, status: 'approved', exitedAt: iso(-90), expectedReturnAt: iso(-10), createdAt: iso(-120) }, NOW)
  assert.equal(late?.kind === 'out' && late.overdue, true)
  assert.equal(late?.kind === 'out' && late.progress, 1)
  const open = openPassClock({ id: 1, status: 'approved', exitedAt: iso(-5), createdAt: iso(-60) }, NOW)
  assert.equal(open?.kind === 'out' && open.returnInMs, null)
  const ready = openPassClock({ id: 1, status: 'approved', expiresAt: iso(45), createdAt: iso(-20) }, NOW)
  assert.deepEqual(ready, { kind: 'ready', exitWindowMs: 45 * 60_000, progress: 0.25 })
})

test('row pills', () => {
  assert.deepEqual(outpassRowLabel({ status: 'pending' }), { label: 'Waiting', tone: 'waiting' })
  assert.deepEqual(outpassRowLabel({ status: 'rejected' }), { label: 'Not approved', tone: 'rejected' })
  assert.equal(outpassRowLabel({ status: 'approved', scanStatus: 'pending_exit' }).label, 'Ready to use')
  assert.equal(outpassRowLabel({ status: 'approved', scanStatus: 'return_expired' }).label, 'Out now')
  assert.equal(outpassRowLabel({ status: 'approved', scanStatus: 'completed' }).label, 'Returned')
  assert.equal(outpassRowLabel({ status: 'approved', scanStatus: 'expired_unscanned' }).label, 'Not used')
  assert.equal(outpassRowLabel({ status: 'approved', exitedAt: iso(-1) }).label, 'Out now')
  assert.equal(outpassRowLabel({ status: 'approved' }).label, 'Approved')
})

test('spans and tickers', () => {
  assert.equal(formatSpan(65 * 60_000), '1 h 05 min')
  assert.equal(formatSpan(12 * 60_000 + 5000), '12 min')
  assert.equal(formatSpan(-45_000), '45 s')
  assert.equal(formatTicker(42 * 60_000 + 10_000), '42:10')
  assert.equal(formatTicker(3_725_000), '1:02:05')
})

test('phone figures stay short for long stretches (days, then hours, mm:ss only under an hour)', () => {
  const H = 3_600_000
  // A pass out since 10 Sep: 1266:43:42 on the ticker.
  assert.equal(formatTicker(1266 * H + 43 * 60_000 + 42_000), '1266:43:42')
  assert.equal(formatTickerShort(1266 * H + 43 * 60_000 + 42_000), '52 d 18 h')
  assert.equal(formatTickerShort(24 * H), '1 d 0 h')
  assert.equal(formatTickerShort(24 * H - 1000), '23 h 59 m')
  assert.equal(formatTickerShort(4 * H + 12 * 60_000 + 59_000), '4 h 12 m')
  assert.equal(formatTickerShort(H), '1 h 0 m')
  assert.equal(formatTickerShort(H - 1000), '59:59')
  assert.equal(formatTickerShort(42 * 60_000 + 10_000), '42:10')
  assert.equal(formatTickerShort(0), '0:00')
  assert.equal(formatTickerShort(-(3 * 24 * H + 5 * H)), '3 d 5 h')
  assert.equal(formatSpanShort(1266 * H + 43 * 60_000), '52 d 18 h')
  assert.equal(formatSpanShort(65 * 60_000), '1 h 05 min')
  assert.equal(formatSpanShort(-45_000), '45 s')
})

test('"back by" is today, or tomorrow once that time has passed', () => {
  const sent = new Date(2026, 9, 31, 23, 0)
  const back = new Date(expectedReturnIso('01:30', sent)!)
  assert.equal(back.getDate(), 1)
  assert.equal(back.getHours(), 1)
  const later = new Date(expectedReturnIso('23:30', sent)!)
  assert.equal(later.getDate(), 31)
  assert.equal(expectedReturnIso('', sent), null)
  assert.equal(expectedReturnIso('25:00', sent), null)
  assert.equal(passTypeLabel('official'), 'Official / Mill Duty')
  assert.equal(passTypeLabel('x'), null)
})

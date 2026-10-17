// Run with `npm test`. The attendance calendar's day markers: the Late / Early Out / Permission ones that were there
// before (a regression guard, they must not move) and the compensation ones the compensation overhaul added
// (compensationKind / compensationMinutes / compensationNote on every day record).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  COMPENSATION_KIND_MARKERS,
  compensationKindOf,
  compensationLegend,
  compensationLine,
  dayHeadline,
  getCompensationMarker,
  getDayFlags,
  getDayMarkers,
  hasCompensationKeys,
  isPunchlessRelaxation,
  legendMarkers,
} from './attendance-flags.ts'

type Day = Parameters<typeof getDayMarkers>[0] & { firstPunch?: string | null; totalPunches?: number }

const day = (extra: Partial<Day> = {}): Day => ({ status: 'present', firstPunch: '09:05', totalPunches: 4, ...extra }) as Day

describe('the flag markers are unchanged', () => {
  test('a clean day has none', () => {
    assert.deepEqual(getDayMarkers(day()), [])
    assert.deepEqual(getDayMarkers({ status: 'absent' } as Day), [])
    assert.deepEqual(getDayMarkers({ status: 'future' } as Day), [])
  })

  test('late, early out, permission, excess and middle still come in their order, on worked days only', () => {
    const flagged = day({
      isLate: true, isEarlyOut: true, morningPermissionApplied: true, eveningPermissionApplied: false,
      morningPermissionExcess: true, middlePermissionToday: true, lateReason: 'arrived 09:40, deadline 09:15',
    })
    assert.deepEqual(getDayMarkers(flagged).map((m) => m.key), ['late', 'earlyOut', 'permission', 'excess', 'middle'])
    assert.equal(getDayMarkers(flagged)[0].detail, 'arrived 09:40, deadline 09:15')
    // A day nobody worked carries no lateness, whatever the flags say.
    assert.deepEqual(getDayMarkers({ ...flagged, status: 'absent' } as Day), [])
  })

  test('a check the company switched off draws nothing, as before', () => {
    const late = day({ isLate: true, morningPermissionApplied: false, eveningPermissionApplied: false })
    assert.deepEqual(getDayMarkers(late, { morningLateInEnabled: false }), [])
    assert.deepEqual(getDayMarkers(late, { morningLateInEnabled: true }).map((m) => m.key), ['late'])
  })

  test('the flag legend does not list compensation (it has its own row)', () => {
    assert.deepEqual(legendMarkers().map((m) => m.key), ['late', 'earlyOut', 'permission', 'excess', 'middle'])
  })

  test('a day with no compensation keys (an older backend) is read exactly as before', () => {
    const old = day({ isLate: true, morningPermissionApplied: false, eveningPermissionApplied: false })
    assert.equal(getCompensationMarker(old), null)
    assert.equal(compensationKindOf(old), null)
    assert.equal(compensationLine(old), null)
    assert.equal(dayHeadline(old), 'Present')
    assert.deepEqual(getDayMarkers(old).map((m) => m.key), ['late'])
  })
})

describe('the compensation marker', () => {
  test('an allowance used: teal timer, with the server\'s sentence as its detail', () => {
    const d = day({ compensationKind: 'ot_allowance', compensationMinutes: 18, compensationNote: 'You arrived 18 minutes late, inside your 30 minute allowance.' })
    const [m] = getDayMarkers(d)
    assert.equal(m.key, 'ot_allowance')
    assert.equal(m.label, 'Late-in allowance used')
    assert.equal(m.symbol, 'timer')
    assert.equal(m.detail, 'You arrived 18 minutes late, inside your 30 minute allowance.')
  })

  test('every kind has its own colour, symbol, ring, chip and label', () => {
    const markers = compensationLegend()
    assert.deepEqual(markers.map((m) => m.key), ['ot_allowance', 'window_late_in', 'window_early_out', 'birthday', 'relaxation'])
    for (const m of markers) {
      assert.ok(m.symbol && m.text && m.ring && m.dot && m.fill && m.chip && m.label, m.key)
    }
    for (const field of ['dot', 'fill', 'chip', 'symbol', 'ring', 'label'] as const) {
      assert.equal(new Set(markers.map((m) => m[field])).size, markers.length, `${field} must be distinct per kind`)
    }
  })

  test('the compensation colours do not collide with the flag markers or the legacy compensation day', () => {
    const taken = new Set(['bg-warning', 'bg-destructive', 'bg-primary', 'bg-orange-600', 'bg-slate-400', 'bg-violet-500', 'bg-success'])
    for (const m of compensationLegend()) assert.equal(taken.has(m.dot), false, m.key)
  })

  test('each kind is found by name and keeps its sentence', () => {
    for (const kind of Object.keys(COMPENSATION_KIND_MARKERS)) {
      const m = getCompensationMarker({ compensationKind: kind, compensationNote: `note for ${kind}` })!
      assert.equal(m.key, kind)
      assert.equal(m.detail, `note for ${kind}`)
    }
  })

  test('with no server note, a fixed sentence explains the kind', () => {
    assert.match(compensationLine({ compensationKind: 'ot_allowance', compensationMinutes: 18 })!, /within your late-in allowance \(18 minutes used\)/)
    assert.match(compensationLine({ compensationKind: 'ot_allowance', compensationMinutes: 0 })!, /within your late-in allowance, so you were not marked late/)
    assert.match(compensationLine({ compensationKind: 'window_late_in' })!, /company announced a late-in time/)
    assert.match(compensationLine({ compensationKind: 'window_early_out' })!, /company announced an early-out time/)
    assert.match(compensationLine({ compensationKind: 'birthday' })!, /Paid birthday leave/)
    assert.match(compensationLine({ compensationKind: 'relaxation' })!, /compensation day \(relaxation\)/)
    assert.equal(compensationLine({ compensationKind: 'relaxation', compensationNote: '   ' })!.length > 10, true)
  })

  test('a kind this app has never seen is a generic violet "Compensation", not dropped', () => {
    const m = getCompensationMarker({ compensationKind: 'festival_bonus', compensationNote: 'A new thing.' })!
    assert.equal(m.key, 'compensation')
    assert.equal(m.label, 'Compensation')
    assert.equal(m.symbol, 'gift')
    assert.equal(m.detail, 'A new thing.')
    assert.match(compensationLine({ compensationKind: 'festival_bonus' })!, /Compensation was applied/)
    // Names every object inherits are not kinds either.
    assert.equal(getCompensationMarker({ compensationKind: 'constructor' })!.key, 'compensation')
    assert.equal(getCompensationMarker({ compensationKind: 'toString' })!.key, 'compensation')
  })

  test('null, blank and non-string kinds mean "no compensation"', () => {
    for (const kind of [null, undefined, '', '   ', 5 as unknown as string, {} as unknown as string]) {
      assert.equal(getCompensationMarker({ compensationKind: kind }), null, String(kind))
    }
    assert.equal(compensationKindOf({ compensationKind: ' birthday ' }), 'birthday')
  })

  test('the marker comes first, then the flag markers; it needs no worked status', () => {
    const d = day({ compensationKind: 'window_late_in', isLate: true, morningPermissionApplied: false, eveningPermissionApplied: false })
    assert.deepEqual(getDayMarkers(d).map((m) => m.key), ['window_late_in', 'late'])
    for (const status of ['absent', 'on_leave', 'holiday', 'future']) {
      assert.deepEqual(getDayMarkers({ status, compensationKind: 'birthday' } as Day).map((m) => m.key), ['birthday'], status)
    }
  })

  test('the keys being present (even null) means the backend knows about compensation', () => {
    assert.equal(hasCompensationKeys([day(), day()]), false)
    assert.equal(hasCompensationKeys([]), false)
    assert.equal(hasCompensationKeys([day(), day({ compensationKind: null })]), true)
  })
})

describe('a relaxation day has no punches and is not drawn as a half day only', () => {
  const relaxation = { status: 'half_shift', firstPunch: null, totalPunches: 0, compensationKind: 'relaxation', compensationNote: 'HR gave you 0.50 shift of compensation on this date.' } as Day

  test('the headline says compensation day, not Half Day', () => {
    assert.equal(isPunchlessRelaxation(relaxation), true)
    assert.equal(dayHeadline(relaxation), 'Compensation day (relaxation)')
    // The day is still counted by its status elsewhere: the flags themselves are untouched.
    assert.equal(getDayFlags(relaxation).halfDay, true)
  })

  test('the marker is there (violet-free fuchsia bed) with the sentence', () => {
    const [m] = getDayMarkers(relaxation)
    assert.equal(m.key, 'relaxation')
    assert.equal(m.symbol, 'bed')
    assert.equal(m.detail, 'HR gave you 0.50 shift of compensation on this date.')
  })

  test('a relaxation day that also has punches reads as the day it is', () => {
    const worked = { ...relaxation, status: 'present', firstPunch: '09:00', totalPunches: 2 } as Day
    assert.equal(isPunchlessRelaxation(worked), false)
    assert.equal(dayHeadline(worked), 'Present')
  })

  test('other compensation kinds keep the plain status headline', () => {
    assert.equal(dayHeadline({ status: 'present', firstPunch: null, compensationKind: 'birthday' }), 'Present')
    assert.equal(dayHeadline({ status: 'half_shift', compensationKind: 'ot_allowance' }), 'Half Day')
    assert.equal(isPunchlessRelaxation({ status: 'present', compensationKind: null }), false)
    assert.equal(isPunchlessRelaxation({ status: 'present' }), false)
  })

  test('a relaxation day with a stray total of punches counts as worked', () => {
    assert.equal(isPunchlessRelaxation({ status: 'half_shift', firstPunch: null, totalPunches: 2, compensationKind: 'relaxation' }), false)
  })
})

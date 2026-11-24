// Run with `npm test`. The attendance day panel (owner 2026-11-24): every punch with its source, the earned shift, the
// action chips and the date a request form opens with.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  dayActions,
  dayPunchViews,
  earnedShiftHint,
  earnedShiftText,
  kindOf,
  prefillDate,
  prefillPermissionType,
  punchCountText,
  readApplyPrefill,
  time12,
  withoutApplyParams,
} from './day-punches.ts'
import { getRequestWindow } from './request-window.ts'

describe('dayPunchViews', () => {
  test('every punch with its source, oldest first; waiting / rejected / OT read as such', () => {
    const views = dayPunchViews([
      { time: '08:58:00', type: 'IN', source: 'biometric', kind: 'biometric' },
      { time: '13:00:00', type: 'OUT', source: 'geo:auto', kind: 'geo' },
      { time: '14:00:00', type: 'IN', source: 'on_duty:pending', kind: 'on_duty', counted: false, verification: 'pending' },
      { time: '15:00:00', type: 'OUT', source: 'on_duty:rejected', kind: 'on_duty', counted: false, verification: 'rejected' },
      { time: '19:30:00', type: 'OT', source: 'on_duty_ot', sourceLabel: 'OT Punch 1', kind: 'ot', counted: false, verification: 'pending' },
      { time: '20:30:00', type: 'OT', source: 'on_duty_ot', sourceLabel: 'OT Punch 2', kind: 'ot', counted: false, verification: 'approved' },
    ])
    assert.deepEqual(
      views.map((v) => [v.time, v.direction, v.source]),
      [
        ['8:58 AM', 'In', 'Biometric'],
        ['1:00 PM', 'Out', 'Geo Punch'],
        ['2:00 PM', 'In', 'On-Duty'],
        ['3:00 PM', 'Out', 'On-Duty'],
        ['7:30 PM', 'OT', 'OT Punch 1'],
        ['8:30 PM', 'OT', 'OT Punch 2'],
      ],
    )
    assert.deepEqual(
      views.map((v) => v.detail),
      [null, null, 'Waiting for HR', 'Rejected by HR', 'Overtime · waiting for approval', 'Overtime · approved'],
    )
    assert.deepEqual(views.map((v) => v.counted), [true, true, false, false, false, false])
    assert.equal(punchCountText(views), '6 recorded · 2 counted')
  })

  test('double tap, previous night, next day', () => {
    const views = dayPunchViews([
      { time: '06:00:00', type: 'OUT', kind: 'biometric', note: 'previous_shift' },
      { time: '09:00:00', type: 'IN', kind: 'biometric' },
      { time: '09:00:30', type: 'IN', kind: 'biometric', counted: false, note: 'double_tap' },
      { time: '01:10:00', type: 'OUT', kind: 'biometric', nextDay: true },
    ])
    assert.deepEqual(views.map((v) => v.detail), ["Previous night's shift", null, 'Not counted · double tap', 'Next day'])
  })

  test('an older server: the plain punch list, the kind worked out from the source', () => {
    const views = dayPunchViews(undefined, [{ time: '09:00', type: 'IN', source: 'missing_punch:approved', sourceLabel: 'Missing Punch' }])
    assert.equal(views[0].source, 'Missing Punch')
    assert.equal(views[0].counted, true)
    assert.equal(dayPunchViews([], [{ time: '09:00', type: 'IN', source: 'manual' }])[0].kind, 'hr')
    assert.equal(kindOf({ source: 'manual' }), 'hr')
    assert.equal(kindOf({ source: 'auto_out' }), 'auto')
    assert.equal(kindOf({ source: 'geo' }), 'geo')
    assert.equal(kindOf({ kind: 'constructor', source: 'biometric' }), 'biometric')
    assert.deepEqual(dayPunchViews(null, null), [])
    assert.equal(punchCountText([]), 'None')
  })

  test('time12', () => {
    assert.equal(time12('00:05'), '12:05 AM')
    assert.equal(time12('12:00:00'), '12:00 PM')
    assert.equal(time12('23:59'), '11:59 PM')
    assert.equal(time12('later'), 'later')
  })
})

describe('earned shift', () => {
  test('text and hint', () => {
    assert.equal(earnedShiftText(1), '1.00 shift')
    assert.equal(earnedShiftText('0.5'), '0.50 shift')
    assert.equal(earnedShiftText(1.5), '1.50 shifts')
    assert.equal(earnedShiftText(null), null)
    assert.equal(earnedShiftText(undefined), null)
    assert.equal(earnedShiftText('abc'), null)
    assert.equal(earnedShiftHint(1), 'Full day')
    assert.equal(earnedShiftHint(0.75), 'Three-quarter day')
    assert.equal(earnedShiftHint(0.5), 'Half day')
    assert.equal(earnedShiftHint(0.25), 'Part of a day')
    assert.equal(earnedShiftHint(0), 'No shift earned')
    assert.equal(earnedShiftHint(null), null)
  })
})

describe('dayActions', () => {
  const now = new Date(2026, 10, 24, 10, 0)
  const w = getRequestWindow(now)
  const base = { late: false, earlyOut: false }

  test('an absent day: leave, and Casual Leave for staff', () => {
    assert.deepEqual(
      dayActions({ ...base, date: '2026-11-20', status: 'absent' }, w, true).actions.map((a) => a.href),
      ['/employee/leave?apply=2026-11-20', '/employee/casual-leave?apply=2026-11-20'],
    )
    assert.deepEqual(dayActions({ ...base, date: '2026-11-20', status: 'absent' }, w, false).actions.map((a) => a.key), ['leave'])
  })

  test('a half day: missing punch; a late / early day: the matching permission', () => {
    const half = dayActions({ date: '2026-11-20', status: 'half_shift', late: true, earlyOut: true }, w, false).actions
    assert.deepEqual(half.map((a) => a.href), ['/employee/missing-punch?apply=2026-11-20', '/employee/permissions?apply=2026-11-20&type=morning_late_in'])
    const early = dayActions({ date: '2026-11-20', status: 'present', late: false, earlyOut: true }, w, false).actions
    assert.deepEqual(early.map((a) => a.href), ['/employee/permissions?apply=2026-11-20&type=evening_early_out'])
    assert.deepEqual(dayActions({ ...base, date: '2026-11-20', status: 'present' }, w, true), { actions: [], closed: false })
  })

  test('a compensated whole day needs no leave or missing punch', () => {
    assert.deepEqual(dayActions({ ...base, date: '2026-11-20', status: 'absent', compensationKind: 'birthday' }, w, true).actions, [])
    assert.deepEqual(dayActions({ ...base, date: '2026-11-20', status: 'half_shift', compensationKind: 'relaxation' }, w, true).actions, [])
  })

  test('outside the request window: no chips, closed', () => {
    assert.deepEqual(dayActions({ ...base, date: '2026-10-30', status: 'absent' }, w, true), { actions: [], closed: true })
    // Grace days: last month is still open on the 1st-5th.
    const grace = getRequestWindow(new Date(2026, 10, 3))
    assert.equal(dayActions({ ...base, date: '2026-10-30', status: 'absent' }, grace, true).closed, false)
  })
})

describe('the form opened on that day', () => {
  const now = new Date(2026, 10, 24, 10, 0)

  test('prefillDate: only a day the form can still take', () => {
    assert.equal(prefillDate('2026-11-20', now), '2026-11-20')
    assert.equal(prefillDate('2026-10-30', now), null) // last month after the 5th: closed
    assert.equal(prefillDate('2026-11-28', now), null) // the future, for a punch / permission
    assert.equal(prefillDate('2026-11-28', now, { allowFuture: true }), '2026-11-28')
    assert.equal(prefillDate('2026-12-01', now, { allowFuture: true }), null)
    assert.equal(prefillDate('2026-11-31', now), null)
    assert.equal(prefillDate('nonsense', now), null)
    assert.equal(prefillDate(null, now), null)
    assert.equal(prefillDate('2026-10-30', new Date(2026, 10, 3)), '2026-10-30') // grace days
  })

  test('permission type: web keys or the app words', () => {
    assert.equal(prefillPermissionType('morning_late_in'), 'morning_late_in')
    assert.equal(prefillPermissionType('Late In'), 'morning_late_in')
    assert.equal(prefillPermissionType('Early Out'), 'evening_early_out')
    assert.equal(prefillPermissionType('middle'), null)
    assert.equal(prefillPermissionType(null), null)
  })

  test('readApplyPrefill / withoutApplyParams', () => {
    assert.equal(readApplyPrefill('?focus=3', now), null)
    assert.deepEqual(readApplyPrefill('?apply=2026-11-20&type=morning_late_in', now), { date: '2026-11-20', permissionType: 'morning_late_in' })
    assert.deepEqual(readApplyPrefill('apply=2026-11-28', now), { date: null, permissionType: null })
    assert.deepEqual(readApplyPrefill('apply=2026-11-28', now, { allowFuture: true }), { date: '2026-11-28', permissionType: null })
    assert.equal(withoutApplyParams('?apply=2026-11-20&type=x&focus=3'), 'focus=3')
    assert.equal(withoutApplyParams('apply=2026-11-20'), '')
  })
})

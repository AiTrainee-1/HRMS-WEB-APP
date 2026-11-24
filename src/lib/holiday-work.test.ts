// Run with `npm test`. How a compensation claim reads on the Department Head's Approvals screen (the claim shape is
// backend/api/holiday_work_views.py::claim_json; every kind since 2026-11-19). Every field but the id may be missing:
// nothing here may throw, and an older backend's claim (no kind, no raisedByRole) reads exactly as before.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { claimBadge, claimDayLabel, claimDecisionToast, claimKindOf, claimRaisedBy, describeClaim } from './holiday-work.ts'
import type { PendingHolidayWorkClaim } from '../types/index.ts'

const sundayClaim: PendingHolidayWorkClaim = {
  id: 2421,
  employeeId: 12,
  employeeCode: 'HW1',
  employeeName: 'Asha Kumar',
  department: 'Cutting',
  designation: null,
  branch: 'Head Office',
  workDate: '2026-10-11',
  dayKind: 'sunday',
  holidayName: null,
  shifts: 0.5,
  reason: 'Dispatch rush',
  status: 'pending',
  requestedBy: 'Meena',
  createdAt: '2026-10-14T06:51:53+00:00',
  hodName: 'Suresh Raj',
}

describe('describeClaim', () => {
  // An older backend's claim (no kind, no raisedByRole): Sunday / holiday work that HR raised, worded as before.
  test('a Sunday claim reads in full', () => {
    assert.deepEqual(describeClaim(sundayClaim), {
      kind: 'holiday_work',
      kindLabel: 'Sunday / holiday work',
      name: 'Asha Kumar',
      code: 'HW1',
      department: 'Cutting',
      workDate: '2026-10-11',
      workDateText: '2026-10-11',
      dateWord: null,
      reason: 'Dispatch rush',
      badge: 'Sunday · 0.50 shift',
      raisedBy: 'hr',
      raisedByText: 'Raised by Meena (HR)',
      approveText: "Approving adds 0.50 shift to Asha Kumar's compensation balance; rejecting adds nothing.",
      note: "Raised by Meena (HR). Approving adds 0.50 shift to Asha Kumar's compensation balance; rejecting adds nothing.",
      overtime: null,
      minutes: null,
    })
  })

  test('a holiday claim names the holiday', () => {
    const v = describeClaim({ ...sundayClaim, dayKind: 'holiday', holidayName: 'Diwali', shifts: 1 })
    assert.equal(v.badge, 'Holiday (Diwali) · 1.00 shift')
  })

  test('the claim is never lost for want of a field', () => {
    const v = describeClaim({ id: 7, workDate: '' } as PendingHolidayWorkClaim)
    assert.equal(v.name, 'Employee')
    assert.equal(v.code, '')
    assert.equal(v.department, null)
    assert.equal(v.workDate, null)
    assert.equal(v.workDateText, '—')
    assert.equal(v.reason, 'No reason given.')
    assert.equal(v.badge, 'Sunday / holiday')
    assert.match(v.note, /^Raised by HR\. Approving adds the claimed shifts to Employee's compensation balance/)
  })

  test('an impossible or odd date is shown as text, never handed to the date formatter', () => {
    assert.equal(describeClaim({ ...sundayClaim, workDate: '2026-02-30' }).workDate, null)
    assert.equal(describeClaim({ ...sundayClaim, workDate: '2026-02-30' }).workDateText, '2026-02-30')
    assert.equal(describeClaim({ ...sundayClaim, workDate: 'Sunday' }).workDate, null)
    assert.equal(describeClaim({ ...sundayClaim, workDate: undefined as unknown as string }).workDateText, '—')
  })

  test('whitespace and non-string values are tolerated', () => {
    const v = describeClaim({ ...sundayClaim, employeeName: '  Asha  ', reason: '   ', requestedBy: 42 as unknown as string, department: '  ' })
    assert.equal(v.name, 'Asha')
    assert.equal(v.reason, 'No reason given.')
    assert.match(v.note, /^Raised by HR\./)
    assert.equal(v.department, null)
  })
})

describe('shifts and day labels', () => {
  test('shifts may arrive as text (a Decimal field) or not at all', () => {
    assert.equal(claimBadge({ dayKind: 'sunday', shifts: '0.25' }), 'Sunday · 0.25 shift')
    assert.equal(claimBadge({ dayKind: 'sunday', shifts: '' }), 'Sunday')
    assert.equal(claimBadge({ dayKind: 'sunday', shifts: 0 }), 'Sunday')
    assert.equal(claimBadge({ dayKind: 'sunday', shifts: 'half' }), 'Sunday')
    assert.equal(claimBadge({ dayKind: 'sunday', shifts: -1 }), 'Sunday')
    assert.equal(claimBadge({ dayKind: 'sunday' }), 'Sunday')
  })

  test('day kinds', () => {
    assert.equal(claimDayLabel({ dayKind: 'sunday' }), 'Sunday')
    assert.equal(claimDayLabel({ dayKind: 'holiday' }), 'Holiday')
    assert.equal(claimDayLabel({ dayKind: 'holiday', holidayName: '  ' }), 'Holiday')
    assert.equal(claimDayLabel({ dayKind: 'holiday', holidayName: 'Pongal' }), 'Holiday (Pongal)')
    assert.equal(claimDayLabel({}), 'Sunday / holiday')
    assert.equal(claimDayLabel({ dayKind: 'weekend' }), 'Sunday / holiday')
  })
})

// ---- every claim kind (2026-11-19: employees claim themselves; one table, one PATCH) ---------------------------------

const employeeOt: PendingHolidayWorkClaim = {
  ...sundayClaim,
  id: 3001,
  kind: 'ot_shift',
  kindLabel: 'Extra hours credit',
  raisedByRole: 'employee',
  requestedBy: 'Asha Kumar',
  workDate: '2026-11-12',
  dayKind: null as unknown as string,
  shifts: 0.75,
  minutes: null,
  overtime: { date: '2026-11-12', shiftEnd: '18:00', lastPunch: '2026-11-13T02:10:00+05:30', extraMinutes: 490 },
}

describe('describeClaim: every kind', () => {
  test('extra hours raised by the employee', () => {
    const v = describeClaim(employeeOt)
    assert.equal(v.kind, 'ot_shift')
    assert.equal(v.badge, 'Extra hours credit · 0.75 shift')
    assert.equal(v.raisedBy, 'employee')
    assert.equal(v.raisedByText, 'Raised by the employee')
    assert.match(v.note, /^Raised by the employee\. Approving adds 0\.75 shift to Asha Kumar's compensation balance/)
    assert.equal(v.dateWord, 'Overtime on')
    assert.equal(v.workDate, '2026-11-12')
    assert.deepEqual(v.overtime, { date: '2026-11-12', shiftEnd: '18:00', lastPunch: '2026-11-13T02:10:00+05:30', lastPunchNextDay: true, extraMinutes: 490 })
  })

  test('a late-in allowance names its minutes and what approving does', () => {
    const v = describeClaim({ ...employeeOt, kind: 'ot_allowance', kindLabel: '', minutes: 30, shifts: undefined })
    assert.equal(v.badge, 'Late-in allowance · 30 min')
    assert.equal(v.minutes, 30)
    assert.match(v.approveText, /arrive up to 30 min later on their next working day/)
  })

  test('a birthday credit and a day off from the balance', () => {
    const b = describeClaim({ ...sundayClaim, kind: 'birthday', raisedByRole: 'hr', shifts: 1, workDate: '2026-11-20' })
    assert.equal(b.badge, 'Birthday credit · 1.00 shift')
    assert.equal(b.dateWord, 'Birthday')
    assert.equal(b.raisedByText, 'Raised by Meena (HR)')

    const u = describeClaim({ ...sundayClaim, kind: 'use_balance', raisedByRole: 'employee', shifts: 0.5, workDate: '2026-11-24', useDate: '2026-11-24' })
    assert.equal(u.badge, 'Day off from balance · 0.50 shift')
    assert.equal(u.dateWord, 'Day off on')
    assert.equal(u.workDate, '2026-11-24')
    assert.match(u.approveText, /^Approving uses 0\.50 shift of Asha Kumar's compensation balance as a paid day off/)
  })

  test('a day off prefers its useDate over the claim date', () => {
    const v = describeClaim({ ...sundayClaim, kind: 'use_balance', workDate: '2026-11-01', useDate: '2026-11-24' })
    assert.equal(v.workDate, '2026-11-24')
  })

  test('an unknown kind keeps the server label; a missing kind is holiday work', () => {
    assert.equal(claimBadge({ kind: 'comp_off', kindLabel: 'Comp off', shifts: 1 }), 'Comp off · 1.00 shift')
    assert.equal(claimBadge({ kind: 'comp_off', shifts: 1 }), 'Comp off · 1.00 shift')
    assert.equal(claimKindOf({}), 'holiday_work')
    assert.equal(claimKindOf({ kind: '  ' }), 'holiday_work')
    assert.equal(claimRaisedBy({}), 'hr')
    assert.equal(claimRaisedBy({ raisedByRole: 'EMPLOYEE' }), 'hr')
    assert.equal(claimRaisedBy({ raisedByRole: 'employee' }), 'employee')
  })

  test('broken overtime blocks never throw', () => {
    assert.equal(describeClaim({ ...employeeOt, overtime: 'x' as unknown as null }).overtime, null)
    assert.equal(describeClaim({ ...employeeOt, overtime: {} }).overtime, null)
    assert.equal(describeClaim({ ...employeeOt, overtime: { lastPunch: '21:30' } }).overtime?.lastPunchNextDay, false)
  })
})

describe('claimDecisionToast', () => {
  test("the server's effect sentence wins", () => {
    assert.deepEqual(claimDecisionToast(employeeOt, 'approved', { credited: true, effect: 'Added 0.75 shift to the balance.' }), {
      title: 'Compensation approved',
      description: 'Added 0.75 shift to the balance.',
    })
  })

  test('else what the kind does; null for a rejection or nothing known', () => {
    assert.equal(claimDecisionToast(employeeOt, 'approved', { credited: true })?.description, "Added to Asha Kumar's compensation balance.")
    assert.match(claimDecisionToast({ ...employeeOt, kind: 'ot_allowance' }, 'approved', {})?.description ?? '', /late-in allowance applies on their next working day/)
    assert.match(claimDecisionToast({ ...employeeOt, kind: 'use_balance' }, 'approved', null)?.description ?? '', /day off is taken from their compensation balance/)
    assert.equal(claimDecisionToast(employeeOt, 'approved', {}), null)
    assert.equal(claimDecisionToast(employeeOt, 'rejected', { credited: true }), null)
  })
})

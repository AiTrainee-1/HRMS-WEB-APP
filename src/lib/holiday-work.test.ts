// Run with `npm test`. How a Holiday / Sunday work claim reads on the Department Head's Approvals screen (the claim shape
// is backend/api/holiday_work_views.py::claim_json). Every field but the id may be missing: nothing here may throw.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { claimBadge, claimDayLabel, describeClaim } from './holiday-work.ts'
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
  test('a Sunday claim reads in full', () => {
    assert.deepEqual(describeClaim(sundayClaim), {
      name: 'Asha Kumar',
      code: 'HW1',
      department: 'Cutting',
      workDate: '2026-10-11',
      workDateText: '2026-10-11',
      reason: 'Dispatch rush',
      badge: 'Sunday · 0.50 shift',
      note: "Raised by Meena (HR). Approving adds 0.50 shift to Asha Kumar's compensation balance; rejecting adds nothing.",
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

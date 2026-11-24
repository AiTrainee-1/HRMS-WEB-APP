// Run with `npm test`. The Department Head's Approvals cards for compensation claims (category "holiday_work", every claim
// kind since 2026-11-19): the type chip, the date line, the overtime facts, who raised it and the approval path's first step.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { claimFacts, claimLine, headSteps, itemDateLabel, itemNote, itemTypeLabel } from './approvals-items.ts'
import type { ApprovalItem } from './approvals-history.ts'

const approval = {
  workflow: 'holiday_work',
  steps: [{ index: 0, roles: ['hod'], mandatory: true, state: 'pending' }],
  currentStep: 0,
}

const oldSunday: ApprovalItem = {
  id: 2421,
  employeeName: 'Asha Kumar',
  employeeCode: 'HW1',
  workDate: '2026-10-11',
  dayKind: 'sunday',
  shifts: 0.5,
  reason: 'Dispatch rush',
  requestedBy: 'Meena',
  createdAt: '2026-10-14T06:51:53+00:00',
  approval,
}

const otShift: ApprovalItem = {
  ...oldSunday,
  id: 3001,
  kind: 'ot_shift',
  kindLabel: 'Extra hours credit',
  raisedByRole: 'employee',
  workDate: '2026-11-12',
  dayKind: null,
  shifts: 0.75,
  overtime: { date: '2026-11-12', shiftEnd: '18:00', lastPunch: '2026-11-13T02:10:00+05:30', extraMinutes: 490 },
}

describe('compensation claims on the head’s cards', () => {
  test('an older backend’s Sunday claim reads as before', () => {
    assert.equal(itemTypeLabel('holiday_work', oldSunday), 'Sunday · 0.50 shift')
    assert.equal(itemDateLabel('holiday_work', oldSunday), '11 Oct 2026')
    assert.match(itemNote('holiday_work', oldSunday) ?? '', /^Raised by Meena \(HR\)\./)
    assert.equal(claimLine(oldSunday), null)
    assert.deepEqual(claimFacts(oldSunday), [
      ['Raised by', 'Meena (HR)'],
      ['Shifts', '0.50 shift'],
    ])
    // HR raised it: the path starts with "HR", not the employee.
    assert.equal(headSteps('holiday_work', oldSunday, () => null)[0].label, 'HR')
  })

  test('extra hours the employee claimed: overtime facts, a next-day last punch, the employee first on the path', () => {
    assert.equal(itemTypeLabel('holiday_work', otShift), 'Extra hours credit · 0.75 shift')
    assert.equal(itemDateLabel('holiday_work', otShift), 'Overtime on 12 Nov 2026')
    assert.equal(claimLine(otShift), 'Shift end 6:00 PM · Last punch 2:10 AM (next day) · 8 h 10 min extra')
    assert.deepEqual(claimFacts(otShift), [
      ['Raised by', 'Asha Kumar (employee)'],
      ['Overtime day', '12 Nov 2026'],
      ['Shift end', '6:00 PM'],
      ['Last punch', '2:10 AM (next day)'],
      ['Extra time', '8 h 10 min'],
      ['Shifts', '0.75 shift'],
    ])
    assert.match(itemNote('holiday_work', otShift) ?? '', /^Raised by the employee\./)
    assert.equal(headSteps('holiday_work', otShift, () => null)[0].label, 'Asha')
  })

  test('a late-in allowance shows its minutes, not shifts', () => {
    const item = { ...otShift, kind: 'ot_allowance', kindLabel: 'Late-in allowance', minutes: 30, shifts: null }
    assert.equal(itemTypeLabel('holiday_work', item), 'Late-in allowance · 30 min')
    const facts = claimFacts(item)
    assert.deepEqual(facts.find(([k]) => k === 'Allowance'), ['Allowance', '30 min late-in'])
    assert.equal(facts.some(([k]) => k === 'Shifts'), false)
  })

  test('a day off from the balance and a birthday credit', () => {
    const use = { ...oldSunday, kind: 'use_balance', raisedByRole: 'employee', useDate: '2026-11-24', workDate: '2026-11-24' }
    assert.equal(itemTypeLabel('holiday_work', use), 'Day off from balance · 0.50 shift')
    assert.equal(itemDateLabel('holiday_work', use), 'Day off on 24 Nov 2026')
    const bday = { ...oldSunday, kind: 'birthday', raisedByRole: 'hr', shifts: 1, workDate: '2026-11-20' }
    assert.equal(itemTypeLabel('holiday_work', bday), 'Birthday credit · 1.00 shift')
    assert.equal(itemDateLabel('holiday_work', bday), 'Birthday 20 Nov 2026')
  })

  test('a claim with nothing but an id never throws', () => {
    const bare: ApprovalItem = { id: 9 }
    assert.equal(itemTypeLabel('holiday_work', bare), 'Sunday / holiday')
    assert.equal(itemDateLabel('holiday_work', bare), '—')
    assert.equal(claimLine(bare), null)
    assert.deepEqual(claimFacts(bare), [['Raised by', 'HR']])
  })
})

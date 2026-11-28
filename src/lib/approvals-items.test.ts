// Run with `npm test`. The Department Head's Approvals cards for compensation claims (category "holiday_work", every claim
// kind since 2026-11-19): the type chip, the date line, the overtime facts, who raised it and the approval path's first step.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  birthdayFacts,
  birthdayLine,
  birthdayRaisedBy,
  claimFacts,
  claimLine,
  headSteps,
  itemDateLabel,
  itemNote,
  itemReason,
  itemTypeLabel,
} from './approvals-items.ts'
import { categoryFromWire, legacyItems, legacyPendingCounts, normalizeSummary, visibleCategories, type ApprovalItem } from './approvals-history.ts'
import { requestTiming } from './request-lead-time.ts'

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

// Birthday Compensation on a chosen date (2026-11-25): its own category, decided by the head first, then HR.
const bdcUse: ApprovalItem = {
  id: 1,
  kind: 'birthday_compensation',
  workflow: 'birthday_compensation',
  employeeCode: 'BDC1',
  employeeName: 'Comp BDC1',
  department: 'VFX Dept',
  birthday: '2026-03-05',
  birthdayText: 'Thursday 5 Mar 2026',
  useDate: '2026-03-03',
  useDateText: 'Tuesday 3 Mar 2026',
  date: '2026-03-03',
  portion: 'first_half',
  portionLabel: 'First half',
  days: 0.5,
  status: 'pending',
  statusKey: 'pending',
  reason: 'Family function',
  raisedByRole: 'employee',
  requestedBy: 'Comp BDC1',
  createdAt: '2026-02-27T06:51:53+00:00',
  approval: {
    workflow: 'birthday_compensation',
    steps: [
      { index: 0, roles: ['hod'], mandatory: true, state: 'pending' },
      { index: 1, roles: ['hr'], mandatory: true, state: 'waiting' },
    ],
    currentStep: 0,
  },
}

describe('Birthday Compensation on the head’s cards', () => {
  test('the category: its wire names, its switch, its place in the rail and the older pending list', () => {
    assert.equal(categoryFromWire('birthday_compensation'), 'birthday_compensation')
    assert.equal(categoryFromWire('birthdayCompensation'), 'birthday_compensation')
    assert.equal(categoryFromWire('birthday'), 'birthday_compensation')
    assert.deepEqual(visibleCategories({ canApproveCompensation: true }), ['leave', 'permission', 'holiday_work', 'birthday_compensation'])
    const s = normalizeSummary({ categories: [{ key: 'birthday_compensation', pending: 2, approved: 1, rejected: 0 }, { key: 'resignation', pending: 1 }, { key: 'holiday_work', pending: 0 }] })!
    assert.deepEqual(s.categories, ['holiday_work', 'birthday_compensation', 'resignation'])
    assert.deepEqual(s.counts.birthday_compensation, { pending: 2, approved: 1, rejected: 0 })
    const lists = { birthdayCompensationUses: [bdcUse] }
    assert.equal(legacyPendingCounts(lists).birthday_compensation?.pending, 1)
    assert.deepEqual(legacyItems(lists, 'birthday_compensation'), [bdcUse])
  })

  test('who, the birthday, the chosen day and part, the reason', () => {
    assert.equal(itemTypeLabel('birthday_compensation', bdcUse), 'Birthday compensation · First half')
    assert.equal(itemDateLabel('birthday_compensation', bdcUse), '03 Mar 2026')
    assert.equal(itemReason('birthday_compensation', bdcUse), 'Family function')
    assert.equal(birthdayLine(bdcUse), 'Birthday 05 Mar 2026 · 0.50 day')
    assert.equal(birthdayRaisedBy(bdcUse), 'employee')
    assert.deepEqual(birthdayFacts(bdcUse), [
      ['Placed by', 'Comp BDC1 (employee)'],
      ['Birthday', 'Thursday 5 Mar 2026'],
      ['Placed on', 'Tuesday 3 Mar 2026'],
      ['Part', 'First half (0.50 day)'],
    ])
    assert.match(itemNote('birthday_compensation', bdcUse) ?? '', /worked on their birthday \(Thursday 5 Mar 2026\)/)
  })

  test('the path: the employee (or HR when HR placed it), the head, then HR', () => {
    const steps = headSteps('birthday_compensation', bdcUse, () => null)
    assert.deepEqual(steps.map((st) => st.label), ['Comp', 'Department Head', 'HR'])
    assert.equal(headSteps('birthday_compensation', { ...bdcUse, raisedByRole: 'hr', requestedBy: 'Meena' }, () => null)[0].label, 'HR')
    assert.equal(birthdayRaisedBy({ ...bdcUse, raisedByRole: 'hr' }), 'hr')
  })

  test('the timing: for the chosen day, applied ahead of it', () => {
    const t = requestTiming('birthday_compensation', bdcUse)
    assert.equal(t.requested, '03 Mar 2026')
    assert.equal(t.lead?.text, 'Applied 4 days before')
  })

  test('a row with nothing but an id never throws', () => {
    const bare: ApprovalItem = { id: 7 }
    assert.equal(itemTypeLabel('birthday_compensation', bare), 'Birthday compensation')
    assert.equal(itemDateLabel('birthday_compensation', bare), '—')
    assert.equal(birthdayLine(bare), null)
    assert.equal(birthdayRaisedBy(bare), null)
    assert.deepEqual(birthdayFacts(bare), [])
  })
})

// Run with `npm test`. Birthday Compensation on a chosen date (2026-11-25): the entitlement as the server sends it, the
// card's figures and words, the birthday month as a calendar, which parts a day can take, the request body, and a
// placement's status / decision words. The JSON is the documented one (api-database-reference.md).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  bdcBalanceText,
  bdcCalendar,
  bdcFigures,
  bdcReady,
  dayLine,
  daysText,
  defaultPortion,
  monthOfDay,
  normalizeUses,
  parseEntitlement,
  parseUse,
  placeBlocked,
  placeBody,
  placeProblem,
  placedText,
  placementApproveText,
  placementDecisionLine,
  placementFacts,
  placementNote,
  placementRaisedText,
  placementStatusInfo,
  placementTypeLabel,
  placementWhatLine,
  portionChoices,
  shortDay,
  stateInfo,
  withdrawEffectText,
  type BdcEntitlement,
} from './birthday-compensation.ts'

const approval = {
  workflow: 'birthday_compensation',
  label: 'Birthday Compensation',
  enabled: true,
  steps: [
    { roles: ['hod'], mandatory: true, label: 'HOD', index: 0, state: 'pending' },
    { roles: ['hr'], mandatory: true, label: 'HR', index: 1, state: 'waiting' },
  ],
  currentStep: 0,
  waitingFor: ['hod'],
  canAct: { hod: true, hr: false },
}

/** The documented use row. */
const USE = {
  id: 1,
  kind: 'birthday_compensation',
  workflow: 'birthday_compensation',
  employeeId: 1,
  employeeCode: 'BDC1',
  employeeName: 'Comp BDC1',
  department: 'VFX Dept',
  employee: { id: 1, employeeCode: 'BDC1', name: 'Comp BDC1', department: 'VFX Dept' },
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
  statusLabel: 'Waiting for the Department Head',
  reason: 'Family function',
  raisedByRole: 'employee',
  requestedBy: 'Comp BDC1',
  createdAt: '2026-11-25T12:21:14.504702+00:00',
  hodReviewedBy: null,
  hodReviewComment: null,
  hrReviewedBy: null,
  hrReviewComment: null,
  reviewedBy: null,
  reviewComment: null,
  canWithdraw: true,
  approval,
}

/** The documented entitlement (March 2026, birthday Thursday 5 Mar, today 12 Mar). */
function entitlementJson(extra: Record<string, unknown> = {}) {
  return {
    employeeId: 1,
    birthday: '2026-03-05',
    birthdayText: 'Thursday 5 Mar 2026',
    weekday: 'Thursday',
    month: { year: 2026, month: 3, label: 'March 2026', from: '2026-03-01', to: '2026-03-31' },
    state: 'available',
    stateLabel: 'To place',
    message: 'You worked on your birthday (Thursday 5 Mar 2026): 1.00 day of Birthday Compensation to place on a day (or two halves) of March 2026, by 31 Mar.',
    worked: true,
    dayStatus: 'present',
    days: { total: 1.0, held: 0.0, used: 0.0, available: 1.0, lapsed: 0.0 },
    windowOpen: true,
    lapsesOn: '2026-03-31',
    canPlace: true,
    placeMessage: null,
    portions: [
      { key: 'full', label: 'Full day', days: 1.0 },
      { key: 'first_half', label: 'First half', days: 0.5 },
      { key: 'second_half', label: 'Second half', days: 0.5 },
    ],
    uses: [],
    eligibleDates: [
      { date: '2026-03-03', weekday: 'Tue', status: 'absent', label: 'Absent', selectable: true, portions: ['full', 'first_half', 'second_half'], suggested: 'full', reason: null, worked: null, halves: { first: '08:30-13:00', second: '14:00-17:30' }, placed: [] },
      { date: '2026-03-05', weekday: 'Thu', status: 'birthday', label: 'Birthday', selectable: false, portions: [], suggested: null, reason: 'The birthday itself cannot be chosen: choose another day of March 2026.', worked: null, halves: null, placed: [] },
      { date: '2026-03-06', weekday: 'Fri', status: 'half_shift', label: 'Half Day · worked the morning', selectable: true, portions: ['second_half', 'full'], suggested: 'second_half', reason: null, worked: 'morning', halves: { first: '08:30-13:00', second: '14:00-17:30' }, placed: [] },
      { date: '2026-03-08', weekday: 'Sun', status: 'off_day', label: 'Sunday', selectable: false, portions: [], suggested: null, reason: 'A Sunday is already a day off: choose a working day.', worked: null, halves: null, placed: [] },
      { date: '2026-03-16', weekday: 'Mon', status: 'future', label: 'Still to come', selectable: true, portions: ['full', 'first_half', 'second_half'], suggested: 'full', reason: null, worked: null, halves: { first: '08:30-13:00', second: '14:00-17:30' }, placed: [] },
    ],
    creditClaim: null,
    approvalPath: 'Employee or HR → HOD → HR',
    workflowEnabled: true,
    isStaff: true,
    enabled: { master: true, birthday: true, workflow: true, canPlace: true },
    today: '2026-03-12',
    ...extra,
  }
}

const ent = (extra: Record<string, unknown> = {}) => parseEntitlement(entitlementJson(extra)) as BdcEntitlement

describe('words', () => {
  test('days are written the way the HRMS writes them', () => {
    assert.equal(daysText(1), '1.00 day')
    assert.equal(daysText(0.5), '0.50 day')
    assert.equal(daysText(0), '0.00 day')
    assert.equal(daysText(1.5), '1.50 days')
    assert.equal(daysText(null), '0.00 day')
    assert.equal(shortDay('2026-03-31'), '31 Mar')
    assert.equal(shortDay('nope'), '')
    assert.equal(monthOfDay('2026-03-05'), 'March 2026')
  })
})

describe('parseEntitlement', () => {
  test('the documented answer is read as it is', () => {
    const e = ent()
    assert.equal(e.isStaff, true)
    assert.equal(e.birthday, '2026-03-05')
    assert.equal(e.birthdayText, 'Thursday 5 Mar 2026')
    assert.deepEqual(e.month, { year: 2026, month: 3, label: 'March 2026', from: '2026-03-01', to: '2026-03-31' })
    assert.equal(e.state, 'available')
    assert.deepEqual(e.days, { total: 1, held: 0, used: 0, available: 1, lapsed: 0 })
    assert.equal(e.canPlace, true)
    assert.equal(e.lapsesOn, '2026-03-31')
    assert.equal(e.eligibleDates.length, 5)
    assert.deepEqual(e.eligibleDates[2].portions, ['second_half', 'full'])
    assert.equal(e.eligibleDates[2].suggested, 'second_half')
    assert.equal(e.eligibleDates[1].selectable, false)
    assert.equal(e.approvalPath, 'Employee or HR → HOD → HR')
    assert.deepEqual(e.enabled, { master: true, birthday: true, workflow: true, canPlace: true })
    assert.equal(e.today, '2026-03-12')
  })

  test('a production answer is valid with nothing to place', () => {
    const e = parseEntitlement({ isStaff: false, message: 'For staff only.', state: 'not_eligible', uses: [], eligibleDates: [], canPlace: false })!
    assert.equal(e.isStaff, false)
    assert.equal(e.canPlace, false)
    assert.equal(e.month, null)
    assert.deepEqual(bdcFigures(e), [])
    assert.equal(bdcCalendar(e), null)
  })

  test('anything that is not the contract is null; junk inside is dropped or neutral', () => {
    assert.equal(parseEntitlement('<html>'), null)
    assert.equal(parseEntitlement([]), null)
    assert.equal(parseEntitlement({ hello: 1 }), null)
    const e = parseEntitlement({
      state: 'available',
      birthday: '2026-02-30',
      canPlace: 'yes',
      days: { total: '1', held: -2, available: 'x' },
      eligibleDates: [null, { date: 'bad' }, { date: '2026-03-03', portions: ['full', 'bonus', 'full'], suggested: 'bonus', selectable: true }],
    })!
    assert.equal(e.birthday, null)
    assert.equal(e.canPlace, false)
    assert.deepEqual(e.days, { total: 1, held: 0, used: 0, available: 0, lapsed: 0 })
    assert.equal(e.eligibleDates.length, 1)
    assert.deepEqual(e.eligibleDates[0].portions, ['full'])
    assert.equal(e.eligibleDates[0].suggested, null)
    // A day the server calls selectable but gives no usable part is never selectable.
    assert.equal(parseEntitlement({ state: 'available', eligibleDates: [{ date: '2026-03-04', selectable: true, portions: [] }] })!.eligibleDates[0].selectable, false)
  })

  test('the month is worked out from the birthday when the server sends none', () => {
    const e = parseEntitlement({ state: 'upcoming', birthday: '2026-04-10' })!
    assert.deepEqual(e.month, { year: 2026, month: 4, label: 'April 2026', from: '2026-04-01', to: '2026-04-30' })
  })
})

describe('the card', () => {
  test('figures: to place, waiting, approved; lapsed only once something lapsed', () => {
    assert.deepEqual(
      bdcFigures(ent()).map((f) => [f.key, f.text]),
      [['available', '1.00 day'], ['held', '0.00 day'], ['used', '0.00 day']],
    )
    const lapsed = ent({ state: 'lapsed', days: { total: 1, held: 0, used: 0.5, available: 0, lapsed: 0.5 } })
    assert.deepEqual(bdcFigures(lapsed).map((f) => f.key), ['available', 'held', 'used', 'lapsed'])
    // Not worked (paid birthday leave): nothing to count.
    assert.deepEqual(bdcFigures(ent({ state: 'paid_leave', days: { total: 0 } })), [])
  })

  test('the balance line', () => {
    assert.equal(bdcBalanceText(ent()), '1.00 day to place by 31 Mar')
    assert.equal(
      bdcBalanceText(ent({ days: { total: 1, held: 0.5, used: 0, available: 0.5, lapsed: 0 } })),
      '0.50 day to place by 31 Mar, 0.50 day waiting for approval',
    )
    assert.equal(bdcBalanceText(ent({ state: 'lapsed', days: { total: 1, used: 0.5, lapsed: 0.5 } })), '0.50 day approved, 0.50 day lapsed')
    assert.equal(bdcBalanceText(ent({ days: { total: 0 } })), null)
    assert.equal(bdcBalanceText(null), null)
  })

  test('ready only while it can be placed and something is left', () => {
    assert.equal(bdcReady(ent()), true)
    assert.equal(placeBlocked(ent()), null)
    const off = ent({ canPlace: false, placeMessage: 'No Department Head may approve compensation for you yet. Ask HR.' })
    assert.equal(bdcReady(off), false)
    assert.equal(placeBlocked(off), 'No Department Head may approve compensation for you yet. Ask HR.')
    const placed = ent({ state: 'placed', canPlace: false, days: { total: 1, held: 1, available: 0 } })
    assert.match(placeBlocked(placed)!, /All of your Birthday Compensation is placed/)
    assert.match(placeBlocked(ent({ state: 'lapsed', canPlace: false, days: { total: 1, lapsed: 1 } }))!, /March 2026 is over/)
    assert.equal(placeBlocked(ent({ state: 'upcoming', canPlace: false, message: 'Your birthday is on 5 Mar.' })), 'Your birthday is on 5 Mar.')
    assert.equal(bdcReady(null), false)
  })

  test('the state chip: the server\'s words, a tone per state', () => {
    assert.deepEqual(stateInfo(ent()), { label: 'To place', chip: 'chip-info', live: true })
    assert.equal(stateInfo(ent({ state: 'placed', stateLabel: 'Placed', days: { total: 1, held: 0.5, used: 0.5 } })).chip, 'chip-warning')
    assert.equal(stateInfo(ent({ state: 'placed', stateLabel: 'Placed', days: { total: 1, used: 1 } })).chip, 'chip-success')
    assert.equal(stateInfo(ent({ state: 'something_new', stateLabel: '' })).label, 'Something new')
    assert.equal(stateInfo(ent({ state: 'something_new' })).chip, 'chip-muted')
  })
})

describe('choosing the day', () => {
  test('the month as a calendar, Sunday first: blanks before the 1st, every day with the server\'s word', () => {
    const cells = bdcCalendar(ent())!
    // 1 Mar 2026 is a Sunday: no blank.
    assert.equal(cells.length, 31)
    assert.equal(cells[0]!.date, '2026-03-01')
    const third = cells[2]!
    assert.equal(third.selectable, true)
    assert.equal(third.info?.status, 'absent')
    const fifth = cells[4]!
    assert.equal(fifth.birthday, true)
    assert.equal(fifth.selectable, false)
    assert.equal(cells[11]!.today, true)
    // A day the server said nothing about is never selectable.
    assert.equal(cells[1]!.info, null)
    assert.equal(cells[1]!.selectable, false)
    // 1 Apr 2026 is a Wednesday: three blanks.
    const april = bdcCalendar(parseEntitlement({ state: 'available', birthday: '2026-04-10' }))!
    assert.deepEqual(april.slice(0, 4).map((c) => c?.date ?? null), [null, null, null, '2026-04-01'])
    assert.equal(april.filter(Boolean).length, 30)
  })

  test('a day with a placement already on it says so', () => {
    const e = ent({
      eligibleDates: [
        { date: '2026-03-16', status: 'future', label: 'Still to come', selectable: true, portions: ['second_half'], placed: [{ id: 9, portion: 'first_half', status: 'pending' }, { id: 8, portion: 'full', status: 'rejected' }] },
      ],
    })
    const cell = bdcCalendar(e)!.find((c) => c?.date === '2026-03-16')!
    assert.deepEqual(cell.placed, [{ id: 9, portion: 'first_half', status: 'pending' }])
    const [full, first, second] = portionChoices(e.eligibleDates[0], 1)
    assert.equal(full.why, 'Already placed on this day')
    assert.equal(first.why, 'Already placed on this day')
    assert.equal(second.allowed, true)
  })

  test('an absent day takes every part; the halves carry their clock times', () => {
    const e = ent()
    const choices = portionChoices(e.eligibleDates[0], 1)
    assert.deepEqual(choices.map((c) => [c.portion, c.allowed]), [['full', true], ['first_half', true], ['second_half', true]])
    assert.equal(choices[1].hint, '0.50 day · 08:30-13:00')
    assert.equal(choices[0].hint, '1.00 day')
    assert.equal(defaultPortion(e.eligibleDates[0], 1), 'full')
  })

  test('a half day takes the missed half or the full day, never the half that was worked', () => {
    const half = ent().eligibleDates[2]
    const [full, first, second] = portionChoices(half, 1)
    assert.equal(full.allowed, true)
    assert.equal(first.allowed, false)
    assert.equal(first.why, 'You worked this half')
    assert.equal(second.allowed, true)
    assert.equal(defaultPortion(half, 1), 'second_half')
  })

  test('with 0.50 left only halves fit; the default moves to an allowed one', () => {
    const absent = ent().eligibleDates[0]
    const [full, first] = portionChoices(absent, 0.5)
    assert.equal(full.allowed, false)
    assert.equal(full.why, 'Only 0.50 day left')
    assert.equal(first.allowed, true)
    assert.equal(defaultPortion(absent, 0.5), 'first_half')
    // A half day with 0.50 left: the missed half.
    assert.equal(defaultPortion(ent().eligibleDates[2], 0.5), 'second_half')
  })

  test('no day picked: every part off, "Pick a day first"; a refused day: nothing to pick', () => {
    assert.ok(portionChoices(null, 1).every((c) => !c.allowed && c.why === 'Pick a day first'))
    const birthday = ent().eligibleDates[1]
    assert.ok(portionChoices(birthday, 1).every((c) => !c.allowed && c.why === 'Not on this day'))
    assert.equal(defaultPortion(birthday, 1), null)
  })

  test('the line under the calendar: the day and its label, or why it cannot be chosen', () => {
    const e = ent()
    assert.equal(dayLine(e.eligibleDates[0]), 'Tue, 3 Mar 2026 · Absent')
    assert.equal(dayLine(e.eligibleDates[3]), 'Sun, 8 Mar 2026 · Sunday: A Sunday is already a day off: choose a working day.')
    assert.equal(dayLine(null), null)
  })
})

describe('sending it', () => {
  const ok = { date: '2026-03-03', portion: 'first_half' as const, reason: '' }

  test('every problem in words, first the one that blocks', () => {
    const e = ent()
    assert.equal(placeProblem({ ...ok, date: '' }, e), 'Pick a day of March 2026.')
    assert.equal(placeProblem({ ...ok, date: '2026-03-08' }, e), 'A Sunday is already a day off: choose a working day.')
    assert.equal(placeProblem({ ...ok, date: '2026-03-20' }, e), 'That day cannot take Birthday Compensation: pick another one.')
    assert.equal(placeProblem({ ...ok, portion: null }, e), 'Pick a full day, a first half or a second half.')
    assert.equal(placeProblem({ ...ok, date: '2026-03-06', portion: 'first_half' }, e), 'On Fri, 6 Mar 2026 only full day or second half can be placed.')
    assert.equal(placeProblem({ ...ok, reason: 'x'.repeat(501) }, e), 'The reason can be at most 500 characters.')
    assert.equal(placeProblem(ok, e), null)
    // Switched off / nothing left: the server's reason.
    assert.equal(placeProblem(ok, ent({ canPlace: false, placeMessage: 'Switched off by HR.' })), 'Switched off by HR.')
  })

  test('the body: the reason only when written', () => {
    assert.deepEqual(placeBody({ ...ok, reason: '   ' }), { useDate: '2026-03-03', portion: 'first_half' })
    assert.deepEqual(placeBody({ ...ok, reason: '  Family function ' }), { useDate: '2026-03-03', portion: 'first_half', reason: 'Family function' })
  })

  test('the sent screen names the part and the day', () => {
    assert.equal(placedText({ date: '2026-03-03', portion: 'first_half' }), 'The first half of Tue, 3 Mar 2026')
    assert.equal(placedText({ date: '2026-03-16', portion: 'full' }), 'The full day of Mon, 16 Mar 2026')
  })
})

describe('a placement', () => {
  test('the documented row is read as it is', () => {
    const u = parseUse(USE)!
    assert.equal(u.key, 'bdcu-1')
    assert.equal(u.employeeName, 'Comp BDC1')
    assert.equal(u.useDate, '2026-03-03')
    assert.equal(u.portion, 'first_half')
    assert.equal(u.days, 0.5)
    assert.equal(u.canWithdraw, true)
    assert.equal(u.approval?.workflow, 'birthday_compensation')
    assert.equal(placementWhatLine(u), 'First half · Tuesday 3 Mar 2026')
    assert.equal(placementRaisedText(u), 'Placed by you')
    assert.equal(placementRaisedText({ raisedByRole: 'hr', requestedBy: 'Meena' }), 'Placed by HR (Meena)')
    assert.equal(placementRaisedText({ raisedByRole: 'hr', requestedBy: null }), 'Placed by HR')
  })

  test('where it stands: the head\'s step and HR\'s told apart', () => {
    const u = parseUse(USE)!
    assert.deepEqual(placementStatusInfo(u), { label: 'Waiting for the Department Head', chip: 'chip-warning', live: true })
    const hr = parseUse({ ...USE, statusKey: 'pending_hr', statusLabel: '' })!
    assert.deepEqual(placementStatusInfo(hr), { label: 'Approved by your Department Head, waiting for HR', chip: 'chip-info', live: true })
    assert.equal(placementStatusInfo(parseUse({ ...USE, status: 'approved', statusKey: 'approved', statusLabel: 'Approved: first half paid on 3 Mar' })!).label, 'Approved: first half paid on 3 Mar')
    assert.equal(placementStatusInfo(parseUse({ ...USE, status: 'rejected', statusKey: 'rejected', statusLabel: '' })!).chip, 'chip-danger')
    assert.equal(placementStatusInfo(parseUse({ ...USE, status: 'withdrawn', statusKey: 'withdrawn', statusLabel: '' })!).chip, 'chip-muted')
    assert.equal(placementStatusInfo(parseUse({ ...USE, status: 'odd', statusKey: 'odd', statusLabel: '' })!).label, 'Odd')
  })

  test('who decided, in one line', () => {
    const base = parseUse(USE)!
    assert.equal(placementDecisionLine(base), null)
    assert.equal(
      placementDecisionLine({ ...base, statusKey: 'pending_hr', hodReviewedBy: 'Kavya' }),
      'Approved by your Department Head (Kavya); HR decides next.',
    )
    assert.equal(
      placementDecisionLine({ ...base, status: 'approved', statusKey: 'approved', hodReviewedBy: 'Kavya', hrReviewedBy: 'Meena' }),
      'Approved by your Department Head (Kavya) and HR (Meena).',
    )
    assert.equal(
      placementDecisionLine({ ...base, status: 'rejected', hodReviewedBy: 'Kavya', hodReviewComment: 'Busy week', reviewComment: 'Busy week' }),
      'Not approved by your Department Head (Kavya): Busy week',
    )
    // The head approved, HR rejected: HR is named.
    assert.equal(
      placementDecisionLine({ ...base, status: 'rejected', hodReviewedBy: 'Kavya', hrReviewedBy: 'Meena', hrReviewComment: 'Payroll closed', reviewComment: null }),
      'Not approved by HR (Meena): Payroll closed',
    )
    assert.equal(placementDecisionLine({ ...base, status: 'withdrawn' }), null)
  })

  test('only a waiting one may be withdrawn; what withdrawing does', () => {
    assert.equal(parseUse({ ...USE, status: 'approved', canWithdraw: true })!.canWithdraw, false)
    assert.equal(parseUse({ ...USE, canWithdraw: undefined, raisedByRole: 'hr' })!.canWithdraw, false)
    assert.equal(parseUse({ ...USE, canWithdraw: undefined })!.canWithdraw, true)
    assert.equal(withdrawEffectText(parseUse(USE)!), 'It stops waiting for approval, and the 0.50 day can be placed again while March 2026 lasts.')
  })

  test('the list in any shape, unique by id, junk dropped; not a list = null', () => {
    assert.deepEqual(normalizeUses({ items: [USE, USE, { id: 2, portion: 'full' }, null, { portion: 'full' }] })!.map((u) => u.key), ['bdcu-1', 'bdcu-2'])
    assert.equal(normalizeUses([{ id: 3, portion: 'full' }])![0].days, 1)
    assert.equal(normalizeUses({ uses: [] })!.length, 0)
    assert.equal(normalizeUses('<html>'), null)
    assert.equal(normalizeUses({ items: 'x' }), null)
  })
})

describe('the Department Head\'s words', () => {
  test('type, facts, what approving does and the note', () => {
    const u = parseUse(USE)!
    assert.equal(placementTypeLabel(u), 'Birthday compensation · First half')
    assert.equal(placementTypeLabel({ portionLabel: '' }), 'Birthday compensation')
    assert.deepEqual(placementFacts(u), [
      ['Placed by', 'Comp BDC1 (employee)'],
      ['Birthday', 'Thursday 5 Mar 2026'],
      ['Placed on', 'Tuesday 3 Mar 2026'],
      ['Part', 'First half (0.50 day)'],
    ])
    assert.equal(placementFacts(parseUse({ ...USE, raisedByRole: 'hr', requestedBy: 'Meena' })!)[0][1], 'Meena (HR)')
    assert.equal(
      placementApproveText(u),
      "Approving passes it to HR, who decides last. Once HR approves, Comp's first half on 3 Mar is paid like a Casual Leave (no leave balance is used).",
    )
    assert.match(placementApproveText(parseUse({ ...USE, portion: 'full' })!), /Comp's full day on 3 Mar/)
    assert.equal(
      placementNote(u),
      'They worked on their birthday (Thursday 5 Mar 2026), so 1.00 day of Birthday Compensation can be placed on working days of March 2026.',
    )
  })
})

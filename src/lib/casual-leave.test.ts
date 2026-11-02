// Run with `npm test`. Casual Leave rules (lib/casual-leave.ts), the same vectors as the mobile app's casualLeave.test.ts
// where they overlap, plus the web's own helpers.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  asPortion,
  asStatus,
  balanceBreakdown,
  balanceCardState,
  balanceHeadline,
  balanceLine,
  balanceSinceDate,
  balanceSinceText,
  clCardState,
  clFormProblem,
  clock12,
  dayMarks,
  daysText,
  defaultApplyDate,
  dialWords,
  firstAllowed,
  halfNum,
  historyRows,
  isCasualLeaveEligible,
  isYearlyBalance,
  mergeUsageRows,
  monthBlock,
  monthCardState,
  monthShapeText,
  monthWeeks,
  portionChoices,
  portionMeaning,
  readBalance,
  readHistory,
  readMonthsUsage,
  thisMonthOf,
  yearMonths,
  yearRange,
  yearTotals,
  type CLBalance,
  type CLMonth,
  type CLRow,
} from './casual-leave.ts'

const october = (over: Partial<CLMonth> = {}): CLMonth => ({
  month: '2026-10',
  label: 'October 2026',
  eligible: true,
  reason: null,
  left: 'full',
  usedParts: [],
  usedHalves: [],
  ...over,
})

test('eligibility: any open month, else the overall flag', () => {
  assert.equal(isCasualLeaveEligible({ eligible: false, months: [{ month: '2026-10', label: 'October 2026', eligible: true, reason: null }] }), true)
  assert.equal(isCasualLeaveEligible({ eligible: true, months: [] }), true)
  assert.equal(isCasualLeaveEligible({ eligible: false }), false)
})

test('reading the server: portion and status', () => {
  assert.equal(asPortion('first_half'), 'first_half')
  assert.equal(asPortion(undefined), 'full')
  assert.equal(asPortion('weird'), 'full')
  assert.equal(asStatus('Approved'), 'approved')
  assert.equal(asStatus('rejected'), 'rejected')
  assert.equal(asStatus(null), 'pending')
})

test('days and clock words', () => {
  assert.equal(daysText(1), '1 day')
  assert.equal(daysText(0.5), '½ day')
  assert.equal(daysText(1.5), '1½ days')
  assert.equal(daysText(0), '0 days')
  assert.equal(clock12('13:05'), '1:05 PM')
  assert.equal(clock12('00:30'), '12:30 AM')
  assert.equal(clock12('x'), 'x')
})

test('what each part means in shift time', () => {
  const shift = { start: '09:00', end: '18:00', firstHalfEnd: '13:00', secondHalfStart: '13:45' }
  assert.equal(portionMeaning('full', shift), 'The whole shift off (9:00 AM - 6:00 PM), paid.')
  assert.equal(portionMeaning('first_half', shift), '9:00 AM - 1:00 PM off, paid. Come in for the second half from 1:45 PM.')
  assert.equal(portionMeaning('second_half', shift), '1:45 PM - 6:00 PM off, paid. Work the first half from 9:00 AM.')
  assert.equal(portionMeaning('full', null), 'The whole day off, paid.')
})

test('this month card: open, one half left, used, closed', () => {
  assert.equal(monthCardState(october()).title, 'Full day available')
  const half = monthCardState(october({ left: 'one_half', usedParts: [{ date: '2026-10-05', portion: 'first_half', status: 'pending' }] }))
  assert.equal(half.tone, 'half')
  assert.equal(half.detail, 'First half on 5 Oct (waiting). You can still take one half-day.')
  const used = monthCardState(october({ left: 'nothing', eligible: true, usedParts: [{ date: '2026-10-07', portion: 'full', status: 'approved' }] }))
  assert.equal(used.tone, 'used')
  assert.equal(used.detail, 'Full day on 7 Oct (approved)')
  const closed = monthCardState(october({ eligible: false, left: 'nothing', reason: 'You joined less than a year ago.' }))
  assert.deepEqual(closed, { tone: 'closed', title: 'Not available', detail: 'You joined less than a year ago.' })
  assert.equal(monthCardState(undefined, { eligible: false, reason: 'No' }).detail, 'No')
  assert.equal(monthCardState(undefined).tone, 'open')
})

test('this month of the list, a picked month block and the default date', () => {
  const sept = october({ month: '2026-09', label: 'September 2026', left: 'nothing', usedParts: [] })
  const months = [sept, october()]
  assert.equal(thisMonthOf(months, new Date(2026, 9, 1))?.month, '2026-10')
  assert.equal(thisMonthOf(undefined, new Date()), undefined)
  assert.equal(monthBlock(months, '2026-09-30'), 'Casual Leave for September 2026 is already used.')
  assert.equal(monthBlock(months, '2026-10-02'), null)
  assert.equal(defaultApplyDate(new Date(2026, 9, 2), months), '2026-10-02')
  // this month used, last month still open on the grace days: start on last month
  const flipped = [october({ month: '2026-09', label: 'September 2026' }), october({ left: 'nothing' })]
  assert.equal(defaultApplyDate(new Date(2026, 9, 2), flipped), '2026-09-01')
})

test('which parts may be picked', () => {
  const full = portionChoices(october(), '2026-10-09')
  assert.equal(full.full.enabled && full.first_half.enabled && full.second_half.enabled, true)
  const oneHalf = october({ left: 'one_half', usedHalves: [{ date: '2026-10-09', portion: 'first_half' }] })
  const c = portionChoices(oneHalf, '2026-10-09')
  assert.equal(c.full.enabled, false)
  assert.equal(c.first_half.enabled, false)
  assert.equal(c.first_half.why, 'The first half of 9 Oct is already asked for.')
  assert.equal(c.second_half.enabled, true)
  assert.equal(firstAllowed(c), 'second_half')
  // another date: both halves free
  assert.equal(portionChoices(oneHalf, '2026-10-10').first_half.enabled, true)
  const shut = portionChoices(october({ eligible: false, reason: 'Not this month' }), '2026-10-10')
  assert.equal(shut.full.why, 'Not this month')
  assert.equal(firstAllowed(shut), null)
  assert.equal(portionChoices(undefined, '2026-10-10').full.enabled, true)
})

test('the year: dial slots, totals, day marks', () => {
  const rows: CLRow[] = [
    { id: 1, date: '2026-01-12', portion: 'full', status: 'approved' },
    { id: 2, date: '2026-03-05', portion: 'second_half', status: 'approved' },
    { id: 3, date: '2026-03-02', portion: 'first_half', status: 'pending' },
    { id: 4, date: '2026-04-09', portion: 'full', status: 'rejected' },
    { id: 5, date: '2026-05-20', portion: 'first_half', status: 'approved' },
    { id: 6, date: '2025-12-10', portion: 'full', status: 'approved' },
  ]
  const months = yearMonths(rows, 2026)
  assert.equal(months.length, 12)
  assert.equal(months[0].shape, 'full')
  assert.equal(months[0].slots[0]?.status, 'approved')
  assert.equal(months[2].shape, 'two_halves')
  assert.equal(months[2].slots[0]?.date, '2026-03-02') // date order
  assert.equal(months[2].slots[0]?.status, 'pending')
  assert.equal(months[2].approvedDays, 0.5)
  assert.equal(months[2].waitingDays, 0.5)
  assert.equal(months[3].shape, 'none') // rejected is not leave
  assert.equal(months[4].shape, 'one_half')
  assert.equal(dialWords(months[0]), 'full day, approved')
  assert.equal(dialWords(months[2]), 'half day on 2 Mar, waiting for approval; half day on 5 Mar, approved')
  assert.equal(dialWords(months[3]), 'no Casual Leave')
  const t = yearTotals(rows, 2026)
  assert.deepEqual(t, { takenDays: 2, waitingDays: 0.5, rejected: 1, applications: 5, monthsUsed: 3 })
  const marks = dayMarks([...rows, { id: 7, date: '2026-03-05', portion: 'first_half', status: 'pending' }])
  assert.deepEqual(marks['2026-03-05'], { first: 'pending', second: 'approved' })
  assert.deepEqual(marks['2026-01-12'], { first: 'approved', second: 'approved' })
  assert.equal(marks['2026-04-09'], undefined)
  assert.deepEqual(yearRange(rows, 2026), { min: 2025, max: 2026 })
  assert.deepEqual(yearRange([], 2026), { min: 2025, max: 2026 })
})

test('month weeks start on Sunday and are padded', () => {
  const weeks = monthWeeks(2026, 10) // 1 Oct 2026 is a Thursday
  assert.deepEqual(weeks[0], [null, null, null, null, 1, 2, 3])
  assert.equal(weeks.every((w) => w.length === 7), true)
  assert.equal(weeks.flat().filter(Boolean).length, 31)
})

test('form problems', () => {
  assert.equal(clFormProblem({ portion: null, reason: 'Temple visit' }), 'Choose Full day, First half or Second half.')
  assert.equal(clFormProblem({ portion: 'full', reason: 'abc' }), 'Please give a reason (at least 5 letters).')
  assert.equal(clFormProblem({ portion: 'first_half', reason: 'Temple visit' }), null)
})

// ─── The yearly balance (owner 2026-11-02): 12 a year, carry-forward, lapses 31 Dec, half = 0.5 ───

const balance2026 = (over: Partial<CLBalance> = {}): CLBalance => ({
  total: 12,
  used: 1,
  pending: 0,
  remaining: 11,
  year: 2026,
  since: '2026-11-02',
  endsOn: '2026-12-31',
  cutOver: '2026-11-02',
  tracked: true,
  ...over,
})

const november = (over: Partial<CLMonth> = {}): CLMonth =>
  october({ month: '2026-11', label: 'November 2026', rule: 'yearly_balance', remaining: 11, usedFullDates: [], ...over })

test('reading the balance block; an older server has none', () => {
  assert.deepEqual(
    readBalance({ total: 12, used: 1, pending: 0.5, remaining: 10.5, year: 2026, since: '2026-11-02', endsOn: '2026-12-31', cutOver: '2026-11-02', tracked: true }),
    balance2026({ pending: 0.5, remaining: 10.5 }),
  )
  assert.equal(readBalance(undefined), null)
  assert.equal(readBalance({ total: 12 }), null)
  const b = readBalance({ total: '12', used: 0, pending: 0, remaining: '12', year: 2027, since: '2027-01-01' })!
  assert.equal(b.total, 12)
  assert.equal(b.endsOn, '2027-12-31')
  assert.equal(b.tracked, true)
  assert.equal(isYearlyBalance({ balance: b, rule: 'yearly_balance' }), true)
  assert.equal(isYearlyBalance({ balance: b, rule: 'one_per_month' }), false)
  assert.equal(isYearlyBalance({ balance: { ...b, tracked: false } }), false)
  assert.equal(isYearlyBalance({ balance: null }), false)
  assert.equal(isYearlyBalance(undefined), false)
})

test('balance words', () => {
  assert.equal(halfNum(11), '11')
  assert.equal(halfNum(10.5), '10½')
  assert.equal(halfNum(0.5), '½')
  assert.equal(halfNum(0), '0')
  assert.equal(balanceHeadline(balance2026()), '11 of 12 CL left in 2026')
  assert.equal(balanceLine(balance2026()), '11 of 12 CL left in 2026 · resets on 1 Jan')
  assert.equal(balanceLine(balance2026({ remaining: 10.5 })), '10½ of 12 CL left in 2026 · resets on 1 Jan')
  assert.equal(balanceBreakdown(balance2026({ pending: 0.5 })), '1 day taken · ½ day waiting for approval')
  assert.equal(balanceBreakdown(balance2026({ used: 0 })), 'Nothing taken yet')
  assert.equal(balanceSinceDate(balance2026()), '2 Nov 2026')
  assert.equal(balanceSinceText(balance2026()), 'Counted from 2 Nov 2026')
  assert.equal(balanceSinceText(balance2026({ year: 2027, since: '2027-01-01' })), null) // a whole year
})

test('the balance card: open, half left, none left, not eligible', () => {
  const open = balanceCardState(balance2026({ pending: 0.5, remaining: 10.5 }), november())
  assert.equal(open.tone, 'open')
  assert.equal(open.title, '10½ of 12 CL left in 2026')
  assert.equal(open.detail, 'Take a full day or a half-day on any date while it lasts. ½ day is waiting for approval. Unused days lapse on 31 Dec; a fresh 12 start on 1 Jan.')
  const half = balanceCardState(balance2026({ used: 11.5, remaining: 0.5 }), november({ left: 'one_half', remaining: 0.5 }))
  assert.equal(half.tone, 'half')
  assert.equal(half.detail, 'Only a half-day is left this year. A fresh 12 start on 1 Jan.')
  const none = balanceCardState(balance2026({ used: 10, pending: 2, remaining: 0 }), november({ eligible: false, left: 'nothing', reason: 'No Casual Leave left for 2026' }))
  assert.deepEqual(none, { tone: 'used', title: 'No CL left in 2026', detail: 'All 12 days of 2026 are taken or waiting for approval. A fresh 12 start on 1 Jan.' })
  const closed = balanceCardState(balance2026({ used: 0, remaining: 12 }), november({ eligible: false, left: 'nothing', reason: 'Eligible after 6 months of service (currently 4)' }))
  assert.deepEqual(closed, { tone: 'closed', title: 'Not available', detail: 'Eligible after 6 months of service (currently 4)' })
  // no months from the server: the overall answer decides
  assert.equal(balanceCardState(balance2026(), undefined, { eligible: true }).tone, 'open')
})

test('clCardState: the balance when the server keeps one, else this month', () => {
  const today = new Date(2026, 10, 5)
  assert.equal(clCardState({ balance: balance2026(), rule: 'yearly_balance', months: [november()], eligible: true }, today).title, '11 of 12 CL left in 2026')
  assert.equal(clCardState({ balance: null, rule: null, months: [october({ month: '2026-11' })], eligible: true }, today).title, 'Full day available')
})

test('yearly rule: which parts may be picked on a date', () => {
  // any number per month while the balance lasts: a used full day elsewhere in the month does not block
  const m = november({ usedFullDates: ['2026-11-05'], usedHalves: [{ date: '2026-11-09', portion: 'first_half' }] })
  const free = portionChoices(m, '2026-11-12')
  assert.equal(free.full.enabled && free.first_half.enabled && free.second_half.enabled, true)
  // a full day already on that date: nothing more fits
  const full = portionChoices(m, '2026-11-05')
  assert.equal(full.full.enabled || full.first_half.enabled || full.second_half.enabled, false)
  assert.equal(full.first_half.why, '5 Nov is already a full day of Casual Leave. Choose another date.')
  // a half already on that date: the other half only, never a full day
  const halfDay = portionChoices(m, '2026-11-09')
  assert.equal(halfDay.full.enabled, false)
  assert.equal(halfDay.full.why, 'Half of 9 Nov is already asked for, so a full day cannot be added. Choose the other half or another date.')
  assert.equal(halfDay.first_half.enabled, false)
  assert.equal(halfDay.second_half.enabled, true)
  assert.equal(firstAllowed(halfDay), 'second_half')
  // half a day left in the year: halves only
  const low = portionChoices(november({ left: 'one_half', remaining: 0.5 }), '2026-11-20')
  assert.equal(low.full.enabled, false)
  assert.equal(low.full.why, 'Only half a day of Casual Leave is left for 2026.')
  assert.equal(low.first_half.enabled, true)
  // nothing left
  const none = portionChoices(november({ eligible: false, left: 'nothing', reason: null }), '2026-11-20')
  assert.equal(none.second_half.why, 'No Casual Leave left for 2026.')
  assert.equal(monthBlock([november({ eligible: false, left: 'nothing', reason: null })], '2026-11-20'), 'No Casual Leave left for 2026.')
  assert.equal(monthBlock([november()], '2026-11-20'), null)
})

test('the year: more than a day in a month, and Casual Leave by HR', () => {
  const rows: CLRow[] = [
    { id: 1, date: '2026-11-03', portion: 'full', status: 'approved' },
    { id: 2, date: '2026-11-10', portion: 'first_half', status: 'pending' },
    { id: 3, date: '2026-11-12', portion: 'full', status: 'approved', source: 'hr_edit' },
    { id: 4, date: '2026-12-01', portion: 'full', status: 'pending' },
    { id: 5, date: '2026-12-02', portion: 'full', status: 'pending' },
  ]
  const months = yearMonths(rows, 2026)
  const nov = months[10]
  assert.equal(nov.shape, 'many')
  assert.equal(nov.approvedDays, 2) // no cap at one day any more
  assert.equal(nov.waitingDays, 0.5)
  assert.equal(nov.days, 2.5)
  assert.equal(nov.byHr, true)
  assert.equal(nov.slots[0]?.status, 'approved')
  assert.equal(nov.slots[1]?.status, 'pending')
  assert.equal(monthShapeText(nov), '2½ days')
  assert.equal(dialWords(nov), '2 days approved, ½ day waiting for approval (some given by HR)')
  const dec = months[11]
  assert.equal(dec.shape, 'many')
  assert.equal(dec.slots[0]?.portion, 'full')
  assert.equal(dec.slots[0]?.status, 'pending')
  assert.equal(dec.byHr, false)
  assert.equal(monthShapeText(months[0]), '—')
  assert.equal(monthShapeText({ shape: 'two_halves', days: 1 }), '2 halves')
  assert.equal(yearTotals(rows, 2026).takenDays, 2)
  assert.equal(yearTotals(rows, 2026).waitingDays, 2.5)
})

const usageReply = [
  { month: '2026-10', label: 'October 2026', used: 0, pending: 0, beforeCutOver: 1, rule: 'one_per_month', parts: [
    { id: 7, requestKind: 'casual_leave', date: '2026-10-06', portion: 'full', portionLabel: 'Full day', days: 1, status: 'approved', source: 'employee', counted: false },
  ] },
  { month: '2026-11', label: 'November 2026', used: 1, pending: 0.5, beforeCutOver: 0, rule: 'yearly_balance', parts: [
    { id: 9, requestKind: 'casual_leave', date: '2026-11-05', portion: 'full', portionLabel: 'Full day', days: 1, status: 'approved', source: 'hr_edit', counted: true },
    { id: 9, requestKind: 'attendance_correction', date: '2026-11-07', portion: 'first_half', portionLabel: 'Half day (first half)', days: 0.5, status: 'pending', source: 'hr_edit', counted: true },
  ] },
]

test('monthsUsage: read, and merged with the request list', () => {
  const usage = readMonthsUsage(usageReply)!
  assert.equal(usage.length, 2)
  assert.equal(usage[0].rule, 'one_per_month')
  assert.equal(usage[0].parts[0].counted, false)
  assert.equal(usage[1].parts[1].requestKind, 'attendance_correction')
  assert.equal(readMonthsUsage(undefined), null)
  const list: CLRow[] = [
    { id: '7', date: '2026-10-06', portion: 'full', status: 'approved', source: 'employee' },
    { id: '9', date: '2026-11-05', portion: 'full', status: 'approved', source: 'hr_edit' },
    { id: '11', date: '2026-11-20', portion: 'full', status: 'rejected', source: 'employee' },
    { id: '3', date: '2025-06-02', portion: 'full', status: 'approved', source: 'employee' },
  ]
  const merged = mergeUsageRows(list, usage)
  // the usage year: its parts (incl. the HR proposal, its own id space) + the rejected request; other years: the list
  assert.deepEqual(merged.map((r) => `${r.id}:${r.status}:${r.source}`).sort(), [
    '11:rejected:employee',
    '3:approved:employee',
    '7:approved:employee',
    '9:approved:hr_edit',
    'hr-edit-9:pending:hr_edit',
  ])
  assert.deepEqual(mergeUsageRows(list, null), list)
  const nov = yearMonths(merged, 2026)[10]
  assert.equal(nov.days, 1.5)
  assert.equal(nov.byHr, true)
})

test('balance history: read, and listed newest first in plain words', () => {
  const h = readHistory({
    employeeId: 5,
    year: 2026,
    total: 12,
    balance: { total: 12, used: 1, pending: 0.5, remaining: 10.5, year: 2026, since: '2026-11-02', endsOn: '2026-12-31', cutOver: '2026-11-02', tracked: true },
    entries: [
      { kind: 'opening', on: '2026-11-02', date: null, portion: null, change: 12, balanceBefore: null, balanceAfter: 12, source: null, text: '12 Casual Leave days for 2026, from 02 Nov 2026' },
      { kind: 'approved', on: '2026-11-05', date: '2026-11-05', portion: 'full', portionLabel: 'Full day', days: 1, change: -1, balanceBefore: 12, balanceAfter: 11, source: 'hr_edit', text: '12 → 11 on 05 Nov: ...' },
      { kind: 'pending', on: '2026-11-06', date: '2026-11-09', portion: 'first_half', days: 0.5, change: -0.5, balanceBefore: 11, balanceAfter: 10.5, source: 'employee', text: '...' },
      { kind: 'rejected', on: '2026-11-07', date: '2026-11-12', portion: 'full', days: 1, change: 0, balanceBefore: 10.5, balanceAfter: 10.5, source: 'employee', text: '...' },
      { kind: 'lapsed', on: '2026-12-31', change: -10.5, balanceBefore: 10.5, balanceAfter: 0, text: '...' },
    ],
  })!
  assert.equal(h.year, 2026)
  assert.equal(h.balance?.remaining, 10.5)
  const rows = historyRows(h)
  assert.deepEqual(
    rows.map((r) => [r.kind, r.title, r.change, r.on, r.byHr]),
    [
      ['lapsed', 'Unused days lapsed', '10½ → 0', '31 Dec', false],
      ['rejected', 'Rejected: Full day, Thu, 12 Nov 2026', 'no change', '7 Nov', false],
      ['pending', 'Waiting for approval: First half, Mon, 9 Nov 2026', '11 → 10½', '6 Nov', false],
      ['approved', 'Approved: Full day, Thu, 5 Nov 2026', '12 → 11', '5 Nov', true],
      ['opening', '12 Casual Leave days for 2026', '+12', '2 Nov', false],
    ],
  )
  assert.equal(rows[3].detail, 'Given by HR (attendance edit)')
  assert.equal(rows[4].detail, 'Counted from Mon, 2 Nov 2026')
  assert.equal(readHistory(null), null)
  assert.deepEqual(readHistory({ year: 2025, entries: [] })!.entries, [])
})

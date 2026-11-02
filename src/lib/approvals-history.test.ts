// Run with `npm test`. The Department Head's Approvals page: categories, counts, the history contract
// (backend/api/mobile_approvals_views.py), search, "who decided" and how a request is worded (approvals-items.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  categoryFromWire,
  emptyCopy,
  legacyItems,
  legacyPendingCounts,
  matchesSearch,
  nextPageParam,
  normalizeHistoryPage,
  normalizeOutcome,
  normalizeSummary,
  outcomeLine,
  statusFromParam,
  totalPending,
  visibleCategories,
  waitTone,
  waitingFor,
  decisionComments,
  fmtDay,
} from './approvals-history.ts'
import {
  clock12,
  empCode,
  empInitials,
  empName,
  hasMockedPunch,
  itemBadge,
  itemDateLabel,
  itemTypeLabel,
  mapLink,
  onDutyJourneyId,
  onDutyPunchLine,
  onDutyPunches,
} from './approvals-items.ts'

const when = () => '31 Oct, 10:05 AM'

describe('categories', () => {
  test('any spelling of a category key', () => {
    assert.equal(categoryFromWire('casual_leave'), 'casual_leave')
    assert.equal(categoryFromWire('casualLeave'), 'casual_leave')
    assert.equal(categoryFromWire('missing-punch'), 'missing_punch')
    assert.equal(categoryFromWire('attendance_correction'), 'attendance')
    assert.equal(categoryFromWire('compensation'), 'holiday_work')
    assert.equal(categoryFromWire('onDuty'), 'on_duty')
    assert.equal(categoryFromWire('resignations'), 'resignation')
    for (const bad of ['', 'nope', null, 3, undefined]) assert.equal(categoryFromWire(bad), null)
  })

  test('status from a link', () => {
    assert.equal(statusFromParam('approved'), 'approved')
    assert.equal(statusFromParam('Approved'), null)
    assert.equal(statusFromParam(undefined), null)
  })

  test('Leave and Permission always; the rest only behind their switch (Outpass follows Permissions)', () => {
    assert.deepEqual(visibleCategories(null), ['leave', 'permission'])
    assert.deepEqual(visibleCategories({ canApproveOnDuty: true, canApproveCasualLeave: false, canApprovePermissions: true }), [
      'leave',
      'permission',
      'on_duty',
      'outpass',
    ])
  })
})

describe('counts', () => {
  test('the summary keeps only real categories, in rail order', () => {
    const s = normalizeSummary({
      categories: [
        { key: 'on_duty', pending: 2, approved: 5, rejected: 1 },
        { key: 'leave', pending: 1, approved: 'x', rejected: -3 },
        { key: 'weird', pending: 9 },
      ],
    })
    assert.ok(s)
    assert.deepEqual(s.categories, ['leave', 'on_duty'])
    assert.deepEqual(s.counts.leave, { pending: 1, approved: 0, rejected: 0 })
    assert.equal(totalPending(s.counts, s.categories), 3)
  })

  test('an older backend (no summary) reads as null', () => {
    assert.equal(normalizeSummary(null), null)
    assert.equal(normalizeSummary('<html>'), null)
    assert.equal(normalizeSummary({ total: 1 }), null)
  })

  test('the older pending lists give pending numbers and items', () => {
    const lists = { leaveRequests: [{ id: '1' }, { id: '2' }], permissions: 'x', onDutySessions: [{ id: 5 }, null] }
    const c = legacyPendingCounts(lists)
    assert.equal(c.leave?.pending, 2)
    assert.equal(c.permission?.pending, 0)
    assert.equal(c.holiday_work?.pending, 0)
    assert.deepEqual(legacyItems(lists, 'on_duty'), [{ id: 5 }])
    assert.deepEqual(legacyItems(null, 'leave'), [])
  })
})

describe('history page', () => {
  test('normalises a page and drops rows without an id', () => {
    const p = normalizeHistoryPage({ items: [{ id: 1 }, { nope: true }, 'x', { id: 'a' }], page: 2, total: 30, hasMore: true, counts: { pending: 3 } }, 2)
    assert.equal(p.items.length, 2)
    assert.equal(p.page, 2)
    assert.equal(nextPageParam(p), 3)
    assert.deepEqual(p.counts, { pending: 3, approved: 0, rejected: 0 })
    assert.equal(nextPageParam(normalizeHistoryPage({ items: [], hasMore: false })), undefined)
    assert.equal(normalizeHistoryPage(null, 4).page, 4)
  })

  test('search matches every word against the name or code, flat or nested', () => {
    assert.equal(matchesSearch({ employeeName: 'Suresh Raj', employeeCode: 'UK0042' }, 'suresh 0042'), true)
    assert.equal(matchesSearch({ employee: { name: 'Priya K', employeeCode: 'UK0007' } }, 'priya'), true)
    assert.equal(matchesSearch({ employeeName: 'Suresh' }, 'priya'), false)
    assert.equal(matchesSearch({}, '   '), true)
  })
})

describe('who decided', () => {
  test('approved by this head, now with HR', () => {
    const o = normalizeOutcome({ state: 'in_progress', yourDecision: 'approved', yourDecisionAt: '2026-10-31T04:35:00Z', decisions: [] })
    const line = outcomeLine(o, when)
    assert.ok(line)
    assert.equal(line.text, 'Approved by you · 31 Oct, 10:05 AM · waiting for HR')
    assert.equal(line.tone, 'waiting')
  })

  test('approved by another head, now with HR', () => {
    const o = normalizeOutcome({
      state: 'inProgress',
      decisions: [{ role: 'hod', decision: 'approved', by: 'Kavya', at: '2026-10-30T04:35:00Z' }],
    })
    assert.equal(outcomeLine(o, when)?.text, 'Approved by Department Head (Kavya) · 31 Oct, 10:05 AM · waiting for HR')
  })

  test('finally rejected by HR after the head approved it first', () => {
    const o = normalizeOutcome({
      state: 'rejected',
      yourDecision: 'approved',
      decidedByRole: 'hr',
      decidedByName: 'Meena',
      decidedAt: '2026-10-31T04:35:00Z',
      decisions: [{ role: 'hr', decision: 'rejected', by: 'Meena', comment: 'Short staffed' }],
    })
    const line = outcomeLine(o, when)
    assert.equal(line?.text, 'Rejected by HR (Meena) · 31 Oct, 10:05 AM')
    assert.equal(line?.note, 'You approved it first')
    assert.equal(line?.tone, 'rejected')
    assert.deepEqual(decisionComments(o), ['HR (Meena): Short staffed'])
  })

  test('decided by you', () => {
    const o = normalizeOutcome({ state: 'approved', decidedByYou: true, decidedByRole: 'hod', yourDecision: 'approved' })
    assert.equal(outcomeLine(o, when)?.text, 'Approved by you')
    assert.equal(outcomeLine(o, when)?.note, null)
  })

  test('pending, missing or broken: no line', () => {
    assert.equal(outcomeLine(normalizeOutcome({ state: 'pending' })), null)
    assert.equal(outcomeLine(normalizeOutcome(null)), null)
    assert.equal(outcomeLine(normalizeOutcome({ state: 'odd' })), null)
  })
})

describe('time and empty states', () => {
  const now = new Date(2026, 9, 31, 12, 0)
  test('waiting text and tone', () => {
    assert.equal(waitingFor(new Date(2026, 9, 31, 11, 59, 30).toISOString(), now), 'Just now')
    assert.equal(waitingFor(new Date(2026, 9, 31, 11, 40).toISOString(), now), 'Waiting 20 min')
    assert.equal(waitingFor(new Date(2026, 9, 31, 7, 0).toISOString(), now), 'Waiting 5 hours')
    assert.equal(waitingFor(new Date(2026, 9, 28, 9, 0).toISOString(), now), 'Waiting 3 days')
    assert.equal(waitingFor(null, now), null)
    assert.equal(waitTone(new Date(2026, 9, 31, 7).toISOString(), now), 'fresh')
    assert.equal(waitTone(new Date(2026, 9, 30, 7).toISOString(), now), 'aging')
    assert.equal(waitTone(new Date(2026, 9, 27, 7).toISOString(), now), 'old')
  })

  test('fmtDay never shifts a bare date', () => {
    assert.equal(fmtDay('2026-10-06'), '06 Oct 2026')
    assert.equal(fmtDay('2026-10-06', { year: false }), '06 Oct')
    assert.equal(fmtDay(''), '—')
    assert.equal(fmtDay('soon'), 'soon')
  })

  test('empty copy', () => {
    assert.equal(emptyCopy('leave', 'pending').title, 'All caught up')
    assert.match(emptyCopy('leave', 'pending', { hodInPipeline: false }).description, /HR only/)
    assert.match(emptyCopy('on_duty', 'approved').description, /Approved on-duty requests/)
    assert.equal(emptyCopy('resignation', 'rejected', { search: 'ravi' }).description, 'No rejected resignation requests for "ravi".')
  })
})

describe('how a request is worded', () => {
  test('who', () => {
    assert.equal(empName({ employee: { name: 'Priya K' } }), 'Priya K')
    assert.equal(empCode({ employee: { employeeCode: 'UK7' } }), 'UK7')
    assert.equal(empName({}), 'Employee')
    assert.equal(empInitials({ employeeName: 'suresh raj kumar' }), 'SR')
    assert.equal(empInitials({}), '?')
  })

  test('leave with a reason category and a half day; casual leave half', () => {
    assert.equal(itemTypeLabel('leave', { type: 'Sick Leave' }), 'Sick Leave')
    assert.equal(itemTypeLabel('leave', { type: 'Leave', reasonCategoryLabel: 'Emergency' }), 'Leave · Emergency')
    assert.equal(itemTypeLabel('leave', { type: 'Sick Leave', isHalfDay: true, halfDaySlot: 'first_half' }), 'Sick Leave · Half day (first half)')
    assert.equal(itemTypeLabel('casual_leave', { portion: 'first_half', portionLabel: 'Half day (first half)' }), 'Casual Leave · Half day (first half)')
    assert.equal(itemTypeLabel('casual_leave', { portion: 'full', portionLabel: 'Full day' }), 'Casual Leave')
  })

  test('dates', () => {
    assert.equal(itemDateLabel('leave', { startDate: '2026-10-06', endDate: '2026-10-08', totalDays: 3 }), '06 Oct → 08 Oct 2026 · 3 days')
    assert.equal(itemDateLabel('permission', { date: '2026-10-10', permissionTime: '09:30' }), '10 Oct 2026 · 09:30')
    assert.equal(itemDateLabel('on_duty', { date: '2026-10-10', punches: [] }), '10 Oct 2026 · No punches yet')
    assert.equal(itemDateLabel('on_duty', { createdAt: '2026-10-10' }), '10 Oct 2026')
    assert.equal(itemTypeLabel('missing_punch', { punchSlot: 'lunch_out' }), 'Lunch Check-Out')
    assert.equal(itemTypeLabel('missing_punch', { punchType: 'IN' }), 'Check-In')
  })

  test('badges: With HR, permission outcome, the list status', () => {
    assert.deepEqual(itemBadge('leave', 'approved', { outcome: { state: 'in_progress' } }), { label: 'With HR', tone: 'info' })
    assert.deepEqual(itemBadge('permission', 'approved', {}), { label: 'Approved', tone: 'approved' })
    assert.deepEqual(itemBadge('leave', 'rejected', {}), { label: 'Rejected', tone: 'rejected' })
    assert.deepEqual(itemBadge('leave', 'pending', {}), { label: 'Pending', tone: 'waiting' })
  })

  test('On-Duty punches, the line, the fake-location flag and the map link', () => {
    const item = {
      punches: [
        { id: 1, punchType: 'IN', punchTime: '09:05', status: 'pending', hasPhoto: true, latitude: 11.1, longitude: 77.3 },
        { id: 2, punchType: 'OUT', punchTime: '13:00', isMocked: true },
        { nope: 1 },
      ],
    }
    assert.equal(onDutyPunches(item).length, 2)
    assert.equal(onDutyPunchLine(item), 'In 9:05 AM · Out 1:00 PM')
    assert.equal(hasMockedPunch(item), true)
    assert.equal(onDutyPunchLine({}), null)
    assert.equal(mapLink(11.1, 77.3), 'https://www.google.com/maps/search/?api=1&query=11.1,77.3')
    assert.equal(mapLink(null, 77), null)
    assert.equal(clock12('00:15'), '12:15 AM')
    assert.equal(clock12(''), '—')
  })

  test('On-Duty: the recorded route of the day, for "View route"', () => {
    assert.equal(onDutyJourneyId({ journeyId: 42 }), 42)
    assert.equal(onDutyJourneyId({ journeyId: '42' }), 42)
    // nothing recorded, an older server that does not say, or junk: no button
    assert.equal(onDutyJourneyId({ journeyId: null }), null)
    assert.equal(onDutyJourneyId({}), null)
    assert.equal(onDutyJourneyId(null), null)
    assert.equal(onDutyJourneyId({ journeyId: 0 }), null)
    assert.equal(onDutyJourneyId({ journeyId: -3 }), null)
    assert.equal(onDutyJourneyId({ journeyId: 1.5 }), null)
    assert.equal(onDutyJourneyId({ journeyId: 'abc' }), null)
  })
})

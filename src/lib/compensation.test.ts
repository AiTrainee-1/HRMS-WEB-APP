// Run with `npm test` (Node's built-in test runner, which runs .ts directly). The Compensation page's logic: the
// GET /employee/compensation contract (the shapes below are the ones backend/api/employee_compensation_views.py sends),
// and the promise that an older / newer / broken answer never crashes the page.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  ASK_HR_TITLE,
  STAFF_ONLY_MESSAGE,
  allowanceBanner,
  allowanceBanners,
  applyFilter,
  enabledNotice,
  filterOf,
  filterOptions,
  formatMinutes,
  formatShifts,
  groupItems,
  isoDateOrNull,
  kindInfo,
  nextCalendarDay,
  parseCompensation,
  sortNewestFirst,
  statusInfo,
  type CompensationItem,
} from './compensation.ts'

const CONTACT = {
  label: 'HR Desk',
  phone: '0421 430 0800',
  phoneDial: '04214300800',
  whatsapp: '',
  whatsappNumber: '',
  email: '',
  hours: '',
  hasContact: true,
  usesHrFallback: false,
}

const ALL_ON = {
  master: true, allowance: true, shift: true, relaxation: true, pay: true, windows: true, holidayWork: true, birthday: true, any: true,
}

/** The documented answer, one item of every kind. */
function fullAnswer() {
  return {
    isStaff: true,
    enabled: ALL_ON,
    balanceShifts: 0.25,
    items: [
      { key: 'ot-3625', kind: 'ot_allowance', group: 'detected', date: '2026-10-12', title: 'Late-in allowance earned: 30 minutes', detail: 'You can arrive later.', status: 'used', statusLabel: 'Used', shifts: null, minutes: 30, minutesUsed: 18, used: true },
      { key: 'ot-3630', kind: 'ot_shift', group: 'detected', date: '2026-10-09', title: 'Extra hours detected: ask HR for compensation', detail: 'Ask HR.', status: 'detected', statusLabel: 'Detected: ask HR to claim it', shifts: 0.5, minutes: 200, minutesUsed: null, used: null },
      { key: 'ot-3601', kind: 'ot_shift_relaxation', group: 'assigned', date: '2026-10-14', title: 'Compensation day assigned by HR: 0.50 shift', detail: 'HR granted it.', status: 'scheduled', statusLabel: 'Scheduled', shifts: 0.5, minutes: 200, minutesUsed: null, used: null, legacy: false, workDate: '2026-10-09' },
      { key: 'ot-3602', kind: 'ot_shift_pay', group: 'assigned', date: '2026-10-03', title: 'Overtime pay assigned by HR: 0.25 shift', detail: 'Paid in salary.', status: 'assigned', statusLabel: 'Assigned by HR', shifts: 0.25, minutes: 160, minutesUsed: null, used: null, legacy: false, workDate: '2026-10-03' },
      { key: 'hw-2421', kind: 'holiday_work', group: 'assigned', date: '2026-10-11', title: 'Sunday work: 0.50 shift', detail: 'HR raised it.', status: 'pending_hod', statusLabel: 'Waiting for your Department Head', shifts: 0.5, minutes: null, minutesUsed: null, used: null, workDate: '2026-10-11' },
      { key: 'rd-9', kind: 'redemption', group: 'balance', date: '2026-10-07', title: 'Compensation day taken: 0.25 shift', detail: 'HR used it.', status: 'taken', statusLabel: 'Taken', shifts: 0.25, minutes: null, minutesUsed: null, used: null },
      { key: 'win-959', kind: 'window_late_in', group: 'company', date: '2026-10-15', title: 'Company late-in window: arrive by 10:30', detail: 'Rain.', status: 'upcoming', statusLabel: 'Upcoming', shifts: null, minutes: null, minutesUsed: null, used: null, time: '10:30' },
      { key: 'win-960', kind: 'window_early_out', group: 'company', date: '2026-10-01', title: 'Company early-out window: leave from 16:00', detail: 'Event.', status: 'not_used', statusLabel: 'Not used', shifts: null, minutes: null, minutesUsed: null, used: false, time: '16:00' },
      { key: 'bd-2026-10-20', kind: 'birthday', group: 'birthday', date: '2026-10-20', title: 'Birthday leave (paid)', detail: 'Enjoy.', status: 'upcoming', statusLabel: 'Upcoming', shifts: null, minutes: null, minutesUsed: null, used: null },
    ],
    todayAllowance: null,
    tomorrowAllowance: { date: '2026-10-15', minutes: 60, workDate: '2026-10-14', onTimeUntil: '10:15', note: 'You worked late on Wednesday 14 Oct 2026.' },
    askHr: {
      title: 'Ask Request for Compensation',
      text: 'The system detects when you work extra hours.',
      points: ['Working past your shift end earns an allowance.', 'HR gives shift compensation.'],
      contact: CONTACT,
    },
    message: null,
  }
}

describe('parseCompensation: the documented answer', () => {
  const payload = parseCompensation(fullAnswer())

  test('a staff answer is read in full', () => {
    assert.ok(payload)
    assert.equal(payload.isStaff, true)
    assert.equal(payload.balanceShifts, 0.25)
    assert.equal(payload.items.length, 9)
    assert.equal(payload.message, null)
    assert.deepEqual(payload.enabled, ALL_ON)
    assert.equal(payload.todayAllowance, null)
  })

  test('an item keeps its fields', () => {
    const used = payload!.items[0]
    assert.deepEqual(
      { key: used.key, kind: used.kind, group: used.group, date: used.date, status: used.status, minutes: used.minutes, minutesUsed: used.minutesUsed, used: used.used, shifts: used.shifts, legacy: used.legacy },
      { key: 'ot-3625', kind: 'ot_allowance', group: 'detected', date: '2026-10-12', status: 'used', minutes: 30, minutesUsed: 18, used: true, shifts: null, legacy: false },
    )
    const claim = payload!.items.find((i) => i.kind === 'holiday_work')!
    assert.equal(claim.status, 'pending_hod')
    assert.equal(claim.statusLabel, 'Waiting for your Department Head')
    assert.equal(claim.workDate, '2026-10-11')
    assert.equal(claim.shifts, 0.5)
    assert.equal(payload!.items.find((i) => i.kind === 'window_late_in')!.time, '10:30')
  })

  test('the next-day allowance and the Ask-HR block come through', () => {
    assert.deepEqual(payload!.tomorrowAllowance, { date: '2026-10-15', minutes: 60, workDate: '2026-10-14', onTimeUntil: '10:15', note: 'You worked late on Wednesday 14 Oct 2026.' })
    assert.equal(payload!.askHr!.title, 'Ask Request for Compensation')
    assert.equal(payload!.askHr!.points.length, 2)
    assert.equal(payload!.askHr!.contact!.phoneDial, '04214300800')
    assert.equal(payload!.askHr!.contact!.hasContact, true)
  })
})

describe('parseCompensation: production and broken answers', () => {
  test('a production employee gets a staff-only payload with nothing listed', () => {
    const p = parseCompensation({
      isStaff: false,
      enabled: { master: false, allowance: false, shift: false, relaxation: false, pay: false, windows: false, holidayWork: false, birthday: false, any: false },
      balanceShifts: 0,
      items: [{ key: 'x', kind: 'birthday', date: '2026-10-01' }],
      todayAllowance: { date: '2026-10-01', minutes: 30 },
      tomorrowAllowance: null,
      askHr: null,
      message: 'Compensation is for staff employees only.',
    })!
    assert.equal(p.isStaff, false)
    // Even if a (future) server leaked staff data into a production answer, none of it is carried over.
    assert.deepEqual(p.items, [])
    assert.equal(p.todayAllowance, null)
    assert.equal(p.askHr, null)
    assert.equal(p.balanceShifts, 0)
    assert.equal(p.message, 'Compensation is for staff employees only.')
  })

  test('a production answer with no message still gets the friendly sentence', () => {
    assert.equal(parseCompensation({ isStaff: false })!.message, STAFF_ONLY_MESSAGE)
  })

  test('anything that is not the contract is null, never a crash', () => {
    for (const junk of [null, undefined, 42, 'a string', true, [], [1, 2], '<html>502 Bad Gateway</html>', {}, { foo: 1 }, { enabled: {} }]) {
      assert.equal(parseCompensation(junk), null, JSON.stringify(junk))
    }
  })

  test('an answer with only the items array is still read (an older shape)', () => {
    const p = parseCompensation({ items: [] })!
    assert.equal(p.isStaff, true)
    assert.equal(p.items.length, 0)
    assert.equal(p.enabled, null)
    assert.equal(p.balanceShifts, 0)
    assert.equal(p.askHr, null)
  })

  test('missing and malformed keys fall back to neutral values', () => {
    const p = parseCompensation({
      isStaff: true,
      balanceShifts: 'lots',
      items: [null, 5, 'x', [], {}, { kind: 42, date: 'tomorrow', shifts: 'half', minutes: {}, used: 'yes' }],
      todayAllowance: 'soon',
      tomorrowAllowance: { minutes: 30 },
      askHr: { points: 'one', contact: 'call us' },
    })!
    assert.equal(p.balanceShifts, 0)
    // The three object entries survive (the junk scalars/arrays are dropped), each as a generic item.
    assert.equal(p.items.length, 2)
    for (const item of p.items) {
      assert.equal(item.kind, 'unknown')
      assert.equal(item.date, null)
      assert.equal(item.shifts, null)
      assert.equal(item.minutes, null)
      assert.equal(item.used, null)
      assert.equal(item.group, 'other')
      assert.equal(item.title, 'Unknown')
    }
    assert.equal(p.todayAllowance, null)
    // An allowance without a date cannot be placed on a day: dropped, not guessed.
    assert.equal(p.tomorrowAllowance, null)
    assert.deepEqual(p.askHr, { title: ASK_HR_TITLE, text: p.askHr!.text, points: [], contact: null })
    assert.ok(p.askHr!.text.length > 20)
  })

  test('numbers sent as text (Decimal fields) are read as numbers', () => {
    const p = parseCompensation({ isStaff: true, balanceShifts: '1.25', items: [{ key: 'a', kind: 'holiday_work', date: '2026-10-11', shifts: '0.50' }] })!
    assert.equal(p.balanceShifts, 1.25)
    assert.equal(p.items[0].shifts, 0.5)
  })

  test('item keys are unique even when the server repeats one', () => {
    const p = parseCompensation({ isStaff: true, items: [{ key: 'dup', kind: 'birthday' }, { key: 'dup', kind: 'birthday' }, { kind: 'birthday', date: '2026-10-20' }, { kind: 'birthday', date: '2026-10-20' }] })!
    assert.equal(new Set(p.items.map((i) => i.key)).size, 4)
  })

  test('an impossible date is dropped (date-fns would throw on it)', () => {
    assert.equal(isoDateOrNull('2026-02-30'), null)
    assert.equal(isoDateOrNull('2026-13-01'), null)
    assert.equal(isoDateOrNull('2026-10-12'), '2026-10-12')
    assert.equal(isoDateOrNull('2026-10-12T08:30:00+05:30'), '2026-10-12')
    assert.equal(isoDateOrNull(20261012), null)
    assert.equal(isoDateOrNull(null), null)
    const p = parseCompensation({ isStaff: true, items: [{ key: 'a', kind: 'birthday', date: '2026-02-30', workDate: 'x' }] })!
    assert.equal(p.items[0].date, null)
    assert.equal(p.items[0].workDate, null)
  })
})

describe('kinds, statuses and formatting', () => {
  test('every kind the backend sends has its own label, symbol and chip', () => {
    const kinds = ['ot_allowance', 'ot_shift', 'ot_shift_relaxation', 'ot_shift_pay', 'holiday_work', 'redemption', 'window_late_in', 'window_early_out', 'birthday']
    for (const kind of kinds) {
      const info = kindInfo(kind)
      assert.ok(info.label && info.symbol && info.chip.startsWith('chip-'), kind)
      assert.notEqual(info.chip, 'chip-muted', kind)
    }
    assert.equal(kindInfo('ot_allowance').label, 'Late-in allowance')
    assert.equal(kindInfo('birthday').label, 'Birthday leave')
  })

  test('an unknown kind is drawn generically, with its own name', () => {
    assert.deepEqual(kindInfo('festival_bonus'), { label: 'Festival bonus', symbol: 'gift', chip: 'chip-muted' })
    assert.deepEqual(kindInfo(''), { label: 'Compensation', symbol: 'gift', chip: 'chip-muted' })
    // Names that exist on Object.prototype are not kinds.
    assert.equal(kindInfo('constructor').chip, 'chip-muted')
    assert.equal(kindInfo('toString').symbol, 'gift')
  })

  test('the server\'s own status words win; a missing label falls back to a fixed one', () => {
    assert.deepEqual(statusInfo({ status: 'pending_hod', statusLabel: 'Waiting for your Department Head' }), { label: 'Waiting for your Department Head', chip: 'chip-warning', live: true })
    assert.equal(statusInfo({ status: 'pending_hod', statusLabel: '' }).label, 'Waiting for your Department Head')
    assert.equal(statusInfo({ status: 'rejected', statusLabel: '' }).label, 'Not approved')
    assert.equal(statusInfo({ status: 'rejected', statusLabel: '' }).chip, 'chip-danger')
    assert.equal(statusInfo({ status: 'used', statusLabel: 'Used' }).chip, 'chip-success')
    assert.equal(statusInfo({ status: 'not_applied', statusLabel: '' }).chip, 'chip-excess')
    assert.equal(statusInfo({ status: 'applied', statusLabel: '' }).live, false)
  })

  test('an unknown or empty status is shown humanised and neutral', () => {
    assert.deepEqual(statusInfo({ status: 'on_hold', statusLabel: '' }), { label: 'On hold', chip: 'chip-muted', live: false })
    assert.deepEqual(statusInfo({ status: '', statusLabel: '' }), { label: 'Status unknown', chip: 'chip-muted', live: false })
    assert.equal(statusInfo({ status: 'constructor', statusLabel: '' }).chip, 'chip-muted')
  })

  test('shifts are written like the HRMS writes them', () => {
    assert.equal(formatShifts(0.25), '0.25 shift')
    assert.equal(formatShifts(0.5), '0.50 shift')
    assert.equal(formatShifts(1), '1.00 shift')
    assert.equal(formatShifts(1.5), '1.50 shifts')
    assert.equal(formatShifts(0), '0.00 shift')
    assert.equal(formatShifts(null), '')
    assert.equal(formatShifts(undefined), '')
    assert.equal(formatShifts(Number.NaN), '')
  })

  test('minutes read as hours and minutes', () => {
    assert.equal(formatMinutes(30), '30 min')
    assert.equal(formatMinutes(60), '1 h')
    assert.equal(formatMinutes(90), '1 h 30 min')
    assert.equal(formatMinutes(150), '2 h 30 min')
    assert.equal(formatMinutes(0), '0 min')
    assert.equal(formatMinutes(-5), '0 min')
    assert.equal(formatMinutes(null), '')
  })
})

describe('the next-day allowance banner', () => {
  // The viewer's own calendar day, passed in so no test depends on the real clock. Wed 14 Oct 2026, late in the evening.
  const WED_14_OCT = new Date(2026, 9, 14, 23, 30)

  test('says the latest on-time arrival when the server knows it', () => {
    const b = allowanceBanner({ date: '2026-10-15', minutes: 60, workDate: '2026-10-14', onTimeUntil: '10:15', note: 'Worked late.' }, 'tomorrow', WED_14_OCT)!
    assert.equal(b.headline, 'You may arrive until 10:15 without being marked late.')
    assert.equal(b.heading, "Tomorrow's late-in allowance")
    assert.equal(b.detail, 'Worked late.')
    assert.equal(b.when, 'tomorrow')
  })

  test('falls back to the allowance minutes when the employee has no shift', () => {
    const b = allowanceBanner({ date: '2026-10-14', minutes: 90, workDate: null, onTimeUntil: null, note: null }, 'today', WED_14_OCT)!
    assert.equal(b.headline, 'You may arrive up to 1 h 30 min later than usual without being marked late.')
    assert.equal(b.heading, "Today's late-in allowance")
    assert.equal(b.detail, null)
  })

  test('no allowance, no banner; today comes before tomorrow', () => {
    assert.equal(allowanceBanner(null, 'today', WED_14_OCT), null)
    assert.equal(allowanceBanner(undefined, 'tomorrow', WED_14_OCT), null)
    assert.deepEqual(allowanceBanners({ todayAllowance: null, tomorrowAllowance: null }, WED_14_OCT), [])
    const both = allowanceBanners(parseCompensation({ isStaff: true, items: [], todayAllowance: { date: '2026-10-14', minutes: 30 }, tomorrowAllowance: { date: '2026-10-15', minutes: 60 } })!, WED_14_OCT)
    assert.deepEqual(both.map((b) => b.when), ['today', 'tomorrow'])
    assert.deepEqual(both.map((b) => b.heading), ["Today's late-in allowance", "Tomorrow's late-in allowance"])
  })

  // The server's tomorrowAllowance is the NEXT WORKING day: after Friday overtime on a Saturday-off shift it is Monday, and
  // the page must not call a Monday "Tomorrow" on a Friday evening.
  test('the next working day is not called "Tomorrow" when it is not the next calendar day', () => {
    const friday = new Date(2026, 9, 16, 20, 0)
    const b = allowanceBanner({ date: '2026-10-19', minutes: 60, workDate: '2026-10-16', onTimeUntil: '10:15', note: null }, 'tomorrow', friday)!
    assert.equal(b.heading, "Next working day's late-in allowance")
    assert.doesNotMatch(b.heading, /tomorrow/i)
    assert.equal(b.date, '2026-10-19') // the page prints this date beside the heading ("Mon, 19 Oct")
    // ... and it is still "Tomorrow" on the Thursday before, when the next working day IS the next calendar day
    const thursday = new Date(2026, 9, 15, 20, 0)
    assert.equal(allowanceBanner({ date: '2026-10-16', minutes: 60, workDate: '2026-10-15', onTimeUntil: null, note: null }, 'tomorrow', thursday)!.heading, "Tomorrow's late-in allowance")
  })

  test('"Tomorrow" is decided by the calendar, across a month, a year and a leap day', () => {
    const tomorrowOf = (today: Date, date: string) => allowanceBanner({ date, minutes: 30, workDate: null, onTimeUntil: null, note: null }, 'tomorrow', today)!.heading
    assert.equal(tomorrowOf(new Date(2026, 9, 31), '2026-11-01'), "Tomorrow's late-in allowance")
    assert.equal(tomorrowOf(new Date(2026, 11, 31, 23, 59), '2027-01-01'), "Tomorrow's late-in allowance")
    assert.equal(tomorrowOf(new Date(2028, 1, 28), '2028-02-29'), "Tomorrow's late-in allowance")
    assert.equal(tomorrowOf(new Date(2028, 1, 29), '2028-03-01'), "Tomorrow's late-in allowance")
    assert.equal(tomorrowOf(new Date(2027, 1, 28), '2027-03-01'), "Tomorrow's late-in allowance")
    // a Sunday-off week: Saturday overtime reaches Monday; a holiday on Thursday pushes Wednesday's to Friday
    assert.equal(tomorrowOf(new Date(2026, 9, 17), '2026-10-19'), "Next working day's late-in allowance")
    assert.equal(tomorrowOf(new Date(2026, 9, 14), '2026-10-16'), "Next working day's late-in allowance")
    // a date that cannot be tomorrow (today's own, or one in the past) is never called tomorrow either
    assert.equal(tomorrowOf(new Date(2026, 9, 14), '2026-10-14'), "Next working day's late-in allowance")
    assert.equal(tomorrowOf(new Date(2026, 9, 14), '2026-10-13'), "Next working day's late-in allowance")
  })

  test('the calendar day after is built from date parts, so the time of day and a clock change cannot move it', () => {
    assert.equal(nextCalendarDay(new Date(2026, 9, 14, 0, 0, 1)), '2026-10-15')
    assert.equal(nextCalendarDay(new Date(2026, 9, 14, 23, 59, 59)), '2026-10-15')
    // the days the clocks change in Europe and in the USA (a 23- or 25-hour day in those zones)
    assert.equal(nextCalendarDay(new Date(2026, 2, 28, 12)), '2026-03-29')
    assert.equal(nextCalendarDay(new Date(2026, 2, 29, 12)), '2026-03-30')
    assert.equal(nextCalendarDay(new Date(2026, 9, 24, 12)), '2026-10-25')
    assert.equal(nextCalendarDay(new Date(2026, 9, 25, 12)), '2026-10-26')
    assert.equal(nextCalendarDay(new Date(2026, 10, 1, 12)), '2026-11-02')
  })

  test('both banners get their headings from the same today', () => {
    const payload = { todayAllowance: { date: '2026-10-16', minutes: 30, workDate: null, onTimeUntil: null, note: null }, tomorrowAllowance: { date: '2026-10-19', minutes: 60, workDate: '2026-10-16', onTimeUntil: null, note: null } }
    assert.deepEqual(allowanceBanners(payload, new Date(2026, 9, 16, 20)).map((b) => b.heading), ["Today's late-in allowance", "Next working day's late-in allowance"])
  })
})

describe('the "features are off" notice', () => {
  test('is silent while the features are on, or when the server did not say', () => {
    assert.equal(enabledNotice(ALL_ON), null)
    assert.equal(enabledNotice(null), null)
  })

  test('explains a master switch that is off, and a feature set with nothing on', () => {
    assert.match(enabledNotice({ ...ALL_ON, master: false, any: false })!, /switched the overtime \/ compensation features off/)
    assert.match(enabledNotice({ ...ALL_ON, any: false })!, /No compensation feature is switched on/)
    // One feature on is enough: no notice.
    assert.equal(enabledNotice({ ...ALL_ON, allowance: false, shift: false, windows: false, holidayWork: false, birthday: false, any: true }), null)
  })
})

describe('groups and filters', () => {
  const items = parseCompensation(fullAnswer())!.items

  test('items come in a fixed group order and each group is newest first', () => {
    const groups = groupItems(items)
    assert.deepEqual(groups.map((g) => g.id), ['detected', 'assigned', 'company', 'birthday', 'balance'])
    assert.deepEqual(groups.map((g) => g.title), ['Detected for you', 'Assigned by HR', 'Company announcements', 'Birthday leave', 'Compensation days taken'])
    assert.deepEqual(groups[0].items.map((i) => i.key), ['ot-3625', 'ot-3630'])
    assert.deepEqual(groups[1].items.map((i) => i.key), ['ot-3601', 'hw-2421', 'ot-3602'])
    assert.deepEqual(groups[2].items.map((i) => i.key), ['win-959', 'win-960'])
    assert.equal(groups.reduce((n, g) => n + g.items.length, 0), items.length)
  })

  test('empty groups are left out and an unknown group goes under "Other"', () => {
    assert.deepEqual(groupItems([]), [])
    const odd = parseCompensation({ isStaff: true, items: [{ key: 'a', kind: 'birthday', group: 'something_new', date: '2026-10-01' }, { key: 'b', kind: 'birthday', group: 'birthday', date: '2026-10-02' }] })!.items
    const groups = groupItems(odd)
    assert.deepEqual(groups.map((g) => g.id), ['birthday', 'other'])
    assert.equal(groups[1].title, 'Other')
  })

  test('sorting is newest first, undated last, and stable for equal dates', () => {
    const mk = (key: string, date: string | null) => ({ key, date }) as CompensationItem
    const sorted = sortNewestFirst([mk('a', '2026-10-01'), mk('b', null), mk('c', '2026-10-03'), mk('d', '2026-10-01'), mk('e', '2026-10-02')])
    assert.deepEqual(sorted.map((i) => i.key), ['c', 'e', 'a', 'd', 'b'])
  })

  test('filter chips exist only for the kinds present, with their counts', () => {
    const options = filterOptions(items)
    assert.deepEqual(options.map((o) => [o.id, o.count]), [
      ['all', 9], ['allowance', 1], ['shift', 3], ['holiday_work', 1], ['redemption', 1], ['window', 2], ['birthday', 1],
    ])
    assert.deepEqual(filterOptions([]).map((o) => o.id), ['all'])
  })

  test('an unknown kind is found under "All" and its own "Other" chip, never lost', () => {
    const withNew = [...items, parseCompensation({ isStaff: true, items: [{ key: 'n', kind: 'festival_bonus', date: '2026-10-02' }] })!.items[0]]
    const options = filterOptions(withNew)
    assert.deepEqual(options.at(-1), { id: 'other', label: 'Other', count: 1 })
    assert.equal(applyFilter(withNew, 'all').length, 10)
    assert.deepEqual(applyFilter(withNew, 'other').map((i) => i.kind), ['festival_bonus'])
    assert.equal(filterOf({ kind: 'festival_bonus' }), 'other')
  })

  test('each filter selects exactly its kinds', () => {
    assert.deepEqual(applyFilter(items, 'shift').map((i) => i.kind).sort(), ['ot_shift', 'ot_shift_pay', 'ot_shift_relaxation'])
    assert.deepEqual(applyFilter(items, 'window').map((i) => i.kind).sort(), ['window_early_out', 'window_late_in'])
    assert.deepEqual(applyFilter(items, 'allowance').map((i) => i.key), ['ot-3625'])
    assert.deepEqual(applyFilter(items, 'redemption').map((i) => i.key), ['rd-9'])
    assert.deepEqual(applyFilter(items, 'birthday').map((i) => i.key), ['bd-2026-10-20'])
    assert.deepEqual(applyFilter(items, 'holiday_work').map((i) => i.key), ['hw-2421'])
  })
})

// Run with `npm test`. Where a notification's View button goes: the server's `target` (2026-11-02 contract), and the
// type-based link for an older server that sends none.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { normalizeTarget, notificationLink, targetLink, targetOf, withQuery, type NormalizedTarget } from './notification-target.ts'
import { notificationKindTitle } from './notification-list.ts'

const t = (over: Partial<NormalizedTarget>): NormalizedTarget => ({
  kind: 'leave',
  id: null,
  date: null,
  role: 'self',
  category: null,
  label: null,
  ...over,
})

describe('normalizeTarget', () => {
  test('reads the contract fields', () => {
    assert.deepEqual(normalizeTarget({ kind: 'leave', id: 42, date: null, role: 'self', category: null, label: 'View leave request' }), {
      kind: 'leave',
      id: 42,
      date: null,
      role: 'self',
      category: 'leave',
      label: 'View leave request',
    })
  })

  test('a numeric string id is the same id; anything else is no id', () => {
    assert.equal(normalizeTarget({ kind: 'leave', id: '17' })?.id, 17)
    for (const id of [0, -3, 1.5, 'abc', '', null, undefined, {}, '12; drop']) assert.equal(normalizeTarget({ kind: 'leave', id })?.id, null, String(id))
  })

  test('dates must be real days; an ISO time keeps its day', () => {
    assert.equal(normalizeTarget({ kind: 'attendance', date: '2026-10-12' })?.date, '2026-10-12')
    assert.equal(normalizeTarget({ kind: 'attendance', date: '2026-10-12T09:30:00+05:30' })?.date, '2026-10-12')
    for (const date of ['2026-02-30', '12-10-2026', 'yesterday', 20261012, null]) assert.equal(normalizeTarget({ kind: 'attendance', date })?.date, null, String(date))
  })

  test('role is approver only when it says so', () => {
    assert.equal(normalizeTarget({ kind: 'leave', role: 'approver' })?.role, 'approver')
    assert.equal(normalizeTarget({ kind: 'leave', role: 'APPROVER' })?.role, 'approver')
    assert.equal(normalizeTarget({ kind: 'leave', role: 'admin' })?.role, 'self')
    assert.equal(normalizeTarget({ kind: 'leave' })?.role, 'self')
  })

  test('the approvals category: the server spelling, else from the kind', () => {
    assert.equal(normalizeTarget({ kind: 'leave', role: 'approver', category: 'casualLeave' })?.category, 'casual_leave')
    assert.equal(normalizeTarget({ kind: 'compensation', role: 'approver' })?.category, 'holiday_work')
    assert.equal(normalizeTarget({ kind: 'geo_punch', role: 'approver' })?.category, 'on_duty')
    assert.equal(normalizeTarget({ kind: 'chat', role: 'approver', category: 'nonsense' })?.category, null)
  })

  test('labels: trimmed; a missing, empty or very long one is dropped (the default words stand in)', () => {
    assert.equal(normalizeTarget({ kind: 'leave', label: '  View   leave ' })?.label, 'View leave')
    assert.equal(normalizeTarget({ kind: 'leave', label: '' })?.label, null)
    assert.equal(normalizeTarget({ kind: 'leave', label: 'x'.repeat(41) })?.label, null)
    assert.equal(normalizeTarget({ kind: 'leave', label: 5 })?.label, null)
  })

  test('unknown kinds and odd shapes are no target', () => {
    for (const raw of [null, undefined, 'leave', 5, [], {}, { kind: 'payroll' }, { kind: 'constructor' }, { kind: '__proto__' }, { kind: 7 }]) {
      assert.equal(normalizeTarget(raw), null, JSON.stringify(raw))
    }
    assert.equal(normalizeTarget({ kind: ' Casual-Leave ' })?.kind, 'casual_leave')
  })
})

describe('targetLink: kind -> route', () => {
  const href = (over: Partial<NormalizedTarget>, viewer?: Parameters<typeof targetLink>[1]) => targetLink(t(over), viewer)?.href ?? null

  test('request pages take focus=<id>', () => {
    assert.equal(href({ kind: 'leave', id: 42 }), '/employee/leave?focus=42')
    assert.equal(href({ kind: 'casual_leave', id: 5 }), '/employee/casual-leave?focus=5')
    assert.equal(href({ kind: 'permission', id: 9 }), '/employee/permissions?focus=9')
    assert.equal(href({ kind: 'missing_punch', id: 3 }), '/employee/missing-punch?focus=3')
    assert.equal(href({ kind: 'outpass', id: 11 }), '/employee/outpass?focus=11')
    assert.equal(href({ kind: 'advance', id: 8 }), '/employee/settlement?focus=8')
    assert.equal(href({ kind: 'on_duty', id: 77 }), '/employee/attendance-request?mode=records&focus=77')
    assert.equal(href({ kind: 'leave' }), '/employee/leave')
  })

  test('day events take date=', () => {
    assert.equal(href({ kind: 'attendance', date: '2026-10-12' }), '/employee/attendance?date=2026-10-12')
    assert.equal(href({ kind: 'attendance' }), '/employee/attendance')
    assert.equal(href({ kind: 'missing_punch', date: '2026-10-12' }), '/employee/missing-punch?date=2026-10-12')
    // A geo punch's id is the punch check, not the record: the day finds the record.
    assert.equal(href({ kind: 'geo_punch', id: 300, date: '2026-10-12' }), '/employee/attendance-request?mode=records&date=2026-10-12')
    assert.equal(href({ kind: 'geo_punch', id: 300 }), '/employee/attendance-request?mode=records')
  })

  test('a salary slip opens its own page', () => {
    assert.equal(href({ kind: 'salary_slip', id: 31 }), '/employee/salary/31')
    assert.equal(href({ kind: 'salary_slip' }), '/employee/salary')
  })

  test('pages without a single item', () => {
    assert.equal(href({ kind: 'documents' }), '/employee/documents')
    assert.equal(href({ kind: 'id_card' }), '/employee/id-card')
    assert.equal(href({ kind: 'resignation', id: 2 }), '/employee/resignation')
    assert.equal(href({ kind: 'chat' }), '/employee/chat')
    assert.equal(href({ kind: 'my_requests' }), '/employee/hod?tab=requests')
    assert.equal(href({ kind: 'shift' }), '/employee/shift')
    assert.equal(href({ kind: 'holidays' }), '/employee/holidays')
    assert.equal(href({ kind: 'profile' }), '/employee/profile')
  })

  test('My Requests rows are keyed "<module>-<id>": an attendance change HR proposed is attendance_correction', () => {
    // Backend 2026-11-02: kind my_requests, role self, category "attendance", id = the attendance-correction request.
    assert.equal(href({ kind: 'my_requests', category: 'attendance', id: 12, date: '2026-10-31' }), '/employee/hod?tab=requests&focus=attendance_correction-12')
    assert.equal(href({ kind: 'my_requests', category: 'leave', id: 3 }), '/employee/hod?tab=requests&focus=leave-3')
    // Without the category the id cannot be placed.
    assert.equal(href({ kind: 'my_requests', id: 12 }), '/employee/hod?tab=requests')
    assert.equal(href({ kind: 'my_requests', category: 'attendance' }), '/employee/hod?tab=requests')
    assert.equal(href({ kind: 'request', id: 4 }), '/employee/hod?tab=requests&focus=request-4')
    assert.equal(href({ kind: 'request' }), '/employee/hod?tab=requests')
    assert.equal(
      notificationLink({ type: 'attendance', target: { kind: 'my_requests', id: 12, date: '2026-10-31', role: 'self', category: 'attendance', label: 'View attendance change' } })?.href,
      '/employee/hod?tab=requests&focus=attendance_correction-12',
    )
    assert.equal(targetLink(t({ kind: 'my_requests', category: 'attendance', id: 12 }))?.label, 'View attendance change')
  })

  test('compensation is for staff: none for a known production employee, shown while not known', () => {
    assert.equal(href({ kind: 'compensation' }, { isStaff: true }), '/employee/compensation')
    assert.equal(href({ kind: 'compensation' }, { isStaff: null }), '/employee/compensation')
    assert.equal(href({ kind: 'compensation' }), '/employee/compensation')
    assert.equal(href({ kind: 'compensation' }, { isStaff: false }), null)
    assert.equal(href({ kind: 'compensation', id: 2421 }, { isStaff: false }), null)
  })

  test('a compensation id is a Sunday / holiday work claim, which the page keys "hw-<id>"', () => {
    assert.equal(href({ kind: 'compensation', id: 2421, date: '2026-10-11' }), '/employee/compensation?focus=hw-2421&date=2026-10-11')
    assert.equal(href({ kind: 'compensation', date: '2026-10-11' }), '/employee/compensation?date=2026-10-11')
  })

  test('missing punch alerts come as attendance days; missing_punch is a request decision', () => {
    assert.equal(href({ kind: 'attendance', date: '2026-10-31', label: 'View attendance for 31 Oct' }), '/employee/attendance?date=2026-10-31')
    assert.equal(href({ kind: 'missing_punch', id: 7, date: '2026-10-30' }), '/employee/missing-punch?focus=7&date=2026-10-30')
  })

  test('approver -> Approvals with the category and the item, for heads only', () => {
    assert.equal(href({ kind: 'leave', id: 42, role: 'approver', category: 'leave' }), '/employee/approvals?category=leave&focus=42')
    assert.equal(href({ kind: 'leave', id: 42, role: 'approver', category: 'leave' }, { isManager: true }), '/employee/approvals?category=leave&focus=42')
    assert.equal(href({ kind: 'leave', id: 42, role: 'approver', category: 'leave' }, { isManager: null }), '/employee/approvals?category=leave&focus=42')
    assert.equal(href({ kind: 'leave', id: 42, role: 'approver', category: 'leave' }, { isManager: false }), null)
    assert.equal(href({ kind: 'compensation', id: 6, role: 'approver', category: 'holiday_work' }), '/employee/approvals?category=holiday_work&focus=6')
    // No category: an id means nothing on its own.
    assert.equal(href({ kind: 'advance', id: 6, role: 'approver' }), '/employee/approvals')
    // A geo punch: its category, not its id.
    assert.equal(href({ kind: 'geo_punch', id: 300, role: 'approver', category: 'on_duty' }), '/employee/approvals?category=on_duty')
    assert.equal(href({ kind: 'approvals', category: 'missing_punch', id: 4 }), '/employee/approvals?category=missing_punch&focus=4')
    assert.equal(href({ kind: 'approvals' }), '/employee/approvals')
    // Backend 2026-11-02: an advance / general request reminder is an approver target with no id and no category.
    assert.deepEqual(
      notificationLink({ type: 'approval_reminder', target: { kind: 'approvals', id: null, date: null, role: 'approver', category: null, label: 'Open approvals' } }, { isManager: true }),
      { href: '/employee/approvals', label: 'Open approvals' },
    )
    assert.equal(notificationLink({ type: 'x', target: { kind: 'approvals', role: 'approver', category: null, id: null } })?.href, '/employee/approvals')
  })

  test("the server's words, else plain defaults", () => {
    assert.equal(targetLink(t({ kind: 'leave', id: 1, label: 'See it' }))?.label, 'See it')
    assert.equal(targetLink(t({ kind: 'leave', id: 1 }))?.label, 'View leave request')
    assert.equal(targetLink(t({ kind: 'leave' }))?.label, 'View your leave')
    assert.equal(targetLink(t({ kind: 'leave', role: 'approver', category: 'leave' }))?.label, 'Open approvals')
    assert.equal(targetLink(t({ kind: 'salary_slip', id: 3 }))?.label, 'View salary slip')
    assert.equal(targetLink(t({ kind: 'attendance', date: '2026-10-12' }))?.label, 'View that day')
  })
})

describe('notificationLink', () => {
  test('uses the target when there is one', () => {
    assert.deepEqual(notificationLink({ type: 'leave', message: 'Your leave was approved.', target: { kind: 'leave', id: 42, role: 'self', label: 'View leave request' } }), {
      href: '/employee/leave?focus=42',
      label: 'View leave request',
    })
  })

  test('target null: the server says there is nothing to open', () => {
    assert.equal(notificationLink({ type: 'leave', message: 'x', target: null }), null)
  })

  test('no target (an older server): the type-based link', () => {
    assert.deepEqual(notificationLink({ type: 'leave', message: 'Your leave was approved.' }), { href: '/employee/leave', label: 'View your leave' })
    assert.deepEqual(notificationLink({ type: 'compensation', message: 'x' }), { href: '/employee/compensation', label: 'View compensation' })
    assert.equal(notificationLink({ type: 'general', message: 'Holiday tomorrow' }), null)
    // "... waiting for your approval" still opens Approvals for a head.
    assert.equal(notificationLink({ type: 'leave', message: "Suresh Raj's leave is waiting for your approval." }, { isManager: true })?.href, '/employee/approvals')
  })

  test('a kind this app does not know yet: the type-based link', () => {
    assert.equal(notificationLink({ type: 'salary_slip', message: 'x', target: { kind: 'payslip_v2', id: 3 } })?.href, '/employee/salary')
  })

  test('a target that is not for this reader gives no button (never the type-based guess)', () => {
    assert.equal(notificationLink({ type: 'leave', message: 'x', target: { kind: 'leave', id: 1, role: 'approver', category: 'leave' } }, { isManager: false }), null)
    assert.equal(notificationLink({ type: 'compensation', message: 'x', target: { kind: 'compensation' } }, { isStaff: false }), null)
  })

  test('targetOf', () => {
    assert.equal(targetOf({ type: 'leave', target: { kind: 'leave', role: 'approver' } })?.role, 'approver')
    assert.equal(targetOf({ type: 'leave' }), null)
    assert.equal(targetOf(null), null)
  })
})

test('withQuery keeps an existing query and skips empty values', () => {
  assert.equal(withQuery('/a', {}), '/a')
  assert.equal(withQuery('/a', { x: null, y: undefined, z: '' }), '/a')
  assert.equal(withQuery('/a?mode=records', { focus: 4 }), '/a?mode=records&focus=4')
  assert.equal(withQuery('/a', { q: 'a b&c' }), '/a?q=a+b%26c')
})

describe('enquiry (2026-11-24)', () => {
  test('HR updated one of my enquiries: View opens it on the Enquiries page', () => {
    const n = { type: 'enquiry', message: 'HR replied to your enquiry.', target: { kind: 'enquiry', id: 12, label: 'View enquiry' } }
    assert.deepEqual(notificationLink(n), { href: '/employee/enquiries?focus=12', label: 'View enquiry' })
    assert.equal(normalizeTarget({ kind: 'enquiry', id: 12 })?.kind, 'enquiry')
    assert.deepEqual(targetLink(t({ kind: 'enquiry', id: null })), { href: '/employee/enquiries', label: 'View enquiry' })
  })

  test('an older server without a target: the type still opens the page', () => {
    assert.deepEqual(notificationLink({ type: 'enquiry', message: 'HR replied.' }), { href: '/employee/enquiries', label: 'View enquiry' })
  })
})

describe('Birthday Compensation (2026-11-25)', () => {
  test('the head asked to decide one: Approvals, its own category', () => {
    // notification_targets.py: type birthday_compensation + "waiting for your approval" -> approver, no id
    const n = {
      type: 'birthday_compensation',
      message: "Comp BDC1's Birthday Compensation (first half of Tuesday 3 Mar 2026) is waiting for your approval.",
      target: { kind: 'approvals', id: null, date: null, role: 'approver', category: 'birthday_compensation', label: 'Open approvals' },
    }
    assert.deepEqual(notificationLink(n, { isManager: true }), { href: '/employee/approvals?category=birthday_compensation', label: 'Open approvals' })
    assert.equal(notificationLink(n, { isManager: false }), null)
    // With an id (a reminder for one placement): that row is focused.
    assert.equal(
      notificationLink({ ...n, target: { ...n.target, id: 14 } }, { isManager: true })?.href,
      '/employee/approvals?category=birthday_compensation&focus=14',
    )
  })

  test('the employee\'s own notice opens the Birthday view; a decision names the placement, not a claim', () => {
    // The WhatsApp decision ("wa:approval:birthday_compensation:<use id>:approved") -> kind compensation, id = the use.
    const decided = { type: 'birthday_compensation', message: 'Request Approved', target: { kind: 'compensation', id: 9, date: '2026-03-03', role: 'self', label: 'View compensation' } }
    assert.deepEqual(notificationLink(decided, { isStaff: true }), { href: '/employee/compensation?tab=birthday&focus=bdcu-9', label: 'View compensation' })
    // The step notice (after the head approved) and HR's "placed for you": no id.
    const step = { type: 'birthday_compensation', message: 'Approved by your Department Head', target: { kind: 'compensation', id: null, role: 'self' } }
    assert.equal(notificationLink(step)?.href, '/employee/compensation?tab=birthday')
    // A compensation CLAIM keeps its "hw-<id>" link.
    assert.equal(notificationLink({ ...decided, type: 'compensation' })?.href, '/employee/compensation?focus=hw-9&date=2026-03-03')
    // Compensation is for staff.
    assert.equal(notificationLink(decided, { isStaff: false }), null)
  })

  test('an older server without a target, and the words', () => {
    assert.deepEqual(notificationLink({ type: 'birthday_compensation', message: 'Approved by your Department Head' }), {
      href: '/employee/compensation?tab=birthday',
      label: 'View birthday compensation',
    })
    assert.equal(
      notificationLink({ type: 'birthday_compensation', message: 'It is waiting for your approval.' }, { isManager: true })?.href,
      '/employee/approvals',
    )
    assert.equal(notificationKindTitle('birthday_compensation'), 'Birthday compensation')
  })
})

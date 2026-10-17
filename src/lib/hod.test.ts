// Run with `npm test`. The HOD Assignment page's logic: the GET /employee/hod contract (the shapes below are the ones
// backend/api/employee_compensation_views.py::employee_hod sends), the photo-URL resolver, and the promise that a broken
// answer never crashes the page.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  DEFAULT_CONTACT_NOTE,
  NOT_ASSIGNED_MESSAGE,
  SELF_MESSAGE,
  approvalCounts,
  approvalSummaryLine,
  initialsOf,
  parseHod,
  resolvePhotoUrl,
  type HodApproval,
} from './hod.ts'

const HR_CONTACT = {
  label: 'HR Desk', phone: '0421 430 0800', phoneDial: '04214300800', whatsapp: '98765 43210', whatsappNumber: '919876543210',
  email: 'hr@example.com', hours: 'Mon-Sat 9 to 6', hasContact: true, usesHrFallback: false,
}

const approvals = [
  { key: 'leave', label: 'Leave', canApprove: true, reason: null, requestedBy: 'Employee', path: 'Employee → HOD or HR' },
  { key: 'permission', label: 'Permission', canApprove: true, reason: null, requestedBy: 'Employee', path: 'Employee → HOD' },
  { key: 'casual_leave', label: 'Casual leave', canApprove: false, reason: 'HR decides this one.', requestedBy: 'Employee', path: 'Employee → HR' },
  { key: 'holiday_work', label: 'Holiday / Sunday work compensation', canApprove: false, reason: 'Not enabled for your Department Head.', requestedBy: 'HR', path: 'HR → HOD' },
]

function assignedAnswer() {
  return {
    assigned: true, employeeId: 77, employeeCode: 'HWB', name: 'Suresh Raj', phone: '9000000001', photoUrl: '/media/boss.jpg',
    designation: 'Cutting Manager', department: 'Cutting', branch: 'Head Office', email: 'boss@example.com',
    approvals, hrContact: HR_CONTACT, contactNote: 'For any question about approvals, contact HR.', message: null,
  }
}

describe('parseHod', () => {
  test('an assigned head is read in full', () => {
    const hod = parseHod(assignedAnswer())!
    assert.equal(hod.assigned, true)
    assert.equal(hod.isSelf, false)
    assert.equal(hod.name, 'Suresh Raj')
    assert.equal(hod.employeeCode, 'HWB')
    assert.equal(hod.phone, '9000000001')
    assert.equal(hod.photoUrl, '/media/boss.jpg')
    assert.equal(hod.designation, 'Cutting Manager')
    assert.equal(hod.department, 'Cutting')
    assert.equal(hod.branch, 'Head Office')
    assert.equal(hod.email, 'boss@example.com')
    assert.equal(hod.message, null)
    assert.equal(hod.contactNote, 'For any question about approvals, contact HR.')
    assert.equal(hod.hrContact!.whatsappNumber, '919876543210')
    assert.equal(hod.approvals.length, 4)
    assert.deepEqual(hod.approvals[2], { key: 'casual_leave', label: 'Casual leave', canApprove: false, reason: 'HR decides this one.', requestedBy: 'Employee', path: 'Employee → HR' })
  })

  test('no head: the friendly message, no approvals, HR contact kept', () => {
    const hod = parseHod({
      assigned: false, name: null, phone: null, photoUrl: null, designation: null, department: null, branch: null, email: null,
      approvals: [], hrContact: HR_CONTACT, contactNote: 'For any question about approvals, contact HR.',
      message: 'You do not have a Department Head assigned yet. Please contact HR to have one assigned.',
    })!
    assert.equal(hod.assigned, false)
    assert.equal(hod.isSelf, false)
    assert.equal(hod.name, null)
    assert.deepEqual(hod.approvals, [])
    assert.equal(hod.message, NOT_ASSIGNED_MESSAGE)
    assert.equal(hod.hrContact!.hasContact, true)
  })

  test('a Department Head themself: isSelf, not assigned, HR decides', () => {
    const hod = parseHod({ assigned: false, isSelf: true, approvals: [], hrContact: HR_CONTACT, message: 'You are a Department Head yourself, so HR decides your own requests.' })!
    assert.equal(hod.assigned, false)
    assert.equal(hod.isSelf, true)
    assert.equal(hod.message, SELF_MESSAGE)
    // A message the server left out is filled in with the same sentences.
    assert.equal(parseHod({ assigned: false, isSelf: true })!.message, SELF_MESSAGE)
    assert.equal(parseHod({ assigned: false })!.message, NOT_ASSIGNED_MESSAGE)
  })

  test('an unassigned answer never lists approvals, even stray ones', () => {
    assert.deepEqual(parseHod({ assigned: false, approvals })!.approvals, [])
    assert.deepEqual(parseHod({ assigned: true, isSelf: true, approvals })!.approvals, [])
  })

  test('missing keys fall back to "not known"', () => {
    const hod = parseHod({ assigned: true })!
    assert.equal(hod.assigned, true)
    assert.equal(hod.name, null)
    assert.equal(hod.phone, null)
    assert.equal(hod.photoUrl, null)
    assert.deepEqual(hod.approvals, [])
    assert.equal(hod.hrContact, null)
    assert.equal(hod.contactNote, DEFAULT_CONTACT_NOTE)
    assert.equal(hod.message, null)
  })

  test('anything that is not the contract is null, never a crash', () => {
    for (const junk of [null, undefined, 7, 'text', true, [], [1], '<html>Bad Gateway</html>', {}, { name: 'x' }]) {
      assert.equal(parseHod(junk), null, JSON.stringify(junk))
    }
  })

  test('blank strings are "not known"; malformed approvals are dropped or tolerated', () => {
    const hod = parseHod({
      assigned: true, name: '  ', phone: '', email: ' ', designation: 5,
      approvals: [null, 3, 'x', {}, { key: '', label: '' }, { key: 'new_thing', canApprove: 'yes' }, { label: 'Outpass', canApprove: true }, { key: 'x', label: 'X', canApprove: false, reason: '  ' }],
    })!
    assert.equal(hod.name, null)
    assert.equal(hod.phone, null)
    assert.equal(hod.email, null)
    assert.equal(hod.designation, null)
    // Dropped: null, 3, 'x', {} and the empty one. Kept: 3 entries; an unknown key is named from itself.
    assert.deepEqual(hod.approvals.map((a) => [a.key, a.label, a.canApprove]), [
      ['new_thing', 'New thing', false],
      ['Outpass', 'Outpass', true],
      ['x', 'X', false],
    ])
    assert.equal(hod.approvals[2].reason, null)
  })

  test('canApprove is true only for an actual true', () => {
    for (const bad of ['true', 1, 'yes', null, undefined, {}]) {
      assert.equal(parseHod({ assigned: true, approvals: [{ key: 'leave', label: 'Leave', canApprove: bad }] })!.approvals[0].canApprove, false, String(bad))
    }
  })
})

describe('the approvals summary', () => {
  const mk = (...flags: boolean[]): HodApproval[] => flags.map((canApprove, i) => ({ key: `k${i}`, label: `L${i}`, canApprove, reason: null, requestedBy: null, path: null }))

  test('counts', () => {
    assert.deepEqual(approvalCounts(mk(true, true, false)), { total: 3, can: 2, cannot: 1 })
    assert.deepEqual(approvalCounts([]), { total: 0, can: 0, cannot: 0 })
  })

  test('the sentence', () => {
    assert.equal(approvalSummaryLine(mk(true, true, false)), 'Your Department Head can approve 2 of 3 kinds of request.')
    assert.equal(approvalSummaryLine(mk(true, true)), 'Your Department Head can approve all 2 kinds of request.')
    assert.equal(approvalSummaryLine(mk(false, false)), 'Your Department Head cannot approve any kind of request right now: HR decides them.')
    assert.equal(approvalSummaryLine([]), '')
  })
})

describe('initialsOf', () => {
  test('two words, one word, extra spaces, nothing', () => {
    assert.equal(initialsOf('Suresh Raj'), 'SR')
    assert.equal(initialsOf('suresh raj kumar'), 'SR')
    assert.equal(initialsOf('Suresh'), 'S')
    assert.equal(initialsOf('  Asha   Kumar  '), 'AK')
    assert.equal(initialsOf(''), '?')
    assert.equal(initialsOf(null), '?')
    assert.equal(initialsOf(undefined), '?')
  })
})

describe('resolvePhotoUrl', () => {
  const API = 'https://api.example.com/api'

  test('a server path is resolved against the API origin, not this site', () => {
    assert.equal(resolvePhotoUrl('/media/boss.jpg', API), 'https://api.example.com/media/boss.jpg')
    assert.equal(resolvePhotoUrl('media/boss.jpg', API), 'https://api.example.com/media/boss.jpg')
    assert.equal(resolvePhotoUrl('/api/employees/5/photo', API), 'https://api.example.com/api/employees/5/photo')
    assert.equal(resolvePhotoUrl('  /media/a b.jpg  ', API), 'https://api.example.com/media/a b.jpg')
  })

  test('the API base may carry a trailing slash, a port, or http', () => {
    assert.equal(resolvePhotoUrl('/media/x.jpg', 'https://api.example.com/api/'), 'https://api.example.com/media/x.jpg')
    assert.equal(resolvePhotoUrl('/media/x.jpg', 'http://localhost:8000/api'), 'http://localhost:8000/media/x.jpg')
    assert.equal(resolvePhotoUrl('/media/x.jpg', 'https://api.example.com'), 'https://api.example.com/media/x.jpg')
  })

  test('an absolute link or an embedded picture is used as it is', () => {
    assert.equal(resolvePhotoUrl('https://cdn.example.com/p.png', API), 'https://cdn.example.com/p.png')
    assert.equal(resolvePhotoUrl('http://cdn.example.com/p.png', API), 'http://cdn.example.com/p.png')
    assert.equal(resolvePhotoUrl('data:image/jpeg;base64,/9j/4AAQ', API), 'data:image/jpeg;base64,/9j/4AAQ')
    assert.equal(resolvePhotoUrl('DATA:IMAGE/PNG;base64,AAA', API), 'DATA:IMAGE/PNG;base64,AAA')
    assert.equal(resolvePhotoUrl('//cdn.example.com/p.png', API), '//cdn.example.com/p.png')
  })

  test('nothing, or something that is not a picture address, gives null', () => {
    for (const bad of [null, undefined, '', '   ']) assert.equal(resolvePhotoUrl(bad, API), null)
    for (const bad of ['javascript:alert(1)', 'data:text/html;base64,PGgxPg==', 'file:///c:/x.jpg', 'blob:https://x/1', 'vbscript:x', 'ftp://host/p.png']) {
      assert.equal(resolvePhotoUrl(bad, API), null, bad)
    }
  })

  test('a relative API base lives on the page\'s own origin; without one the path is kept', () => {
    assert.equal(resolvePhotoUrl('/media/x.jpg', '/api', 'https://web.example.com'), 'https://web.example.com/media/x.jpg')
    assert.equal(resolvePhotoUrl('/media/x.jpg', '/api'), '/media/x.jpg')
    assert.equal(resolvePhotoUrl('media/x.jpg', undefined), '/media/x.jpg')
    assert.equal(resolvePhotoUrl('/media/x.jpg', undefined, 'https://web.example.com'), 'https://web.example.com/media/x.jpg')
    assert.equal(resolvePhotoUrl('/media/x.jpg', 'not a url'), '/media/x.jpg')
    assert.equal(resolvePhotoUrl('/media/x.jpg', ''), '/media/x.jpg')
  })
})

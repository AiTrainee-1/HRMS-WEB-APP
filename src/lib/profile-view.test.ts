// Run with `npm test` (Node's built-in test runner). The My Profile page's wording (lib/profile-view.ts).
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calcAge,
  capitalize,
  clockText,
  displayDate,
  employmentTypeLabel,
  extractPhone,
  initialsOf,
  maskAccount,
  passwordAgeLabel,
  readExtras,
  recordCompleteness,
  resignationLine,
  serviceLength,
  shiftWindow,
} from './profile-view.ts'

// Local times throughout, so the tests pass in any time zone.
const NOW = new Date(2026, 10, 25, 10, 0)

test('bank account: only the last four characters show', () => {
  assert.equal(maskAccount('123456789012'), '••••••••9012')
  assert.equal(maskAccount('123456'), '••3456')
  assert.equal(maskAccount('123'), '123')
  assert.equal(maskAccount(''), null)
  assert.equal(maskAccount(null), null)
})

test('age in whole years, the birthday counted on the day', () => {
  assert.equal(calcAge('1990-11-25', NOW), 36)
  assert.equal(calcAge('1990-11-26', NOW), 35)
  assert.equal(calcAge('1990-12-01', NOW), 35)
  assert.equal(calcAge('nope', NOW), null)
  assert.equal(calcAge(null, NOW), null)
})

test('password age', () => {
  assert.equal(passwordAgeLabel(null, NOW), 'Never changed')
  assert.equal(passwordAgeLabel('garbage', NOW), 'Never changed')
  assert.equal(passwordAgeLabel(new Date(2026, 10, 25, 8).toISOString(), NOW), 'Updated today')
  assert.equal(passwordAgeLabel(new Date(2026, 10, 24, 9).toISOString(), NOW), 'Last updated 1 day ago')
  assert.equal(passwordAgeLabel(new Date(2026, 10, 13, 9).toISOString(), NOW), 'Last updated 12 days ago')
})

test('phone number out of a free-text contact', () => {
  assert.equal(extractPhone('Ravi (brother) 98765 43210'), '9876543210')
  assert.equal(extractPhone('+91-98765-43210 mother'), '+919876543210')
  assert.equal(extractPhone('call Ravi'), null)
  assert.equal(extractPhone(null), null)
})

test('dates read the day as written, never shifted by time zone', () => {
  assert.equal(displayDate('2020-01-15'), '15 Jan 2020')
  assert.equal(displayDate('2020-01-15T00:00:00Z'), '15 Jan 2020')
  assert.equal(displayDate('15/01/2020'), '15/01/2020')
  assert.equal(displayDate(null), null)
  assert.equal(displayDate('  '), null)
})

test('length of service', () => {
  assert.equal(serviceLength('2023-09-10', NOW), '3 yrs 2 mos')
  assert.equal(serviceLength('2025-11-25', NOW), '1 yr')
  assert.equal(serviceLength('2026-03-30', NOW), '7 mos')
  assert.equal(serviceLength('2026-10-26', NOW), 'New this month')
  assert.equal(serviceLength('2026-11-02', NOW), 'New this month')
  assert.equal(serviceLength('2027-01-01', NOW), null)
  assert.equal(serviceLength(undefined, NOW), null)
})

test('labels', () => {
  assert.equal(capitalize('male'), 'Male')
  assert.equal(capitalize('on_leave'), 'On leave')
  assert.equal(capitalize(''), null)
  assert.equal(employmentTypeLabel('production'), 'Production')
  assert.equal(employmentTypeLabel('Production'), 'Production')
  assert.equal(employmentTypeLabel('staff'), 'Staff')
  assert.equal(employmentTypeLabel('office'), 'Staff')
  assert.equal(employmentTypeLabel(undefined), null)
  assert.equal(initialsOf('Anitha Kumar Raj'), 'AK')
  assert.equal(initialsOf('  priya  '), 'P')
  assert.equal(initialsOf(null), '')
})

test('shift times read as a 12-hour window', () => {
  assert.equal(clockText('09:00'), '9:00 AM')
  assert.equal(clockText('18:30:00'), '6:30 PM')
  assert.equal(clockText('00:15'), '12:15 AM')
  assert.equal(clockText('12:00'), '12:00 PM')
  assert.equal(clockText('soon'), 'soon')
  assert.equal(clockText(''), null)
  assert.equal(shiftWindow('09:00', '18:00'), '9:00 AM – 6:00 PM')
  assert.equal(shiftWindow('—', '18:00'), null)
  assert.equal(shiftWindow(null, '18:00'), null)
})

test('extra profile fields are read defensively', () => {
  const full = readExtras({
    nationality: 'Indian',
    workstation: ' Line 4 ',
    zone: 2,
    staffTier: 'T2',
    isConfirmed: false,
    confirmationDate: null,
    hasPassword: true,
    passwordUpdatedAt: '2026-11-01T10:00:00+05:30',
    reportingManager: { id: 9, name: 'Kavya R', designationTitle: 'Supervisor' },
  })
  assert.deepEqual(full, {
    nationality: 'Indian',
    workstation: 'Line 4',
    zone: '2',
    staffTier: 'T2',
    isConfirmed: false,
    confirmationDate: null,
    hasPassword: true,
    passwordUpdatedAt: '2026-11-01T10:00:00+05:30',
    supervisor: 'Kavya R · Supervisor',
  })
  const none = readExtras(null)
  assert.equal(none.isConfirmed, null)
  assert.equal(none.hasPassword, false)
  assert.equal(none.supervisor, null)
  assert.equal(readExtras({ reportingManager: { name: 'Kavya R', designationTitle: null } }).supervisor, 'Kavya R')
  assert.equal(readExtras({ reportingManager: 'x', zone: '' }).zone, null)
})

test('record completeness', () => {
  const rec = { a: 'x', b: '', c: 'y', d: undefined as string | undefined }
  assert.deepEqual(recordCompleteness(rec, ['a', 'b', 'c', 'd']), { filled: 2, total: 4, pct: 50 })
  assert.deepEqual(recordCompleteness(null, ['a'] as never[]), { filled: 0, total: 1, pct: 0 })
  assert.deepEqual(recordCompleteness(rec, []), { filled: 0, total: 0, pct: 0 })
})

test('resignation line', () => {
  assert.equal(resignationLine(null), 'Resign, and see your notice details')
  assert.equal(resignationLine('pending', 'Waiting for Department Head'), 'Sent · waiting for Department Head')
  assert.equal(resignationLine('pending'), 'Sent · waiting for your Department Head')
  assert.equal(resignationLine('dept_approved'), 'Sent · waiting for HR')
  assert.equal(resignationLine('approved'), 'Resignation approved')
  assert.equal(resignationLine('rejected'), 'Not accepted · you can send it again')
  assert.equal(resignationLine('weird'), 'See your resignation and notice details')
})

// Run with `npm test`. My Department Head -> My Requests: the GET /my/pending-requests contract
// (backend/api/mobile_reminder_views.py), the 24 h reminder countdown and the stepper.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  changeText,
  cooldownProgress,
  cooldownText,
  countBadge,
  decisionLine,
  durationText,
  normalizePendingRequests,
  readRemindResult,
  remindErrorText,
  remindLabel,
  retryAfterSeconds,
  secondsUntilRemind,
  stepperSteps,
  waitingSinceText,
} from './pending-reminders.ts'

const ROW = {
  key: 'leave-7',
  module: 'leave',
  moduleLabel: 'Leave',
  id: 7,
  title: 'Sick Leave',
  summary: '06 Oct - 08 Oct · 3 days',
  submittedAt: '2026-10-28T04:00:00Z',
  stage: 'Waiting for your Department Head (Ravi)',
  approver: { role: 'hod', name: 'Ravi', label: 'Department Head' },
  steps: [
    { label: 'Department Head', state: 'pending' },
    { label: 'HR', state: 'waiting' },
  ],
  canRemind: false,
  remindInSeconds: 3600,
  lastRemindedAt: '2026-10-31T03:00:00Z',
}

describe('normalizePendingRequests', () => {
  test('reads a real reply', () => {
    const r = normalizePendingRequests({
      items: [ROW, { id: 'x' }, null],
      cooldownHours: 24,
      recentDays: 30,
      recentHrEdits: [
        { id: 3, status: 'approved', decidedBy: 'Meena', decidedByRole: 'hr', change: { date: '2026-10-08', fromLabel: 'Absent', toLabel: 'Present' } },
        { id: 4, status: 'pending' },
      ],
    })
    assert.ok(r)
    assert.equal(r.count, 1)
    const it = r.items[0]
    assert.equal(it.approver.role, 'hod')
    assert.equal(it.canRemind, false)
    assert.equal(it.remindInSeconds, 3600)
    assert.equal(it.raisedBy, 'employee')
    assert.equal(r.recentHrEdits.length, 1)
    assert.equal(r.recentHrEdits[0].raisedBy, 'hr')
    assert.equal(r.recentHrEdits[0].change?.text, '2026-10-08: Absent → Present')
  })

  test('an HR-raised attendance change keeps its chip and its sentence', () => {
    const r = normalizePendingRequests({
      items: [{ id: 9, module: 'attendance_correction', raisedBy: 'hr', raisedByName: 'Meena', change: { text: 'Absent → Present' }, canRemind: true }],
    })
    assert.equal(r?.items[0].raisedByLabel, 'Raised by HR')
    assert.equal(r?.items[0].raisedByName, 'Meena')
    assert.equal(r?.items[0].change?.text, 'Absent → Present')
    assert.equal(r?.items[0].canRemind, true)
  })

  test('not the contract: null', () => {
    assert.equal(normalizePendingRequests(null), null)
    assert.equal(normalizePendingRequests({ items: 'x' }), null)
    assert.equal(normalizePendingRequests('<html>'), null)
  })
})

describe('the reminder', () => {
  test('countdown follows the server, not this clock', () => {
    const item = { canRemind: false, remindInSeconds: 3600 }
    assert.equal(secondsUntilRemind(item, 1_000_000, 1_000_000 + 600_000), 3000)
    assert.equal(secondsUntilRemind(item, 1_000_000, 1_000_000 + 4_000_000), 0)
    assert.equal(secondsUntilRemind({ canRemind: true, remindInSeconds: 99 }, 0, 0), 0)
  })

  test('wording', () => {
    assert.equal(durationText(0), '')
    assert.equal(durationText(30), 'under a minute')
    assert.equal(durationText(61), '2 m')
    assert.equal(durationText(5 * 3600 + 11 * 60 + 5), '5 h 12 m')
    assert.equal(cooldownText(3600), 'You can remind again in 1 h 0 m')
    assert.equal(cooldownText(0), '')
    assert.equal(remindLabel({ approver: { role: 'hod', name: 'Ravi', label: 'Department Head' } }), 'Remind Department Head')
    assert.equal(remindLabel({ approver: { role: 'hr', name: 'HR', label: 'HR' } }), 'Remind HR')
    assert.equal(cooldownProgress(12 * 3600, 24), 0.5)
    assert.equal(cooldownProgress(0, 24), 1)
  })

  test('errors: the server sentence (429 too_soon), else a plain one', () => {
    const tooSoon = { status: 429, message: 'x', data: { error: 'You already reminded the approver.', retryAfterSeconds: 7200 } }
    assert.equal(remindErrorText(tooSoon), 'You already reminded the approver.')
    assert.equal(retryAfterSeconds(tooSoon), 7200)
    assert.equal(remindErrorText({ status: 500, data: '<html>' }), 'The reminder could not be sent. Please try again.')
    assert.equal(remindErrorText(new Error('Network Error')), 'No connection. Check your internet and try again.')
    assert.equal(retryAfterSeconds({ status: 500 }), null)
  })

  test('result', () => {
    const r = readRemindResult({ message: 'Ravi has been reminded.', item: { ...ROW, canRemind: false, remindInSeconds: 86400 } })
    assert.equal(r.message, 'Ravi has been reminded.')
    assert.equal(r.item?.remindInSeconds, 86400)
    assert.deepEqual(readRemindResult(null), { message: 'Reminder sent.', item: null })
  })
})

describe('stepper and small words', () => {
  test('You first, then the pipeline, the waiting step current', () => {
    const r = normalizePendingRequests({ items: [ROW] })
    const steps = stepperSteps(r!.items[0], () => '28 Oct, 9:30 AM')
    assert.deepEqual(
      steps.map((s) => [s.label, s.state]),
      [
        ['You', 'done'],
        ['Department Head', 'current'],
        ['HR', 'upcoming'],
      ],
    )
    assert.equal(steps[0].detail, 'Sent 28 Oct, 9:30 AM')
  })

  test('an HR-raised change starts with HR', () => {
    const steps = stepperSteps({ steps: [], submittedAt: null, raisedBy: 'hr', raisedByName: null })
    assert.equal(steps[0].label, 'HR (raised it)')
    assert.equal(steps[1].state, 'current')
  })

  test('waiting, decision line, badge, change text', () => {
    const now = Date.parse('2026-10-31T04:00:00Z')
    assert.equal(waitingSinceText('2026-10-28T04:00:00Z', now), 'Waiting 3 days')
    assert.equal(waitingSinceText('2026-10-31T03:59:30Z', now), 'Sent just now')
    assert.equal(waitingSinceText(null, now), '')
    assert.equal(decisionLine({ statusLabel: 'Rejected', decidedBy: null, decidedByRole: 'hod', decidedAt: null }), 'Rejected by your Department Head')
    assert.equal(countBadge(0), '')
    assert.equal(countBadge(120), '99+')
    assert.equal(
      changeText({ date: '2026-10-08', fromLabel: 'Absent', fromShifts: '0.00 shift', toLabel: 'Present', toShifts: '1.00 shift', firstPunch: '09:00', lastPunch: '18:00', marks: ['Late'] }),
      '2026-10-08: Absent (0.00 shift) → Present (1.00 shift), 09:00 to 18:00, marked Late',
    )
  })
})

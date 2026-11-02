// Run with `npm test`. HR attendance edits on the calendar (lib/hr-edit.ts): reading the server's `hrEdit`, the words
// of the popover / day dialog, and the counts under the calendar.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  changeText,
  commentText,
  countHrEdits,
  hrEditAria,
  hrEditBadgeClass,
  hrEditMonthText,
  hrEditOf,
  hrEditRows,
  hrEditStatusWord,
  hrEditTitle,
  hrEditTone,
  isHrEditApplied,
  readHrEdit,
  shiftsText,
  sideText,
} from './hr-edit.ts'
import type { HrEdit } from '../types/index.ts'

// A fixed clock for the "who and when" lines, so the tests do not depend on the machine's time zone.
const when = (iso: string) => (iso.startsWith('2026-11-02T10:05') ? '2 Nov, 10:05 AM' : iso.startsWith('2026-11-02T15:30') ? '2 Nov, 3:30 PM' : null)

const applied: HrEdit = {
  requestId: 41,
  status: 'applied',
  stageLabel: 'Applied - approved by Suresh Raj (Department Head) and Meena (HR) on 02 Nov 2026',
  from: { label: 'Absent', shifts: 0 },
  to: { label: 'Present', shifts: 1 },
  option: 'worked',
  type: 'present_full',
  typeLabel: 'Present',
  reason: 'Biometric was down that morning',
  comment: null,
  raisedBy: 'Meena',
  raisedAt: '2026-11-02T10:05:00+05:30',
  decidedBy: 'Meena',
  decidedAt: '2026-11-02T15:30:00+05:30',
}

describe('reading the server', () => {
  test('null, an older server and junk are no edit', () => {
    assert.equal(readHrEdit(null), null)
    assert.equal(readHrEdit(undefined), null)
    assert.equal(readHrEdit('applied'), null)
    assert.equal(readHrEdit([]), null)
    assert.equal(readHrEdit({ requestId: 3 }), null) // no status
    assert.equal(hrEditOf({}), null)
    assert.equal(hrEditOf(null), null)
    assert.equal(hrEditOf({ hrEdit: null }), null)
  })

  test('a full block is kept as sent', () => {
    assert.deepEqual(readHrEdit(applied), applied)
    assert.deepEqual(hrEditOf({ hrEdit: applied }), applied)
  })

  test('missing words fall back to plain ones; numeric strings become numbers', () => {
    const e = readHrEdit({ requestId: '7', status: 'waiting_hr', from: { label: 'Half Day', shifts: '0.50' }, to: {}, type: 'mark_late' })!
    assert.equal(e.requestId, 7)
    assert.equal(e.stageLabel, 'Waiting for HR')
    assert.deepEqual(e.from, { label: 'Half Day', shifts: 0.5 })
    assert.deepEqual(e.to, { label: 'Not recorded', shifts: null })
    assert.equal(e.typeLabel, 'mark late')
    assert.equal(e.reason, null)
    assert.equal(e.raisedBy, null)
    assert.equal(readHrEdit({ status: 'applied' })!.typeLabel, 'Attendance change')
  })
})

describe('stage words and tones', () => {
  test('the four stages', () => {
    assert.equal(hrEditStatusWord('waiting_hod'), 'Waiting for Department Head')
    assert.equal(hrEditStatusWord('waiting_hr'), 'Waiting for HR')
    assert.equal(hrEditStatusWord('applied'), 'Applied')
    assert.equal(hrEditStatusWord('rejected'), 'Rejected')
    assert.equal(hrEditStatusWord('on_hold'), 'On hold') // a stage added later
    assert.equal(hrEditTone('waiting_hod'), 'waiting')
    assert.equal(hrEditTone('waiting_hr'), 'waiting')
    assert.equal(hrEditTone('applied'), 'approved')
    assert.equal(hrEditTone('rejected'), 'rejected')
    assert.equal(hrEditTone('on_hold'), 'neutral')
  })

  test('only an applied edit takes the colour', () => {
    assert.equal(isHrEditApplied(applied), true)
    assert.equal(isHrEditApplied({ status: 'waiting_hr' }), false)
    assert.equal(isHrEditApplied({ status: 'rejected' }), false)
    assert.equal(isHrEditApplied(null), false)
  })

  test('titles and the badge colour follow the stage', () => {
    assert.equal(hrEditTitle(applied), 'Edited by HR')
    assert.equal(hrEditTitle({ status: 'waiting_hod' }), 'HR edit waiting for approval')
    assert.equal(hrEditTitle({ status: 'rejected' }), 'HR edit rejected')
    assert.match(hrEditBadgeClass('waiting_hr'), /bg-warning/)
    assert.match(hrEditBadgeClass('applied'), /#4F46E5/)
    assert.match(hrEditBadgeClass('rejected'), /bg-destructive/)
  })
})

describe('the words of the popover', () => {
  test('shifts and from -> to', () => {
    assert.equal(shiftsText(1), '1 shift')
    assert.equal(shiftsText(0), '0 shifts')
    assert.equal(shiftsText(0.5), '½ shift')
    assert.equal(shiftsText(1.5), '1½ shifts')
    assert.equal(shiftsText(0.75), '0.75 shift')
    assert.equal(shiftsText(2), '2 shifts')
    assert.equal(sideText({ label: 'Present', shifts: null }), 'Present')
    assert.equal(changeText(applied), 'Absent (0 shifts) → Present (1 shift)')
  })

  test('an applied edit lists everything, in order', () => {
    assert.deepEqual(hrEditRows(applied, when), [
      { key: 'what', label: 'What HR changed', value: 'Present' },
      { key: 'change', label: 'Change', value: 'Absent (0 shifts) → Present (1 shift)' },
      { key: 'reason', label: 'Reason', value: 'Biometric was down that morning' },
      { key: 'raised', label: 'Raised by', value: 'Meena · 2 Nov, 10:05 AM' },
      { key: 'stage', label: 'Approval stage', value: applied.stageLabel },
      { key: 'decided', label: 'Approved by', value: 'Meena · 2 Nov, 3:30 PM' },
    ])
  })

  test('a waiting edit has no decision line, even if a name is around', () => {
    const waiting: HrEdit = { ...applied, status: 'waiting_hr', stageLabel: 'Waiting for HR (Department Head Suresh Raj approved on 02 Nov 2026)', decidedBy: 'Suresh Raj' }
    const keys = hrEditRows(waiting, when).map((r) => r.key)
    assert.deepEqual(keys, ['what', 'change', 'reason', 'raised', 'stage'])
  })

  test('a rejected edit: who rejected; the comment once', () => {
    const rejected: HrEdit = {
      ...applied,
      status: 'rejected',
      stageLabel: 'Rejected by Suresh Raj (Department Head) on 02 Nov 2026: Was on leave',
      comment: 'Was on leave',
      decidedBy: 'Suresh Raj',
      reason: null,
    }
    const rows = hrEditRows(rejected, when)
    assert.deepEqual(rows.find((r) => r.key === 'decided'), { key: 'decided', label: 'Rejected by', value: 'Suresh Raj · 2 Nov, 3:30 PM' })
    assert.equal(rows.some((r) => r.key === 'comment'), false) // already in the stage sentence
    assert.equal(rows.some((r) => r.key === 'reason'), false)
    assert.equal(commentText({ ...rejected, stageLabel: 'Rejected' }), 'Was on leave')
  })

  test('a time without a name, and nothing at all', () => {
    const e: HrEdit = { ...applied, raisedBy: null, decidedBy: null, raisedAt: null }
    const rows = hrEditRows(e, when)
    assert.equal(rows.some((r) => r.key === 'raised'), false)
    assert.deepEqual(rows.find((r) => r.key === 'decided'), { key: 'decided', label: 'Approved on', value: '2 Nov, 3:30 PM' })
  })

  test('the accessible words of a calendar cell', () => {
    assert.equal(hrEditAria(applied), 'edited by HR: Present, applied')
    assert.equal(hrEditAria({ status: 'waiting_hr', typeLabel: 'Mark as Late' }), 'HR edit: Mark as Late, waiting for HR')
  })
})

describe('the month', () => {
  test('counts by stage and the line under the calendar', () => {
    const days = [
      { hrEdit: applied },
      { hrEdit: { ...applied, status: 'waiting_hod' } },
      { hrEdit: { ...applied, status: 'rejected' } },
      { hrEdit: null },
      {},
    ]
    const c = countHrEdits(days)
    assert.deepEqual(c, { any: 3, applied: 1, waiting: 1, rejected: 1 })
    assert.equal(hrEditMonthText(c), 'HR changed 3 days this month: 1 applied, 1 waiting for approval, 1 rejected.')
    assert.equal(hrEditMonthText(countHrEdits([{ hrEdit: applied }])), 'HR changed 1 day this month: 1 applied.')
    assert.equal(hrEditMonthText(countHrEdits([])), null)
  })
})

// Run with `npm test`. Enquiries to HR (owner 2026-11-24).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { enquiryCounts, enquiryProblem, enquiryStatusOf, filterEnquiries, readEnquiries, readEnquiry, statusWords } from './enquiries.ts'

const wire = {
  id: 7,
  category: 'salary',
  categoryLabel: 'Salary & deductions',
  subject: 'PF missing',
  message: 'My PF for October is not shown.',
  status: 'on_hold',
  statusLabel: 'On Hold',
  hrReply: 'Checking with accounts.',
  handledBy: 'Meena',
  handledAt: '2026-11-24T10:00:00+05:30',
  doneAt: null,
  history: [{ at: '2026-11-24T10:00:00+05:30', by: 'Meena', status: 'on_hold', reply: 'Checking with accounts.' }],
  createdAt: '2026-11-23T09:00:00+05:30',
}

describe('enquiries', () => {
  test('reads the wire shape', () => {
    const e = readEnquiry(wire)!
    assert.equal(e.id, 7)
    assert.equal(e.categoryLabel, 'Salary & deductions')
    assert.equal(e.history.length, 1)
    assert.equal(e.history[0].by, 'Meena')
    assert.equal(e.doneAt, null)
  })

  test('rows without a usable id are dropped; a missing label falls back to the topic list', () => {
    assert.equal(readEnquiry({ id: 0 }), null)
    assert.equal(readEnquiry(null), null)
    assert.equal(readEnquiry({ id: '3', category: 'leave' })?.categoryLabel, 'Leave & holidays')
    assert.deepEqual(readEnquiry({ id: 4, history: 'x' })?.history, [])
    assert.equal(readEnquiries([wire, { id: -1 }, 'x']).length, 1)
    assert.deepEqual(readEnquiries({ items: [] }), [])
  })

  test('status words', () => {
    assert.equal(statusWords({ status: 'pending', statusLabel: 'Pending' }).employeeText, 'Waiting for HR')
    assert.equal(statusWords({ status: 'on_hold', statusLabel: '' }).employeeText, 'HR put it on hold')
    assert.equal(statusWords({ status: 'done', statusLabel: '' }).employeeText, 'Resolved by HR')
    assert.equal(statusWords({ status: 'escalated', statusLabel: 'Escalated' }).label, 'Escalated')
    assert.equal(enquiryStatusOf('On Hold'), 'on_hold')
    assert.equal(enquiryStatusOf('weird'), 'pending')
  })

  test('counts and filters', () => {
    const list = [{ status: 'pending' }, { status: 'done' }, { status: 'on_hold' }, { status: 'done' }]
    assert.deepEqual(enquiryCounts(list), { all: 4, pending: 1, on_hold: 1, done: 2 })
    assert.equal(filterEnquiries(list, 'done').length, 2)
    assert.equal(filterEnquiries(list, 'all').length, 4)
  })

  test('the form', () => {
    assert.match(enquiryProblem('  a ', '')!, /at least 3/)
    assert.match(enquiryProblem('x'.repeat(201), '')!, /at most 200/)
    assert.match(enquiryProblem('Salary', 'x'.repeat(2001))!, /at most 2000/)
    assert.equal(enquiryProblem('PF missing', ''), null)
  })
})

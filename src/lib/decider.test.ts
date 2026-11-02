// Run with `npm test`. Who decided a request (lib/decider.ts) - the mobile app's approvalsDecider.test.ts vectors, plus
// the web's Department Head line and the stepper path.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  approvalPath,
  decisionLineFor,
  deciderForAdvance,
  deciderFromApproval,
  deciderFromFields,
  deciderFromStamps,
  deciderText,
  formatWhen,
  roleOf,
  waitingTarget,
} from './decider.ts'

const W = (iso: string) => `@${iso.slice(11, 16)}`
const step = (o: Record<string, unknown>) => ({ roles: ['hod'], mandatory: true, label: 'HOD', index: 0, state: 'waiting', ...o })
const block = (steps: unknown[], o: Record<string, unknown> = {}): any => ({
  workflow: 'leave',
  label: 'Leave',
  enabled: true,
  steps,
  currentStep: null,
  waitingFor: [],
  canAct: { hod: false, hr: false },
  ...o,
})

test('the final approver: the step decided last, with its role, name and time', () => {
  const a = block([
    step({ index: 0, roles: ['hod'], state: 'approved', by: 'Kavya', at: '2026-10-30T09:00:00Z', decidedBy: 'hod' }),
    step({ index: 1, roles: ['hr'], state: 'approved', by: 'Meena', at: '2026-10-31T10:05:00Z', decidedBy: 'hr' }),
  ])
  const d = deciderFromApproval(a)!
  assert.deepEqual(d, { decision: 'approved', role: 'hr', name: 'Meena', at: '2026-10-31T10:05:00Z' })
  assert.equal(deciderText(d, W), 'Approved by HR (Meena) · @10:05')
})

test('a shared "HOD or HR" step says which of the two decided', () => {
  const a = block([step({ roles: ['hod', 'hr'], state: 'approved', by: 'Kavya', decidedBy: 'hod' })])
  assert.equal(deciderText(deciderFromApproval(a)!, W), 'Approved by Department Head (Kavya)')
})

test('a rejection names the step that rejected', () => {
  const a = block([
    step({ index: 0, state: 'approved', by: 'Kavya', at: '2026-10-30T09:00:00Z' }),
    step({ index: 1, roles: ['hr'], state: 'rejected', by: 'Meena', at: '2026-10-31T10:05:00Z' }),
  ])
  assert.equal(deciderText(deciderFromApproval(a)!, W), 'Rejected by HR (Meena) · @10:05')
})

test('nothing while the request waits, without a block, or when the block cannot say', () => {
  assert.equal(deciderFromApproval(null), null)
  assert.equal(deciderFromApproval(block([step({ state: 'pending' })], { currentStep: 0, waitingFor: ['hod'] })), null)
  assert.equal(deciderFromApproval(block([step({ state: 'skipped' })])), null)
  // An old REJECTED row whose stamps only kept approvals: never "Approved by ...".
  assert.equal(
    deciderFromApproval(block([step({ index: 0, state: 'approved', by: 'Kavya' }), step({ index: 1, roles: ['hr'], state: 'waiting' })])),
    null,
  )
})

test('old requests: the fields they kept', () => {
  assert.deepEqual(deciderFromFields({ status: 'approved', name: 'Meena', role: 'hr', at: '2026-10-31T10:05:00Z' }), {
    decision: 'approved',
    role: 'hr',
    name: 'Meena',
    at: '2026-10-31T10:05:00Z',
  })
  assert.deepEqual(deciderFromFields({ status: 'rejected', name: 'dept_head' }), { decision: 'rejected', role: 'hod', name: null, at: null })
  assert.equal(deciderFromFields({ status: 'pending', name: 'Meena' }), null)
  assert.equal(deciderFromFields({ status: 'approved' }), null)
  assert.equal(deciderFromFields({ status: 'approved', name: 'system' }), null)
  assert.equal(deciderFromFields({ status: 'closed', name: 'Meena' })!.decision, 'approved')
  assert.equal(roleOf('DEPT_HEAD'), 'hod')
  assert.equal(roleOf('system'), null)
})

test('the wording', () => {
  assert.equal(deciderText({ decision: 'approved', role: null, name: null, at: null, you: true }), 'Approved by you')
  assert.equal(deciderText({ decision: 'rejected', role: 'hod', name: null, at: null }), 'Rejected by Department Head')
  assert.equal(deciderText({ decision: 'approved', role: null, name: 'Old Boss', at: null }), 'Approved by Old Boss')
  assert.equal(deciderText({ decision: 'approved', role: null, name: null, at: null }), 'Approved')
  assert.equal(deciderText({ decision: 'approved', role: 'hr', name: 'Meena', at: 'bad' }), 'Approved by HR (Meena)')
})

test('formatWhen: "31 Oct, 10:05 AM" in local time', () => {
  assert.equal(formatWhen(new Date(2026, 9, 31, 10, 5).toISOString()), '31 Oct, 10:05 AM')
  assert.equal(formatWhen(new Date(2026, 9, 1, 0, 7).toISOString()), '1 Oct, 12:07 AM')
  assert.equal(formatWhen(new Date(2026, 9, 1, 12, 30).toISOString()), '1 Oct, 12:30 PM')
  assert.equal(formatWhen('not a date'), null)
})

test('old Missing Punch / On-Duty stamps and settlements', () => {
  assert.deepEqual(deciderFromStamps({ status: 'rejected', hodBy: 'Kavya', hodAt: 'x' }), { decision: 'rejected', role: 'hod', name: 'Kavya', at: 'x' })
  assert.deepEqual(deciderFromStamps({ status: 'approved', hodBy: 'Kavya', hrBy: 'Meena' }), { decision: 'approved', role: 'hr', name: 'Meena', at: null })
  assert.equal(deciderFromStamps({ status: 'pending_hr', hodBy: 'Kavya' }), null)
  assert.equal(deciderFromStamps({ status: 'completed', hrBy: 'Meena' })!.decision, 'approved')
  assert.deepEqual(deciderForAdvance({ status: 'closed', approvedBy: 'Meena', approvedAt: 't' }), { decision: 'approved', role: 'hr', name: 'Meena', at: 't' })
  assert.deepEqual(
    deciderForAdvance({ status: 'rejected', approvedBy: null, timeline: [{ kind: 'applied' }, { kind: 'rejected', by: 'Meena', at: 't2' }] }),
    { decision: 'rejected', role: 'hr', name: 'Meena', at: 't2' },
  )
  assert.equal(deciderText(deciderForAdvance({ status: 'approved' })!), 'Approved by HR')
  assert.equal(deciderForAdvance({ status: 'pending', approvedBy: 'Meena' }), null)
})

test('waitingTarget sorts the roles so the wording never flips', () => {
  assert.equal(waitingTarget(block([step({ state: 'pending' })], { currentStep: 0, waitingFor: ['hr', 'hod'] })), 'Department Head or HR')
  assert.equal(waitingTarget(block([step({ state: 'approved' })])), null)
})

test("the Department Head's own line", () => {
  const forwarded = block(
    [
      step({ index: 0, roles: ['hod'], state: 'approved', by: 'Kavya', at: '2026-10-31T10:05:00Z', decidedBy: 'hod' }),
      step({ index: 1, roles: ['hr'], state: 'pending' }),
    ],
    { currentStep: 1, waitingFor: ['hr'] },
  )
  assert.deepEqual(
    { text: decisionLineFor(forwarded, 'hod', W)!.text, tone: decisionLineFor(forwarded, 'hod', W)!.tone },
    { text: 'Approved by you · @10:05 · waiting for HR', tone: 'waiting' },
  )
  // Still at the head's own step: nothing decided yet.
  assert.equal(decisionLineFor(block([step({ state: 'pending' })], { currentStep: 0, waitingFor: ['hod'] }), 'hod'), null)
  // Final: HR rejected it.
  const rejected = block([
    step({ index: 0, state: 'approved', by: 'Kavya', at: '2026-10-30T09:00:00Z', decidedBy: 'hod' }),
    step({ index: 1, roles: ['hr'], state: 'rejected', by: 'Meena', at: '2026-10-31T10:05:00Z', decidedBy: 'hr' }),
  ])
  assert.equal(decisionLineFor(rejected, 'hod', W)!.text, 'Rejected by HR (Meena) · @10:05')
  assert.equal(decisionLineFor(rejected, 'hod', W)!.tone, 'rejected')
  // Final and the viewer's role made the call.
  const mine = block([step({ state: 'approved', by: 'Kavya', at: '2026-10-31T10:05:00Z', decidedBy: 'hod' })])
  assert.equal(decisionLineFor(mine, 'hod', W)!.text, 'Approved by you · @10:05')
})

test('approvalPath: You, then one step per approver', () => {
  const a = block(
    [
      step({ index: 0, roles: ['hod'], mandatory: false, state: 'approved', by: 'Kavya', at: '2026-10-30T09:00:00Z', comment: ' ok ' }),
      step({ index: 1, roles: ['hr', 'hod'], state: 'pending' }),
    ],
    { currentStep: 1, waitingFor: ['hr'] },
  )
  const path = approvalPath(a, '2026-10-29T08:00:00Z', W)
  assert.deepEqual(
    path.map((s) => [s.label, s.state, s.detail, s.comment]),
    [
      ['You', 'done', 'Sent @08:00', null],
      ['Department Head (optional)', 'done', 'Approved by Kavya · @09:00', 'ok'],
      ['Department Head or HR', 'current', 'Waiting for decision', null],
    ],
  )
  assert.deepEqual(approvalPath(null), [])
  const finished = block([step({ state: 'approved', by: 'A', decidedBy: 'hod' }), step({ index: 1, roles: ['hr'], state: 'waiting' })])
  assert.equal(approvalPath(finished)[2].detail, 'Not reached')
  const shared = block([step({ roles: ['hod', 'hr'], state: 'rejected', by: 'Meena', decidedBy: 'hr' })])
  assert.equal(approvalPath(shared, null, W)[1].detail, 'Rejected by Meena (HR)')
  assert.equal(approvalPath(shared, null, W)[1].state, 'rejected')
})

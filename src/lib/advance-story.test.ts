// Run with `npm test`. How a Loan & Advance amount was decided (lib/advance-story.ts): reading `amountStory` and wording
// it. The vectors are the backend's own (api/tests_employee_app_transparency.py): 7,300 asked, limit 7,600, rounded to
// 7,500, the management 6,000, the auditor 5,000.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  differenceOf,
  differenceText,
  normalizeAmountStory,
  remarksNotInSteps,
  reviewRows,
  roundingLine,
  stepTitle,
  stepWho,
  storyCardNote,
  storyExplainsLimit,
  storyFigures,
  storyMentions,
  waitingText,
  type AmountStory,
  type AmountStoryStep,
} from './advance-story.ts'
import { normalizeAdvance } from './advances.ts'

const ROUNDING_NOTE =
  'Company policy: a Salary Advance is rounded to the nearest ₹500 (₹250 and above rounds up, below ₹250 rounds down), and never above your eligible limit. ₹7,300 is rounded up to ₹7,500. That is ₹200 more than you asked for, still within your limit.'

const reducedRaw = {
  type: 'general',
  status: 'approved',
  method: 'automation',
  isFinal: true,
  raisedBy: 'employee',
  requested: 7300,
  eligibleLimit: 7600,
  limitBasis: '50% of the ₹15,200 salary you earned from 1 to 20 October 2026 (19 paid days).',
  limitBasisCode: 'earned_salary',
  roundingApplies: true,
  roundingIsFinal: true,
  beforeRounding: 7300,
  afterRounding: 7500,
  rounded: true,
  cappedAtLimit: false,
  roundsToZero: false,
  roundingNote: ROUNDING_NOTE,
  finalApproved: 5000,
  difference: -2300,
  reductionReason: 'Management: Pending canteen dues. Auditor: Leave in the 1st-20th.',
  rejectionReason: null,
  steps: [
    { stage: 'requested', role: 'employee', by: 'You', name: null, action: 'requested', from: null, to: 7300, reason: 'You asked for this amount.', remark: 'School fees', at: '2026-10-21T10:00:00+05:30', round: null },
    { stage: 'rounding', role: 'policy', by: 'Company policy', name: null, action: 'rounded_up', from: 7300, to: 7500, reason: ROUNDING_NOTE, remark: null, at: '2026-10-23T10:00:00+05:30', round: null },
    { stage: 'hr_review', role: 'hr', by: 'HR', name: null, action: 'approved', from: 7500, to: 7500, reason: null, remark: null, at: '2026-10-23T10:00:00+05:30', round: 1 },
    { stage: 'md_review', role: 'md', by: 'Management', name: null, action: 'reduced', from: 7500, to: 6000, reason: null, remark: 'Pending canteen dues', at: '2026-10-24T11:00:00+05:30', round: 1 },
    { stage: 'auditor_review', role: 'auditor', by: 'Auditor', name: null, action: 'reduced', from: 6000, to: 5000, reason: null, remark: 'Leave in the 1st-20th', at: '2026-10-26T12:00:00+05:30', round: 1 },
    { stage: 'final', role: 'hr', by: 'HR', name: null, action: 'approved', from: 7300, to: 5000, reason: 'Approved ₹5,000 of the ₹7,300 asked for.', remark: null, at: '2026-10-27T09:00:00+05:30', round: null },
  ],
  remarks: [
    { stage: 'md_review', role: 'md', by: 'Management', text: 'Pending canteen dues', at: '2026-10-24T11:00:00+05:30' },
    { stage: 'auditor_review', role: 'auditor', by: 'Auditor', text: 'Leave in the 1st-20th', at: '2026-10-26T12:00:00+05:30' },
  ],
}

const waitingRaw = {
  type: 'general',
  status: 'pending',
  method: 'automation',
  isFinal: false,
  raisedBy: 'employee',
  requested: 7300,
  eligibleLimit: 7600,
  limitBasis: '50% of the ₹15,200 salary you earned from 1 to 20 October 2026 (19 paid days).',
  limitBasisCode: 'earned_salary',
  roundingApplies: true,
  roundingIsFinal: false,
  beforeRounding: 7300,
  afterRounding: 7500,
  rounded: true,
  cappedAtLimit: false,
  roundsToZero: false,
  roundingNote: ROUNDING_NOTE,
  finalApproved: null,
  difference: null,
  reductionReason: null,
  rejectionReason: null,
  steps: [
    { stage: 'requested', role: 'employee', by: 'You', action: 'requested', from: null, to: 7300, reason: 'You asked for this amount.', at: '2026-10-21T10:00:00+05:30' },
    { stage: 'rounding', role: 'policy', by: 'Company policy', action: 'rounded_up', from: 7300, to: 7500, reason: ROUNDING_NOTE, at: null },
  ],
  remarks: [],
}

const TERM_NOTE = 'Term Loans are not rounded: the approved amount is paid and recovered in monthly EMIs.'
const termRaw = {
  type: 'term',
  status: 'approved',
  method: 'normal',
  isFinal: true,
  raisedBy: 'hr',
  requested: 10000,
  eligibleLimit: 30000,
  limitBasis: '100% of your fixed monthly salary of ₹30,000.',
  limitBasisCode: 'monthly_salary',
  roundingApplies: false,
  roundingIsFinal: null,
  beforeRounding: null,
  afterRounding: null,
  rounded: false,
  cappedAtLimit: false,
  roundsToZero: false,
  roundingNote: TERM_NOTE,
  finalApproved: 8000,
  difference: -2000,
  reductionReason: 'HR: Budget this month.',
  rejectionReason: null,
  steps: [
    { stage: 'requested', role: 'hr', by: 'HR', action: 'requested', from: null, to: 10000, reason: 'HR raised this request for you.' },
    { stage: 'hr_review', role: 'hr', by: 'HR', name: 'Meena', action: 'reduced', from: 10000, to: 8000, remark: 'Budget this month' },
    { stage: 'final', role: 'hr', by: 'HR', action: 'approved', from: 10000, to: 8000, reason: 'Approved ₹8,000 of the ₹10,000 asked for.' },
  ],
  remarks: [{ stage: 'hr_review', role: 'hr', by: 'HR', text: 'Budget this month', at: null }],
}

const rejectedRaw = {
  ...termRaw,
  type: 'general',
  status: 'rejected',
  raisedBy: 'employee',
  requested: 5000,
  roundingNote: 'This Salary Advance was not rounded: HR approved the amount directly.',
  finalApproved: null,
  difference: null,
  reductionReason: null,
  rejectionReason: 'HR: Already took one this year',
  steps: [
    { stage: 'requested', role: 'employee', by: 'You', action: 'requested', from: null, to: 5000 },
    { stage: 'hr_review', role: 'hr', by: 'HR', action: 'rejected', from: 5000, to: null, remark: 'Already took one this year' },
    { stage: 'final', role: 'hr', by: 'HR', action: 'rejected', from: 5000, to: null, reason: 'Rejected: nothing is paid or deducted.' },
  ],
  remarks: [{ stage: 'hr_review', role: 'hr', by: 'HR', text: 'Already took one this year', at: null }],
}

const story = (raw: unknown): AmountStory => normalizeAmountStory(raw)!

test('normalizeAmountStory reads the block defensively', () => {
  const s = story(reducedRaw)
  assert.equal(s.method, 'automation')
  assert.equal(s.isFinal, true)
  assert.equal(s.requested, 7300)
  assert.equal(s.eligibleLimit, 7600)
  assert.equal(s.limitBasisCode, 'earned_salary')
  assert.equal(s.roundingIsFinal, true)
  assert.equal(s.steps.length, 6)
  assert.deepEqual(s.remarks.map((r) => [r.by, r.text]), [['Management', 'Pending canteen dues'], ['Auditor', 'Leave in the 1st-20th']])
  // numbers sent as strings still read; a missing or unreadable block is null (an older server)
  assert.equal(story({ ...reducedRaw, requested: '7300.00', finalApproved: '5000' }).finalApproved, 5000)
  assert.equal(normalizeAmountStory(null), null)
  assert.equal(normalizeAmountStory('story'), null)
  assert.equal(normalizeAmountStory({ ...reducedRaw, requested: null }), null)
  // a step without a stage and a remark without text are dropped; no rounding = no roundingIsFinal
  const odd = story({ ...termRaw, steps: [{ role: 'hr' }, ...termRaw.steps], remarks: [{ by: 'HR', text: '  ' }], roundingIsFinal: true })
  assert.equal(odd.steps.length, 3)
  assert.deepEqual(odd.remarks, [])
  assert.equal(odd.roundingIsFinal, null)
  // a step without `by` gets its ROLE label, never a name
  const bare = story({ ...reducedRaw, steps: [{ stage: 'md_review', role: 'md', action: 'reduced', from: 7500, to: 6000 }], remarks: [{ role: 'auditor', text: 'Late' }] })
  assert.equal(bare.steps[0].by, 'Management')
  assert.equal(bare.remarks[0].by, 'Auditor')
})

test('normalizeAdvance carries the story (null on an older server)', () => {
  const a = normalizeAdvance({ id: 9, advanceType: 'general', status: 'approved', amount: 5000, requestedAmount: 7300, amountStory: reducedRaw })!
  assert.equal(a.amountStory?.finalApproved, 5000)
  assert.equal(normalizeAdvance({ id: 10, status: 'pending', amount: 3000 })!.amountStory, null)
})

test('storyFigures: asked, limit (with its basis), before / after rounding, the final amount', () => {
  const f = storyFigures(story(reducedRaw))
  assert.deepEqual(
    f.map((x) => [x.key, x.label, x.value, x.tone]),
    [
      ['requested', 'You asked for', '₹7,300', 'plain'],
      ['limit', 'Eligible up to', '₹7,600', 'plain'],
      ['before', 'Before rounding', '₹7,300', 'plain'],
      ['after', 'After rounding', '₹7,500', 'more'],
      ['final', 'Final approved', '₹5,000', 'less'],
    ],
  )
  assert.equal(f[1].sub, '50% of the ₹15,200 salary you earned from 1 to 20 October 2026 (19 paid days).')
  assert.equal(f[4].sub, '₹2,300 less than asked')
  // waiting in the review: only what is fixed; the rounding is a preview; no decision yet
  const w = storyFigures(story(waitingRaw))
  assert.deepEqual(w.map((x) => x.key), ['requested', 'limit', 'before', 'after', 'final'])
  assert.equal(w[3].label, 'After rounding (not final yet)')
  assert.deepEqual([w[4].value, w[4].tone], ['Not decided yet', 'waiting'])
  // a Term Loan raised by HR: no rounding figures
  const t = storyFigures(story(termRaw))
  assert.deepEqual(t.map((x) => x.key), ['requested', 'limit', 'final'])
  assert.equal(t[0].label, 'Requested (raised by HR)')
  assert.equal(t[2].sub, '₹2,000 less than asked')
  // rejected
  const r = storyFigures(story(rejectedRaw))
  assert.deepEqual([r[r.length - 1].value, r[r.length - 1].tone], ['Not approved', 'rejected'])
  // capped at the limit; rounds to ₹0; a basis without a recorded limit
  const capped = storyFigures(story({ ...waitingRaw, requested: 7800, cappedAtLimit: true, beforeRounding: 7600, afterRounding: 7500, roundingIsFinal: true }))
  assert.equal(capped[2].sub, 'Your ask was above the limit, so the limit is used.')
  assert.equal(capped[3].tone, 'less')
  assert.equal(storyFigures(story({ ...waitingRaw, requested: 240, beforeRounding: 240, afterRounding: 0, roundsToZero: true }))[3].tone, 'rejected')
  const noLimit = storyFigures(story({ ...termRaw, eligibleLimit: null, limitBasis: 'No limit was recorded for this request.' }))
  assert.deepEqual([noLimit[1].value, noLimit[1].sub], ['Not recorded', 'No limit was recorded for this request.'])
  assert.deepEqual(storyFigures(story({ ...termRaw, eligibleLimit: null, limitBasis: null })).map((x) => x.key), ['requested', 'final'])
})

test('differenceOf / differenceText: only once approved', () => {
  const base = { isFinal: true, status: 'approved', requested: 7300 }
  assert.equal(differenceText({ ...base, finalApproved: 7500, difference: 200 }), '₹200 more than asked')
  assert.equal(differenceText({ ...base, finalApproved: 7300, difference: 0 }), 'The amount asked for')
  assert.equal(differenceText({ ...base, finalApproved: 5000, difference: null }), '₹2,300 less than asked')
  assert.equal(differenceOf({ ...base, finalApproved: 5000, difference: null }), -2300)
  assert.equal(differenceText({ ...base, isFinal: false, finalApproved: null, difference: null }), null)
  assert.equal(differenceText({ ...base, status: 'rejected', finalApproved: null, difference: null }), null)
})

test('roundingLine: the server sentence as it is, with its look', () => {
  assert.deepEqual(roundingLine(story(reducedRaw)), { text: ROUNDING_NOTE, tone: 'info' })
  assert.deepEqual(roundingLine(story(termRaw)), { text: TERM_NOTE, tone: 'muted' })
  // a waiting Normal-method Salary Advance: the server's own words, shown as they are
  const waitingNormal = story({ ...waitingRaw, method: 'normal', roundingApplies: false, roundingNote: 'HR decides this Salary Advance directly; it is not rounded.' })
  assert.deepEqual(roundingLine(waitingNormal), { text: 'HR decides this Salary Advance directly; it is not rounded.', tone: 'muted' })
  assert.equal(roundingLine(story({ ...waitingRaw, roundsToZero: true }))?.tone, 'warn')
  assert.equal(roundingLine(story({ ...termRaw, roundingNote: null })), null)
})

test('reviewRows: each decision by role, with its remark once', () => {
  const rows = reviewRows(story(reducedRaw))
  assert.deepEqual(
    rows.map((r) => [r.title, r.change, r.meta, r.remark, r.tone]),
    [
      ['HR approved ₹7,500', null, 'HR review', null, 'ok'],
      ['Management reduced it to ₹6,000', '₹7,500 → ₹6,000', 'Management review', 'Pending canteen dues', 'less'],
      ['Auditor reduced it to ₹5,000', '₹6,000 → ₹5,000', 'Auditor check', 'Leave in the 1st-20th', 'less'],
    ],
  )
  // the remarks are all next to their decisions: nothing left for a separate list
  assert.deepEqual(remarksNotInSteps(story(reducedRaw)), [])
  // HR's own decision in the Normal Method: "HR decision", with the name the apps already show
  assert.deepEqual(
    reviewRows(story(termRaw)).map((r) => [r.title, r.meta, r.remark]),
    [['HR (Meena) reduced it to ₹8,000', 'HR decision', 'Budget this month']],
  )
  assert.deepEqual(reviewRows(story(rejectedRaw)).map((r) => [r.title, r.tone]), [['HR rejected it', 'rejected']])
  // waiting: no review steps were sent, so none are shown
  assert.deepEqual(reviewRows(story(waitingRaw)), [])
  assert.equal(waitingText(story(waitingRaw)), 'The decision, and any remarks, are shown here once it is decided.')
  assert.equal(waitingText(story(reducedRaw)), null)
  // a rework round: the rounds are named
  const reworked = story({
    ...reducedRaw,
    steps: [...reducedRaw.steps.slice(0, 4), { stage: 'hr_review', role: 'hr', by: 'HR', action: 'approved', from: 6000, to: 6000, round: 2 }],
  })
  assert.deepEqual(reviewRows(reworked).map((r) => r.meta), ['HR review · Round 1', 'Management review · Round 1', 'HR review · Round 2'])
  // a remark that is not on a decision step is listed on its own
  const extra = story({ ...reducedRaw, remarks: [...reducedRaw.remarks, { stage: 'hr_final', role: 'hr', by: 'HR', text: 'Paid with October salary' }] })
  assert.deepEqual(remarksNotInSteps(extra).map((r) => [r.by, r.text]), [['HR', 'Paid with October salary']])
})

test('stepTitle: every action', () => {
  const step = (over: Partial<AmountStoryStep>): AmountStoryStep => ({
    stage: 'md_review', role: 'md', by: 'Management', name: null, action: 'approved', from: 7500, to: 7500,
    reason: null, remark: null, at: null, round: null, ...over,
  })
  assert.equal(stepTitle(step({ action: 'increased', to: 8000 })), 'Management raised it to ₹8,000')
  assert.equal(stepTitle(step({ action: 'remark' })), 'Management added a remark')
  assert.equal(stepTitle(step({ action: 'approved', to: null })), 'Management approved it')
  assert.equal(stepTitle(step({ action: 'sent_back' })), 'Management: sent back')
  // never a name the server did not send; the role label when `by` is missing
  assert.equal(stepWho({ by: '', name: null, role: 'auditor' }), 'Auditor')
})

test('storyExplainsLimit, storyCardNote, storyMentions', () => {
  assert.equal(storyExplainsLimit(story(reducedRaw)), true)
  assert.equal(storyExplainsLimit(story({ ...reducedRaw, limitBasis: null })), false)
  assert.equal(storyExplainsLimit(null), false)
  assert.equal(storyCardNote({ status: 'approved', amountStory: story(reducedRaw) }), 'Why it is lower: Management: Pending canteen dues. Auditor: Leave in the 1st-20th.')
  assert.equal(storyCardNote({ status: 'rejected', amountStory: story(rejectedRaw) }), 'Reason: HR: Already took one this year')
  assert.equal(storyCardNote({ status: 'pending', amountStory: story(waitingRaw) }), null)
  assert.equal(storyCardNote({ status: 'approved' }), null)
  const s = story(termRaw)
  assert.equal(storyMentions(s, 'Budget this month'), true)
  assert.equal(storyMentions(s, '  budget   THIS month '), true)
  assert.equal(storyMentions(story({ ...termRaw, remarks: [] }), 'Budget this month'), true) // on its decision step
  assert.equal(storyMentions(s, 'Something else'), false)
  assert.equal(storyMentions(null, 'Budget this month'), false)
  assert.equal(storyMentions(s, ''), false)
})

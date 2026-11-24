// Run with `npm test`. Compensation self-claims (2026-11-19): what can be claimed and how (the Claim dialog's choices and
// the body sent), using the balance, the employee's own claims list, and the error sentence shown on a refusal.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parseCompensation, type CompensationItem, type CompensationPayload } from './compensation.ts'
import {
  applyClaimFilter,
  balanceUse,
  balanceUseProblem,
  canClaimItem,
  claimAmount,
  claimBody,
  claimDateLine,
  claimDecisionLine,
  claimDraft,
  claimErrorText,
  claimFilterOptions,
  claimKindLabel,
  claimProblem,
  claimRaisedByText,
  claimStateOf,
  claimStatusInfo,
  claimableItems,
  normalizeMyClaims,
  quarterFloor,
  shiftChoices,
} from './compensation-claims.ts'

/** One item as parseCompensation makes it, from the keys a test cares about. */
function item(raw: Record<string, unknown>): CompensationItem {
  const p = parseCompensation({ isStaff: true, canClaim: true, items: [{ key: 'k', kind: 'holiday_work', date: '2026-11-09', ...raw }] })
  return p!.items[0]
}

function payload(raw: Record<string, unknown>): CompensationPayload {
  return parseCompensation({ isStaff: true, items: [], ...raw })!
}

describe('quarters', () => {
  test('a value rounds DOWN to a quarter, within 0 .. 1', () => {
    assert.equal(quarterFloor(0.6), 0.5)
    assert.equal(quarterFloor(0.75), 0.75)
    assert.equal(quarterFloor(0.74), 0.5)
    assert.equal(quarterFloor(1.3), 1)
    assert.equal(quarterFloor(0.2), 0)
    assert.equal(quarterFloor(-1), 0)
    assert.equal(quarterFloor(null), 0)
    assert.equal(quarterFloor(Number.NaN), 0)
  })

  test('the choices never go above the cap', () => {
    assert.deepEqual(shiftChoices(0.5), [0.25, 0.5])
    assert.deepEqual(shiftChoices(1), [0.25, 0.5, 0.75, 1])
    assert.deepEqual(shiftChoices(3), [0.25, 0.5, 0.75, 1])
    assert.deepEqual(shiftChoices(0.1), [])
    assert.deepEqual(shiftChoices(null), [])
  })
})

describe('an item as a claim', () => {
  test('pending / approved win; then claimable (also after a rejection); then rejected; else nothing', () => {
    assert.equal(claimStateOf(item({ claimable: true, claim: { id: 1, status: 'pending' } })), 'pending')
    assert.equal(claimStateOf(item({ claimable: true, claim: { id: 1, status: 'approved' } })), 'approved')
    assert.equal(claimStateOf(item({ claimable: true, claim: { id: 1, status: 'rejected' } })), 'claimable')
    assert.equal(claimStateOf(item({ claimable: false, claim: { id: 1, status: 'rejected' } })), 'rejected')
    assert.equal(claimStateOf(item({ status: 'claim_pending' })), 'pending')
    assert.equal(claimStateOf(item({ status: 'claim_approved' })), 'approved')
    assert.equal(claimStateOf(item({ status: 'pending_hod' })), null)
    assert.equal(claimStateOf(item({})), null)
  })

  test('the Claim button needs canClaim, a claimable item and a date', () => {
    const it = item({ claimable: true })
    assert.equal(canClaimItem(it, true), true)
    assert.equal(canClaimItem(it, false), false)
    assert.equal(canClaimItem(item({ claimable: true, date: null }), true), false)
    assert.equal(canClaimItem(item({ claimable: true, claim: { id: 2, status: 'pending' } }), true), false)
  })

  test('claimableItems lists only claimable ones, newest day first, and nothing without canClaim', () => {
    const p = parseCompensation({
      isStaff: true,
      canClaim: true,
      items: [
        { key: 'a', kind: 'holiday_work', date: '2026-11-02', claimable: true },
        { key: 'b', kind: 'ot_shift', date: '2026-11-12', claimable: true, suggestedShifts: 0.5 },
        { key: 'c', kind: 'redemption', date: '2026-11-15', claimable: true },
        { key: 'd', kind: 'holiday_work', date: '2026-11-09', claimable: false },
      ],
    })!
    assert.deepEqual(claimableItems(p).map((i) => i.key), ['b', 'a'])
    assert.deepEqual(claimableItems({ ...p, canClaim: false }), [])
    assert.deepEqual(claimableItems(null), [])
  })
})

describe('claimDraft: what the Claim dialog offers', () => {
  test('Sunday / holiday work: any quarter, starting at the suggestion', () => {
    const d = claimDraft(item({ claimable: true, workDate: '2026-11-09', suggestedShifts: 0.5 }))!
    assert.equal(d.kind, 'holiday_work')
    assert.equal(d.date, '2026-11-09')
    assert.deepEqual(d.choices, [0.25, 0.5, 0.75, 1])
    assert.equal(d.defaultShifts, 0.5)
    assert.equal(d.overtimeRecordId, null)
    assert.equal(d.what, 'Sunday / holiday work on Mon, 9 Nov 2026')
    // Without a suggestion: the item's shifts, else a full shift.
    assert.equal(claimDraft(item({ claimable: true, shifts: 0.75 }))!.defaultShifts, 0.75)
    assert.equal(claimDraft(item({ claimable: true }))!.defaultShifts, 1)
  })

  test('extra hours: never above the suggested credit, starting at it, with the OT record', () => {
    const d = claimDraft(item({ key: 'ot-55', kind: 'ot_shift', date: '2026-11-12', claimable: true, suggestedShifts: 0.75, shifts: 0.75, minutes: 400 }))!
    assert.equal(d.kind, 'ot_shift')
    assert.deepEqual(d.choices, [0.25, 0.5, 0.75])
    assert.equal(d.defaultShifts, 0.75)
    assert.equal(d.overtimeRecordId, 55)
    assert.match(d.effect, /up to 0\.75 shift for this day/)
    assert.deepEqual(claimBody(d, 0.5, '  Night dispatch  '), { kind: 'ot_shift', date: '2026-11-12', overtimeRecordId: 55, shifts: 0.5, reason: 'Night dispatch' })
    assert.equal(claimProblem(d, 1, 'Night dispatch'), 'Pick how many shifts to claim.')
    assert.equal(claimProblem(d, 0.75, 'Night dispatch'), null)
  })

  test('extra hours without a suggestion: no picker, the server works the shifts out', () => {
    const d = claimDraft(item({ key: 'ot-56', kind: 'ot_shift', claimable: true }))!
    assert.deepEqual(d.choices, [])
    assert.equal(d.defaultShifts, null)
    assert.deepEqual(claimBody(d, null, 'Late'), { kind: 'ot_shift', date: '2026-11-09', overtimeRecordId: 56, reason: 'Late' })
  })

  test('a late-in allowance: no shifts, its minutes, the OT record', () => {
    const d = claimDraft(item({ key: 'ot-57', kind: 'ot_allowance', claimable: true, minutes: 30 }))!
    assert.equal(d.kind, 'ot_allowance')
    assert.deepEqual(d.choices, [])
    assert.equal(d.minutes, 30)
    assert.match(d.effect, /arrive up to 30 min later on your next working day after Mon, 9 Nov 2026/)
    assert.deepEqual(claimBody(d, 0.5, 'Stock count'), { kind: 'ot_allowance', date: '2026-11-09', overtimeRecordId: 57, reason: 'Stock count' })
  })

  test('a worked birthday: one full shift, nothing to pick, no shifts sent', () => {
    const d = claimDraft(item({ key: 'bd-2026-11-05', kind: 'birthday_credit', date: '2026-11-05', claimable: true }))!
    assert.equal(d.kind, 'birthday')
    assert.equal(d.fixedShifts, 1)
    assert.deepEqual(d.choices, [])
    assert.deepEqual(claimBody(d, null, 'Worked my birthday'), { kind: 'birthday', date: '2026-11-05', reason: 'Worked my birthday' })
  })

  test('a rejected claim can be claimed again, and says so', () => {
    assert.equal(claimDraft(item({ claimable: true, claim: { id: 4, status: 'rejected' } }))!.rejectedBefore, true)
  })

  test('nothing to offer for an item that cannot be claimed', () => {
    assert.equal(claimDraft(item({ claimable: false })), null)
    assert.equal(claimDraft(item({ claimable: true, claim: { id: 1, status: 'pending' } })), null)
  })

  test('the reason is required and capped', () => {
    const d = claimDraft(item({ claimable: true }))!
    assert.match(claimProblem(d, 1, '   ') ?? '', /Give a reason/)
    assert.match(claimProblem(d, 1, 'x'.repeat(501)) ?? '', /at most 500/)
    assert.equal(claimProblem(d, 1, 'x'.repeat(500)), null)
  })
})

describe('using the balance', () => {
  const now = new Date(2026, 10, 19, 10, 0) // 19 Nov 2026

  test('available = balance - waiting, in quarters up to a full shift', () => {
    const u = balanceUse(payload({ canClaim: true, useBalance: { allowed: true, balanceShifts: 1.25, pendingShifts: 0.5, availableShifts: 0.75 } }))
    assert.equal(u.allowed, true)
    assert.equal(u.available, 0.75)
    assert.deepEqual(u.choices, [0.25, 0.5, 0.75])
    assert.equal(u.blocked, null)
    assert.deepEqual(balanceUse(payload({ canClaim: true, useBalance: { allowed: true, balanceShifts: 4 } })).choices, [0.25, 0.5, 0.75, 1])
  })

  test('blocked: an older backend, the server says no, nothing free', () => {
    assert.match(balanceUse(payload({ balanceShifts: 2 })).blocked ?? '', /not available yet/)
    assert.equal(balanceUse(payload({ canClaim: true, useBalance: { allowed: false, balanceShifts: 1, message: 'Using the balance is switched off.' } })).blocked, 'Using the balance is switched off.')
    assert.match(balanceUse(payload({ canClaim: true, useBalance: { allowed: true, balanceShifts: 0.5, pendingShifts: 0.5 } })).blocked ?? '', /0\.50 shift is already waiting/)
    assert.match(balanceUse(payload({ canClaim: true, useBalance: { allowed: true, balanceShifts: 0 } })).blocked ?? '', /no compensation balance/)
    assert.equal(balanceUse(null).allowed, false)
  })

  test('the form: a day in the request window, an allowed amount, a reason', () => {
    const u = balanceUse(payload({ canClaim: true, useBalance: { allowed: true, balanceShifts: 0.5 } }))
    assert.equal(balanceUseProblem({ date: '', shifts: 0.5, reason: 'x' }, u, now), 'Pick the day you want off.')
    assert.match(balanceUseProblem({ date: '2026-12-01', shifts: 0.5, reason: 'x' }, u, now) ?? '', /November 2026/)
    assert.equal(balanceUseProblem({ date: '2026-11-24', shifts: 1, reason: 'x' }, u, now), 'Pick how much of your balance to use.')
    assert.match(balanceUseProblem({ date: '2026-11-24', shifts: 0.5, reason: ' ' }, u, now) ?? '', /Give a reason/)
    assert.equal(balanceUseProblem({ date: '2026-11-24', shifts: 0.5, reason: 'Family function' }, u, now), null)
  })
})

describe('my claims (GET /employee/compensation/claims)', () => {
  const raw = [
    { id: 77, kind: 'ot_shift', kindLabel: 'Extra hours credit', status: 'pending', workDate: '2026-11-10', shifts: '0.50', reason: 'Dispatch', raisedByRole: 'employee', requestedBy: 'Asha', createdAt: '2026-11-11T09:00:00+05:30' },
    { id: 78, kind: 'use_balance', status: 'approved', workDate: '2026-11-12', useDate: '2026-11-24', shifts: 1, raisedByRole: 'employee', reviewedBy: 'Suresh Raj', canWithdraw: true },
    { id: 79, kind: 'holiday_work', status: 'rejected', workDate: '2026-11-09', shifts: 1, raisedByRole: 'hr', requestedBy: 'Meena', reviewedBy: 'Suresh Raj', reviewComment: 'Not a working Sunday.' },
    { id: 80, kind: 'ot_allowance', status: 'withdrawn', workDate: '2026-11-03', minutes: 30, raisedByRole: 'employee' },
    { id: 81, kind: 'birthday', status: 'pending', workDate: '2026-11-05', shifts: 1, raisedByRole: 'hr', requestedBy: 'Meena' },
  ]

  test('any of the three shapes is read; junk is null', () => {
    assert.equal(normalizeMyClaims(raw)!.length, 5)
    assert.equal(normalizeMyClaims({ items: raw })!.length, 5)
    assert.equal(normalizeMyClaims({ claims: raw })!.length, 5)
    for (const junk of [null, 'x', 42, {}, { items: 'no' }]) assert.equal(normalizeMyClaims(junk), null, JSON.stringify(junk))
    // Entries without an id are dropped; a repeated id is listed once.
    assert.equal(normalizeMyClaims([{ kind: 'birthday' }, { id: 1 }, { id: 1 }, 'x'])!.length, 1)
  })

  test('a claim reads in full, keyed like the notification link ("hw-<id>")', () => {
    const [c] = normalizeMyClaims(raw)!
    assert.equal(c.key, 'hw-77')
    assert.equal(c.kindLabel, 'Extra hours credit')
    assert.equal(c.shifts, 0.5)
    assert.equal(c.date, '2026-11-10')
    assert.equal(c.canWithdraw, true)
    assert.equal(claimAmount(c), '0.50 shift')
    assert.equal(claimDateLine(c), 'Overtime on Tue, 10 Nov 2026')
    assert.equal(claimRaisedByText(c), 'Raised by you')
    assert.equal(claimDecisionLine(c), null)
    assert.deepEqual(claimStatusInfo(c), { label: 'Waiting for your Department Head', chip: 'chip-warning', live: true })
  })

  test('the day off is the useDate; withdraw only while waiting, whatever the server flag says', () => {
    const c = normalizeMyClaims(raw)![1]
    assert.equal(c.date, '2026-11-24')
    assert.equal(claimDateLine(c), 'Day off on Tue, 24 Nov 2026')
    assert.equal(c.canWithdraw, false)
    assert.equal(claimDecisionLine(c), 'Approved by Suresh Raj.')
  })

  test('HR-raised claims cannot be withdrawn by the employee unless the server says so', () => {
    const claims = normalizeMyClaims(raw)!
    assert.equal(claims[4].canWithdraw, false)
    assert.equal(claimRaisedByText(claims[4]), 'Raised by HR (Meena)')
    assert.equal(normalizeMyClaims([{ ...raw[4], canWithdraw: true }])![0].canWithdraw, true)
  })

  test('rejected, withdrawn and unknown statuses', () => {
    const claims = normalizeMyClaims(raw)!
    assert.equal(claimDecisionLine(claims[2]), 'Not approved by Suresh Raj: Not a working Sunday.')
    assert.equal(claimStatusInfo(claims[2]).chip, 'chip-danger')
    assert.equal(claimStatusInfo(claims[3]).label, 'Withdrawn')
    assert.equal(claimAmount(claims[3]), '30 min allowance')
    assert.deepEqual(claimStatusInfo({ status: 'on_hold', statusLabel: '' }), { label: 'On hold', chip: 'chip-muted', live: false })
    assert.equal(claimStatusInfo({ status: 'pending', statusLabel: 'With your head' }).label, 'With your head')
  })

  test('filters: a chip per status that has claims', () => {
    const claims = normalizeMyClaims(raw)!
    assert.deepEqual(
      claimFilterOptions(claims).map((o) => [o.id, o.count]),
      [['all', 5], ['pending', 2], ['approved', 1], ['rejected', 1], ['other', 1]],
    )
    assert.deepEqual(applyClaimFilter(claims, 'pending').map((c) => c.id), [77, 81])
    assert.deepEqual(applyClaimFilter(claims, 'other').map((c) => c.id), [80])
    assert.equal(applyClaimFilter(claims, 'all').length, 5)
  })

  test('kind labels: ours, the server’s, or the kind’s own name', () => {
    assert.equal(claimKindLabel('birthday'), 'Birthday credit')
    assert.equal(claimKindLabel('birthday', 'Birthday shift'), 'Birthday shift')
    assert.equal(claimKindLabel('comp_off'), 'Comp off')
    assert.equal(claimKindLabel(''), 'Compensation claim')
    assert.equal(claimKindLabel('toString'), 'ToString')
  })
})

describe('claimErrorText', () => {
  test("a refusal is shown in the server's words", () => {
    assert.equal(claimErrorText({ status: 409, message: 'You already claimed this day.' }), 'You already claimed this day.')
    assert.equal(claimErrorText({ status: 400, message: 'Claims can be made up to 45 days after the day.' }), 'Claims can be made up to 45 days after the day.')
  })

  test('anything else gets a plain sentence, never a status code', () => {
    const fallback = 'Could not send it. Check your connection and try again.'
    assert.equal(claimErrorText({ status: 500, message: 'Internal Server Error' }), fallback)
    assert.equal(claimErrorText({ status: 404, message: 'Request failed with status code 404' }), fallback)
    assert.equal(claimErrorText({ message: 'Network Error' }), fallback)
    assert.equal(claimErrorText(null, 'Try later.'), 'Try later.')
  })
})

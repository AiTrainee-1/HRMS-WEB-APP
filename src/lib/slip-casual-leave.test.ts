// Run with `npm test`. A salary slip's Casual Leave (lib/slip-casual-leave.ts): reading `casualLeave` (the breakdown's
// full block and the slip list's short form) and wording it. Vectors after the backend's (api/tests_employee_app_
// transparency.py): 22.5 paid days x ₹1,000 = ₹22,500 earned, 3 Casual Leave days of which 2 paid on the slip.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clShortBySlip,
  readSlipCasualLeave,
  readSlipCasualLeaveShort,
  slipClChip,
  slipClSplitKnown,
  slipClView,
  slipDays,
  type SlipCasualLeave,
} from './slip-casual-leave.ts'
import { normalizePeriod } from './salary-insights.ts'

const NOTE =
  '2 days of Casual Leave paid in October 2026 at ₹1,000 a day = ₹2,000. It is part of your salary earned for 22.5 paid days, not an extra amount. 1 day of Casual Leave is not paid on this slip (approved after the slip was made, or not a working day).'

const fullRaw = {
  applicable: true,
  used: true,
  daysUsed: 3,
  paidDays: 2,
  unpaidDays: 1,
  amountPaid: 2000,
  dailyRate: 1000,
  workedDays: 19.5,
  workedPay: 19500,
  holidayDays: 1,
  holidayPay: 1000,
  earnedPay: 22500,
  paidDaysTotal: 22.5,
  companyDays: 26,
  lopDays: 3.5,
  lopDeduction: 3500,
  monthlySalary: 26000,
  fromStoredSlip: true,
  dates: [
    { date: '2026-10-06', portion: 'full', days: 1, paidDays: 1 },
    { date: '2026-10-13', portion: 'half', days: 0.5, paidDays: 0.5 },
    { date: '2026-10-20', portion: 'half', days: 0.5, paidDays: 0.5 },
    { date: '2026-10-31', portion: 'full', days: 1, paidDays: 0 },
  ],
  note: NOTE,
}

const OLD_NOTE = '1 day of Casual Leave in October 2026. This slip does not record its days, so the Casual Leave pay cannot be shown separately: it is inside the salary earned.'
const blank = {
  paidDays: null, unpaidDays: null, amountPaid: null, dailyRate: null, workedDays: null, workedPay: null, holidayDays: null,
  holidayPay: null, earnedPay: null, paidDaysTotal: null, companyDays: null, lopDays: null, lopDeduction: null, monthlySalary: null,
}
const oldRaw = { applicable: true, used: true, daysUsed: 1, ...blank, fromStoredSlip: false, dates: [{ date: '2026-10-06', portion: 'full', days: 1, paidDays: null }], note: OLD_NOTE }

const cl = (raw: unknown): SlipCasualLeave => readSlipCasualLeave(raw)!

test('readSlipCasualLeave / readSlipCasualLeaveShort read defensively', () => {
  const c = cl(fullRaw)
  assert.equal(c.applicable, true)
  assert.equal(c.amountPaid, 2000)
  assert.equal(c.dates.length, 4)
  assert.deepEqual(c.dates[1], { date: '2026-10-13', portion: 'half', days: 0.5, paidDays: 0.5 })
  // strings read; a date that is not one is dropped; a missing `used` follows the days
  const odd = cl({ ...fullRaw, amountPaid: '2000.00', used: undefined, dates: [{ date: 'soon' }, { date: '2026-10-06T00:00:00', portion: 'x' }] })
  assert.equal(odd.amountPaid, 2000)
  assert.equal(odd.used, true)
  assert.deepEqual(odd.dates, [{ date: '2026-10-06', portion: 'full', days: 1, paidDays: null }])
  assert.equal(readSlipCasualLeave(null), null)
  assert.equal(readSlipCasualLeave({ daysUsed: 1 }), null)
  assert.deepEqual(readSlipCasualLeaveShort({ applicable: true, used: true, daysUsed: 1.5, paidDays: 1.5, amountPaid: 1500, fromStoredSlip: true }), {
    applicable: true, used: true, daysUsed: 1.5, paidDays: 1.5, amountPaid: 1500, fromStoredSlip: true,
  })
  assert.equal(readSlipCasualLeaveShort(undefined), null)
})

test('normalizePeriod carries the breakdown block (null without one)', () => {
  const base = { slipId: 7, kind: 'staff', month: 10, year: 2026, period: { label: 'October 2026' }, steps: [] }
  assert.equal(normalizePeriod({ ...base, casualLeave: fullRaw })?.casualLeave?.amountPaid, 2000)
  assert.equal(normalizePeriod(base)?.casualLeave, null)
})

test('slipClView: Casual Leave paid on a stored slip, and the salary earned split', () => {
  const v = slipClView(cl(fullRaw), 'October 2026')!
  assert.equal(v.used, true)
  assert.equal(v.headline, '3 days of Casual Leave in October 2026')
  assert.deepEqual(
    v.figures.map((f) => [f.key, f.label, f.value]),
    [
      ['used', 'Days used', '3'],
      ['paid', 'Paid CL days', '2'],
      ['unpaid', 'Not paid on this slip', '1'],
      ['amount', 'Paid for CL', '₹2,000'],
    ],
  )
  assert.deepEqual(
    v.split.map((r) => [r.key, r.label, r.sub, r.value, r.kind]),
    [
      ['worked', 'Earned for days worked', '19.5 days', '₹19,500', 'part'],
      ['casualLeave', 'Paid Casual Leave', '2 days × ₹1,000', '₹2,000', 'part'],
      ['holiday', 'Holiday pay', '1 day', '₹1,000', 'part'],
      ['earned', 'Salary earned', '22.5 days paid of 26', '= ₹22,500', 'total'],
      ['lop', 'Unpaid leave (LOP)', '3.5 days', '- ₹3,500', 'loss'],
      ['monthly', 'Monthly salary', 'Before the loss of pay', '₹26,000', 'reference'],
    ],
  )
  assert.deepEqual(
    v.dates.map((d) => [d.day, d.portion, d.paid, d.paidTone]),
    [
      ['Tue, 6 Oct 2026', 'Full day', 'Paid', 'approved'],
      ['Tue, 13 Oct 2026', 'Half day', 'Paid', 'approved'],
      ['Tue, 20 Oct 2026', 'Half day', 'Paid', 'approved'],
      ['Sat, 31 Oct 2026', 'Full day', 'Not paid on this slip', 'waiting'],
    ],
  )
  assert.equal(v.note, NOTE)
  // a part-paid date; no holiday pay = no holiday row; nothing lost
  const part = slipClView(cl({ ...fullRaw, holidayPay: 0, holidayDays: 0, lopDeduction: 0, lopDays: 0, dates: [{ date: '2026-10-06', portion: 'full', days: 1, paidDays: 0.5 }] }))!
  assert.equal(part.dates[0].paid, '0.5 paid')
  assert.deepEqual(part.split.map((r) => r.key), ['worked', 'casualLeave', 'earned', 'lop', 'monthly'])
  assert.equal(part.split.find((r) => r.key === 'lop')?.value, '₹0')
  assert.equal(part.headline, '3 days of Casual Leave on this slip')
})

test('slipClView: an older slip gives the days and the server note, no money', () => {
  const v = slipClView(cl(oldRaw), 'October 2026')!
  assert.equal(v.headline, '1 day of Casual Leave in October 2026')
  assert.deepEqual(v.figures.map((f) => f.key), ['used'])
  assert.deepEqual(v.split, [])
  assert.equal(v.dates[0].paid, null)
  assert.equal(v.note, OLD_NOTE)
  // no Casual Leave on an older slip: the server's "No Casual Leave in ..." is the headline already
  const none = slipClView(cl({ ...oldRaw, used: false, daysUsed: 0, dates: [], note: 'No Casual Leave in October 2026.' }), 'October 2026')!
  assert.deepEqual([none.headline, none.figures, none.note], ['No Casual Leave in October 2026', [], null])
  // a stored slip whose figures do not add up: no money, and the note even without Casual Leave
  const MISMATCH = 'The stored figures of this slip do not add up to its earned salary, so the Casual Leave pay is not shown separately: it is inside the salary earned.'
  const mismatch = slipClView(cl({ ...fullRaw, used: false, daysUsed: 0, dates: [], amountPaid: null, workedPay: null, holidayPay: null, lopDeduction: null, note: MISMATCH }))!
  assert.deepEqual(mismatch.split, [])
  assert.equal(mismatch.note, MISMATCH)
  assert.equal(slipClSplitKnown(cl({ ...fullRaw, fromStoredSlip: false })), false)
})

test('slipClView: no Casual Leave on a stored slip still splits the salary earned; nothing for production pay', () => {
  const v = slipClView(cl({ ...fullRaw, used: false, daysUsed: 0, paidDays: 0, unpaidDays: 0, amountPaid: 0, workedPay: 21500, dates: [], note: 'No Casual Leave in October 2026.' }), 'October 2026')!
  assert.equal(v.used, false)
  assert.deepEqual(v.figures, [])
  assert.equal(v.split.length, 6)
  assert.equal(v.note, null)
  assert.equal(slipClView(cl({ applicable: false, used: false, daysUsed: 0, ...blank, fromStoredSlip: false, dates: [], note: 'per shift' })), null)
  assert.equal(slipClView(null), null)
  assert.equal(slipClView(undefined), null)
})

test('slipClChip and clShortBySlip (the slip list)', () => {
  assert.equal(slipClChip({ applicable: true, used: true, daysUsed: 2, paidDays: 2, amountPaid: 2000, fromStoredSlip: true }), 'Casual Leave: 2 days paid · ₹2,000')
  assert.equal(slipClChip({ applicable: true, used: true, daysUsed: 2, paidDays: 1.5, amountPaid: 1500, fromStoredSlip: true }), 'Casual Leave: 1.5 of 2 days paid · ₹1,500')
  assert.equal(slipClChip({ applicable: true, used: true, daysUsed: 1, paidDays: null, amountPaid: null, fromStoredSlip: false }), 'Casual Leave: 1 day used')
  assert.equal(slipClChip({ applicable: true, used: false, daysUsed: 0, paidDays: 0, amountPaid: 0, fromStoredSlip: true }), null)
  assert.equal(slipClChip({ applicable: false, used: false, daysUsed: 0, paidDays: null, amountPaid: null, fromStoredSlip: false }), null)
  assert.equal(slipClChip(null), null)
  const map = clShortBySlip([
    { id: 11, casualLeave: { applicable: true, used: true, daysUsed: 1, paidDays: 1, amountPaid: 1000, fromStoredSlip: true } },
    { id: '12' },
    { id: 13, casualLeave: null },
  ])
  assert.deepEqual([...map.keys()], ['11'])
  assert.equal(map.get('11')?.amountPaid, 1000)
  assert.equal(clShortBySlip(undefined).size, 0)
})

test('slipDays', () => {
  assert.equal(slipDays(1), '1 day')
  assert.equal(slipDays(0.5), '0.5 day')
  assert.equal(slipDays(2), '2 days')
  assert.equal(slipDays(22.5), '22.5 days')
  assert.equal(slipDays(0), '0 days')
})

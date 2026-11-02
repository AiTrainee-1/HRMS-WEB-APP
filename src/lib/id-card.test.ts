// Run with `npm test`. Digital ID card rules (lib/id-card.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { cardDate, cardFileName, employeeStatusInfo } from './id-card.ts'

describe('employeeStatusInfo', () => {
  test('kinds', () => {
    assert.deepEqual(employeeStatusInfo('active'), { kind: 'active', isActive: true, label: 'Active', unknown: false })
    assert.equal(employeeStatusInfo('ACTIVE').kind, 'active')
    assert.equal(employeeStatusInfo('probation').label, 'On probation')
    assert.equal(employeeStatusInfo('on_leave').kind, 'working')
    assert.equal(employeeStatusInfo('Resigned').isActive, false)
    assert.equal(employeeStatusInfo('inactive').label, 'Inactive')
    assert.equal(employeeStatusInfo('contract').kind, 'other')
    assert.equal(employeeStatusInfo('').unknown, true)
    assert.equal(employeeStatusInfo(null).isActive, true)
  })
})

describe('card text', () => {
  test('cardDate', () => {
    assert.equal(cardDate('2026-10-31'), '31 Oct 2026')
    assert.equal(cardDate('31/10/2026'), '31/10/2026')
    assert.equal(cardDate(undefined), '')
  })
  test('cardFileName', () => {
    assert.equal(cardFileName('UKT 12/34', 'front'), 'UKT1234-id-card-front.png')
    assert.equal(cardFileName('', 'back'), 'uktextiles-id-card-back.png')
  })
})

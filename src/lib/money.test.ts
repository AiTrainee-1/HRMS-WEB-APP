// Run with `npm test`. Rupee formatting in the Indian way (lib/money.ts), used by the kit's <MoneyText>.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { formatCount, formatINR, formatINRCompact, formatIndianNumber, groupIndian, spokenINR, toAmount } from './money.ts'

describe('groupIndian', () => {
  test('lakh and crore grouping', () => {
    assert.equal(groupIndian('1'), '1')
    assert.equal(groupIndian('999'), '999')
    assert.equal(groupIndian('1000'), '1,000')
    assert.equal(groupIndian('100000'), '1,00,000')
    assert.equal(groupIndian('1234567'), '12,34,567')
    assert.equal(groupIndian('123456789'), '12,34,56,789')
  })
})

describe('toAmount', () => {
  test('numbers and numeric strings, nothing else', () => {
    assert.equal(toAmount(12), 12)
    assert.equal(toAmount('1234.50'), 1234.5)
    assert.equal(toAmount('₹ 1,234'), 1234)
    assert.equal(toAmount('-500'), -500)
    assert.equal(toAmount(''), null)
    assert.equal(toAmount('abc'), null)
    assert.equal(toAmount(null), null)
    assert.equal(toAmount(undefined), null)
    assert.equal(toAmount(Number.NaN), null)
    assert.equal(toAmount(Number.POSITIVE_INFINITY), null)
  })
})

describe('formatINR', () => {
  test('whole amounts have no paise by default, fractions get two digits', () => {
    assert.equal(formatINR(1234567), '₹12,34,567')
    assert.equal(formatINR(1234.5), '₹1,234.50')
    assert.equal(formatINR('25000.00'), '₹25,000')
    assert.equal(formatINR(0), '₹0')
    assert.equal(formatINR(0.1 + 0.2), '₹0.30')
  })
  test('forced decimals', () => {
    assert.equal(formatINR(1500, { decimals: 2 }), '₹1,500.00')
    assert.equal(formatINR(1499.6, { decimals: 0 }), '₹1,500')
  })
  test('signs', () => {
    assert.equal(formatINR(-500), '-₹500')
    assert.equal(formatINR(250, { sign: true }), '+₹250')
    assert.equal(formatINR(0, { sign: true }), '₹0')
    assert.equal(formatINR(-0.001), '₹0')
  })
  test('without the symbol, and the empty text', () => {
    assert.equal(formatINR(1234, { symbol: false }), '1,234')
    assert.equal(formatINR(null), '—')
    assert.equal(formatINR('n/a', { empty: '-' }), '-')
  })
  test('paise round correctly', () => {
    assert.equal(formatIndianNumber(1234.567), '1,234.57')
    assert.equal(formatIndianNumber(99999.999), '1,00,000')
  })
})

describe('formatINRCompact', () => {
  test('K, L and Cr', () => {
    assert.equal(formatINRCompact(950), '₹950')
    assert.equal(formatINRCompact(9999), '₹9,999')
    assert.equal(formatINRCompact(12500), '₹12.5K')
    assert.equal(formatINRCompact(340000), '₹3.4 L')
    assert.equal(formatINRCompact(100000), '₹1 L')
    assert.equal(formatINRCompact(12000000), '₹1.2 Cr')
    assert.equal(formatINRCompact(-250000), '-₹2.5 L')
    assert.equal(formatINRCompact(undefined), '—')
  })
})

test('formatCount rounds and groups', () => {
  assert.equal(formatCount(1234567.4), '12,34,567')
  assert.equal(formatCount(-3.6), '-4')
  assert.equal(formatCount(Number.NaN), '0')
})

test('spokenINR says a negative out loud', () => {
  assert.equal(spokenINR(-500), 'minus ₹500')
  assert.equal(spokenINR(1234.5), '₹1,234.50')
  assert.equal(spokenINR(null), 'no amount')
})

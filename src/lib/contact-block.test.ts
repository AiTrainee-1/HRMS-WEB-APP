// Run with `npm test`. The contact block (lib/contact-block.ts) the compensation and HOD endpoints embed (same shape as /support-contact's
// `hr`), and the ways to reach it that SupportContactCard and ContactBlockCard both draw.
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { contactMethodLabel, contactMethods, normalizeContactBlock, primaryContactMethod } from './contact-block.ts'

const FULL = {
  label: 'HR Desk', phone: '0421 430 0800', phoneDial: '04214300800', whatsapp: '98765 43210', whatsappNumber: '919876543210',
  email: 'hr@example.com', hours: 'Mon-Sat 9 to 6', hasContact: true, usesHrFallback: false,
}

describe('normalizeContactBlock', () => {
  test('a full block is read as it is', () => {
    assert.deepEqual(normalizeContactBlock(FULL), FULL)
  })

  test('hasContact is worked out from the fields, not trusted', () => {
    assert.equal(normalizeContactBlock({ ...FULL, hasContact: false })!.hasContact, true)
    assert.equal(normalizeContactBlock({ label: 'HR Desk', phone: '', whatsapp: '', email: '' })!.hasContact, false)
  })

  test('the dial number is rebuilt from the typed phone when the server sent none', () => {
    assert.equal(normalizeContactBlock({ phone: '+91 98765-43210' })!.phoneDial, '+919876543210')
  })

  test('not an object is null; missing fields are empty strings', () => {
    for (const junk of [null, undefined, 'call us', 5, [], true]) assert.equal(normalizeContactBlock(junk), null)
    assert.deepEqual(normalizeContactBlock({}), {
      label: '', phone: '', phoneDial: '', whatsapp: '', whatsappNumber: '', email: '', hours: '', hasContact: false, usesHrFallback: false,
    })
  })
})

describe('contactMethods', () => {
  test('call, WhatsApp, email, in that order, each with its link', () => {
    const methods = contactMethods(normalizeContactBlock(FULL)!)
    assert.deepEqual(methods.map((m) => m.key), ['call', 'whatsapp', 'email'])
    assert.deepEqual(methods.map((m) => m.href), ['tel:04214300800', 'https://wa.me/919876543210', 'mailto:hr@example.com'])
    assert.deepEqual(methods.map((m) => m.external), [false, true, false])
    assert.deepEqual(methods.map((m) => m.testId), ['support-call', 'support-whatsapp', 'support-email'])
    assert.equal(methods[0].value, '0421 430 0800')
  })

  test('only the fields that are set, and an unlinkable field has no href', () => {
    assert.deepEqual(contactMethods(normalizeContactBlock({ email: 'a@b.c' })!).map((m) => m.key), ['email'])
    assert.deepEqual(contactMethods(normalizeContactBlock({})!), [])
    const phoneOnlyText = contactMethods(normalizeContactBlock({ phone: 'ask reception' })!)
    assert.equal(phoneOnlyText.length, 1)
    assert.equal(phoneOnlyText[0].href, '')
  })
})

describe('primaryContactMethod (the one-line "Need help?" link)', () => {
  test('the first linkable way, in the order call, WhatsApp, email', () => {
    assert.equal(primaryContactMethod(normalizeContactBlock(FULL))!.key, 'call')
    assert.equal(primaryContactMethod(normalizeContactBlock({ whatsapp: '98765 43210', whatsappNumber: '919876543210', email: 'a@b.c' }))!.key, 'whatsapp')
  })

  test('an unlinkable phone gives way to a linkable one further down', () => {
    assert.equal(primaryContactMethod(normalizeContactBlock({ phone: 'ask reception', email: 'a@b.c' }))!.key, 'email')
  })

  test('only unlinkable text: that, shown as plain text; nothing set or no block: null', () => {
    const plain = primaryContactMethod(normalizeContactBlock({ phone: 'ask reception' }))!
    assert.equal(plain.key, 'call')
    assert.equal(plain.href, '')
    assert.equal(primaryContactMethod(normalizeContactBlock({})), null)
    assert.equal(primaryContactMethod(null), null)
    assert.equal(primaryContactMethod(undefined), null)
  })

  test('contactMethodLabel says who and how', () => {
    assert.equal(contactMethodLabel({ key: 'call', value: '0421 430 0800' }, 'HR Department'), 'Call HR Department on 0421 430 0800')
    assert.equal(contactMethodLabel({ key: 'whatsapp', value: '98765 43210' }, 'HR Desk'), 'Message HR Desk on WhatsApp at 98765 43210')
    assert.equal(contactMethodLabel({ key: 'email', value: 'hr@example.com' }, 'HR Desk'), 'Email HR Desk at hr@example.com')
  })
})

// Run with `npm test`. The dashboard's welcome tour (lib/app-tour.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { TOUR_STEPS, cardPosition, isUsableRect, shouldAutoStart, spotlightRect, tourSeenKey } from './app-tour.ts'

const desktop = { width: 1440, height: 900 }
const phone = { width: 390, height: 780 }
const card = { width: 340, height: 300 }

describe('the steps', () => {
  test('short, a welcome first and a goodbye last, unique keys, words everywhere', () => {
    assert.ok(TOUR_STEPS.length >= 4 && TOUR_STEPS.length <= 8)
    assert.equal(TOUR_STEPS[0].targets, undefined)
    assert.equal(TOUR_STEPS[TOUR_STEPS.length - 1].targets, undefined)
    assert.equal(new Set(TOUR_STEPS.map((s) => s.key)).size, TOUR_STEPS.length)
    for (const s of TOUR_STEPS) assert.ok(s.title && s.body && s.bubble, s.key)
  })
})

describe('once per person', () => {
  test('a key per person and version', () => {
    assert.equal(tourSeenKey(42), 'uktex.tour.v1.42')
    assert.equal(tourSeenKey('42', 2), 'uktex.tour.v2.42')
    assert.equal(tourSeenKey(null), 'uktex.tour.v1.anon')
  })
  test('starts by itself only when not seen, on the dashboard', () => {
    assert.equal(shouldAutoStart(null, '/employee/dashboard'), true)
    assert.equal(shouldAutoStart('1', '/employee/dashboard'), false)
    assert.equal(shouldAutoStart(null, '/employee/chat'), false)
  })
})

describe('placing the spotlight and the card', () => {
  test('only boxes on screen and big enough', () => {
    assert.equal(isUsableRect({ top: 10, left: 10, width: 40, height: 40 }, desktop), true)
    assert.equal(isUsableRect({ top: 10, left: 10, width: 0, height: 40 }, desktop), false)
    assert.equal(isUsableRect({ top: 2000, left: 10, width: 40, height: 40 }, desktop), false)
    assert.equal(isUsableRect(null, desktop), false)
  })
  test('the spotlight is padded and stays on screen', () => {
    assert.deepEqual(spotlightRect({ top: 100, left: 100, width: 50, height: 20 }, desktop), { top: 94, left: 94, width: 62, height: 32 })
    const edge = spotlightRect({ top: 0, left: 0, width: 50, height: 20 }, desktop)
    assert.equal(edge.left, 4)
    assert.equal(edge.top, 4)
  })
  test('desktop: beside the sidebar; at the right edge: to the left', () => {
    const nav = { top: 80, left: 0, width: 272, height: 700 }
    const p = cardPosition(nav, card, desktop)
    assert.equal(p.left, 272 + 16)
    const avatar = { top: 12, left: 1380, width: 44, height: 44 }
    const q = cardPosition(avatar, card, desktop)
    assert.ok(q.left + card.width <= 1380)
    assert.ok(q.top >= 12)
  })
  test('phone: under a top-bar button, above the tab bar, centred with nothing to point at', () => {
    const bell = { top: 6, left: 300, width: 40, height: 40 }
    const p = cardPosition(bell, card, phone)
    assert.equal(p.top, 6 + 40 + 16)
    assert.ok(p.left >= 12 && p.left + card.width <= phone.width - 12)
    const tabs = { top: 712, left: 0, width: 390, height: 68 }
    const q = cardPosition(tabs, card, phone)
    assert.equal(q.top, 712 - 16 - card.height)
    const c = cardPosition(null, card, phone)
    assert.equal(c.left, 25)
  })
})

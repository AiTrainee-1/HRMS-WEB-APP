// Run with `npm test`. "Show me that one": reading focus / date / highlight from a link, finding the item, picking the
// view that holds it, and the ring (with stand-in elements, no browser).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  FOCUS_ATTR,
  cleanDate,
  findFocusElement,
  findFocusRow,
  flashFocus,
  focusKey,
  nextToTry,
  readFocusParams,
  ringTargetOf,
  sameId,
  viewForRow,
  type RingEl,
  type RingRoot,
} from './focus-item.ts'
import type { ViewOptions } from './request-views.ts'

describe('readFocusParams', () => {
  test('reads focus, date and highlight, with or without the "?"', () => {
    assert.deepEqual(readFocusParams('?focus=42&date=2026-10-12&highlight=7'), { focus: '42', date: '2026-10-12', highlight: '7' })
    assert.deepEqual(readFocusParams('mode=records&focus=9'), { focus: '9', date: null, highlight: null })
    assert.deepEqual(readFocusParams(''), { focus: null, date: null, highlight: null })
    assert.deepEqual(readFocusParams(null), { focus: null, date: null, highlight: null })
  })

  test('odd values are ignored', () => {
    assert.equal(readFocusParams('focus=<script>').focus, null)
    assert.equal(readFocusParams(`focus=${'1'.repeat(65)}`).focus, null)
    assert.equal(readFocusParams('focus=%20%20').focus, null)
    assert.equal(readFocusParams('focus= 12 ').focus, '12')
    assert.equal(readFocusParams('date=2026-13-01').date, null)
    assert.equal(readFocusParams('highlight=a"b').highlight, null)
  })

  test('cleanDate', () => {
    assert.equal(cleanDate('2026-02-28'), '2026-02-28')
    assert.equal(cleanDate('2028-02-29'), '2028-02-29')
    assert.equal(cleanDate('2026-02-29'), null)
    assert.equal(cleanDate('2026-10-12T23:59:00Z'), '2026-10-12')
    assert.equal(cleanDate('2026-10-1'), null)
    assert.equal(cleanDate(undefined), null)
  })
})

describe('finding the item', () => {
  type Row = { id: number | string; status: string; date: string }
  const rows: Row[] = [
    { id: 1, status: 'pending', date: '2026-10-30' },
    { id: '2', status: 'approved', date: '2026-10-05' },
    { id: 3, status: 'approved', date: '2026-09-12' },
    { id: 4, status: 'rejected', date: '2026-10-20' },
    { id: 5, status: 'excess', date: '2026-08-01' },
  ]
  const opts: ViewOptions<Row> = { statusOf: (r) => r.status, month: { dateOf: (r) => r.date, kind: 'taken' }, today: new Date(2026, 9, 31) }

  test('focusKey and sameId', () => {
    assert.equal(focusKey('leave', 42), 'leave:42')
    assert.equal(sameId(2, '2'), true)
    assert.equal(sameId(' 2', 2), true)
    assert.equal(sameId(2, 3), false)
    assert.equal(sameId(null, 'null'), false)
    assert.equal(sameId('', ''), false)
  })

  test('by id (number or string), else by day, else nothing', () => {
    assert.equal(findFocusRow(rows, { id: '2' }, (r) => r.id)?.id, '2')
    assert.equal(findFocusRow(rows, { id: '3' }, (r) => r.id)?.id, 3)
    assert.equal(findFocusRow(rows, { id: '99' }, (r) => r.id), null)
    assert.equal(findFocusRow(rows, { date: '2026-10-20' }, (r) => r.id, (r) => r.date)?.id, 4)
    // A date without a way to read a row's day finds nothing.
    assert.equal(findFocusRow(rows, { date: '2026-10-20' }, (r) => r.id), null)
    // An id wins over a date.
    assert.equal(findFocusRow(rows, { id: '1', date: '2026-10-20' }, (r) => r.id, (r) => r.date)?.id, 1)
    assert.equal(findFocusRow(rows, {}, (r) => r.id), null)
  })

  test('the view that shows it: the open one when it does, else its status view, else This month', () => {
    assert.equal(viewForRow(rows[0], opts), 'waiting')
    assert.equal(viewForRow(rows[1], opts), 'approved')
    // Approved this month: already on This month, stay there.
    assert.equal(viewForRow(rows[1], opts, 'month'), 'month')
    assert.equal(viewForRow(rows[1], opts, 'waiting'), 'approved')
    assert.equal(viewForRow(rows[3], opts, 'month'), 'rejected')
    // A page's own status that no view holds.
    assert.equal(viewForRow(rows[4], opts), null)
    // A page's own grouping counts.
    assert.equal(viewForRow(rows[4], { ...opts, groupOf: (r) => (r.status === 'excess' ? 'approved' : null) }), 'approved')
  })

  test('a page with the month switcher: the view as it is once the row\'s own month is shown', () => {
    // On September: row 3 (approved, 12 Sep) is in "All in Sep" and in Approved.
    const sep: ViewOptions<Row> = { ...opts, scope: { year: 2026, month: 9, daysOf: (r) => r.date } }
    assert.equal(viewForRow(rows[2], sep), 'approved')
    assert.equal(viewForRow(rows[2], sep, 'month'), 'month')
    // Row 1 (waiting, 30 Oct) is not in September: its own month's Waiting view, even with "month" open (the page moves
    // to October first, where "This month" would hold it too - the open view is kept).
    assert.equal(viewForRow(rows[0], sep), 'waiting')
    assert.equal(viewForRow(rows[0], sep, 'month'), 'month')
    assert.equal(viewForRow(rows[0], sep, 'rejected'), 'waiting')
    // A page's own status: the every-row view of its month holds it.
    assert.equal(viewForRow(rows[4], sep), 'month')
  })

  test('nextToTry skips what was tried and what the server counts as empty', () => {
    const order = ['pending', 'approved', 'rejected'] as const
    assert.equal(nextToTry(order, ['pending']), 'approved')
    assert.equal(nextToTry(order, ['pending'], (k) => (k === 'approved' ? 0 : 3)), 'rejected')
    assert.equal(nextToTry(order, ['pending'], () => null), 'approved')
    assert.equal(nextToTry(order, ['pending', 'approved', 'rejected']), null)
    assert.equal(nextToTry(order, ['pending'], () => 0), null)
  })
})

// ---- stand-in DOM ---------------------------------------------------------------------------------------------------

type Fake = {
  attrs: Record<string, string>
  style: { outline: string; outlineOffset: string }
  scrolled: unknown[]
  focused: unknown[]
  animated: unknown[]
  cancelled: number
  children: Fake[]
  isCard: boolean
  getAttribute(n: string): string | null
  setAttribute(n: string, v: string): void
  hasAttribute(n: string): boolean
  matches(sel: string): boolean
  querySelector(sel: string): Fake | null
  querySelectorAll(sel: string): Fake[]
  scrollIntoView(o: unknown): void
  focus(o: unknown): void
  animate(k: unknown, o: unknown): { cancel(): void }
}

function fake(isCard = false, attrs: Record<string, string> = {}, children: Fake[] = []): Fake {
  const all = (f: Fake): Fake[] => f.children.flatMap((c) => [c, ...all(c)])
  const el: Fake = {
    attrs: { ...attrs },
    style: { outline: '', outlineOffset: '' },
    scrolled: [],
    focused: [],
    animated: [],
    cancelled: 0,
    children,
    isCard,
    getAttribute: (n) => el.attrs[n] ?? null,
    setAttribute: (n, v) => {
      el.attrs[n] = v
    },
    hasAttribute: (n) => n in el.attrs,
    matches: (sel) => sel === '[data-slot="glass-card"]' && el.isCard,
    querySelector: (sel) => (sel === '[data-slot="glass-card"]' ? (all(el).find((c) => c.isCard) ?? null) : null),
    querySelectorAll: (sel) => (sel === `[${FOCUS_ATTR}]` ? all(el).filter((c) => FOCUS_ATTR in c.attrs) : []),
    scrollIntoView: (o) => {
      el.scrolled.push(o)
    },
    focus: (o) => {
      el.focused.push(o)
    },
    animate: (k, o) => {
      el.animated.push([k, o])
      return {
        cancel: () => {
          el.cancelled += 1
        },
      }
    },
  }
  return el
}

describe('pointing at it', () => {
  test('finds the element by its key, compared as text', () => {
    const a = fake(false, { [FOCUS_ATTR]: 'leave:1' })
    const b = fake(false, { [FOCUS_ATTR]: 'leave:2"]' })
    const root = fake(false, {}, [a, fake(false, {}, [b])])
    assert.equal(findFocusElement(root as unknown as RingRoot, 'leave:1'), a)
    assert.equal(findFocusElement(root as unknown as RingRoot, 'leave:2"]'), b)
    assert.equal(findFocusElement(root as unknown as RingRoot, 'leave:3'), null)
    assert.equal(findFocusElement(null, 'leave:1'), null)
  })

  test('rings the card inside a list item', () => {
    const card = fake(true)
    const li = fake(false, { [FOCUS_ATTR]: 'leave:1' }, [card])
    assert.equal(ringTargetOf(li as unknown as RingEl), card)
    assert.equal(ringTargetOf(card as unknown as RingEl), card)
    const bare = fake(false)
    assert.equal(ringTargetOf(bare as unknown as RingEl), bare)
  })

  test('scrolls smoothly, moves focus, pulses, and cleans up', () => {
    const card = fake(true)
    const li = fake(false, { [FOCUS_ATTR]: 'leave:1' }, [card])
    const stop = flashFocus(li as unknown as RingEl, { reduced: false, durationMs: 60_000 })
    assert.deepEqual(li.scrolled, [{ behavior: 'smooth', block: 'center' }])
    assert.deepEqual(card.focused, [{ preventScroll: true }])
    assert.equal(card.attrs.tabindex, '-1')
    assert.match(card.style.outline, /solid/)
    assert.equal(card.animated.length, 1)
    stop()
    assert.equal(card.style.outline, '')
    assert.equal(card.style.outlineOffset, '')
    assert.equal(card.cancelled, 1)
    stop() // twice is harmless
    assert.equal(card.cancelled, 1)
  })

  test('reduced motion: jumps, and the ring stays still', () => {
    const card = fake(true, { tabindex: '0' })
    const stop = flashFocus(card as unknown as RingEl, { reduced: true, durationMs: 60_000 })
    assert.deepEqual(card.scrolled, [{ behavior: 'auto', block: 'center' }])
    assert.equal(card.animated.length, 0)
    assert.equal(card.attrs.tabindex, '0', 'an element that already takes focus keeps its tabindex')
    assert.match(card.style.outline, /solid/)
    stop()
    assert.equal(card.style.outline, '')
  })

  test('scroll and focus can be left alone', () => {
    const card = fake(true)
    const stop = flashFocus(card as unknown as RingEl, { reduced: false, scroll: false, moveFocus: false, durationMs: 60_000 })
    assert.equal(card.scrolled.length, 0)
    assert.equal(card.focused.length, 0)
    stop()
  })
})

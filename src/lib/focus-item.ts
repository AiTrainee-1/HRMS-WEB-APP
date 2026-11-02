// "Show me that one": a link may name one item of a page (a notification's View button opens
// /employee/leave?focus=42, a day event /employee/attendance?date=2026-10-12, a push tap
// /employee/notifications?highlight=7). The page selects the view / tab that holds it, scrolls to it and rings it for a
// moment (a static ring under reduced motion). The pure parts are unit-tested (focus-item.test.ts); the DOM part
// (flashFocus) only runs in the browser. React glue: hooks/useFocusItem.ts.

import { rowsForView, scopeToRow, type RequestView, type ViewOptions } from './request-views.ts'

// ---- the link's params ----------------------------------------------------------------------------------------------

export interface FocusParams {
  /** `focus=<id>`: the item a page should show (a request id, an advance id ...). */
  focus: string | null
  /** `date=YYYY-MM-DD`: a day event (an attendance day, the On-Duty record of a day). */
  date: string | null
  /** `highlight=<id>`: the notification to point at on the Notifications page. */
  highlight: string | null
}

/** Ids we accept from a URL: short, plain characters only (they end up in attribute comparisons and messages). */
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/

function cleanId(raw: string | null): string | null {
  const s = (raw ?? '').trim()
  return ID_RE.test(s) ? s : null
}

/** "2026-10-12" (also the day part of "2026-10-12T09:30:00+05:30") when it is a real calendar day, else null. */
export function cleanDate(raw: unknown): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(typeof raw === 'string' ? raw.trim() : '')
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(y, mo - 1, d)
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** Reads `focus`, `date` and `highlight` from a query string ("?focus=4&date=..." or without the "?"). */
export function readFocusParams(search: string | null | undefined): FocusParams {
  const p = new URLSearchParams(search ?? '')
  return { focus: cleanId(p.get('focus')), date: cleanDate(p.get('date')), highlight: cleanId(p.get('highlight')) }
}

// ---- finding the item -----------------------------------------------------------------------------------------------

/** The value of the `data-focus-key` attribute an item carries: "<scope>:<id>" ("leave:42", "notification:7"). */
export function focusKey(scope: string, id: string | number): string {
  return `${scope}:${String(id)}`
}

/** Ids from the server can be numbers or strings: 42 and "42" are the same item. */
export function sameId(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return false
  return String(a).trim() === String(b).trim() && String(a).trim() !== ''
}

/**
 * The row a link asks for: by id when it names one, else (when the page can read a row's day) the first row of that
 * day. Null when it is not there (an old or deleted item).
 */
export function findFocusRow<T>(
  rows: readonly T[],
  want: { id?: string | null; date?: string | null },
  idOf: (row: T) => string | number | null | undefined,
  dateOf?: (row: T) => string | null | undefined,
): T | null {
  if (want.id) return rows.find((r) => sameId(idOf(r), want.id)) ?? null
  if (want.date && dateOf) return rows.find((r) => cleanDate(dateOf(r)) === want.date) ?? null
  return null
}

/**
 * Which of the four request views shows a row: the open one when it already does (no needless switch), else its status
 * view (Waiting / Approved / Rejected), else This month. Null when no view holds it (a page's own status).
 * A page with the month switcher (`opts.scope`): the views as they are once the page shows the row's own month (the
 * hook switches the month first - monthForRow - then the view, the scroll and the ring).
 */
export function viewForRow<T>(row: T, opts: ViewOptions<T>, current?: RequestView | null): RequestView | null {
  const o = scopeToRow(row, opts)
  if (current && rowsForView([row], current, o).length > 0) return current
  const order: RequestView[] = ['waiting', 'approved', 'rejected', 'month']
  return order.find((v) => rowsForView([row], v, o).length > 0) ?? null
}

/**
 * The next list to look in, in `order`, skipping the ones already tried and the ones the server counts as empty
 * (an unknown count is worth a look). Null when there is nowhere left. Approvals: pending -> approved -> rejected.
 */
export function nextToTry<K extends string>(order: readonly K[], tried: readonly K[], countOf?: (k: K) => number | null | undefined): K | null {
  for (const k of order) {
    if (tried.includes(k)) continue
    const n = countOf?.(k)
    if (typeof n === 'number' && n <= 0) continue
    return k
  }
  return null
}

// ---- pointing at it (browser only) ----------------------------------------------------------------------------------

export const FOCUS_ATTR = 'data-focus-key'
/** How long the ring stays. */
export const FLASH_MS = 2600

/**
 * The parts of a DOM element the ring uses. Spelled out here (rather than HTMLElement) so this file also type-checks
 * and runs under Node's test runner with stand-ins; the browser caller passes real elements (`as unknown as RingEl`).
 */
export interface RingEl {
  style: { outline: string; outlineOffset: string }
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
  hasAttribute(name: string): boolean
  matches?(selector: string): boolean
  querySelector(selector: string): RingEl | null
  scrollIntoView?(options: { behavior: 'auto' | 'smooth'; block: 'center' }): void
  focus?(options: { preventScroll: boolean }): void
  animate?(keyframes: Array<{ outlineOffset: string }>, options: { duration: number; iterations: number; easing: string }): { cancel(): void }
}

/** A document (or any element) to search in. */
export interface RingRoot {
  querySelectorAll(selector: string): ArrayLike<RingEl>
}

/** The element carrying `data-focus-key="<key>"` (compared as text, so odd ids never break a selector). */
export function findFocusElement(root: RingRoot | null | undefined, key: string): RingEl | null {
  if (!root) return null
  for (const el of Array.from(root.querySelectorAll(`[${FOCUS_ATTR}]`))) {
    if (el.getAttribute(FOCUS_ATTR) === key) return el
  }
  return null
}

/** The surface to ring: the card itself, or the first card inside a list item (so the ring follows its corners). */
export function ringTargetOf(el: RingEl): RingEl {
  if (el.matches?.('[data-slot="glass-card"]')) return el
  return el.querySelector('[data-slot="glass-card"]') ?? el
}

export interface FlashOptions {
  /** The person asked for less motion: jump (no smooth scroll) and a static ring (no pulse). */
  reduced: boolean
  durationMs?: number
  /** Bring it into sight (default true). */
  scroll?: boolean
  /** Move keyboard / screen-reader focus to it (default true), so the next Tab continues from there. */
  moveFocus?: boolean
}

/**
 * Scrolls `el` to the middle of its scroll area, moves focus to its card and rings the card in sapphire for
 * FLASH_MS: a breathing ring (3 soft pulses), or a still ring under reduced motion. Returns a function that removes the
 * ring at once (call it on unmount). Inline styles only, so no page CSS is needed and nothing is left behind.
 */
export function flashFocus(el: RingEl, opts: FlashOptions): () => void {
  const target = ringTargetOf(el)
  if (opts.scroll !== false) el.scrollIntoView?.({ behavior: opts.reduced ? 'auto' : 'smooth', block: 'center' })
  if (opts.moveFocus !== false && target.focus) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
  }

  const style = target.style
  const before = { outline: style.outline, outlineOffset: style.outlineOffset }
  style.outline = '2px solid var(--status-info-fg)'
  style.outlineOffset = '3px'

  let anim: { cancel: () => void } | null = null
  if (!opts.reduced && target.animate) {
    try {
      anim = target.animate([{ outlineOffset: '3px' }, { outlineOffset: '7px' }, { outlineOffset: '3px' }], {
        duration: 820,
        iterations: 3,
        easing: 'ease-in-out',
      })
    } catch {
      anim = null
    }
  }

  let done = false
  const finish = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    anim?.cancel()
    style.outline = before.outline
    style.outlineOffset = before.outlineOffset
  }
  const timer = setTimeout(finish, opts.durationMs ?? FLASH_MS)
  return finish
}

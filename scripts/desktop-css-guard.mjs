#!/usr/bin/env node
// Desktop CSS guard for the phone-view work (src/components/kit/MOBILE.md).
//
// The rule: the phone view (< 768 px) may change, the desktop view (>= 768 px) may not. Every phone change lives in a
// phone media query (`max-md:` utilities, `@media (width < 48rem)` blocks), so the compiled CSS OUTSIDE those blocks must
// stay the same as the saved baseline. This script proves it:
//
//   node scripts/desktop-css-guard.mjs <baseline.css> <new.css>
//   node scripts/desktop-css-guard.mjs <baseline.css> dist/assets      (picks the index-*.css in that folder)
//
// It parses both files, drops every phone-only media block - `(width<48rem)`, `(width < 48rem)`, `(max-width: 767px)`,
// `(max-width: 767.98px)`, and Tailwind 4's own `max-md:` output `not all and (width>=48rem)` - then compares what is
// left, one selector at a time (selector lists are split, so Lightning CSS merging `.a,.b{}` differently is not noise).
//
// Report sections:
//   CHANGED   a selector that exists in both files but with a different value for a property        -> FAIL
//   REMOVED   a selector or property that the baseline had and the new file does not                 -> FAIL
//   ORDER     rules present in both files whose relative order changed (cascade could change)         -> FAIL
//   ADDED     new selectors / new properties on existing selectors (new utilities used by new
//             phone-only markup, `@property --tw-*` registrations, `:root` theme variables)         -> listed, not a failure:
//             a selector that did not exist before cannot match existing markup unless that markup
//             gained the class - which the markup review checks.
// Exit code 1 when anything in CHANGED / REMOVED / ORDER, else 0.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function resolveCss(p) {
  if (statSync(p).isDirectory()) {
    const hit = readdirSync(p).find((f) => /^index-.*\.css$/.test(f))
    if (!hit) throw new Error(`No index-*.css in ${p}`)
    return join(p, hit)
  }
  return p
}

// ── A small CSS tokenizer/parser good enough for minified Tailwind / Lightning CSS output ───────────────────────────
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Finds the index of the matching close brace for the `{` at `open`, skipping strings. */
function matchBrace(css, open) {
  let depth = 0
  for (let i = open; i < css.length; i++) {
    const ch = css[i]
    if (ch === '"' || ch === "'") {
      const q = ch
      i++
      while (i < css.length && css[i] !== q) {
        if (css[i] === '\\') i++
        i++
      }
      continue
    }
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  throw new Error('Unbalanced braces')
}

/** Finds the next `{` or `;` at depth 0 from `start` (skipping strings, escapes and parentheses). */
function nextBoundary(css, start) {
  let paren = 0
  for (let i = start; i < css.length; i++) {
    const ch = css[i]
    if (ch === '"' || ch === "'") {
      const q = ch
      i++
      while (i < css.length && css[i] !== q) {
        if (css[i] === '\\') i++
        i++
      }
      continue
    }
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (paren === 0 && (ch === '{' || ch === ';' || ch === '}')) return i
  }
  return -1
}

/** Parses a block body into nodes: { type: 'rule', selector, body } | { type: 'at', name, prelude, body|null }. */
function parse(css) {
  const nodes = []
  let i = 0
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++
    if (i >= css.length) break
    if (css[i] === '}') {
      i++
      continue
    }
    const b = nextBoundary(css, i)
    if (b === -1) break
    const head = css.slice(i, b).trim()
    if (css[b] === ';' || css[b] === '}') {
      // statement at-rule (@layer a,b; @import ...) or a stray declaration
      if (head) nodes.push({ type: 'statement', text: head })
      i = b + 1
      continue
    }
    const close = matchBrace(css, b)
    const body = css.slice(b + 1, close)
    if (head.startsWith('@')) {
      const m = /^@([\w-]+)\s*([\s\S]*)$/.exec(head)
      nodes.push({ type: 'at', name: m[1], prelude: m[2].trim(), body })
    } else {
      nodes.push({ type: 'rule', selector: head, body })
    }
    i = close + 1
  }
  return nodes
}

/** Splits a selector list on top-level commas. */
function splitSelectors(sel) {
  const out = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i]
    if (ch === '\\') {
      cur += ch + (sel[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** Splits declarations on top-level semicolons into [prop, value] pairs. Nested blocks (CSS nesting) are kept whole. */
function splitDecls(body) {
  const out = []
  let depth = 0
  let paren = 0
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '"' || ch === "'") {
      const q = ch
      let j = i + 1
      while (j < body.length && body[j] !== q) {
        if (body[j] === '\\') j++
        j++
      }
      cur += body.slice(i, j + 1)
      i = j
      continue
    }
    if (ch === '\\') {
      cur += ch + (body[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '(') paren++
    else if (ch === ')') paren--
    else if (ch === '{') depth++
    else if (ch === '}') depth--
    if (ch === ';' && depth === 0 && paren === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out.map((d) => {
    const k = d.indexOf(':')
    if (k === -1 || d.includes('{')) return [`<nested> ${d}`, '']
    return [d.slice(0, k).trim(), d.slice(k + 1).trim()]
  })
}

const norm = (s) => s.replace(/\s+/g, '').toLowerCase()

const toPx = (n, unit) => (unit === 'rem' || unit === 'em' ? Number(n) * 16 : Number(n))

/**
 * Is this @media prelude phone-only, i.e. can it only ever match below 768px? True when the query carries an upper width
 * bound at or under 768px - `(width<48rem)`, `(width < 48rem)`, `(max-width: 767px)`, `(width<=767.98px)`, Tailwind's
 * `max-md:` / `max-sm:` output `not all and (width>=48rem)` / `(width>=40rem)` - possibly AND-ed with other conditions
 * (`(width<48rem) and (hover:hover)`). A comma (OR) list counts only if every branch is phone-only.
 */
function isPhoneMedia(prelude) {
  const branches = splitSelectors(prelude).map(norm)
  const LIMIT = 768
  const phone = (p) => {
    // not all and (width>=X) / (min-width:X): matches only below X.
    const neg = /^notalland\((?:width>=|min-width:)([\d.]+)(rem|em|px)\)$/.exec(p)
    if (neg) return toPx(neg[1], neg[2]) <= LIMIT
    for (const m of p.matchAll(/\((?:width<|max-width:|width<=)([\d.]+)(rem|em|px)\)/g)) {
      const px = toPx(m[1], m[2])
      const strict = m[0].startsWith('(width<') && !m[0].startsWith('(width<=')
      if (strict ? px <= LIMIT : px < LIMIT) return !p.includes(' or ') && !/\bor\(/.test(p)
    }
    return false
  }
  return branches.length > 0 && branches.every(phone)
}

/**
 * Flattens a parsed tree into entries { key, ctx, selector, decls: Map(prop -> value), order }, skipping phone media.
 * Keyframes, @property, @font-face and statements are compared as whole units.
 */
function flatten(nodes, ctx = [], out = { entries: new Map(), order: [], removedPhone: 0 }) {
  for (const n of nodes) {
    if (n.type === 'statement') {
      const key = `${ctx.join(' > ')} || ${norm(n.text)}`
      add(out, key, ctx, n.text, new Map([['<statement>', norm(n.text)]]))
      continue
    }
    if (n.type === 'at') {
      if (n.name === 'media' && isPhoneMedia(n.prelude)) {
        out.removedPhone++
        continue
      }
      if (['keyframes', '-webkit-keyframes', 'property', 'font-face', 'counter-style', 'page'].includes(n.name)) {
        const label = `@${n.name} ${n.prelude}`.trim()
        add(out, `${ctx.join(' > ')} || ${label}`, ctx, label, new Map([['<block>', norm(n.body)]]))
        continue
      }
      flatten(parse(n.body), [...ctx, `@${n.name} ${norm(n.prelude)}`.trim()], out)
      continue
    }
    const decls = splitDecls(n.body)
    const nested = decls.filter(([p]) => p.startsWith('<nested>'))
    const plain = decls.filter(([p]) => !p.startsWith('<nested>'))
    for (const sel of splitSelectors(n.selector)) {
      const m = new Map()
      for (const [p, v] of plain) m.set(p, v)
      add(out, `${ctx.join(' > ')} || ${sel}`, ctx, sel, m)
      // CSS nesting (rare in compiled output): treat each nested rule as its own entry under the parent selector.
      for (const [p] of nested) {
        const inner = p.replace(/^<nested>\s*/, '')
        flatten(parse(inner), [...ctx, sel], out)
      }
    }
  }
  return out
}

function add(out, key, ctx, selector, decls) {
  const prev = out.entries.get(key)
  if (prev) {
    for (const [p, v] of decls) prev.decls.set(p, v)
  } else {
    out.entries.set(key, { key, ctx: ctx.join(' > '), selector, decls })
    out.order.push(key)
  }
}

// ── Compare ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function compare(basePath, newPath) {
  const a = flatten(parse(stripComments(readFileSync(basePath, 'utf8'))))
  const b = flatten(parse(stripComments(readFileSync(newPath, 'utf8'))))

  const changed = []
  const removed = []
  const added = []
  const addedProps = []

  for (const [key, ea] of a.entries) {
    const eb = b.entries.get(key)
    if (!eb) {
      removed.push(`${label(ea)}  { ${[...ea.decls].map(([p, v]) => `${p}:${v}`).join('; ')} }`)
      continue
    }
    for (const [p, v] of ea.decls) {
      if (!eb.decls.has(p)) removed.push(`${label(ea)}  property ${p} (was ${v})`)
      else if (eb.decls.get(p) !== v) changed.push(`${label(ea)}  ${p}: ${v}  ->  ${eb.decls.get(p)}`)
    }
    for (const [p, v] of eb.decls) {
      if (!ea.decls.has(p)) addedProps.push(`${label(eb)}  + ${p}: ${v}`)
    }
  }
  for (const [key, eb] of b.entries) {
    if (!a.entries.has(key)) added.push(`${label(eb)}  { ${[...eb.decls].map(([p, v]) => `${p}:${v}`).join('; ')} }`)
  }

  // Relative order of the rules both files share. Order matters only between rules that can hit the same element
  // with the same property, but checking every shared rule is simple and strict.
  const shared = new Set([...a.entries.keys()].filter((k) => b.entries.has(k)))
  const seqA = a.order.filter((k) => shared.has(k))
  const posB = new Map(b.order.filter((k) => shared.has(k)).map((k, i) => [k, i]))
  const order = []
  let maxSeen = -1
  let maxKey = ''
  for (const k of seqA) {
    const p = posB.get(k)
    if (p < maxSeen) order.push(`${k}  now comes before  ${maxKey}`)
    if (p > maxSeen) {
      maxSeen = p
      maxKey = k
    }
  }

  return { a, b, changed, removed, added, addedProps, order }
}

function label(e) {
  return e.ctx ? `[${e.ctx}] ${e.selector}` : e.selector
}

// ── Main ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const [, , baseArg, newArg] = process.argv
if (!baseArg || !newArg) {
  console.error('usage: node scripts/desktop-css-guard.mjs <baseline.css> <new.css | dist/assets>')
  process.exit(2)
}
const basePath = resolveCss(baseArg)
const newPath = resolveCss(newArg)
const r = compare(basePath, newPath)

const section = (title, list, max = 400) => {
  console.log(`\n${title} (${list.length})`)
  for (const line of list.slice(0, max)) console.log(`  ${line}`)
  if (list.length > max) console.log(`  ... ${list.length - max} more`)
}

console.log('Desktop CSS guard')
console.log(`  baseline: ${basePath}`)
console.log(`  new:      ${newPath}`)
console.log(
  `  phone media blocks dropped: baseline ${r.a.removedPhone}, new ${r.b.removedPhone}; ` +
    `selectors compared: baseline ${r.a.entries.size}, new ${r.b.entries.size}`,
)
section('CHANGED outside phone media - FAIL', r.changed)
section('REMOVED outside phone media - FAIL', r.removed)
section('ORDER changed among shared rules - FAIL', r.order, 50)
section('ADDED selectors outside phone media (must only be used by phone-only markup)', r.added)
section('ADDED properties on existing selectors (theme variables, @property defaults)', r.addedProps)

const fail = r.changed.length + r.removed.length + r.order.length
console.log(fail ? `\nRESULT: FAIL (${fail} desktop differences)` : '\nRESULT: PASS - nothing outside phone media changed or moved')
process.exit(fail ? 1 : 0)

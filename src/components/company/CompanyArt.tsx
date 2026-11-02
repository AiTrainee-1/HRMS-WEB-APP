import type * as React from 'react'
import { threadParticles, type SegmentKey } from '@/lib/company-about'

// The page's visuals: type, shapes and SVG only (no images). All decorative, hidden from screen readers.

const PARTICLES = threadParticles(26)

/**
 * Fibres falling through the hero: short vertical threads with a glowing tip (26, half of them on phones). CSS only;
 * they pause when the tab is hidden, the hero is scrolled away or the page's Pause button is on, and rest in place under
 * reduced motion (company.css).
 */
export function ThreadField() {
  return (
    <div className="ukt-threads" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="ukt-thread ukt-anim"
          data-tone={p.tone}
          style={
            {
              '--x': `${p.left}%`,
              '--dur': `${p.duration}s`,
              '--delay': `${p.delay}s`,
              '--len': `${p.length}px`,
              '--op': p.opacity,
              '--tw': `${p.twinkle}s`,
              '--rest': `${p.rest}%`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

/** One outlined line of text stretched to the full width of its viewBox (so it always fills the panel exactly). */
function OutlineText({ text, width, height, size, baseline }: { text: string; width: number; height: number; size: number; baseline: number }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} focusable="false" aria-hidden="true">
      <text x={width / 2} y={baseline} textAnchor="middle" textLength={width - 8} lengthAdjust="spacingAndGlyphs" fontSize={size}>
        {text}
      </text>
    </svg>
  )
}

function WordmarkLine(props: { text: string; width: number; height: number; size: number; baseline: number }) {
  return (
    <div className="relative">
      <div className="ukt-wordmark__base">
        <OutlineText {...props} />
      </div>
      {/* A soft band of light travelling along the outline. */}
      <div className="ukt-wordmark__shine ukt-anim">
        <div className="ukt-wordmark__shine-inner ukt-anim">
          <OutlineText {...props} />
        </div>
      </div>
    </div>
  )
}

/** The giant outlined "UK TEXTILES" across the foot of the hero ("UKT" on narrow screens). */
export function Wordmark() {
  return (
    <div className="ukt-wordmark" aria-hidden="true">
      <div className="hidden @xl:block">
        <WordmarkLine text="UK TEXTILES" width={1200} height={200} size={232} baseline={186} />
      </div>
      <div className="@xl:hidden">
        <WordmarkLine text="UKT" width={600} height={236} size={286} baseline={222} />
      </div>
    </div>
  )
}

/** Simple line drawings for the three segments: a polo tee, a dress, a child's romper. */
export function SegmentIcon({ kind, className }: { kind: SegmentKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'men' && (
        <>
          <path d="M35 14 22 19 8 32l9 12 8-5v45h46V39l8 5 9-12-14-13-13-5c-2 6-7 10-13 10s-11-4-13-10Z" />
          <path className="ukt-accent-stroke" d="m41 15 7 10 7-10" />
          <path d="M48 25v14" />
          <circle cx="48" cy="30" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="48" cy="35" r="1.3" fill="currentColor" stroke="none" />
          <path className="ukt-accent-stroke" d="M25 77h46" strokeDasharray="3 4" />
        </>
      )}
      {kind === 'women' && (
        <>
          <path d="M38 10v12M58 10v12" />
          <path d="M38 22c3 3 6 4 10 4s7-1 10-4c0 7 1 13 4 18H34c3-5 4-11 4-18Z" />
          <path className="ukt-accent-stroke" d="M34 40h28" />
          <path d="M34 40 20 84c9 3 18 4 28 4s19-1 28-4L62 40" />
          <path d="m42 45-6 39M54 45l6 39M48 45v43" strokeOpacity={0.55} />
        </>
      )}
      {kind === 'children' && (
        <>
          <path d="M37 16 26 21 16 32l8 9 7-4v24c0 8 4 13 10 15l2 10h10l2-10c6-2 10-7 10-15V37l7 4 8-9-10-11-11-5c-2 5-6 8-11 8s-9-3-11-8Z" />
          <path className="ukt-accent-stroke" d="M48 50c-2-3-7-3-7 1 0 3 4 5 7 8 3-3 7-5 7-8 0-4-5-4-7-1Z" />
          <circle cx="45" cy="82" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="51" cy="82" r="1.2" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  )
}

const KNIT_ROWS = [80, 100, 120]
const KNIT_COLS = [276, 292, 308, 324]

/** Yarn -> knitted fabric -> garment, joined by a stitched thread with a quality check between each stage. */
export function YarnToGarment() {
  return (
    <svg
      viewBox="0 0 600 200"
      fill="none"
      stroke="#f6f1e4"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {[100, 300, 500].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={100} r={66} stroke="rgba(246,241,228,0.16)" />
          <circle cx={cx} cy={100} r={80} stroke="rgba(246,241,228,0.1)" strokeDasharray="2 8" />
        </g>
      ))}

      {/* Yarn ball */}
      <circle cx={100} cy={100} r={40} />
      <path d="M66 82c18-14 48-14 68 4M62 102c22-20 56-18 74 2M70 124c18-16 44-16 60-2M86 63c-9 22-7 50 7 74" strokeOpacity={0.7} />

      {/* Knitted fabric */}
      <rect x={258} y={58} width={84} height={84} rx={10} />
      {KNIT_ROWS.map((y) => KNIT_COLS.map((x) => <path key={`${x}-${y}`} d={`M${x - 6} ${y - 7}l6 10 6-10`} strokeOpacity={0.8} />))}

      {/* Garment */}
      <path transform="translate(452 52)" d="M35 14 22 19 8 32l9 12 8-5v45h46V39l8 5 9-12-14-13-13-5c-2 6-7 10-13 10s-11-4-13-10Z" />

      {/* The thread between stages */}
      <path d="M140 108c20 18 40-24 60-8s40 22 58 2" stroke="#f3f298" strokeDasharray="5 6" />
      <path d="M342 100c20-16 40 16 58 0s40-20 60-4" stroke="#f3f298" strokeDasharray="5 6" />

      {/* Quality checks */}
      {[200, 400].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={100} r={14} fill="#ff8fa3" stroke="none" />
          <path d={`M${cx - 6} ${100}l4 4.5 8-9`} stroke="#14112b" strokeWidth={2.6} />
        </g>
      ))}
    </svg>
  )
}

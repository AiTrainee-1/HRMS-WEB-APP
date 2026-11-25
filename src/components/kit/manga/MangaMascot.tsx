import * as React from 'react'
import { cn } from '@/lib/utils'
import './manga.css'

// An original chibi (owner 2026-11-25, drawn for the mobile app's UpdatePrompt and redrawn here as plain SVG): a big
// round head with a blue fringe and a thread-loop "ahoge", sitting on a little thread spool - UKTextiles makes yarn.
// Art colours are fixed (it is an illustration); the outline is a soft ink that reads on both themes' panel tint.
const ART = {
  ink: '#1B1B3A',
  skin: '#FFE4D2',
  hair: '#2B59D9',
  hairShine: '#FFFFFF',
  wood: '#E9B872',
  thread: '#2563EB',
  threadLight: '#93C5FD',
  blush: '#FF8FA3',
  mouth: '#E2556B',
  iris: '#3B82F6',
  sweat: '#7DD3FC',
  pin: '#E11D48',
  gold: '#F59E0B',
}

export type MascotMood = 'happy' | 'excited' | 'worried'
export type MascotProp = 'pin' | 'star' | 'flag' | null

/**
 * The mascot. `mood` changes the face (and a worried one gets a sweat drop); `holding` puts a small thing in the raised
 * hand (a map pin, a star, a little flag). It waves and blinks unless `still` (or reduced motion: manga.css).
 */
export function MangaMascot({
  mood = 'happy',
  holding = null,
  still = false,
  width = 104,
  className,
  label = 'A cheerful mascot waving',
}: {
  mood?: MascotMood
  holding?: MascotProp
  still?: boolean
  width?: number
  className?: string
  /** What a screen reader hears; '' hides it (decoration). */
  label?: string
}) {
  const height = Math.round((width * 150) / 120)
  const waving = !still && mood !== 'worried'
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 150"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn('overflow-visible', className)}
    >
      {/* the spool body */}
      <rect x={43} y={100} width={34} height={31} fill={ART.thread} stroke={ART.ink} strokeWidth={2.4} />
      {[106, 111, 116, 121, 126].map((y) => (
        <path key={y} d={`M45 ${y} L75 ${y}`} stroke={ART.threadLight} strokeWidth={1.6} strokeLinecap="round" />
      ))}
      <rect x={37} y={93} width={46} height={9} rx={4.5} fill={ART.wood} stroke={ART.ink} strokeWidth={2.4} />
      <rect x={37} y={129} width={46} height={9} rx={4.5} fill={ART.wood} stroke={ART.ink} strokeWidth={2.4} />
      {/* the resting arm */}
      <path d="M45 108 Q36 112 32 119" stroke={ART.ink} strokeWidth={8.5} strokeLinecap="round" fill="none" />
      <path d="M45 108 Q36 112 32 119" stroke={ART.skin} strokeWidth={5} strokeLinecap="round" fill="none" />
      <circle cx={31} cy={121} r={5} fill={ART.skin} stroke={ART.ink} strokeWidth={2.2} />
      {/* the head */}
      <path d="M21 60 C19 71 22 79 28 84 C26 75 26 68 28 62 Z" fill={ART.hair} stroke={ART.ink} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M99 60 C101 71 98 79 92 84 C94 75 94 68 92 62 Z" fill={ART.hair} stroke={ART.ink} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={60} cy={58} r={40} fill={ART.skin} stroke={ART.ink} strokeWidth={2.6} />
      <path
        d="M20 62 C16 30 36 14 60 14 C84 14 104 30 100 62 C96 53 92 47 88 45 L84 55 L77 43 L70 53 L62 41 L55 53 L48 43 L41 55 L35 46 C29 49 24 55 20 62 Z"
        fill={ART.hair}
        stroke={ART.ink}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path d="M36 28 Q48 19 64 20" stroke={ART.hairShine} strokeOpacity={0.55} strokeWidth={3} strokeLinecap="round" fill="none" />
      {/* the thread-loop ahoge */}
      <path d="M60 15 C53 2 71 -2 69 8 C68 13 62 12 63 8" stroke={ART.hair} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      {/* cheeks */}
      <ellipse cx={37} cy={74} rx={5.5} ry={2.8} fill={ART.blush} opacity={0.75} />
      <ellipse cx={83} cy={74} rx={5.5} ry={2.8} fill={ART.blush} opacity={0.75} />

      {/* the eyes, on their own group so they can blink */}
      <g className={cn(!still && 'manga-eyes')}>
        {[47, 73].map((cx) => (
          <React.Fragment key={cx}>
            <ellipse cx={cx} cy={63} rx={6.2} ry={mood === 'excited' ? 9.6 : 9} fill={ART.ink} />
            <ellipse cx={cx} cy={66.5} rx={4.6} ry={4.6} fill={ART.iris} />
            <circle cx={cx - 2} cy={59.5} r={mood === 'excited' ? 3 : 2.5} fill="#FFFFFF" />
            <circle cx={cx + 2.3} cy={67.5} r={1.2} fill="#FFFFFF" />
          </React.Fragment>
        ))}
      </g>
      {mood === 'worried' && (
        <>
          {/* tilted brows and a wobbly mouth */}
          <path d="M39 50 L53 53" stroke={ART.ink} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M81 50 L67 53" stroke={ART.ink} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M53 79 Q56.5 75.5 60 79 Q63.5 82.5 67 79" stroke={ART.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
          <path className={cn(!still && 'manga-sweat')} d="M97 34 C93 40 93 44 97 45 C101 44 101 40 97 34 Z" fill={ART.sweat} stroke={ART.ink} strokeWidth={1.4} />
        </>
      )}
      {mood === 'happy' && <path d="M54 75 Q60 83 66 75 Z" fill={ART.mouth} stroke={ART.ink} strokeWidth={1.8} strokeLinejoin="round" />}
      {mood === 'excited' && <path d="M51 73 Q60 89 69 73 Z" fill={ART.mouth} stroke={ART.ink} strokeWidth={1.8} strokeLinejoin="round" />}

      {/* the raised arm, turning about the shoulder (waving), with whatever it holds */}
      <g className={cn(waving && 'manga-wave')}>
        {mood === 'worried' ? (
          <>
            <path d="M75 108 Q95 103 103 85" stroke={ART.ink} strokeWidth={8.5} strokeLinecap="round" fill="none" />
            <path d="M75 108 Q95 103 103 85" stroke={ART.skin} strokeWidth={5} strokeLinecap="round" fill="none" />
            <circle cx={104} cy={81} r={5.6} fill={ART.skin} stroke={ART.ink} strokeWidth={2.2} />
          </>
        ) : (
          <>
            <path d="M75 108 Q88 104 93 91" stroke={ART.ink} strokeWidth={8.5} strokeLinecap="round" fill="none" />
            <path d="M75 108 Q88 104 93 91" stroke={ART.skin} strokeWidth={5} strokeLinecap="round" fill="none" />
            <circle cx={94} cy={87} r={5.6} fill={ART.skin} stroke={ART.ink} strokeWidth={2.2} />
          </>
        )}
        {holding === 'pin' && (
          <g transform={mood === 'worried' ? 'translate(95 46)' : 'translate(84 55)'}>
            <path d="M11 0 C4.9 0 0 4.9 0 11 C0 19 11 30 11 30 C11 30 22 19 22 11 C22 4.9 17.1 0 11 0 Z" fill={ART.pin} stroke={ART.ink} strokeWidth={2} />
            <circle cx={11} cy={11} r={4.2} fill="#FFFFFF" stroke={ART.ink} strokeWidth={1.6} />
            {mood === 'worried' && <path d="M-1 28 L23 -2" stroke={ART.ink} strokeWidth={2.6} strokeLinecap="round" />}
          </g>
        )}
        {holding === 'star' && (
          <path
            transform="translate(85 62)"
            d="M10 0 L12.9 6.6 L20 7.3 L14.6 12 L16.2 19 L10 15.3 L3.8 19 L5.4 12 L0 7.3 L7.1 6.6 Z"
            fill={ART.gold}
            stroke={ART.ink}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        )}
        {holding === 'flag' && (
          <g transform="translate(92 52)">
            <path d="M2 0 L2 36" stroke={ART.ink} strokeWidth={2.4} strokeLinecap="round" />
            <path d="M2 1 L22 6 L2 13 Z" fill={ART.gold} stroke={ART.ink} strokeWidth={1.8} strokeLinejoin="round" />
          </g>
        )}
      </g>
    </svg>
  )
}

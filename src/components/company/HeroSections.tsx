import * as React from 'react'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUpRight, Pause, Play } from 'lucide-react'
import { EASE_OUT, useReducedMotion } from '@/components/kit'
import { formatCount } from '@/lib/money'
import { HERO_INTRO, MARQUEE_WORDS, companyStats, heroStickers } from '@/lib/company-about'
import { CountUp, StarMark } from './CompanyBits'
import { ThreadField, Wordmark } from './CompanyArt'
import { useOffscreenFlag } from './hooks'

const TILTS = ['-3deg', '2.2deg', '-1.4deg']

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: EASE_OUT, delay },
})

/**
 * The hero: tilted mono stickers, the page's only h1 with its italic accent, the intro, two pills (scroll to the story;
 * Help & Support for HR), falling thread fibres and the giant outlined wordmark at the foot.
 */
export function Hero({ storyId, paused, onTogglePaused }: { storyId: string; paused: boolean; onTogglePaused: () => void }) {
  const ref = React.useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  useOffscreenFlag(ref)

  const goToStory = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const section = document.getElementById(storyId)
    const heading = document.getElementById(`${storyId}-title`)
    if (!section) return
    e.preventDefault()
    section.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    heading?.focus({ preventScroll: true })
  }

  return (
    <section ref={ref} className="ukt-sec ukt-hero" aria-labelledby="ukt-hero-title">
      <div aria-hidden="true" className="ukt-glow ukt-glow--blue" style={{ top: -220, left: -160, width: 'max(78%, 560px)' }} />
      <div aria-hidden="true" className="ukt-glow ukt-glow--crimson" style={{ top: '18%', right: '-30%', width: 'max(64%, 460px)' }} />
      <ThreadField />

      <div className="ukt-hero__content">
        <div className="flex items-start justify-between gap-4">
          <motion.ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-3 pt-1" aria-hidden="true" {...rise(0.05)}>
            {heroStickers().map((s, i) => (
              <li key={s.code} className="ukt-sticker" data-tone={s.tone} style={{ '--tilt': TILTS[i % TILTS.length] } as React.CSSProperties}>
                <span className="ukt-sticker__code">{s.code}</span>
                <span>— {s.text}</span>
              </li>
            ))}
          </motion.ul>
          {!reduced && (
            // Stops the fibres, the wordmark's light and the tapes (WCAG 2.2.2). The words are the button's name on every
            // screen (visually hidden on narrow ones), so voice control can say what it shows.
            <button type="button" className="ukt-motion-toggle shrink-0" onClick={onTogglePaused}>
              {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
              <span className="sr-only @xl:not-sr-only">{paused ? 'Play motion' : 'Pause motion'}</span>
            </button>
          )}
        </div>

        <motion.p className="ukt-eyebrow mt-10 @3xl:mt-14" {...rise(0.12)}>
          <span aria-hidden="true">— </span>About UK Textiles
        </motion.p>
        <motion.h1 id="ukt-hero-title" className="ukt-display ukt-h1 ukt-hero__title" {...rise(0.18)}>
          Knitwear for the world, <span className="ukt-accent">made in Tirupur.</span>
        </motion.h1>
        <motion.p className="ukt-lead mt-6 @3xl:mt-8" {...rise(0.28)}>
          {HERO_INTRO}
        </motion.p>
        <motion.div className="mt-8 flex flex-wrap items-center gap-3" {...rise(0.36)}>
          <a href={`#${storyId}`} onClick={goToStory} className="ukt-pill ukt-pill--butter ukt-pill--down">
            Our story
            <span className="ukt-pill__badge" aria-hidden="true">
              <ArrowDown />
            </span>
          </a>
          <Link href="/employee/help" className="ukt-pill ukt-pill--ghost">
            Contact HR
            <span className="ukt-pill__badge" aria-hidden="true">
              <ArrowUpRight />
            </span>
          </Link>
        </motion.div>
      </div>

      <Wordmark />
    </section>
  )
}

/** Six true figures that count up when they scroll into view. */
export function Stats() {
  const stats = React.useMemo(() => companyStats(), [])
  return (
    <section className="ukt-sec ukt-stats" aria-labelledby="ukt-stats-title">
      <h2 id="ukt-stats-title" className="sr-only">
        UK Textiles in numbers
      </h2>
      {/* Six across on wide panels, the 4,00,000 column a little wider than the rest. */}
      <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-8 p-0 @3xl:grid-cols-3 @5xl:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)_repeat(4,minmax(0,1fr))]">
        {stats.map((s) => (
          <li key={s.key} className="ukt-stat" data-tone={s.tone}>
            <p className="ukt-stat__value m-0">
              <span>
                <CountUp value={s.value} format={formatCount} />
              </span>
              {s.unit && <span className="ukt-stat__unit">{s.unit === 'pcs' ? <abbr title="pieces">pcs</abbr> : s.unit}</span>}
            </p>
            <p className="ukt-stat__caption">{s.caption}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** One copy of a tape's words. Each copy must be wider than the widest panel, so the loop (two copies sliding by
 *  half the track) never shows a gap. */
function MarqueeGroup({ words }: { words: readonly string[] }) {
  return (
    <ul className="ukt-marquee__group">
      {words.map((w, i) => (
        <React.Fragment key={i}>
          <li className="ukt-marquee__word">{w}</li>
          <li className="flex">
            <StarMark className="ukt-marquee__star" />
          </li>
        </React.Fragment>
      ))}
    </ul>
  )
}

// The thin tape's words are small, so they repeat three times per copy to stay wider than the panel.
const SIGNATURE_ONCE = ['UK Textiles', 'Tirupur', 'Since 1993', 'Be in style', 'Knitwear for all segments']
const SIGNATURE = [...SIGNATURE_ONCE, ...SIGNATURE_ONCE, ...SIGNATURE_ONCE]

/**
 * Two crossed tapes straddling the hero and the story: a big butter marquee of what we make (pauses on hover, stops
 * under reduced motion) over a thin crimson one running the other way. Decorative: every word is on the page as text.
 */
export function Tapes() {
  const ref = React.useRef<HTMLDivElement>(null)
  useOffscreenFlag(ref)
  return (
    <div ref={ref} className="ukt-tapes" aria-hidden="true">
      <div className="ukt-tape ukt-tape--crimson">
        <div className="ukt-marquee__track ukt-anim">
          <MarqueeGroup words={SIGNATURE} />
          <MarqueeGroup words={SIGNATURE} />
        </div>
      </div>
      <div className="ukt-tape ukt-tape--butter">
        <div className="ukt-marquee__track ukt-anim">
          <MarqueeGroup words={MARQUEE_WORDS} />
          <MarqueeGroup words={MARQUEE_WORDS} />
        </div>
      </div>
    </div>
  )
}

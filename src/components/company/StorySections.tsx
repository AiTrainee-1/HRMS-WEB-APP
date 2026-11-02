import * as React from 'react'
import { motion } from 'framer-motion'
import {
  BadgeCheck, Building2, ChevronLeft, ChevronRight, ClipboardCheck, PencilRuler, Printer, Scissors, Sparkles, Spool, Truck,
  type LucideIcon,
} from 'lucide-react'
import { useReducedMotion } from '@/components/kit'
import {
  ABOUT_PARAGRAPHS, CERTIFICATIONS, CERTIFICATION_TEXT, FOUNDED_YEAR, GROUP_COMPANIES, PROCESS_STEPS, QUALITY_STAGES,
  QUALITY_TEXT, SEGMENTS, TAGLINES, type StepIcon,
} from '@/lib/company-about'
import { Eyebrow, Reveal, SectionTitle, StarMark } from './CompanyBits'
import { SegmentIcon, YarnToGarment } from './CompanyArt'
import { REVEAL_VIEWPORT, revealGroup, revealUp, useScrollEdges } from './hooks'

/** "— ABOUT US" on cream: the story, what we stand for (the site's taglines) and the group companies. */
export function AboutSection({ id }: { id: string }) {
  return (
    <section id={id} className="ukt-sec ukt-block--cream ukt-after-tapes scroll-mt-4" aria-labelledby={`${id}-title`}>
      <div className="grid gap-12 @4xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] @4xl:gap-16">
        <Reveal>
          <Eyebrow>About us</Eyebrow>
          <SectionTitle id={`${id}-title`} focusable before={`Since ${FOUNDED_YEAR}, garments made`} accent="with care" after="in Tirupur." />
          <div className="mt-8 flex max-w-[62ch] flex-col gap-4">
            {ABOUT_PARAGRAPHS.map((p, i) => (
              <p key={i} className={i === 0 ? 'ukt-lead ukt-text' : 'ukt-body'}>
                {p}
              </p>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.12} className="flex min-w-0 flex-col gap-8">
          <p className="ukt-outline ukt-year m-0" aria-hidden="true">
            {FOUNDED_YEAR}
          </p>
          <div>
            <h3 className="ukt-h3 mb-3 text-[19px]">What we stand for</h3>
            <ul className="ukt-tagline-list">
              {TAGLINES.slice(0, 4).map((t) => (
                <li key={t}>
                  <StarMark />
                  <span>{t}.</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="ukt-h3 mb-3 text-[19px]">Group companies</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {GROUP_COMPANIES.map((c) => (
                <li key={c} className="ukt-chip">
                  <Building2 aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const STEP_ICONS: Record<StepIcon, LucideIcon> = {
  sampling: PencilRuler,
  merchandising: ClipboardCheck,
  production: Scissors,
  embroidery: Spool,
  printing: Printer,
  value: Sparkles,
  logistics: Truck,
}

/**
 * "— HOW WE MAKE IT": the seven departments as numbered cards hanging from one thread, in a row that scrolls sideways
 * inside its own box (snap, arrow buttons, keyboard: focus the row and use the arrow keys).
 */
export function ProcessSection() {
  const scroller = React.useRef<HTMLDivElement>(null)
  const { atStart, atEnd } = useScrollEdges(scroller)
  const reduced = useReducedMotion()

  const step = (dir: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.ukt-step')
    const by = card ? card.offsetWidth + 16 : el.clientWidth * 0.8
    el.scrollBy({ left: dir * by, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <section className="ukt-sec" aria-labelledby="ukt-process-title">
      <div aria-hidden="true" className="ukt-glow ukt-glow--blue" style={{ top: '-10%', right: '-20%', width: 'max(60%, 420px)' }} />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <Reveal className="max-w-3xl">
          <Eyebrow>How we make it</Eyebrow>
          <SectionTitle id="ukt-process-title" before="From sample to shipment," accent="in seven steps." />
          <p className="ukt-lead mt-6">
            A modern, vertically integrated facility: from the latest ERP-enabled systems to the most advanced machinery,
            every garment moves through these seven departments.
          </p>
        </Reveal>
        {!(atStart && atEnd) && (
          <div className="flex gap-2">
            <button type="button" className="ukt-scroll-btn" onClick={() => step(-1)} disabled={atStart} aria-label="Show earlier steps" aria-controls="ukt-steps">
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="ukt-scroll-btn" onClick={() => step(1)} disabled={atEnd} aria-label="Show later steps" aria-controls="ukt-steps">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div ref={scroller} className="ukt-scroller mt-10" role="region" aria-label="The seven steps, in a row that scrolls sideways" tabIndex={0}>
        <div className="ukt-track">
          <motion.div
            aria-hidden="true"
            className="ukt-track__line"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.ol id="ukt-steps" className="ukt-steps" variants={revealGroup} initial="hidden" whileInView="show" viewport={REVEAL_VIEWPORT}>
            {PROCESS_STEPS.map((s) => {
              const Icon = STEP_ICONS[s.icon]
              return (
                <motion.li key={s.number} className="ukt-step" variants={revealUp}>
                  <div className="ukt-step__card ukt-lift">
                    <div className="flex items-start justify-between gap-3">
                      <span className="ukt-step__num" aria-hidden="true">
                        {s.number}
                      </span>
                      <span className="ukt-icon-ring" aria-hidden="true">
                        <Icon />
                      </span>
                    </div>
                    <h3 className="ukt-h3 ukt-step__title">
                      <span className="sr-only">Step {Number(s.number)}: </span>
                      {s.title}
                    </h3>
                    <p className="ukt-step__text">{s.text}</p>
                    <p className="ukt-step__tag">{s.tag}</p>
                  </div>
                </motion.li>
              )
            })}
          </motion.ol>
        </div>
      </div>
    </section>
  )
}

/** "— WHAT WE MAKE" on royal indigo: Men / Women / Children tiles with line drawings. */
export function ProductsSection() {
  return (
    <section className="ukt-sec ukt-block--royal" aria-labelledby="ukt-products-title">
      <Reveal className="max-w-3xl">
        <Eyebrow>What we make</Eyebrow>
        <SectionTitle id="ukt-products-title" before="Knitwear for" accent="all segments." />
        <p className="ukt-lead mt-6">
          Our specialisation is knitwear: high-fashion, value-added garments for men, women and children.
        </p>
      </Reveal>
      <motion.ul
        className="m-0 mt-10 grid list-none gap-4 p-0 @3xl:grid-cols-3 @3xl:gap-5"
        variants={revealGroup}
        initial="hidden"
        whileInView="show"
        viewport={REVEAL_VIEWPORT}
      >
        {SEGMENTS.map((s) => (
          <motion.li key={s.key} variants={revealUp}>
            <div className="ukt-tile ukt-lift">
              <span className="ukt-outline ukt-tile__letter" aria-hidden="true">
                {s.title.charAt(0)}
              </span>
              <SegmentIcon kind={s.key} className="ukt-tile__icon" />
              <h3 className="ukt-h3 ukt-tile__title">{s.title}</h3>
              <p className="ukt-body m-0 max-w-[30ch]">{s.text}</p>
              <span className="ukt-tile__tag">Knitwear</span>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  )
}

/** "— QUALITY": the quality promise, the yarn-to-garment check visual and the certificate chips. */
export function QualitySection() {
  return (
    <section className="ukt-sec" aria-labelledby="ukt-quality-title">
      <div aria-hidden="true" className="ukt-glow ukt-glow--crimson" style={{ top: '10%', left: '-30%', width: 'max(70%, 440px)' }} />
      <div className="grid gap-12 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] @4xl:items-center @4xl:gap-16">
        <Reveal>
          <Eyebrow>Quality</Eyebrow>
          <SectionTitle id="ukt-quality-title" before="Quality is" accent="a way of life." />
          <p className="ukt-lead mt-6">{QUALITY_TEXT}</p>
          <p className="ukt-body mt-4">{CERTIFICATION_TEXT}</p>
          <h3 className="ukt-h3 mt-8 mb-3 text-[19px]">Certificates &amp; approvals</h3>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {CERTIFICATIONS.map((c) => (
              <li key={c} className="ukt-chip ukt-cert">
                <BadgeCheck aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.12}>
          <figure className="ukt-qc">
            <YarnToGarment />
            <ul className="ukt-qc__labels" aria-label="Stages">
              {QUALITY_STAGES.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <figcaption>Checked at every stage</figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  )
}

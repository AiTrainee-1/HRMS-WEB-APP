import * as React from 'react'
import { animate, motion, useInView } from 'framer-motion'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import { EASE_OUT, useReducedMotion } from '@/components/kit'
import { REVEAL_VIEWPORT, revealUp } from './hooks'

// Small building blocks of the About UK Textiles page. Styling lives in company.css (scoped under .ukt-about).

/** Fades a block up the first time it scrolls into view (once). */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      variants={revealUp}
      initial="hidden"
      whileInView="show"
      viewport={REVEAL_VIEWPORT}
      custom={delay}
    >
      {children}
    </motion.div>
  )
}

/** "— ABOUT US": the mono eyebrow above a section title. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="ukt-eyebrow">
      <span aria-hidden="true">— </span>
      {children}
    </p>
  )
}

/**
 * A section's h2: heavy grotesque with ONE italic serif accent phrase. `before` + `accent` + `after` read as one
 * sentence. `focusable` lets an in-page link move focus to it (tabIndex -1).
 */
export function SectionTitle({
  id,
  before,
  accent,
  after,
  focusable,
  className,
}: {
  id: string
  before?: string
  accent: string
  after?: string
  focusable?: boolean
  className?: string
}) {
  return (
    <h2 id={id} tabIndex={focusable ? -1 : undefined} className={`ukt-display ukt-h2 ${className ?? ''}`}>
      {before}
      {before ? ' ' : ''}
      <span className="ukt-accent">{accent}</span>
      {after ? ` ${after}` : ''}
    </h2>
  )
}

/**
 * A figure that counts up from 0 the first time it is seen. The moving text is hidden from screen readers, which get
 * the final figure once; reduced motion shows the final figure at once.
 */
export function CountUp({ value, format, duration = 1.6 }: { value: number; format: (n: number) => string; duration?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  const reduced = useReducedMotion()
  const formatRef = React.useRef(format)
  formatRef.current = format

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.textContent = formatRef.current(value)
      return
    }
    if (!seen) {
      el.textContent = formatRef.current(0)
      return
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = formatRef.current(v)
      },
      onComplete: () => {
        el.textContent = formatRef.current(value)
      },
    })
    return () => controls.stop()
  }, [seen, reduced, value, duration])

  return (
    <>
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{format(value)}</span>
    </>
  )
}

/** A four-point star used as a separator (decorative). */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M12 1.5c.6 5.6 4.9 9.9 10.5 10.5-5.6.6-9.9 4.9-10.5 10.5C11.4 16.9 7.1 12.6 1.5 12 7.1 11.4 11.4 7.1 12 1.5Z" fill="currentColor" />
    </svg>
  )
}

/**
 * One way to reach the head office: a real link (tel:, mailto:, or an outside page opened in a new tab without access
 * to this one). The accessible name is "label, value" (+ "opens in a new tab").
 */
export function ContactRow({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: LucideIcon
  label: string
  value: string
  href: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      className="ukt-contact-link"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={`${label}, ${value}${external ? ' (opens in a new tab)' : ''}`}
    >
      <span className="ukt-contact-link__icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="min-w-0">
        <span className="ukt-contact-link__label">{label}</span>
        <span className="ukt-contact-link__value">{value}</span>
      </span>
      <ArrowUpRight className="ukt-contact-link__arrow" aria-hidden="true" />
    </a>
  )
}

import * as React from 'react'
import type { Variants } from 'framer-motion'
import { EASE_OUT } from '@/components/kit'
import { COMPANY_FONTS_HREF } from '@/lib/company-about'

// Motion presets and small DOM hooks for the About UK Textiles page (pages/employee/Company.tsx). Reduced motion:
// framer is gated app-wide by <MotionConfig reducedMotion="user"> (transforms dropped, opacity still fades); the CSS
// loops are stopped by company.css.

/**
 * Fade + rise for a block the first time it scrolls into view. `custom` = an extra delay in seconds; leave it out
 * inside a `revealGroup` (a child's own delay would replace the group's stagger).
 */
export const revealUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (delay?: number) => ({
    opacity: 1,
    y: 0,
    transition: delay ? { duration: 0.7, ease: EASE_OUT, delay } : { duration: 0.7, ease: EASE_OUT },
  }),
}

/** A parent whose children (each with `revealUp`) come in one after another. */
export const revealGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

/** Once, as soon as the top of the block is a little way into the viewport (works for blocks taller than the screen). */
export const REVEAL_VIEWPORT = { once: true, amount: 'some', margin: '0px 0px -12% 0px' } as const

const FONT_LINK_ID = 'ukt-about-fonts'

/**
 * Loads the page's three display fonts (Bricolage Grotesque, Instrument Serif italic, JetBrains Mono) with one
 * stylesheet <link> in <head>, only when this page is opened, and only once. The link stays after leaving the page so a
 * return visit draws them at once from cache. Until they arrive the fallback stacks in company.css are used (swap).
 */
export function useCompanyFonts(): void {
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById(FONT_LINK_ID)) return
    const already = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some((l) => l.href === COMPANY_FONTS_HREF)
    if (already) return
    const link = document.createElement('link')
    link.id = FONT_LINK_ID
    link.rel = 'stylesheet'
    link.href = COMPANY_FONTS_HREF
    document.head.appendChild(link)
  }, [])
}

/** data-tab-hidden="true" on the element while the browser tab is hidden: company.css pauses every endless loop. */
export function useTabHiddenFlag(ref: React.RefObject<HTMLElement | null>): void {
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof document === 'undefined') return
    const sync = () => el.setAttribute('data-tab-hidden', document.hidden ? 'true' : 'false')
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [ref])
}

/** data-offscreen="true" on the element while it is scrolled out of view: its CSS loops pause (no work off screen). */
export function useOffscreenFlag(ref: React.RefObject<HTMLElement | null>): void {
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (entry) el.setAttribute('data-offscreen', entry.isIntersecting ? 'false' : 'true')
      },
      { rootMargin: '120px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
}

/** Where a sideways scroller is: at its start, at its end (both when everything fits). Updated once a frame at most. */
export function useScrollEdges(ref: React.RefObject<HTMLElement | null>): { atStart: boolean; atEnd: boolean } {
  const [edges, setEdges] = React.useState({ atStart: true, atEnd: false })
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const measure = () => {
      frame = 0
      const max = el.scrollWidth - el.clientWidth
      const atStart = el.scrollLeft <= 4
      const atEnd = el.scrollLeft >= max - 4
      setEdges((prev) => (prev.atStart === atStart && prev.atEnd === atEnd ? prev : { atStart, atEnd }))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    el.addEventListener('scroll', schedule, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', schedule)
      ro?.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref])
  return edges
}

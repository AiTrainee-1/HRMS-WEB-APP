import * as React from 'react'
import { motion } from 'framer-motion'
import { EASE_OUT } from '@/components/kit/motion'
import { AUTH_COLORS, AUTH_FONTS_HREF } from '@/lib/auth-look'
import { Lightfall } from './Lightfall'
import './auth.css'

const FONT_LINK_ID = 'ukt-auth-fonts'
const WIDE_QUERY = '(min-width: 640px)'

/**
 * Sora + Manrope with one stylesheet <link> in <head>, only once a sign-in page opens, and only once. The link stays
 * after leaving so a return visit draws them at once from cache; until they arrive the fallback stacks in auth.css
 * (Plus Jakarta Sans / Inter, already loaded app-wide, then the system fonts) are used.
 */
function useAuthFonts(): void {
  React.useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(FONT_LINK_ID)) return
    const link = document.createElement('link')
    link.id = FONT_LINK_ID
    link.rel = 'stylesheet'
    link.href = AUTH_FONTS_HREF
    document.head.appendChild(link)
  }, [])
}

/** The phone browser's toolbar takes the header's deep emerald while a sign-in page is open, as the app's status bar does. */
function useThemeColor(color: string): void {
  React.useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) return
    const previous = meta.content
    meta.content = color
    return () => {
      meta.content = previous
    }
  }, [color])
}

function subscribeWide(onChange: () => void): () => void {
  const mq = window.matchMedia?.(WIDE_QUERY)
  mq?.addEventListener('change', onChange)
  return () => mq?.removeEventListener('change', onChange)
}

function isWide(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_QUERY).matches
}

/**
 * The page the three sign-in screens share, as the mobile app's AuthShell draws it: an animated emerald header (the
 * Lightfall animation over a gradient, under a soft veil) with a white sheet, rounded on top, rising over its bottom
 * edge. It only arranges things; every field, button and request stays on the page that owns it.
 *
 * Phone widths: exactly that, full-bleed; the animation sits behind the header and stops once the sheet has scrolled
 * over it. From 640px: the same composition as a phone-width column in the middle of the page, with the animation
 * filling the whole page behind it. Light in both themes (auth.css pins the palette).
 */
export function AuthShell({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const headerRef = React.useRef<HTMLElement>(null)
  const [headerOut, setHeaderOut] = React.useState(false)
  const wide = React.useSyncExternalStore(subscribeWide, isWide, () => false)

  useAuthFonts()
  useThemeColor(AUTH_COLORS.gradient[0])

  // The phone backdrop is as tall as the header (+40px under the sheet); and it can rest once the header is gone.
  React.useEffect(() => {
    const root = rootRef.current
    const head = headerRef.current
    if (!root || !head) return
    const measure = () => root.style.setProperty('--auth-header-h', `${Math.ceil(head.getBoundingClientRect().height)}px`)
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(head)
    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1]
            if (entry) setHeaderOut(!entry.isIntersecting)
          })
    io?.observe(head)
    return () => {
      ro?.disconnect()
      io?.disconnect()
    }
  }, [])

  return (
    <div ref={rootRef} className="auth-scope auth-app">
      <Lightfall className="auth-backdrop" paused={!wide && headerOut} />
      <div className="auth-stage">
        <main className="auth-column">
          <header ref={headerRef} className="auth-header">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
              {header}
            </motion.div>
          </header>
          <motion.div
            className="auth-sheet"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.06 }}
          >
            <div className="auth-grabber" aria-hidden />
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

import * as React from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'wouter'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { MangaButton, MangaCard } from '@/components/kit/manga/MangaCard'
import { useReducedMotion } from '@/components/kit/useReducedMotion'
import { authTransitions } from '@/components/transitions/auth-transitions'
import { useAuth } from '@/context/AuthContext'
import { TOUR_STEPS, cardPosition, isUsableRect, shouldAutoStart, spotlightRect, tourSeenKey, type Rect } from '@/lib/app-tour'
import { subscribeTourReplay, takeTourReplay, tourReplayPending } from './tour-replay'

const START_DELAY_MS = 1100

function readSeen(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return '1' // storage blocked: never nag
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // not remembered in this browser
  }
}

/** The first of `selectors` that is on screen now, and its box. */
function findTarget(selectors: string[] | undefined): Rect | null {
  if (!selectors?.length) return null
  const view = { width: window.innerWidth, height: window.innerHeight }
  for (const sel of selectors) {
    let nodes: NodeListOf<Element>
    try {
      nodes = document.querySelectorAll(sel)
    } catch {
      continue
    }
    for (const el of nodes) {
      const r = el.getBoundingClientRect()
      const box = { top: r.top, left: r.left, width: r.width, height: r.height }
      if (isUsableRect(box, view) && getComputedStyle(el).visibility !== 'hidden') return box
    }
  }
  return null
}

/**
 * The dashboard's welcome tour (owner 2026-11-25), in the manga card: a few short steps, each lighting up a part of the
 * page (the menu, today's punch, notifications, chat, your account) with the mascot explaining it. Shown once per person
 * on this browser after sign-in (after the sign-in transition), replayable from Help. Esc / Skip ends it; the arrow
 * keys move between steps. lib/app-tour.ts has the steps and the placement rules.
 */
export function WelcomeTour() {
  const { user } = useAuth()
  const [location] = useLocation()
  const reduced = useReducedMotion()
  const [index, setIndex] = React.useState<number | null>(null)
  const playing = React.useSyncExternalStore(authTransitions.subscribe, () => authTransitions.current() != null, () => false)
  const replayRequested = React.useSyncExternalStore(subscribeTourReplay, tourReplayPending, () => false)
  const seenKey = tourSeenKey(user?.employeeId)
  const onDashboard = /^\/employee\/dashboard\/?$/.test(location)
  const running = index != null

  // Starts by itself once (not seen yet), a moment after the dashboard is up and no transition is playing; or when Help
  // asked for a replay.
  React.useEffect(() => {
    if (!user || running || playing || !onDashboard) return
    const auto = shouldAutoStart(readSeen(seenKey), location)
    if (!auto && !replayRequested) return
    const t = window.setTimeout(() => {
      takeTourReplay()
      setIndex(0)
    }, replayRequested ? 400 : START_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [user, running, playing, onDashboard, seenKey, location, replayRequested])

  // Leaving the dashboard or signing out ends it.
  React.useEffect(() => {
    if (running && (!user || !onDashboard)) setIndex(null)
  }, [running, user, onDashboard])

  const finish = React.useCallback(() => {
    markSeen(seenKey)
    setIndex(null)
  }, [seenKey])

  if (index == null || !user) return null
  return <TourStepView key="tour" index={index} reduced={reduced} onIndex={setIndex} onFinish={finish} />
}

function TourStepView({ index, reduced, onIndex, onFinish }: { index: number; reduced: boolean; onIndex: (i: number) => void; onFinish: () => void }) {
  const step = TOUR_STEPS[index]
  const last = index === TOUR_STEPS.length - 1
  const [target, setTarget] = React.useState<Rect | null>(null)
  const [view, setView] = React.useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const [cardSize, setCardSize] = React.useState({ width: 340, height: 330 })
  const cardRef = React.useRef<HTMLDivElement>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // the focus goes back where it was when the tour ends
  React.useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    return () => before?.focus?.({ preventScroll: true })
  }, [])

  // measure the lit element (again on resize / scroll, the page may move under the tour)
  React.useLayoutEffect(() => {
    const measure = () => {
      setView({ width: window.innerWidth, height: window.innerHeight })
      setTarget(findTarget(step.targets))
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [step])

  React.useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const update = () => setCardSize({ width: el.offsetWidth, height: el.offsetHeight })
    update()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [index])

  // each step's heading takes the focus, so a screen reader reads it and Tab starts inside the card
  React.useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [index])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onFinish()
      } else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault()
        if (last) onFinish()
        else onIndex(index + 1)
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault()
        onIndex(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, last, onFinish, onIndex])

  const spot = target ? spotlightRect(target, view) : null
  const pos = cardPosition(spot, cardSize, view)
  const move = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 260, damping: 30 }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[85]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      onKeyDown={(e) => {
        // Tab stays inside the card
        if (e.key !== 'Tab') return
        const items = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href]') ?? [])
        if (!items.length) return
        const first = items[0]
        const lastItem = items[items.length - 1]
        if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
          e.preventDefault()
          lastItem.focus()
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault()
          first.focus()
        }
      }}
    >
      {spot ? (
        <motion.div
          aria-hidden="true"
          className="manga-spot pointer-events-none absolute rounded-2xl"
          initial={false}
          animate={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
          transition={move}
        />
      ) : (
        <motion.div aria-hidden="true" className="absolute inset-0 bg-[rgb(2_6_23/0.55)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      )}
      {/* the page underneath is not usable while the tour is on */}
      <div className="absolute inset-0" aria-hidden="true" />

      <motion.div
        ref={cardRef}
        className="absolute w-[min(360px,calc(100vw-24px))] pr-[10px] pb-[10px]"
        initial={false}
        animate={{ top: pos.top, left: pos.left }}
        transition={move}
      >
        <MangaCard
          key={step.key}
          bubble={step.bubble}
          mood={step.mood}
          holding={last ? 'flag' : index === 0 ? 'star' : null}
          panelHeight={124}
          mascotWidth={80}
          animateIn={index === 0}
        >
          <p className="font-label text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Step {index + 1} of {TOUR_STEPS.length}
          </p>
          <h2 id="tour-title" ref={headingRef} tabIndex={-1} className="manga-title font-label mt-0.5 text-[21px] leading-tight font-extrabold text-[var(--manga-ink)] outline-none">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1 text-[13.5px] leading-[19px] text-muted-foreground">
            {step.body}
          </p>
          <div className="mt-2.5 flex gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <span key={s.key} className={i === index ? 'h-1.5 w-5 rounded-full bg-primary' : 'size-1.5 rounded-full bg-foreground/20'} />
            ))}
          </div>
          <div className="mt-4 mr-1 mb-1 flex items-center gap-2">
            {index > 0 && (
              <MangaButton tone="plain" className="min-h-11 px-3.5" onClick={() => onIndex(index - 1)} aria-label="Previous step" icon={<ArrowLeft className="size-[18px]" aria-hidden="true" />} />
            )}
            <MangaButton
              className="min-h-11 flex-1"
              onClick={() => (last ? onFinish() : onIndex(index + 1))}
              icon={last ? <Check className="size-[18px]" aria-hidden="true" /> : undefined}
            >
              {last ? 'Done' : index === 0 ? 'Show me' : 'Next'}
              {!last && <ArrowRight className="size-[18px]" aria-hidden="true" />}
            </MangaButton>
          </div>
          {!last && (
            <button
              type="button"
              onClick={onFinish}
              className="focus-ring mx-auto mt-2 block min-h-10 rounded-full px-3 text-[13px] font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Skip the tour
            </button>
          )}
        </MangaCard>
      </motion.div>
    </div>
  )
}

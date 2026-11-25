// The full-screen moments around signing in and out (owner 2026-11-25), drawn by components/transitions/
// AuthTransitionOverlay.tsx at the app root so they outlive the page that started them. Pure (no React, no DOM):
// tested in auth-transition.test.ts.
//
// Sign-in (password or one-time code, pages/auth/Login.tsx): a portal opens from the sign-in button and covers the
// screen; only then does the app go to the dashboard (behind the cover); "Welcome back, <first name>" is revealed over
// layered rings and glowing particles, and the dashboard shows through as they fade. About 2 s. A spoken greeting
// follows the person's own sign-in click when "Spoken welcome" is on (the default; Help page).
// Sign-out (only the employee's own sign-out, context/AuthContext.tsx logout): a little character walks out through
// the door of a small home and the door closes behind them; the session ends behind the cover and the sign-in page
// shows through. About 2.3 s. Forced sign-outs (a 401, deactivation) never play it.
// Reduced motion: a plain fade, shorter. The navigation never waits on an animation: `once` runs it after a fallback
// timer whatever happens.

export interface Point {
  x: number
  y: number
}

export type AuthTransitionRequest =
  | {
      kind: 'sign-in'
      /** Where the portal opens from (the centre of the sign-in button, in window coordinates); null = low centre. */
      origin: Point | null
      /** "Priya" for "Welcome back, Priya"; '' for plain "Welcome back". */
      firstName: string
      /** Called once, when the screen is covered: go to the dashboard here. */
      onCovered: () => void
    }
  | {
      kind: 'sign-out'
      /** Called once, when the farewell covers the screen: end the session here. */
      onCovered: () => void
    }

/** The phases of a transition, in milliseconds. */
export interface Timeline {
  /** The cover comes in (the portal opens / the scene appears). */
  enterMs: number
  /** Held while the app changes pages behind it. */
  holdMs: number
  /** The cover goes, showing the new page. */
  exitMs: number
}

export function totalMs(t: Timeline): number {
  return t.enterMs + t.holdMs + t.exitMs
}

/** Sign-in: about 2 s; with reduced motion a plain fade, shorter. */
export function signInTimeline(reduceMotion: boolean): Timeline {
  return reduceMotion ? { enterMs: 200, holdMs: 700, exitMs: 300 } : { enterMs: 560, holdMs: 1000, exitMs: 480 }
}

/** Sign-out: about 2.3 s, long enough to watch the door close; with reduced motion no movement, shorter. */
export function signOutTimeline(reduceMotion: boolean): Timeline {
  return reduceMotion ? { enterMs: 220, holdMs: 800, exitMs: 280 } : { enterMs: 280, holdMs: 1650, exitMs: 380 }
}

/** If the overlay never says the screen is covered (not mounted, or it failed), go on anyway after this. */
export const SIGN_IN_FALLBACK_MS = 1200
export const SIGN_OUT_FALLBACK_MS = 900

/**
 * `fn` wrapped to run exactly once: when called, or after `fallbackMs` whatever happens. `schedule` / `cancel` are the
 * timer functions (window.setTimeout in the app, fakes in tests).
 */
export function once(
  fn: () => void,
  fallbackMs: number,
  schedule: (cb: () => void, ms: number) => unknown = (cb, ms) => setTimeout(cb, ms),
  cancel: (handle: unknown) => void = (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
): () => void {
  let done = false
  let timer: unknown = null
  const run = () => {
    if (done) return
    done = true
    if (timer != null) cancel(timer)
    fn()
  }
  timer = schedule(run, fallbackMs)
  return run
}

/** "PRIYA raman" -> "Priya"; '' when there is no usable name. */
export function firstNameOf(name: string | null | undefined): string {
  const first = String(name ?? '').trim().split(/\s+/)[0] ?? ''
  if (!first || !/\p{L}/u.test(first)) return ''
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

/** "Welcome back, Priya" / "Welcome back". */
export function welcomeLine(firstName: string): string {
  return firstName ? `Welcome back, ${firstName}` : 'Welcome back'
}

/** What the spoken greeting says. */
export function spokenWelcome(firstName: string): string {
  return firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'
}

// ── "Spoken welcome" setting (on unless turned off; this browser only) ───────

export const WELCOME_VOICE_KEY = 'uktex.welcomeVoice'

/** The stored value -> on / off. Anything but "off" is on (the default). */
export function welcomeVoiceOn(stored: string | null | undefined): boolean {
  return stored !== 'off'
}

export interface VoiceLike {
  lang: string
  name: string
  default?: boolean
  localService?: boolean
}

/**
 * The voice for the greeting: Indian English when the device has one, then any English (a local one first, so it
 * speaks at once), else null (the browser's default voice reads it).
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], prefer = 'en-IN'): T | null {
  const norm = (l: string) => l.replace('_', '-').toLowerCase()
  const want = norm(prefer)
  const exact = voices.filter((v) => norm(v.lang) === want)
  if (exact.length) return exact.find((v) => v.localService) ?? exact[0]
  const english = voices.filter((v) => norm(v.lang).startsWith('en'))
  if (!english.length) return null
  return english.find((v) => v.localService && v.default) ?? english.find((v) => v.localService) ?? english[0]
}

// ── a tiny store the overlay listens to ──────────────────────────────────────

export interface OverlayStore<T> {
  /** Asks the overlay to play `request`. False when nothing is listening (the caller then goes on without it). */
  open: (request: T) => boolean
  /** The request playing now, or null. */
  current: () => T | null
  /** The overlay says it finished. */
  close: () => void
  subscribe: (listener: () => void) => () => void
  /** Something is listening (the overlay is mounted). */
  hasListener: () => boolean
}

export function createOverlayStore<T>(): OverlayStore<T> {
  let active: T | null = null
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  return {
    open(request) {
      if (!listeners.size) return false
      active = request
      emit()
      return true
    },
    current: () => active,
    close() {
      if (active == null) return
      active = null
      emit()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    hasListener: () => listeners.size > 0,
  }
}

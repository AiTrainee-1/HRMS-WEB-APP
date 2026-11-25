import {
  SIGN_IN_FALLBACK_MS, SIGN_OUT_FALLBACK_MS, WELCOME_VOICE_KEY, createOverlayStore, once, pickVoice, spokenWelcome, welcomeVoiceOn,
  type AuthTransitionRequest, type Point,
} from '@/lib/auth-transition'

// The sign-in / sign-out transitions' controls (owner 2026-11-25). The rules are in lib/auth-transition.ts; the drawing
// is AuthTransitionOverlay.tsx (mounted once in App.tsx).

export const authTransitions = createOverlayStore<AuthTransitionRequest>()

/**
 * Plays the sign-in portal from `origin` and calls `onCovered` (go to the dashboard) exactly once: when the screen is
 * covered, or after SIGN_IN_FALLBACK_MS whatever happens - a sign-in never waits on an animation.
 */
export function playSignIn(origin: Point | null, firstName: string, onCovered: () => void): void {
  const run = once(onCovered, SIGN_IN_FALLBACK_MS)
  if (!authTransitions.open({ kind: 'sign-in', origin, firstName, onCovered: run })) run()
}

/** Plays the walk-out-of-the-door farewell and calls `onCovered` (end the session) exactly once, the same way. */
export function playSignOut(onCovered: () => void): void {
  const run = once(onCovered, SIGN_OUT_FALLBACK_MS)
  if (!authTransitions.open({ kind: 'sign-out', onCovered: run })) run()
}

/** A transition is on screen (a sign-out already under way ignores a second click). */
export function transitionPlaying(kind?: AuthTransitionRequest['kind']): boolean {
  const cur = authTransitions.current()
  return !!cur && (!kind || cur.kind === kind)
}

/** The centre of an element, in window coordinates (where the portal opens from). */
export function centreOf(el: Element | null | undefined): Point | null {
  if (!el || typeof (el as HTMLElement).getBoundingClientRect !== 'function') return null
  const r = el.getBoundingClientRect()
  if (!r.width && !r.height) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// ── the spoken welcome ───────────────────────────────────────────────────────

export function readWelcomeVoice(): boolean {
  try {
    return welcomeVoiceOn(localStorage.getItem(WELCOME_VOICE_KEY))
  } catch {
    return true
  }
}

export function saveWelcomeVoice(on: boolean): void {
  try {
    localStorage.setItem(WELCOME_VOICE_KEY, on ? 'on' : 'off')
  } catch {
    // not remembered in this browser: the default (on) stays
  }
}

function speech(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null
}

/**
 * Call synchronously inside the sign-in click / submit: browsers let a page speak only after the person's own gesture
 * (Safari needs the first utterance inside it), so a silent one is queued here, and the voices start loading.
 */
export function unlockSpeech(): void {
  const s = speech()
  if (!s || !readWelcomeVoice()) return
  try {
    s.getVoices()
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    s.speak(u)
  } catch {
    // no speech here: the welcome stays silent
  }
}

/** "Welcome back, Priya." in Indian English when the device has that voice. Silent when the setting is off. */
export function speakWelcome(firstName: string): void {
  const s = speech()
  if (!s || !readWelcomeVoice()) return
  try {
    const u = new SpeechSynthesisUtterance(spokenWelcome(firstName))
    const voice = pickVoice(s.getVoices())
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'en-IN'
    u.rate = 1
    u.pitch = 1.05
    u.volume = 1
    s.speak(u)
  } catch {
    // speaking is a nicety: never let it disturb the sign-in
  }
}

/** Stops a greeting that is still talking (a sign-out right after signing in). */
export function stopSpeaking(): void {
  try {
    speech()?.cancel()
  } catch {
    // nothing to stop
  }
}

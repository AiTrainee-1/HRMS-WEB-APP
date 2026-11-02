// The look of the three sign-in pages (Login, Set Password, Forgot Password), copied from the Employee mobile app
// (src/components/auth/authTheme.ts + lightfallHtml.ts there), and the small rules those pages need.
//
// Pure on purpose (no React, no DOM): Node's test runner loads it directly, see auth-look.test.ts.

/** The web app's own version, shown in the small chip on the sign-in header (the mobile app shows its version there).
 *  Kept equal to package.json's "version" by auth-look.test.ts. */
export const WEB_APP_VERSION = '2.0.0'
export const WEB_APP_VERSION_LABEL = `v${WEB_APP_VERSION}`

/** The mobile app's sign-in colours (authTheme.ts AuthColors), one for one. */
export const AUTH_COLORS = {
  /** The header's base gradient: deep emerald to teal. The Lightfall animation is drawn over it. */
  gradient: ['#043B35', '#0B7A6B', '#14B8A6'],
  accent: '#0E9F8E',
  accentDark: '#0B6E63',
  accentSoft: '#E6F7F4',
  /** The button's pill, and the circle that holds its dotted arrow. */
  pill: '#0A2E2B',
  pillCircle: '#5EEAD4',
  /** Lightfall streak colours: mint, teal and white against the emerald header. */
  streaks: ['#A7F3D0', '#5EEAD4', '#FFFFFF'],
  glow: '#0F766E',
} as const

/** What the animation is drawn over, and the whole look when it cannot run (no WebGL, or reduced motion). The same
 *  gradient the mobile app's Lightfall page paints (lightfallHtml.ts). */
export const AUTH_BACKDROP_GRADIENT = `linear-gradient(160deg, ${AUTH_COLORS.gradient[0]} 0%, ${AUTH_COLORS.gradient[1]} 55%, ${AUTH_COLORS.gradient[2]} 100%)`

/** The two fonts of the sign-in pages (the mobile app's AuthFont): Sora for headlines, buttons and labels, Manrope for
 *  sentences and field text. Loaded only while a sign-in page is open. */
export const AUTH_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Sora:wght@600;700&display=swap'

// ---- Lightfall -------------------------------------------------------------------------------------------------

/** The props of the React Bits <Lightfall /> that the sign-in header uses (no mouse: it follows nothing). */
export interface LightfallSettings {
  colors: readonly string[]
  backgroundColor: string
  speed: number
  streakCount: number
  streakWidth: number
  streakLength: number
  glow: number
  density: number
  twinkle: number
  zoom: number
  backgroundGlow: number
  opacity: number
  /** Most canvas pixels per CSS pixel. A soft-light background needs only a fraction of the screen's pixels. */
  dpr: number
  /** Frames drawn per second at most. */
  fps: number
}

/** The mobile app's settings (lightfallHtml.ts AUTH_LIGHTFALL), one for one. */
export const AUTH_LIGHTFALL: LightfallSettings = {
  colors: AUTH_COLORS.streaks,
  backgroundColor: AUTH_COLORS.glow,
  speed: 1,
  streakCount: 6,
  streakWidth: 1,
  streakLength: 1,
  glow: 0.85,
  density: 1,
  twinkle: 1,
  zoom: 2,
  backgroundGlow: 1,
  opacity: 1,
  dpr: 0.7,
  fps: 30,
}

/** A device that should do less (2 or fewer cores, 2 GB or less memory, Data Saver): fewer frames, fewer pixels. */
export const LOW_POWER_LIGHTFALL = { dpr: 0.5, fps: 20 } as const

/** At most this many canvas pixels are drawn per frame. A phone header stays at the full 0.7 (about 80 000 pixels);
 *  a whole desktop page drops below it, so a large screen costs about what a laptop does. */
export const LIGHTFALL_PIXEL_BUDGET = 520_000

/** Below this the streaks get too soft to read as streaks. */
export const LIGHTFALL_MIN_DPR = 0.35

/**
 * Canvas pixels per CSS pixel for a canvas of this CSS size: `cap` (0.7) unless that would draw more than `budget`
 * pixels, then just enough to stay inside it, never below LIGHTFALL_MIN_DPR (or `cap`, if that is lower). Nonsense
 * sizes get `cap`.
 */
export function lightfallDpr(cssWidth: number, cssHeight: number, cap = AUTH_LIGHTFALL.dpr, budget = LIGHTFALL_PIXEL_BUDGET): number {
  const safeCap = Number.isFinite(cap) && cap > 0 ? cap : AUTH_LIGHTFALL.dpr
  const area = cssWidth * cssHeight
  if (!Number.isFinite(area) || area <= 0 || !Number.isFinite(budget) || budget <= 0) return safeCap
  const fit = Math.sqrt(budget / area)
  const floor = Math.min(LIGHTFALL_MIN_DPR, safeCap)
  return Math.round(Math.max(floor, Math.min(safeCap, fit)) * 1000) / 1000
}

/** Whether a frame is due at `now` (ms) when the last one was drawn at `lastDraw`, for at most `fps` frames a second.
 *  A millisecond of slack so a 60 Hz screen draws every second frame for 30 fps instead of skipping to every third. */
export function frameDue(now: number, lastDraw: number, fps: number): boolean {
  if (!(fps > 0) || !Number.isFinite(fps)) return true
  return now - lastDraw >= 1000 / fps - 1
}

export type Rgb = [number, number, number]

/** '#5EEAD4' -> [0.37, 0.92, 0.83] (0..1 channels). Short or broken values are padded with 0, as in the original. */
export function hexToRgb(hex: string): Rgb {
  const c = String(hex ?? '').replace('#', '').padEnd(6, '0')
  const channel = (from: number) => {
    const n = parseInt(c.slice(from, from + 2), 16)
    return Number.isFinite(n) ? n / 255 : 0
  }
  return [channel(0), channel(2), channel(4)]
}

/** The shader takes exactly 8 colour slots: the given colours (at most 8), the last one repeated to fill the rest. */
export function prepColors(input: readonly string[] | null | undefined, slots = 8): { arr: Rgb[]; count: number } {
  const base = (input && input.length ? input : ['#A6C8FF', '#5227FF', '#FF9FFC']).slice(0, slots)
  const arr: Rgb[] = []
  for (let i = 0; i < slots; i++) arr.push(hexToRgb(base[Math.min(i, base.length - 1)]))
  return { arr, count: base.length }
}

// ---- Set password -----------------------------------------------------------------------------------------------

/**
 * The checklist under a new password (the mobile app's PASSWORD_RULES). Advisory only: the server's rule is "8
 * characters minimum", which is what actually gates the button; the other two only help choose a stronger password.
 */
export const PASSWORD_RULES: readonly { label: string; test: (password: string) => boolean }[] = [
  { label: 'At least 8 characters long', test: (p) => p.length >= 8 },
  { label: 'Includes uppercase & lowercase letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { label: 'Contains at least 1 number or special symbol', test: (p) => /[0-9\W]/.test(p) },
]

// ---- Sign-in failures -------------------------------------------------------------------------------------------

/**
 * A failed sign-in (or password setup) as the screen shows it, from the error's HTTP status:
 *  'rejected'  the server answered and said no (wrong password, unknown code, too many attempts): the notice dialog
 *  'server'    the server never answered, or answered 5xx: an inline note plus the software-support contact
 */
export function signInFailureKind(status: unknown): 'rejected' | 'server' {
  if (typeof status !== 'number' || !Number.isFinite(status)) return 'server'
  return status >= 500 ? 'server' : 'rejected'
}

// "Your location is off / blocked" in ONE place (owner 2026-11-25, the mobile app's src/lib/locationOff.ts for the
// browser): what went wrong with a location request, what the popup says for each feature, and the steps to turn it on
// in the browser and device the person is using. Pure (no DOM): tested in location-off.test.ts. The popup is
// components/system/LocationOffPopup.tsx; getPosition() in hooks/useLocationPrompt.ts raises the errors read here.

/** Which feature needs the location: decides the popup's explanation. */
export type LocationReason = 'punch' | 'on_duty' | 'general'

/** Why the browser gave no position. */
export type LocationProblem = 'blocked' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure'

/** A failed location request, with why. */
export class LocationError extends Error {
  readonly problem: LocationProblem
  constructor(problem: LocationProblem, message: string) {
    super(message)
    this.name = 'LocationError'
    this.problem = problem
  }
}

/** The W3C GeolocationPositionError codes. */
const PERMISSION_DENIED = 1
const POSITION_UNAVAILABLE = 2
const TIMEOUT = 3

/** A GeolocationPositionError's code as a problem. */
export function problemFromCode(code: number | null | undefined): LocationProblem {
  if (code === PERMISSION_DENIED) return 'blocked'
  if (code === POSITION_UNAVAILABLE) return 'unavailable'
  if (code === TIMEOUT) return 'timeout'
  return 'unavailable'
}

/** The sentence a failed request carries (shown inline / in a toast when no popup is shown). */
export function problemMessage(problem: LocationProblem): string {
  switch (problem) {
    case 'blocked':
      return "Location access is blocked. Allow it in your browser's site settings, then try again."
    case 'unsupported':
      return 'Location is not supported on this device or browser.'
    case 'insecure':
      return 'Location only works on the secure (https) address of the Employee Portal.'
    case 'timeout':
      return 'Finding your location took too long. Move to an open area and try again.'
    default:
      return "Your device's location is off or could not be found. Turn it on, then try again."
  }
}

/** The problem behind an error a location request threw; null when it is not a location error. */
export function locationProblemOf(err: unknown): LocationProblem | null {
  if (err instanceof LocationError) return err.problem
  if (typeof err === 'object' && err !== null) {
    const { problem, code } = err as { problem?: unknown; code?: unknown }
    if (problem === 'blocked' || problem === 'unavailable' || problem === 'timeout' || problem === 'unsupported' || problem === 'insecure') {
      return problem
    }
    // a raw GeolocationPositionError
    if (typeof code === 'number' && 'PERMISSION_DENIED' in (err as object)) return problemFromCode(code)
  }
  return null
}

/** Whether the popup should open for this problem (a timeout just says "try again" where it happened). */
export function showsPopup(problem: LocationProblem | null): boolean {
  return problem === 'blocked' || problem === 'unavailable' || problem === 'unsupported' || problem === 'insecure'
}

// ── the words ────────────────────────────────────────────────────────────────

export type BrowserFamily = 'chrome' | 'edge' | 'firefox' | 'safari' | 'samsung' | 'other'
export type DeviceFamily = 'android' | 'ios' | 'windows' | 'mac' | 'other'

/** The browser and device from a user-agent string (only to pick which steps to show). */
export function detectPlatform(ua: string | null | undefined): { browser: BrowserFamily; device: DeviceFamily } {
  const s = String(ua ?? '')
  const device: DeviceFamily = /Android/i.test(s)
    ? 'android'
    : /iPhone|iPad|iPod/i.test(s)
      ? 'ios'
      : /Windows/i.test(s)
        ? 'windows'
        : /Macintosh|Mac OS X/i.test(s)
          ? 'mac'
          : 'other'
  const browser: BrowserFamily = /SamsungBrowser/i.test(s)
    ? 'samsung'
    : /Edg(e|A|iOS)?\//i.test(s)
      ? 'edge'
      : /Firefox|FxiOS/i.test(s)
        ? 'firefox'
        : /Chrome|CriOS|Chromium/i.test(s)
          ? 'chrome'
          : /Safari/i.test(s)
            ? 'safari'
            : 'other'
  return { browser, device }
}

export interface LocationOffCopy {
  /** The speech bubble. */
  bubble: string
  title: string
  body: string
  /** Numbered steps to turn it on. */
  steps: string[]
  /** The stamp on the panel. */
  stamp: string
}

const WHY: Record<LocationReason, string> = {
  punch: 'We check that you are at your branch before your punch is recorded.',
  on_duty: 'Each On-Duty punch is recorded at the place you are.',
  general: 'This needs to know where you are.',
}

function siteSteps(browser: BrowserFamily, device: DeviceFamily): string[] {
  if (device === 'ios') {
    return browser === 'safari' || browser === 'other'
      ? [
          'Tap “aA” (or the page icon) at the left of the address bar, then Website Settings.',
          'Set Location to Allow.',
          'If it is still blocked: iPhone Settings → Privacy & Security → Location Services → Safari Websites → While Using.',
        ]
      : [
          'Open iPhone Settings → Privacy & Security → Location Services, and make sure it is on.',
          `Scroll to ${browser === 'chrome' ? 'Chrome' : browser === 'edge' ? 'Edge' : 'your browser'} and choose While Using the App.`,
        ]
  }
  if (browser === 'firefox') {
    return [
      'Click the map / lock icon at the left of the address bar.',
      'Next to “Access your location”, remove the block (click the ×).',
    ]
  }
  if (browser === 'safari') {
    return ['Open Safari → Settings for This Website (or Settings → Websites → Location).', 'Set this site to Allow.']
  }
  return [
    device === 'android' ? 'Tap the icon at the left of the address bar, then Permissions (or Site settings).' : 'Click the icon at the left of the address bar (the lock or the settings sliders).',
    'Set Location to Allow.',
  ]
}

function deviceSteps(device: DeviceFamily): string[] {
  switch (device) {
    case 'android':
      return ['Swipe down from the top of the screen and turn on Location.', 'Keep this page open and tap Try again.']
    case 'ios':
      return ['Open Settings → Privacy & Security → Location Services and turn it on.', 'Come back here and tap Try again.']
    case 'windows':
      return ['Open Windows Settings → Privacy & security → Location.', 'Turn on Location services and “Let desktop apps access your location”.']
    case 'mac':
      return ['Open System Settings → Privacy & Security → Location Services.', 'Turn it on, and turn it on for your browser.']
    default:
      return ["Turn on your device's location (GPS).", 'Then try again.']
  }
}

/** What the popup says for this problem, feature and device. */
export function locationOffCopy(problem: LocationProblem, reason: LocationReason = 'general', ua?: string | null): LocationOffCopy {
  const { browser, device } = detectPlatform(ua)
  const why = WHY[reason] ?? WHY.general
  switch (problem) {
    case 'blocked': {
      const steps = siteSteps(browser, device)
      return {
        bubble: 'I can’t see where you are!',
        title: 'Location is blocked',
        body: `This browser is not allowed to share your location with the Employee Portal. ${why}`,
        steps: [...steps, 'Come back to this page and press Try again.'],
        stamp: 'BLOCKED',
      }
    }
    case 'unsupported':
      return {
        bubble: 'Hmm, no location here…',
        title: 'Location isn’t available',
        body: `This browser cannot share a location. ${why}`,
        steps: ['Open the Employee Portal in an up-to-date Chrome, Edge, Firefox or Safari.', 'Or use the UKTextiles mobile app.'],
        stamp: 'NO GPS',
      }
    case 'insecure':
      return {
        bubble: 'Wrong address!',
        title: 'Use the secure address',
        body: `Browsers share your location only with secure (https) pages. ${why}`,
        steps: ['Open the Employee Portal with its https:// address.', 'Then try again.'],
        stamp: 'NOT HTTPS',
      }
    default:
      return {
        bubble: 'Your location is off!',
        title: 'Turn on your location',
        body: `Your device did not give a location - its location (GPS) may be switched off. ${why}`,
        steps: deviceSteps(device),
        stamp: 'LOCATION OFF',
      }
  }
}

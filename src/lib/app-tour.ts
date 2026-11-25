// The welcome tour of the dashboard (owner 2026-11-25: the web app had no first-run tour, so a short one, in the manga
// card the mobile app's update prompt uses). Shown once per person on this browser after they sign in, replayable from
// Help. A step either points at a real part of the page (`targets`: the first one visible on this screen size is lit by
// a spotlight and the card sits beside it) or is a card in the middle. Pure (no DOM): tested in app-tour.test.ts; the
// drawing is components/system/WelcomeTour.tsx.

/** The mascot's face on a step (the same names as kit/manga/MangaMascot). */
export type TourMood = 'happy' | 'excited' | 'worried'

export interface TourStep {
  key: string
  title: string
  body: string
  /** The speech bubble. */
  bubble: string
  mood: TourMood
  /** CSS selectors of the element to light up, best first (desktop and phone layouts differ). None = centred card. */
  targets?: string[]
}

/** Bump to show a changed tour once more to everybody. */
export const TOUR_VERSION = 1

export const TOUR_STEPS: TourStep[] = [
  {
    key: 'welcome',
    title: 'Welcome to the Employee Portal',
    body: 'A quick look around your dashboard in a few short steps. You can skip it any time, and replay it from Help.',
    bubble: 'Hi! I’m Spool!',
    mood: 'excited',
  },
  {
    key: 'menu',
    title: 'Everything is in the menu',
    body: 'Attendance, leave, permissions, outpass, On-Duty, salary, documents and more. Open any page from here.',
    bubble: 'Start here!',
    mood: 'happy',
    targets: ['aside nav[aria-label="Main"]', 'button[aria-label="Open menu"]', 'nav[aria-label="Main tabs"]'],
  },
  {
    key: 'punch',
    title: 'Your punches today',
    body: 'See your last punch at a glance. Attendance shows your month, and Attendance Request records a geo punch from your phone.',
    bubble: 'Punched in?',
    mood: 'happy',
    targets: ['header a[href="/employee/attendance"]', 'nav[aria-label="Main tabs"] a[href="/employee/attendance"]', 'aside a[href="/employee/attendance"]'],
  },
  {
    key: 'bell',
    title: 'Notifications',
    body: 'Approvals, reminders and messages from HR arrive here. A number means something is still unread.',
    bubble: 'Ding ding!',
    mood: 'excited',
    targets: ['header button[aria-label^="Notifications"]', 'header a[href^="/employee/notifications"]', 'a[href="/employee/notifications"]'],
  },
  {
    key: 'chat',
    title: 'Team Chat',
    body: 'Talk with the whole company or your department - messages, GIFs and voice notes.',
    bubble: 'Say hello!',
    mood: 'happy',
    targets: ['aside a[href="/employee/chat"]', 'nav[aria-label="Main tabs"] a[href="/employee/chat"]'],
  },
  {
    key: 'account',
    title: 'You, your profile and Help',
    body: 'Your profile, Digital ID, dark mode and sign out live here. Help has contacts, answers and this tour again.',
    bubble: 'That’s you!',
    mood: 'happy',
    targets: ['header button[aria-label^="Your account"]', 'a[aria-label="My Profile"]'],
  },
  {
    key: 'done',
    title: 'You’re all set!',
    body: 'Have a great day at UKTextiles. If anything is unclear, the Help page is one click away.',
    bubble: 'Let’s go!',
    mood: 'excited',
  },
]

/** The per-person "seen it" key (this browser only). */
export function tourSeenKey(employeeId: string | number | null | undefined, version = TOUR_VERSION): string {
  return `uktex.tour.v${version}.${employeeId ?? 'anon'}`
}

/** Whether the tour shows by itself: not seen by this person, on the dashboard. */
export function shouldAutoStart(seenValue: string | null | undefined, path: string): boolean {
  return !seenValue && /^\/employee\/dashboard\/?$/.test(path)
}

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

/** True when a box is on screen and big enough to point at. */
export function isUsableRect(r: Rect | null | undefined, view: Viewport): boolean {
  if (!r || r.width < 8 || r.height < 8) return false
  return r.left < view.width && r.top < view.height && r.left + r.width > 0 && r.top + r.height > 0
}

/** The spotlight box: the element's box padded, kept inside the screen. */
export function spotlightRect(r: Rect, view: Viewport, pad = 6): Rect {
  const left = Math.max(4, r.left - pad)
  const top = Math.max(4, r.top - pad)
  const right = Math.min(view.width - 4, r.left + r.width + pad)
  const bottom = Math.min(view.height - 4, r.top + r.height + pad)
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

/**
 * Where the card goes next to a lit element: beside it (right, else left) when there is room, else below, else above;
 * always inside the screen with a 12px margin. Phones (narrow screens) get the card along the bottom or the top.
 */
export function cardPosition(target: Rect | null, card: { width: number; height: number }, view: Viewport, gap = 16): { top: number; left: number } {
  const m = 12
  const clampX = (x: number) => Math.max(m, Math.min(view.width - card.width - m, x))
  const clampY = (y: number) => Math.max(m, Math.min(view.height - card.height - m, y))
  if (!target) return { left: clampX((view.width - card.width) / 2), top: clampY((view.height - card.height) / 2) }
  const right = target.left + target.width + gap
  const midY = clampY(target.top + target.height / 2 - card.height / 2)
  if (view.width >= 768) {
    if (right + card.width + m <= view.width) return { left: right, top: midY }
    const left = target.left - gap - card.width
    if (left >= m) return { left, top: midY }
  }
  const below = target.top + target.height + gap
  if (below + card.height + m <= view.height) return { left: clampX(target.left + target.width / 2 - card.width / 2), top: below }
  const above = target.top - gap - card.height
  if (above >= m) return { left: clampX(target.left + target.width / 2 - card.width / 2), top: above }
  return { left: clampX((view.width - card.width) / 2), top: clampY(view.height - card.height - m) }
}

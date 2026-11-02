// The gate pass that is "open right now", pinned at the top of the Outpass page (owner, 2026-10-31: "The currently
// opened gate pass should be displayed at the top"), and the clock it shows. Mirrors the mobile app's
// src/lib/outpassOpen.ts. Pure, tested in outpass-open.test.ts.
//
// Open means one of:
//   out      - the employee went out through the gate and has not come back yet (no matter how long ago);
//   ready    - approved, not used yet, and its 60-minute exit window is still running (the exit QR is live).
// An "out" pass always wins over a "ready" one; within a kind the newest wins.

export type OpenPassInput = {
  id: number | string
  status: string
  approvedAt?: string | null
  expiresAt?: string | null
  exitedAt?: string | null
  enteredAt?: string | null
  expectedReturnAt?: string | null
  createdAt: string
}

export type OpenPassKind = 'out' | 'ready'

function ms(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

export function openKind(p: OpenPassInput, nowMs: number): OpenPassKind | null {
  if (String(p.status).toLowerCase() !== 'approved') return null
  if (p.exitedAt && !p.enteredAt) return 'out'
  if (p.exitedAt) return null // went out and came back: done
  const exp = ms(p.expiresAt)
  return exp != null && exp > nowMs ? 'ready' : null
}

/** The pass to pin, or null when nothing is open. */
export function pickOpenPass<T extends OpenPassInput>(items: readonly T[], nowMs: number): T | null {
  let best: { item: T; rank: number; at: number } | null = null
  for (const item of items) {
    const kind = openKind(item, nowMs)
    if (!kind) continue
    const rank = kind === 'out' ? 2 : 1
    const at = ms(kind === 'out' ? item.exitedAt : item.approvedAt) ?? ms(item.createdAt) ?? 0
    if (!best || rank > best.rank || (rank === best.rank && at > best.at)) best = { item, rank, at }
  }
  return best?.item ?? null
}

export type OpenPassClock =
  | {
      kind: 'out'
      /** Since the employee went out through the gate. */
      elapsedMs: number
      /** Time left until the expected return (negative once late); null when no return time was given. */
      returnInMs: number | null
      overdue: boolean
      /** 0..1 of the way from going out to the expected return (1 once late); null without a return time. */
      progress: number | null
    }
  | {
      kind: 'ready'
      /** Time left to go out through the gate before the pass expires. */
      exitWindowMs: number
      /** 0..1 of the 60-minute window already used. */
      progress: number
    }

export const EXIT_WINDOW_MS = 60 * 60 * 1000

export function openPassClock(p: OpenPassInput, nowMs: number): OpenPassClock | null {
  const kind = openKind(p, nowMs)
  if (kind === 'out') {
    const out = ms(p.exitedAt) ?? nowMs
    const back = ms(p.expectedReturnAt)
    const elapsedMs = Math.max(0, nowMs - out)
    if (back == null || back <= out) return { kind, elapsedMs, returnInMs: null, overdue: false, progress: null }
    const returnInMs = back - nowMs
    return {
      kind,
      elapsedMs,
      returnInMs,
      overdue: returnInMs < 0,
      progress: Math.min(1, Math.max(0, elapsedMs / (back - out))),
    }
  }
  if (kind === 'ready') {
    const exp = ms(p.expiresAt) ?? nowMs
    const exitWindowMs = Math.max(0, exp - nowMs)
    return { kind, exitWindowMs, progress: Math.min(1, Math.max(0, 1 - exitWindowMs / EXIT_WINDOW_MS)) }
  }
  return null
}

export type OutpassRowLabel = { label: string; tone: 'waiting' | 'approved' | 'rejected' | 'info' | 'neutral' | 'live' }

/**
 * The plain-English pill of a pass in the list, from its status and where it is at the gate (`scanStatus`):
 * Waiting / Not approved / Ready to use / Out now / Returned / Not used (the 60 minutes ran out) / Approved.
 */
export function outpassRowLabel(p: { status: string; scanStatus?: string | null; exitedAt?: string | null; enteredAt?: string | null }): OutpassRowLabel {
  const s = String(p.status).toLowerCase()
  if (s === 'pending') return { label: 'Waiting', tone: 'waiting' }
  if (s === 'rejected') return { label: 'Not approved', tone: 'rejected' }
  if (s !== 'approved') return { label: p.status, tone: 'neutral' }
  switch (p.scanStatus) {
    case 'pending_exit':
      return { label: 'Ready to use', tone: 'live' }
    case 'exited':
    case 'pending_return':
    case 'return_expired':
      return { label: 'Out now', tone: 'waiting' }
    case 'completed':
      return { label: 'Returned', tone: 'approved' }
    case 'expired_unscanned':
      return { label: 'Not used', tone: 'neutral' }
    default:
      if (p.enteredAt) return { label: 'Returned', tone: 'approved' }
      if (p.exitedAt) return { label: 'Out now', tone: 'waiting' }
      return { label: 'Approved', tone: 'approved' }
  }
}

/** "1 h 05 min", "12 min", "45 s" - the length of a stretch of time in plain words. */
export function formatSpan(spanMs: number): string {
  const total = Math.max(0, Math.floor(Math.abs(spanMs) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  if (m > 0) return `${m} min`
  return `${s} s`
}

/** "mm:ss" (or "h:mm:ss") for a ticking clock. */
export function formatTicker(spanMs: number): string {
  const total = Math.max(0, Math.floor(Math.abs(spanMs) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/**
 * The phone view's ticking figure, kept short however long the stretch: "52 d 18 h" from a day up, "4 h 12 m" from an
 * hour up, and the ticking "mm:ss" (formatTicker) only under an hour. A pass left open for weeks never reads "1266:43:42".
 */
export function formatTickerShort(spanMs: number): string {
  const total = Math.max(0, Math.floor(Math.abs(spanMs) / 1000))
  const d = Math.floor(total / 86_400)
  if (d > 0) return `${d} d ${Math.floor((total % 86_400) / 3600)} h`
  if (total >= 3600) return `${Math.floor(total / 3600)} h ${Math.floor((total % 3600) / 60)} m`
  return formatTicker(spanMs)
}

/** formatSpan for the phone view: days from a day up ("52 d 18 h"), otherwise the same words ("1 h 05 min", "12 min"). */
export function formatSpanShort(spanMs: number): string {
  const total = Math.max(0, Math.floor(Math.abs(spanMs) / 1000))
  const d = Math.floor(total / 86_400)
  if (d > 0) return `${d} d ${Math.floor((total % 86_400) / 3600)} h`
  return formatSpan(spanMs)
}

/**
 * The expected return as an ISO time from the "Back by" clock time picked on the form: today at that time, or tomorrow
 * when that time has already passed (asked at 11 PM, back at 1 AM). Null for an empty or bad time.
 */
export function expectedReturnIso(hhmm: string, sentAt: Date): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null
  const back = new Date(sentAt)
  back.setHours(Number(m[1]), Number(m[2]), 0, 0)
  if (back.getTime() <= sentAt.getTime()) back.setDate(back.getDate() + 1)
  return back.toISOString()
}

export type OutpassPassType = 'official' | 'personal' | 'early_dismissal'

export const PASS_TYPES: readonly { value: OutpassPassType; label: string; hint: string }[] = [
  { value: 'official', label: 'Official / Mill Duty', hint: 'Client visit, sampling, delivery or bank courier' },
  { value: 'personal', label: 'Personal Emergency', hint: 'Medical, urgent errand or family emergency' },
  { value: 'early_dismissal', label: 'Early Shift Dismissal', hint: 'Leaving before your shift ends, with permission' },
]

export function passTypeLabel(value: string | null | undefined): string | null {
  return PASS_TYPES.find((t) => t.value === value)?.label ?? null
}

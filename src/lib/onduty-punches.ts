// The four On-Duty punches as the redesigned On-Duty page shows them (owner 2026-11-24): named, with the time each is
// expected, each one selectable on its own (any order), and what has happened to it. Mirrors the mobile app's
// src/lib/onDutyPunches.ts (without its offline queue: the web sends at once). Pure; tested in onduty-punches.test.ts.
//
// The server's `punchSlots` (GET /on-duty-sessions/status) is the truth for the day's four slots: it also knows punches
// from the biometric device / Office Geo Punch. Since 2026-11-24 it names each slot and gives its expected time from the
// employee's shift (backend geo_attendance_views.expected_slot_times); an older server sends neither and the defaults
// below are used.

export type PunchNumber = 1 | 2 | 3 | 4

export const PUNCH_NAMES: Record<PunchNumber, string> = {
  1: 'Morning Punch',
  2: 'Lunch Out',
  3: 'Lunch In',
  4: 'Night Punch',
}

export const PUNCH_HINTS: Record<PunchNumber, string> = {
  1: 'When your shift starts',
  2: 'When you go for lunch',
  3: 'When you are back from lunch',
  4: 'When your shift ends',
}

const DEFAULT_EXPECTED: Record<PunchNumber, string> = { 1: '09:00', 2: '13:00', 3: '14:00', 4: '18:00' }

export interface ServerSlotLike {
  punchNumber: number
  punchType: 'IN' | 'OUT'
  status: 'available' | 'pending' | 'approved' | 'recorded' | string
  available: boolean
  name?: string | null
  expectedTime?: string | null
  expectedSource?: 'shift' | 'default' | string | null
  punchTime?: string | null
  punchSource?: string | null
}

export interface VerificationLike {
  punchNumber: number
  punchTime: string
  status: 'pending' | 'approved' | 'rejected' | string
  hrReviewComment?: string | null
}

export type TileState = 'open' | 'done'

export interface PunchTile {
  punchNumber: PunchNumber
  name: string
  hint: string
  kind: 'IN' | 'OUT'
  /** "9:00 AM" (from the shift, or the usual day). */
  expected: string | null
  expectedFromShift: boolean
  state: TileState
  /** The server's slot status of a done punch: 'pending' | 'approved' | 'recorded'; null while open. */
  doneStatus: 'pending' | 'approved' | 'recorded' | null
  /** "9:05 AM" when it is in. */
  time: string | null
  /** "Waiting for HR", "Approved", "Recorded by the biometric", "Not recorded yet" ... */
  statusLabel: string
  /** A note under it ("HR rejected this punch: ..." on a punch that must be taken again). */
  note: string | null
  /** Can be recorded now. */
  selectable: boolean
}

/** "13:45" or "13:45:10" -> "1:45 PM"; anything else -> null. */
export function clock12(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  if (h > 23) return null
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${suffix}`
}

/** "9:05 AM" of an ISO time, in the device's own clock; null for a missing or bad value. */
export function clockOfIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const d = new Date(t)
  return clock12(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
}

export function punchSourceLabel(source: string | null | undefined): string {
  const s = String(source ?? '')
  if (s.startsWith('geo')) return 'Recorded by Office Geo Punch'
  if (s === 'manual') return 'Entered by HR'
  if (s.startsWith('missing_punch')) return 'From a missing-punch request'
  if (s === 'on_duty') return 'On-Duty punch'
  return 'Recorded by the biometric'
}

export function buildPunchTiles(input: {
  slots: readonly ServerSlotLike[] | null | undefined
  verifications?: readonly VerificationLike[] | null
  /** False while the session cannot take punches (ended, rejected, none). */
  canPunch: boolean
}): PunchTile[] {
  const byNumber = new Map<number, ServerSlotLike>()
  for (const s of input.slots ?? []) byNumber.set(Number(s.punchNumber), s)
  // The verifications come oldest first per punch: the last one of a number is its latest.
  const latest = new Map<number, VerificationLike>()
  for (const v of input.verifications ?? []) latest.set(Number(v.punchNumber), v)

  return ([1, 2, 3, 4] as PunchNumber[]).map((n): PunchTile => {
    const slot = byNumber.get(n)
    const base = {
      punchNumber: n,
      name: slot?.name || PUNCH_NAMES[n],
      hint: PUNCH_HINTS[n],
      kind: (slot?.punchType ?? (n % 2 === 1 ? 'IN' : 'OUT')) as 'IN' | 'OUT',
      expected: clock12(slot?.expectedTime ?? DEFAULT_EXPECTED[n]),
      expectedFromShift: slot?.expectedSource === 'shift',
    }
    if (slot && !slot.available) {
      const v = latest.get(n)
      const doneStatus = slot.status === 'approved' ? 'approved' : slot.status === 'pending' ? 'pending' : 'recorded'
      const statusLabel = doneStatus === 'approved' ? 'Approved' : doneStatus === 'pending' ? 'Waiting for HR' : punchSourceLabel(slot.punchSource)
      return {
        ...base,
        state: 'done',
        doneStatus,
        time: clock12(slot.punchTime ?? v?.punchTime ?? null),
        statusLabel,
        note: null,
        selectable: false,
      }
    }
    const v = latest.get(n)
    const wasRejected = v?.status === 'rejected'
    return {
      ...base,
      state: 'open',
      doneStatus: null,
      time: null,
      statusLabel: input.canPunch ? 'Not recorded yet' : 'Not recorded',
      note: wasRejected ? `HR rejected this punch${v?.hrReviewComment ? `: ${v.hrReviewComment}` : ''}. Record it again.` : null,
      selectable: input.canPunch,
    }
  })
}

export interface EndSummary {
  done: PunchTile[]
  missing: PunchTile[]
  /** "Lunch Out and Night Punch" (for the warning sentence), or null when none is missing. */
  missingNames: string | null
  durationMs: number | null
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function endSummary(tiles: readonly PunchTile[], startedAt: string | null | undefined, nowMs: number): EndSummary {
  const done = tiles.filter((t) => t.state !== 'open')
  const missing = tiles.filter((t) => t.state === 'open')
  const start = startedAt ? Date.parse(startedAt) : NaN
  return {
    done,
    missing,
    missingNames: missing.length ? joinNames(missing.map((t) => t.name)) : null,
    durationMs: Number.isNaN(start) ? null : Math.max(0, nowMs - start),
  }
}

/** "3 h 25 min", "45 min", "less than a minute". */
export function durationText(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin < 1) return 'less than a minute'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** A session the employee is still working under (the backend's "punchable"): not ended, not decided against. */
export function isOpenSession(s: { approvalStatus?: string | null; status?: string | null; employeeEndedAt?: string | null } | null | undefined): boolean {
  if (!s || s.employeeEndedAt) return false
  const st = s.approvalStatus || s.status || ''
  return st === 'pending_hod' || st === 'pending_hr' || st === 'active'
}

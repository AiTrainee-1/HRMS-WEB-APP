// Overtime (OT) punches of an On-Duty day (owner 2026-11-24): after the four punches the employee chooses "Continue Duty"
// and records extra punches - a selfie and the location each, like the four - which never become attendance and only count
// for overtime (backend OnDutyOvertimePunch). Mirrors the mobile app's src/lib/onDutyOvertime.ts (without its offline
// queue). Pure; tested in onduty-overtime.test.ts.
import { clock12, durationText } from './onduty-punches.ts'

export interface ServerOtPunchLike {
  sequence: number
  punchTime: string
  status: 'pending' | 'approved' | 'rejected' | string
}

export interface OtRow {
  key: string
  /** 1, 2, 3 ... in the order they were taken. */
  number: number
  time: string | null
  state: 'pending' | 'approved'
  label: string
}

/** The OT punches to list: the server's (rejected ones left out), numbered in order. */
export function otRows(server: readonly ServerOtPunchLike[] | null | undefined): OtRow[] {
  const kept = [...(server ?? [])].filter((p) => p.status !== 'rejected').sort((a, b) => a.sequence - b.sequence)
  return kept.map((p, i) => ({
    key: `s${p.sequence}`,
    number: i + 1,
    time: clock12(p.punchTime),
    state: p.status === 'approved' ? 'approved' : 'pending',
    label: p.status === 'approved' ? 'Approved' : 'Waiting for approval',
  }))
}

/** "1 h 20 min past your Night Punch time" / null when none. */
export function otSummary(otMinutes: number | null | undefined): string | null {
  if (!otMinutes || otMinutes <= 0) return null
  return `${durationText(otMinutes * 60_000)} past your Night Punch time`
}

/**
 * What to show once the four punches are in (session still open): the choice (Complete / Continue Duty) until the
 * employee chose to continue - or already has OT punches - then the OT section.
 */
export function overtimeStage(input: { allFourIn: boolean; open: boolean; continued: boolean; otCount: number }): 'none' | 'choose' | 'overtime' {
  if (!input.open || !input.allFourIn) return 'none'
  return input.continued || input.otCount > 0 ? 'overtime' : 'choose'
}

/** The 409 code the server sends for an OT punch before the four are in. */
export const REGULAR_PUNCHES_MISSING = 'regular_punches_missing'

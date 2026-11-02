// Pure helpers for the Digital ID Card page, tested in id-card.test.ts. A port of the mobile app's src/lib/idCard.ts.

export interface StatusInfo {
  /**
   * 'active'  - HR's record says active.
   * 'working' - still employed but not plain active (on probation, on leave, serving notice).
   * 'ended'   - no longer employed or barred (inactive, resigned, terminated, suspended ...): the card is stamped NOT ACTIVE.
   * 'other'   - some other word HR typed; shown as it is, no stamp.
   * 'unknown' - the server sent no status (older server): shown as before, no status chip.
   */
  kind: 'active' | 'working' | 'ended' | 'other' | 'unknown'
  /** False only for 'ended'. */
  isActive: boolean
  /** HR's status in words, e.g. "Inactive", "On probation". '' when the server sent none. */
  label: string
  unknown: boolean
}

const WORKING = new Set(['probation', 'on probation', 'on leave', 'leave', 'notice', 'on notice', 'notice period'])
const ENDED = new Set([
  'inactive', 'resigned', 'terminated', 'suspended', 'relieved', 'absconded', 'left', 'exited',
  'deactivated', 'dismissed', 'retired', 'separated', 'blocked',
])

/** Reads the employee status HR keeps (free text on the server, "active" by default). */
export function employeeStatusInfo(status: string | null | undefined): StatusInfo {
  const raw = (status ?? '').trim()
  if (!raw) return { kind: 'unknown', isActive: true, label: '', unknown: true }
  const words = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').toLowerCase()
  const label = words === 'probation' ? 'On probation' : words.charAt(0).toUpperCase() + words.slice(1)
  if (words === 'active') return { kind: 'active', isActive: true, label: 'Active', unknown: false }
  if (WORKING.has(words)) return { kind: 'working', isActive: true, label, unknown: false }
  if (ENDED.has(words)) return { kind: 'ended', isActive: false, label, unknown: false }
  return { kind: 'other', isActive: true, label, unknown: false }
}

/** "2026-10-31" -> "31 Oct 2026"; anything else as it came; '' for nothing. */
export function cardDate(value: string | null | undefined): string {
  const v = (value ?? '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (!m) return v
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mi = Number(m[2]) - 1
  if (mi < 0 || mi > 11) return v
  return `${Number(m[3])} ${months[mi]} ${m[1]}`
}

/** A file name for the downloaded PNG: "UKT1234-id-card-front.png" (letters, digits and dashes only). */
export function cardFileName(code: string | null | undefined, side: 'front' | 'back' | 'both'): string {
  const clean = String(code ?? '').replace(/[^A-Za-z0-9-]+/g, '').slice(0, 32) || 'uktextiles'
  return `${clean}-id-card-${side}.png`
}

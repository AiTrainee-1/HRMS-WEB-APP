// How the My Profile page words the employee's own record (owner 2026-11-25 redesign, mirroring the mobile app's
// src/lib/profileView.ts). Pure (no React, no path aliases), unit-tested in profile-view.test.ts. Every value comes from
// GET /employees/:id (backend/api/serializers.py::employee_json); a missing one reads as null and the page says so.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A "yyyy-MM-dd..." value as a local date (the day as written, never shifted by the time zone), or null. */
function localDate(value?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** "123456789012" -> "••••••••9012": only the last four characters of an account number show (at most 8 dots). */
export function maskAccount(acc?: string | null): string | null {
  const v = text(acc)
  if (!v) return null
  return v.length <= 4 ? v : `${'•'.repeat(Math.min(8, v.length - 4))}${v.slice(-4)}`
}

/** Whole years since the date of birth (the birthday counts on the day), or null. */
export function calcAge(dob: string | null | undefined, now: Date = new Date()): number | null {
  const d = localDate(dob)
  if (!d) return null
  let years = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) years -= 1
  return years >= 0 ? years : null
}

/** "Never changed" / "Updated today" / "Last updated 1 day ago" / "Last updated 12 days ago". */
export function passwordAgeLabel(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'Never changed'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'Never changed'
  const days = Math.floor((now.getTime() - then) / (24 * 3600 * 1000))
  if (days <= 0) return 'Updated today'
  if (days === 1) return 'Last updated 1 day ago'
  return `Last updated ${days} days ago`
}

/** The first phone number in a free-text contact ("Ravi (brother) 98765 43210" -> "9876543210"), or null. */
export function extractPhone(value?: string | null): string | null {
  if (!value) return null
  const match = value.match(/[+\d][\d\s-]{6,}/)
  if (!match) return null
  return match[0].replace(/[\s-]/g, '')
}

/** "15 Jan 2020" for a "2020-01-15" date; anything else as it came; null when empty. */
export function displayDate(value?: string | null): string | null {
  const d = localDate(value)
  if (!d) return text(value)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** How long since joining: "3 yrs 2 mos", "1 yr", "8 mos", "New this month"; null without a (past) join date. */
export function serviceLength(joinDate: string | null | undefined, now: Date = new Date()): string | null {
  const d = localDate(joinDate)
  if (!d || d.getTime() > now.getTime()) return null
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (now.getDate() < d.getDate()) months -= 1
  if (months <= 0) return 'New this month'
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts: string[] = []
  if (y) parts.push(`${y} ${y === 1 ? 'yr' : 'yrs'}`)
  if (m) parts.push(`${m} ${m === 1 ? 'mo' : 'mos'}`)
  return parts.join(' ')
}

/** "male" -> "Male", "on_leave" -> "On leave"; null for empty. */
export function capitalize(value?: string | null): string | null {
  const v = String(value ?? '').trim().replace(/_/g, ' ')
  if (!v) return null
  return v.charAt(0).toUpperCase() + v.slice(1)
}

/** The web app's two employment types: "production" -> "Production", any other recorded type -> "Staff"; null when none. */
export function employmentTypeLabel(value?: string | null): string | null {
  const v = text(value)
  if (!v) return null
  return v.toLowerCase() === 'production' ? 'Production' : 'Staff'
}

/** Up to two initials of a name ("Anitha Kumar Raj" -> "AK"); '' without a name. */
export function initialsOf(name?: string | null): string {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** "9:00 AM" from "09:00" / "09:00:00"; the text as it came when it is not a time; null when empty. */
export function clockText(value?: string | null): string | null {
  const v = text(value)
  if (!v) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(v)
  if (!m) return v
  const h = Number(m[1])
  if (h > 23) return v
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/** "9:00 AM – 6:00 PM" for a shift's start and end, or null when either is missing ("—" counts as missing). */
export function shiftWindow(start?: string | null, end?: string | null): string | null {
  const a = start === '—' ? null : clockText(start)
  const b = end === '—' ? null : clockText(end)
  return a && b ? `${a} – ${b}` : null
}

// ---- the fields the base Employee type does not list (sent by the same endpoint) ------------------------------------

export interface ProfileExtras {
  nationality: string | null
  workstation: string | null
  zone: string | null
  staffTier: string | null
  /** true / false once HR has (or has not) recorded a confirmation date; null on an older backend. */
  isConfirmed: boolean | null
  confirmationDate: string | null
  /** The employee has set a portal password (their account is verified). */
  hasPassword: boolean
  passwordUpdatedAt: string | null
  supervisor: string | null
}

/** The extra profile fields, read defensively from GET /employees/:id (any of them may be missing on an older backend). */
export function readExtras(raw: unknown): ProfileExtras {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const mgr = r.reportingManager && typeof r.reportingManager === 'object' ? (r.reportingManager as Record<string, unknown>) : null
  const supervisor = mgr ? [text(mgr.name), text(mgr.designationTitle)].filter(Boolean).join(' · ') || null : null
  const zone = typeof r.zone === 'number' ? String(r.zone) : text(r.zone)
  return {
    nationality: text(r.nationality),
    workstation: text(r.workstation),
    zone,
    staffTier: text(r.staffTier),
    isConfirmed: typeof r.isConfirmed === 'boolean' ? r.isConfirmed : null,
    confirmationDate: text(r.confirmationDate),
    hasPassword: r.hasPassword === true,
    passwordUpdatedAt: text(r.passwordUpdatedAt),
    supervisor,
  }
}

/** How many of `fields` have a value on the record: { filled, total, pct } (pct rounded, 0 for no fields). */
export function recordCompleteness<T extends object>(record: T | null | undefined, fields: readonly (keyof T)[]): {
  filled: number
  total: number
  pct: number
} {
  const total = fields.length
  const filled = record ? fields.filter((k) => !!record[k]).length : 0
  return { filled, total, pct: total ? Math.round((filled / total) * 100) : 0 }
}

/**
 * The line under "Resignation & Exit": where the employee's own resignation stands. `waiting` is who it waits for, in
 * words ("Waiting for HR", from lib/approval.ts waitingText), when the server sent the pipeline.
 */
export function resignationLine(status: string | null | undefined, waiting?: string | null): string {
  const s = String(status ?? '').trim().toLowerCase()
  if (!s) return 'Resign, and see your notice details'
  if (s === 'pending' || s === 'dept_approved' || s === 'pending_hr' || s === 'pending_hod') {
    if (waiting) return `Sent · ${waiting.charAt(0).toLowerCase()}${waiting.slice(1)}`
    return s === 'dept_approved' || s === 'pending_hr' ? 'Sent · waiting for HR' : 'Sent · waiting for your Department Head'
  }
  if (s === 'approved') return 'Resignation approved'
  if (s === 'rejected') return 'Not accepted · you can send it again'
  if (s === 'withdrawn' || s === 'cancelled') return 'Withdrawn'
  return 'See your resignation and notice details'
}

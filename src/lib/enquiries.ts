// Enquiries (owner 2026-11-24, replaced "Ask HR" in the mobile app): a question or concern to HR, which HR works through on
// the HR portal's Enquiries page like a to-do list (Pending -> On Hold -> Done) with a reply. backend api/enquiry_views.py:
//   GET  /my/enquiries   my enquiries, newest first
//   POST /my/enquiries   {category, subject, message} -> 201 the enquiry
// Every status change / reply comes as a notification (type "enquiry", target {kind: "enquiry", id}) whose View opens
// /employee/enquiries?focus=<id>. Pure, no imports: unit-tested in enquiries.test.ts. Same words as the mobile app
// (src/hooks/useEnquiries.ts, app/enquiries/index.tsx).

export type EnquiryStatus = 'pending' | 'on_hold' | 'done'
export type EnquiryFilter = 'all' | EnquiryStatus

export interface EnquiryHistoryEntry {
  at: string | null
  by: string
  status: string
  reply: string | null
}

export interface Enquiry {
  id: number
  category: string
  categoryLabel: string
  subject: string
  message: string
  status: string
  statusLabel: string
  hrReply: string | null
  handledBy: string | null
  handledAt: string | null
  doneAt: string | null
  history: EnquiryHistoryEntry[]
  createdAt: string | null
}

export const ENQUIRY_CATEGORIES: readonly { key: string; label: string; hint: string }[] = [
  { key: 'general', label: 'General question', hint: 'Anything for HR' },
  { key: 'salary', label: 'Salary & deductions', hint: 'Pay, PF / ESI, Form 16 ...' },
  { key: 'attendance', label: 'Attendance & shift', hint: 'A wrong day, punch or shift' },
  { key: 'leave', label: 'Leave & holidays', hint: 'Balances, holidays, rules' },
  { key: 'documents', label: 'Documents & letters', hint: 'Certificates, letters, ID' },
  { key: 'other', label: 'Something else', hint: 'Any other concern' },
]

/** The short word (filters, pill) and the plain sentence for the employee. */
export const ENQUIRY_STATUS: Record<EnquiryStatus, { label: string; employeeText: string }> = {
  pending: { label: 'Pending', employeeText: 'Waiting for HR' },
  on_hold: { label: 'On Hold', employeeText: 'HR put it on hold' },
  done: { label: 'Done', employeeText: 'Resolved by HR' },
}

export const ENQUIRY_FILTERS: readonly { key: EnquiryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'done', label: 'Done' },
]

export const SUBJECT_MIN = 3
export const SUBJECT_MAX = 200
export const MESSAGE_MAX = 2000

/** A status the app knows ("on-hold" / "On Hold" read as on_hold); anything else is still waiting. */
export function enquiryStatusOf(raw: unknown): EnquiryStatus {
  const s = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return s === 'done' || s === 'on_hold' ? s : 'pending'
}

/** The words for a status (the server's label for one this app does not know). */
export function statusWords(e: Pick<Enquiry, 'status' | 'statusLabel'>): { label: string; employeeText: string } {
  const known = String(e.status ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (known === 'pending' || known === 'on_hold' || known === 'done') return ENQUIRY_STATUS[known]
  const label = e.statusLabel?.trim() || 'Pending'
  return { label, employeeText: label }
}

/** null when the form can be sent, else what to fix. */
export function enquiryProblem(subject: string, message: string): string | null {
  const s = subject.trim()
  if (s.length < SUBJECT_MIN) return `Write a subject (at least ${SUBJECT_MIN} characters).`
  if (s.length > SUBJECT_MAX) return `The subject can be at most ${SUBJECT_MAX} characters.`
  if (message.trim().length > MESSAGE_MAX) return `The details can be at most ${MESSAGE_MAX} characters.`
  return null
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** One enquiry from the server, every field checked; null when it has no usable id. */
export function readEnquiry(raw: unknown): Enquiry | null {
  if (!isObject(raw)) return null
  const id = typeof raw.id === 'number' ? raw.id : typeof raw.id === 'string' && /^\d{1,12}$/.test(raw.id) ? Number(raw.id) : NaN
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const category = str(raw.category) || 'general'
  return {
    id,
    category,
    categoryLabel: str(raw.categoryLabel) || ENQUIRY_CATEGORIES.find((c) => c.key === category)?.label || 'Enquiry',
    subject: str(raw.subject),
    message: str(raw.message),
    status: str(raw.status) || 'pending',
    statusLabel: str(raw.statusLabel),
    hrReply: strOrNull(raw.hrReply),
    handledBy: strOrNull(raw.handledBy),
    handledAt: strOrNull(raw.handledAt),
    doneAt: strOrNull(raw.doneAt),
    history: Array.isArray(raw.history)
      ? raw.history.filter(isObject).map((h) => ({ at: strOrNull(h.at), by: str(h.by) || 'HR', status: str(h.status), reply: strOrNull(h.reply) }))
      : [],
    createdAt: strOrNull(raw.createdAt),
  }
}

/** The list from the server (an array; anything else is an empty list). */
export function readEnquiries(raw: unknown): Enquiry[] {
  return Array.isArray(raw) ? raw.map(readEnquiry).filter((e): e is Enquiry => e !== null) : []
}

/** How many enquiries are in each filter. */
export function enquiryCounts(list: readonly Pick<Enquiry, 'status'>[]): Record<EnquiryFilter, number> {
  const counts: Record<EnquiryFilter, number> = { all: list.length, pending: 0, on_hold: 0, done: 0 }
  for (const e of list) counts[enquiryStatusOf(e.status)] += 1
  return counts
}

/** The enquiries a filter shows (in the server's order: newest first). */
export function filterEnquiries<T extends Pick<Enquiry, 'status'>>(list: readonly T[], filter: EnquiryFilter): T[] {
  return filter === 'all' ? [...list] : list.filter((e) => enquiryStatusOf(e.status) === filter)
}

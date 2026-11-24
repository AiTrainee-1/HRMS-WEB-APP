// Where a notification's View button goes (owner 2026-11-02: every notification gets Read and View; View opens the page
// of the exact request or event it is about). The server says what each notification is about in `target`
// (GET /notifications, serializers.notification_json):
//
//   target: null | { kind, id, date, role: 'self' | 'approver', category, label }
//
// This file turns that into a web route with `focus=<id>` / `date=YYYY-MM-DD`, which the target page reads
// (hooks/useFocusItem.ts) to select the view holding the item, scroll to it and ring it. An older server sends no
// `target` at all: then the type-based link of lib/notifications.ts (`notificationTarget`) stands in. `target: null`
// means the server knows there is nothing to open (a free-text message HR typed). Pure, unit-tested
// (notification-target.test.ts). The mobile app reads the same `target` and maps the kinds to its own screens.

import { categoryFromWire, type ApprovalCategory } from './approvals-history.ts'
import { cleanDate } from './focus-item.ts'
import { notificationTarget, type NotificationTarget, type NotificationViewer } from './notifications.ts'
import type { NotificationTargetKind } from '../types/index.ts'

/** Every kind this app opens: the shared contract's kinds plus `enquiry` (2026-11-24: HR updated one of my enquiries ->
 *  /employee/enquiries?focus=<id>). */
export type TargetKind = NotificationTargetKind | 'enquiry'

export interface NotificationLinkViewer extends NotificationViewer {
  /** Staff (true), production (false), or not known yet (null / undefined). Compensation is for staff only. */
  isStaff?: boolean | null
}

/** A `target` after checking every field. */
export interface NormalizedTarget {
  kind: TargetKind
  /** The item's id when the server knows it (a positive whole number). */
  id: number | null
  /** "YYYY-MM-DD" for day events. */
  date: string | null
  /** approver = the reader must act on it (a Department Head): it opens Approvals. */
  role: 'self' | 'approver'
  /** The Approvals category, for role approver (from the server, else from the kind). */
  category: ApprovalCategory | null
  /** The server's button words, when usable. */
  label: string | null
}

export const TARGET_KINDS: readonly TargetKind[] = [
  'leave',
  'casual_leave',
  'permission',
  'missing_punch',
  'outpass',
  'on_duty',
  'geo_punch',
  'attendance',
  'salary_slip',
  'documents',
  'id_card',
  'compensation',
  'advance',
  'resignation',
  'chat',
  'approvals',
  'my_requests',
  'request',
  'shift',
  'holidays',
  'profile',
  'enquiry',
]

/** The Approvals category a kind belongs to, when the server sends none. */
const KIND_CATEGORY: Partial<Record<TargetKind, ApprovalCategory>> = {
  leave: 'leave',
  casual_leave: 'casual_leave',
  permission: 'permission',
  missing_punch: 'missing_punch',
  outpass: 'outpass',
  on_duty: 'on_duty',
  geo_punch: 'on_duty',
  attendance: 'attendance',
  compensation: 'holiday_work',
  resignation: 'resignation',
}

/** The words when the server sends no label (or one too long for a button). */
function defaultLabel(t: Pick<NormalizedTarget, 'kind' | 'id' | 'date' | 'role' | 'category'>): string {
  if (t.role === 'approver' || t.kind === 'approvals') return 'Open approvals'
  switch (t.kind) {
    case 'leave':
      return t.id ? 'View leave request' : 'View your leave'
    case 'casual_leave':
      return 'View Casual Leave'
    case 'permission':
      return t.id ? 'View permission' : 'View your permissions'
    case 'missing_punch':
      return 'View missing punch'
    case 'outpass':
      return 'View outpass'
    case 'on_duty':
      return 'View On-Duty'
    case 'geo_punch':
      return 'View On-Duty punches'
    case 'attendance':
      return t.date ? 'View that day' : 'View attendance'
    case 'salary_slip':
      return t.id ? 'View salary slip' : 'View salary slips'
    case 'documents':
      return 'View documents'
    case 'id_card':
      return 'View ID card'
    case 'compensation':
      return 'View compensation'
    case 'advance':
      return 'View advance'
    case 'resignation':
      return 'View resignation'
    case 'chat':
      return 'Open chat'
    case 'my_requests':
      return t.category === 'attendance' ? 'View attendance change' : 'View my requests'
    case 'request':
      return 'View request'
    case 'shift':
      return 'View my shift'
    case 'holidays':
      return 'View holidays'
    case 'profile':
      return 'View profile'
    case 'enquiry':
      return 'View enquiry'
  }
  return 'View'
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readId(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,12}$/.test(v.trim()) ? Number(v.trim()) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function readLabel(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.replace(/\s+/g, ' ').trim()
  return s && s.length <= 40 ? s : null
}

/** A `target` from the server, every field checked; null when it is missing or its kind is not one this app knows. */
export function normalizeTarget(raw: unknown): NormalizedTarget | null {
  if (!isObject(raw)) return null
  const kind = typeof raw.kind === 'string' ? raw.kind.trim().toLowerCase().replace(/-/g, '_') : ''
  if (!(TARGET_KINDS as readonly string[]).includes(kind)) return null
  const k = kind as TargetKind
  const role = typeof raw.role === 'string' && raw.role.trim().toLowerCase() === 'approver' ? 'approver' : 'self'
  return {
    kind: k,
    id: readId(raw.id),
    date: cleanDate(raw.date),
    role,
    category: categoryFromWire(raw.category) ?? KIND_CATEGORY[k] ?? null,
    label: readLabel(raw.label),
  }
}

/** `path` plus query params (skipping empty ones); `path` may already carry a query. */
export function withQuery(path: string, params: Record<string, string | number | null | undefined>): string {
  const [base, existing] = path.split('?')
  const q = new URLSearchParams(existing ?? '')
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && String(v) !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `${base}?${s}` : base
}

/** Kinds whose page lists the item by the id the server sends (so `focus=<id>` finds it). */
const OWN_PAGE: Partial<Record<TargetKind, string>> = {
  leave: '/employee/leave',
  casual_leave: '/employee/casual-leave',
  permission: '/employee/permissions',
  missing_punch: '/employee/missing-punch',
  outpass: '/employee/outpass',
  on_duty: '/employee/attendance-request?mode=records',
  advance: '/employee/settlement',
  enquiry: '/employee/enquiries',
}

/** Kinds with a page but no single item on it. */
const PLAIN_PAGE: Partial<Record<TargetKind, string>> = {
  documents: '/employee/documents',
  id_card: '/employee/id-card',
  resignation: '/employee/resignation',
  chat: '/employee/chat',
  shift: '/employee/shift',
  holidays: '/employee/holidays',
  profile: '/employee/profile',
}

/** My Requests (My Department Head -> My Requests) keys its rows "<module>-<id>"; the module of an Approvals category
 *  when the two words differ (an attendance change HR proposed is an "attendance_correction"). */
const MY_REQUESTS_MODULE: Partial<Record<ApprovalCategory, string>> = { attendance: 'attendance_correction' }

/**
 * The route of a checked target, or null when this reader has nothing to open:
 *   role approver (or kind approvals) -> /employee/approvals?category=<c>&focus=<id>   (heads only; neither when the
 *                                        server sends none: an advance / general request reminder just opens Approvals)
 *   leave / casual_leave / permission / missing_punch / outpass / advance / enquiry -> its page ?focus=<id> (&date= for a day)
 *   on_duty  -> Geo Punch & On-Duty, View Records ?focus=<session id>
 *   geo_punch -> the same records, the record of that day (?date=; the id is a punch check, not a record)
 *   attendance -> the calendar, that day opened (?date=); late / absent / missing punch ALERTS come this way
 *   salary_slip -> /employee/salary/<id> (the list without an id)
 *   compensation -> staff only; ?focus=hw-<claim id> (every compensation claim kind shares the Holiday-work table, so
 *                   "hw-<id>": the page finds it in the year timeline, else under Claims -> My claims) &date=
 *   my_requests -> My Requests ?focus=<module>-<id> (category "attendance" -> "attendance_correction-<id>")
 *   request -> My Requests ?focus=request-<id>
 *   documents / id_card / resignation / chat / shift / holidays / profile -> the page
 */
export function targetLink(t: NormalizedTarget, viewer?: NotificationLinkViewer | null): NotificationTarget | null {
  const label = t.label ?? defaultLabel(t)

  if (t.role === 'approver' || t.kind === 'approvals') {
    if (viewer?.isManager === false) return null
    // An id only means something inside its category's list; a geo punch's id is the punch check, not the On-Duty
    // request Approvals lists.
    const focus = t.category && t.kind !== 'geo_punch' ? t.id : null
    return { href: withQuery('/employee/approvals', { category: t.category, focus }), label }
  }

  if (t.kind === 'compensation' && viewer?.isStaff === false) return null

  const own = OWN_PAGE[t.kind]
  if (own) return { href: withQuery(own, { focus: t.id, date: t.date }), label }

  switch (t.kind) {
    case 'geo_punch':
      return { href: withQuery('/employee/attendance-request?mode=records', { date: t.date }), label }
    case 'attendance':
      return { href: withQuery('/employee/attendance', { date: t.date }), label }
    case 'salary_slip':
      return { href: t.id ? `/employee/salary/${t.id}` : '/employee/salary', label }
    case 'compensation':
      return { href: withQuery('/employee/compensation', { focus: t.id ? `hw-${t.id}` : null, date: t.date }), label }
    case 'my_requests':
    case 'request': {
      const module = t.kind === 'request' ? 'request' : t.category ? (MY_REQUESTS_MODULE[t.category] ?? t.category) : null
      return { href: withQuery('/employee/hod?tab=requests', { focus: t.id && module ? `${module}-${t.id}` : null }), label }
    }
  }

  const plain = PLAIN_PAGE[t.kind]
  return plain ? { href: plain, label } : null
}

export interface NotificationLike {
  type?: string | null
  message?: string | null
  target?: unknown
}

/** The checked target of a notification (null when there is none, or an older server sent none). */
export function targetOf(n: NotificationLike | null | undefined): NormalizedTarget | null {
  return n ? normalizeTarget(n.target) : null
}

/**
 * What a notification's View button opens, or null for no button.
 *   target present  -> its route (null when it is not for this reader: an approver link for someone no longer a head,
 *                      compensation for a production employee)
 *   target null     -> nothing (the server says there is nothing to open)
 *   no target       -> an older server: the type-based link (notificationTarget)
 *   unknown kind    -> also the type-based link (a newer server with a kind this app does not know yet)
 */
export function notificationLink(n: NotificationLike, viewer?: NotificationLinkViewer | null): NotificationTarget | null {
  if (n.target === null) return null
  const t = normalizeTarget(n.target)
  if (t) return targetLink(t, viewer)
  return notificationTarget(n.type, viewer, n.message)
}

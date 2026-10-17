// The HOD Assignment page's logic: GET /employee/hod (backend/api/employee_compensation_views.py::employee_hod) validated
// and turned into what the screen draws, plus the photo-URL resolver. The Mobile App reads the same endpoint.
//
// Defensive on purpose (an older or newer backend must not crash the page): the answer only has to be an object, every
// other key falls back to "not known", an approval type this app has never heard of is listed like any other. Pure
// TypeScript (it imports only other pure lib modules and types), so Node's test runner can run it: `npm test`.
import { humanize } from './strings.ts'
import { normalizeContactBlock, type SupportContactBlock } from './contact-block.ts'

export interface HodApproval {
  key: string
  label: string
  /** true: this Department Head can give this approval. */
  canApprove: boolean
  /** Why not ("HR decides this one."); null when they can. */
  reason: string | null
  /** 'Employee' | 'HR': who raises such a request. */
  requestedBy: string | null
  /** "Employee → HOD or HR": the route a request takes. */
  path: string | null
}

export interface HodPayload {
  /** The employee has a Department Head (and is not one themselves). */
  assigned: boolean
  /** The employee is a Department Head themselves, so HR decides their own requests. */
  isSelf: boolean
  employeeCode: string | null
  name: string | null
  phone: string | null
  /** As the server sent it ('/media/...', an https link or an embedded data: image): resolve it with resolvePhotoUrl. */
  photoUrl: string | null
  designation: string | null
  department: string | null
  branch: string | null
  email: string | null
  approvals: HodApproval[]
  /** HR's contact (Settings -> HR Contact); null when the server sent none. */
  hrContact: SupportContactBlock | null
  contactNote: string
  /** The friendly sentence for "no Department Head yet" / "you are one yourself". */
  message: string | null
}

export const DEFAULT_CONTACT_NOTE = 'For any question about approvals, contact HR.'
export const NOT_ASSIGNED_MESSAGE = 'You do not have a Department Head assigned yet. Please contact HR to have one assigned.'
export const SELF_MESSAGE = 'You are a Department Head yourself, so HR decides your own requests.'

type PlainObject = Record<string, unknown>

function isObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrNull(value: unknown): string | null {
  return text(value) || null
}

function parseApproval(raw: unknown): HodApproval | null {
  if (!isObject(raw)) return null
  const key = text(raw.key)
  const label = text(raw.label) || humanize(key)
  if (!label) return null
  return {
    key: key || label,
    label,
    canApprove: raw.canApprove === true,
    reason: textOrNull(raw.reason),
    requestedBy: textOrNull(raw.requestedBy),
    path: textOrNull(raw.path),
  }
}

/**
 * Validates the response and coerces it to the contract; null when it is not one (an HTML error page from a proxy, a
 * bare string), so the screen can say "could not read it" instead of crashing.
 */
export function parseHod(raw: unknown): HodPayload | null {
  if (!isObject(raw)) return null
  // Neither key every real answer has: some other document.
  if (typeof raw.assigned !== 'boolean' && !Array.isArray(raw.approvals)) return null
  const isSelf = raw.isSelf === true
  const assigned = raw.assigned === true && !isSelf
  const approvals = Array.isArray(raw.approvals)
    ? raw.approvals.map(parseApproval).filter((a): a is HodApproval => a !== null)
    : []
  return {
    assigned,
    isSelf,
    employeeCode: textOrNull(raw.employeeCode),
    name: textOrNull(raw.name),
    phone: textOrNull(raw.phone),
    photoUrl: textOrNull(raw.photoUrl),
    designation: textOrNull(raw.designation),
    department: textOrNull(raw.department),
    branch: textOrNull(raw.branch),
    email: textOrNull(raw.email),
    // An unassigned answer carries no approvals; ignore any stray ones so the page never lists a head who is not there.
    approvals: assigned ? approvals : [],
    hrContact: normalizeContactBlock(raw.hrContact),
    contactNote: text(raw.contactNote) || DEFAULT_CONTACT_NOTE,
    message: textOrNull(raw.message) ?? (isSelf ? SELF_MESSAGE : assigned ? null : NOT_ASSIGNED_MESSAGE),
  }
}

export interface ApprovalCounts {
  total: number
  can: number
  cannot: number
}

export function approvalCounts(approvals: HodApproval[]): ApprovalCounts {
  const can = approvals.filter((a) => a.canApprove).length
  return { total: approvals.length, can, cannot: approvals.length - can }
}

/** "Your Department Head can approve 6 of 9 kinds of request." ('' when the list is empty). */
export function approvalSummaryLine(approvals: HodApproval[]): string {
  const { total, can } = approvalCounts(approvals)
  if (total === 0) return ''
  if (can === 0) return 'Your Department Head cannot approve any kind of request right now: HR decides them.'
  if (can === total) return `Your Department Head can approve all ${total} kinds of request.`
  return `Your Department Head can approve ${can} of ${total} kinds of request.`
}

/** 'Suresh Raj' -> 'SR'; one word -> its first letter; nothing -> '?'. */
export function initialsOf(name: string | null | undefined): string {
  const letters = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
  return letters || '?'
}

/** The origin (scheme + host) the API lives on, from its base URL ('https://host/api' -> 'https://host'); a relative base
 * ('/api') lives on the page's own origin. Null when neither is known. */
function apiOrigin(apiBase: string | null | undefined, pageOrigin: string | null | undefined): string | null {
  const base = (apiBase ?? '').trim()
  try {
    if (base) return new URL(base, pageOrigin || undefined).origin
    return pageOrigin ? new URL(pageOrigin).origin : null
  } catch {
    return null
  }
}

/**
 * The address an <img> can load for a photo URL the API returned. The API sends whatever is stored for the employee: an
 * https link or an embedded `data:image/...` picture (both used as they are), or a path on the server ('/media/boss.jpg',
 * which would resolve against THIS site and 404), so a path is resolved against the API's own origin. Anything else
 * (another scheme, empty) gives null and the avatar shows initials.
 *
 * `apiBase` is the API root ('https://host/api'); `pageOrigin` is only used when that base is itself relative.
 */
export function resolvePhotoUrl(
  raw: string | null | undefined,
  apiBase: string | null | undefined,
  pageOrigin?: string | null,
): string | null {
  const url = (raw ?? '').trim()
  if (!url) return null
  if (/^data:image\//i.test(url) || /^https?:\/\//i.test(url)) return url
  // Protocol-relative ('//cdn.host/x.jpg'): the page's own scheme applies.
  if (url.startsWith('//')) return url
  // Any other scheme (javascript:, data:text/html, file:, blob:) is not a picture address.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null
  const origin = apiOrigin(apiBase, pageOrigin)
  if (!origin) return url.startsWith('/') ? url : `/${url}`
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

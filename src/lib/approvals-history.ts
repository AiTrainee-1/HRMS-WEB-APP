// The Department Head's Approvals page: categories, the three lists (Pending / Approved / Rejected), their counts, search
// and the "who decided" line, in ONE place. Pure (no React), unit-tested in approvals-history.test.ts.
//
// Mirrors the mobile app's src/lib/approvalsHistory.ts so both apps sort and word a head's requests the same way.
// Server: backend/api/mobile_approvals_views.py
//   GET /manager/requests/summary  -> { categories: [{ key, workflow, label, pending, approved, rejected }], total }
//   GET /manager/requests?category=&status=&search=&page=&page_size=
//                                  -> { category, status, counts, items, page, pageSize, total, hasMore }
// Every item is the same JSON /manager/pending-requests sends for its category, plus `historyStatus` and `outcome`.
// The web app does not camelize anything: the category keys arrive in the server's own snake_case ("casual_leave").
//
// The three statuses for a Department Head (decided on the server, worded here):
//   * Pending  - waiting for YOUR decision now (the same list the badge counts).
//   * Approved - finally approved, or approved by the Department Head and now waiting for HR ("in_progress").
//   * Rejected - finally rejected, by whoever.

import { deciderText, formatWhen, type Decider } from './decider.ts'
import type { ApprovalWorkflowKey } from '../types/index.ts'

export type ApprovalCategory =
  | 'leave'
  | 'permission'
  | 'casual_leave'
  | 'attendance'
  | 'missing_punch'
  | 'on_duty'
  | 'outpass'
  | 'holiday_work'
  | 'resignation'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export const APPROVAL_STATUSES: readonly ApprovalStatus[] = ['pending', 'approved', 'rejected']

/** The order the category rail lists them in. */
export const CATEGORY_ORDER: readonly ApprovalCategory[] = [
  'leave',
  'permission',
  'casual_leave',
  'attendance',
  'missing_punch',
  'on_duty',
  'outpass',
  'holiday_work',
  'resignation',
]

/** What a category is called on screen ("Compensation" = every compensation claim: Sunday / holiday work, late-in
 *  allowance, extra hours, birthday credit, a day off from the balance; raised by the employee or by HR). */
export const CATEGORY_LABEL: Record<ApprovalCategory, string> = {
  leave: 'Leave',
  permission: 'Permission',
  casual_leave: 'Casual Leave',
  attendance: 'Attendance',
  missing_punch: 'Missing Punch',
  on_duty: 'On-Duty',
  outpass: 'Outpass',
  holiday_work: 'Compensation',
  resignation: 'Resignations',
}

/** Which of HR's approval pipelines (GET /approval-summary) each category's requests follow. */
export const CATEGORY_WORKFLOW: Record<ApprovalCategory, ApprovalWorkflowKey> = {
  leave: 'leave',
  permission: 'permission',
  casual_leave: 'casual_leave',
  attendance: 'attendance_correction',
  missing_punch: 'missing_punch',
  on_duty: 'on_duty',
  outpass: 'outpass',
  holiday_work: 'holiday_work',
  resignation: 'resignation',
}

/** The per-person switch on GET /manager/me that lets a head see a category (Leave and Permission are always shown;
 *  Outpass follows the Permissions switch, as on the server). */
export const CATEGORY_FLAG: Record<ApprovalCategory, string> = {
  leave: 'canApproveLeaves',
  permission: 'canApprovePermissions',
  casual_leave: 'canApproveCasualLeave',
  attendance: 'canApproveAttendance',
  missing_punch: 'canApproveMissingPunch',
  on_duty: 'canApproveOnDuty',
  outpass: 'canApprovePermissions',
  holiday_work: 'canApproveCompensation',
  resignation: 'canApproveResignations',
}

/** Where each category sits in the older GET /manager/pending-requests reply. */
export const LEGACY_LIST_KEY: Record<ApprovalCategory, string> = {
  leave: 'leaveRequests',
  permission: 'permissions',
  casual_leave: 'casualLeaves',
  attendance: 'attendanceRequests',
  missing_punch: 'missingPunchRequests',
  on_duty: 'onDutySessions',
  outpass: 'outpassRequests',
  holiday_work: 'holidayWorkClaims',
  resignation: 'resignations',
}

export const STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

/** A category key in any spelling the server or a link may use ("casual_leave", "casualLeave", "missing-punch"). */
export function categoryFromWire(raw: unknown): ApprovalCategory | null {
  if (typeof raw !== 'string') return null
  const flat = raw.trim().toLowerCase().replace(/[-_\s]/g, '')
  if (!flat) return null
  if (flat === 'attendancecorrection') return 'attendance'
  if (flat === 'compensation') return 'holiday_work'
  if (flat === 'resignations') return 'resignation'
  return CATEGORY_ORDER.find((c) => c.replace(/_/g, '') === flat) ?? null
}

export function statusFromParam(raw: unknown): ApprovalStatus | null {
  return typeof raw === 'string' && (APPROVAL_STATUSES as readonly string[]).includes(raw) ? (raw as ApprovalStatus) : null
}

/** The categories a head sees from their GET /manager/me switches, in rail order. Leave and Permission always. */
export function visibleCategories(flags: Record<string, unknown> | null | undefined): ApprovalCategory[] {
  return CATEGORY_ORDER.filter((c) => c === 'leave' || c === 'permission' || flags?.[CATEGORY_FLAG[c]] === true)
}

// ---- counts --------------------------------------------------------------------------------------------------------

export interface StatusCounts {
  pending: number
  approved: number
  rejected: number
}

export const ZERO_COUNTS: StatusCounts = { pending: 0, approved: 0, rejected: 0 }

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)

export function normalizeCounts(raw: unknown): StatusCounts {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { pending: n(r.pending), approved: n(r.approved), rejected: n(r.rejected) }
}

export type CategoryCounts = Partial<Record<ApprovalCategory, StatusCounts>>

export interface ApprovalSummaryCounts {
  /** The categories the server lists for this head, in rail order (only the ones they may see). */
  categories: ApprovalCategory[]
  counts: CategoryCounts
}

/** GET /manager/requests/summary as the page uses it, or null when the reply is not that shape (an older backend). */
export function normalizeSummary(raw: unknown): ApprovalSummaryCounts | null {
  const list = raw && typeof raw === 'object' ? (raw as { categories?: unknown }).categories : null
  if (!Array.isArray(list)) return null
  const counts: CategoryCounts = {}
  for (const entry of list) {
    const key = categoryFromWire((entry as { key?: unknown } | null)?.key)
    if (key) counts[key] = normalizeCounts(entry)
  }
  return { categories: CATEGORY_ORDER.filter((c) => c in counts), counts }
}

/** Pending numbers from the older pending lists (Approved / Rejected are not known there and stay 0). */
export function legacyPendingCounts(lists: Record<string, unknown> | null | undefined): CategoryCounts {
  const out: CategoryCounts = {}
  for (const c of CATEGORY_ORDER) {
    const list = lists?.[LEGACY_LIST_KEY[c]]
    out[c] = { ...ZERO_COUNTS, pending: Array.isArray(list) ? list.length : 0 }
  }
  return out
}

/** The older pending list of one category ([] for a category an older backend does not send). */
export function legacyItems(lists: Record<string, unknown> | null | undefined, category: ApprovalCategory): ApprovalItem[] {
  const list = lists?.[LEGACY_LIST_KEY[category]]
  return Array.isArray(list) ? (list.filter((i) => i && typeof i === 'object') as ApprovalItem[]) : []
}

/** Sum of every category's pending number (the page's headline). */
export function totalPending(counts: CategoryCounts, categories: readonly ApprovalCategory[]): number {
  return categories.reduce((sum, c) => sum + (counts[c]?.pending ?? 0), 0)
}

// ---- one page of a list --------------------------------------------------------------------------------------------

/** One request on the page: whatever the server sent for its category (read through approvals-items.ts). */
export type ApprovalItem = Record<string, unknown> & { id: string | number }

export interface HistoryPage {
  items: ApprovalItem[]
  page: number
  total: number
  hasMore: boolean
  counts: StatusCounts
}

export function normalizeHistoryPage(raw: unknown, requestedPage = 1): HistoryPage {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const items = Array.isArray(r.items)
    ? (r.items.filter((i: unknown) => {
        const id = i && typeof i === 'object' ? (i as { id?: unknown }).id : undefined
        return typeof id === 'number' || typeof id === 'string'
      }) as ApprovalItem[])
    : []
  return {
    items,
    page: typeof r.page === 'number' && r.page > 0 ? r.page : requestedPage,
    total: typeof r.total === 'number' && r.total >= 0 ? r.total : items.length,
    hasMore: r.hasMore === true,
    counts: normalizeCounts(r.counts),
  }
}

/** The page to fetch after this one, or undefined when the list is complete. */
export function nextPageParam(last: HistoryPage | undefined): number | undefined {
  return last && last.hasMore ? last.page + 1 : undefined
}

// ---- search (also used on the older backend's pending list, which the server cannot search) -------------------------

const empText = (item: unknown): string => {
  const i = (item ?? {}) as Record<string, unknown>
  const e = (i.employee && typeof i.employee === 'object' ? i.employee : {}) as Record<string, unknown>
  return [i.employeeName, i.employeeCode, e.name, e.code, e.employeeCode]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase()
}

/** Every word of `query` appears in the employee's name or code. An empty query matches everything. */
export function matchesSearch(item: unknown, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = empText(item)
  return words.every((w) => hay.includes(w))
}

// ---- who decided ---------------------------------------------------------------------------------------------------

export interface ApprovalDecisionEntry {
  role: string | null
  decision: string | null
  by: string | null
  at: string | null
  comment: string | null
}

export interface ApprovalOutcome {
  /** "pending" | "in_progress" (approved by a Department Head, waiting for HR) | "approved" | "rejected" */
  state: 'pending' | 'in_progress' | 'approved' | 'rejected' | null
  yourDecision: 'approved' | 'rejected' | null
  yourDecisionAt: string | null
  yourComment: string | null
  decidedByYou: boolean
  decidedByRole: 'hod' | 'hr' | null
  decidedByName: string | null
  decidedAt: string | null
  decisions: ApprovalDecisionEntry[]
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const roleOf = (v: unknown): 'hod' | 'hr' | null => (v === 'hod' || v === 'hr' ? v : null)
const decisionOf = (v: unknown): 'approved' | 'rejected' | null => (v === 'approved' || v === 'rejected' ? v : null)

/** The `outcome` block of a list item, or null when it is missing or not that shape. */
export function normalizeOutcome(raw: unknown): ApprovalOutcome | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const states = ['pending', 'in_progress', 'inProgress', 'approved', 'rejected']
  const state = typeof r.state === 'string' && states.includes(r.state) ? r.state : null
  return {
    state: state === 'inProgress' ? 'in_progress' : (state as ApprovalOutcome['state']),
    yourDecision: decisionOf(r.yourDecision),
    yourDecisionAt: str(r.yourDecisionAt),
    yourComment: str(r.yourComment),
    decidedByYou: r.decidedByYou === true,
    decidedByRole: roleOf(r.decidedByRole),
    decidedByName: str(r.decidedByName),
    decidedAt: str(r.decidedAt),
    decisions: Array.isArray(r.decisions)
      ? r.decisions
          .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
          .map((d) => ({
            role: str(d.role),
            decision: str(d.decision),
            by: str(d.by),
            at: str(d.at),
            comment: str(d.comment),
          }))
      : [],
  }
}

export type OutcomeTone = 'approved' | 'rejected' | 'waiting'

export interface OutcomeLine {
  /** "Approved by you · 31 Oct, 10:05 AM", "Rejected by HR (Meena) · ...", "Approved by Department Head (Kavya)". */
  text: string
  /** What else the head should know: "You approved it first", "Waiting for HR's final decision". */
  note: string | null
  tone: OutcomeTone
  decider: Decider
}

/** Who decided a request on the head's page, as a band plus a note. Null for a pending request (or no outcome). */
export function outcomeLine(
  o: ApprovalOutcome | null | undefined,
  when: (iso: string) => string | null = formatWhen,
): OutcomeLine | null {
  if (!o || !o.state || o.state === 'pending') return null
  if (o.state === 'in_progress') {
    const you = o.yourDecision === 'approved'
    const hodStep = [...o.decisions].reverse().find((d) => d.role === 'hod' && d.decision === 'approved')
    const decider: Decider = {
      decision: 'approved',
      role: 'hod',
      name: you ? null : (hodStep?.by ?? null),
      at: you ? o.yourDecisionAt : (hodStep?.at ?? null),
      you,
    }
    return { text: `${deciderText(decider, when)} · waiting for HR`, note: "HR makes the final decision.", tone: 'waiting', decider }
  }
  const decider: Decider = {
    decision: o.state,
    role: o.decidedByRole,
    name: o.decidedByName,
    at: o.decidedAt,
    you: o.decidedByYou,
  }
  const note = o.yourDecision && !o.decidedByYou ? `You ${o.yourDecision} it first` : null
  return { text: deciderText(decider, when), note, tone: o.state, decider }
}

/** The comments approvers left on a decided request, newest last ("HR (Meena): Not enough staff that day"). */
export function decisionComments(o: ApprovalOutcome | null | undefined): string[] {
  if (!o) return []
  const role = (r: string | null) => (r === 'hod' ? 'Department Head' : r === 'hr' ? 'HR' : 'Approver')
  return o.decisions
    .filter((d) => d.comment)
    .map((d) => `${role(d.role)}${d.by ? ` (${d.by})` : ''}: ${d.comment}`)
}

// ---- time ----------------------------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A calendar day "YYYY-MM-DD" as a local date (never shifted by the time zone), or null. Full ISO timestamps parse too. */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "06 Oct 2026" (or "06 Oct" with `year: false`); the raw text when it does not parse; an em dash when missing. */
export function fmtDay(value: unknown, opts: { year?: boolean } = {}): string {
  const d = parseDay(value)
  if (d) {
    const base = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`
    return opts.year === false ? base : `${base} ${d.getFullYear()}`
  }
  return typeof value === 'string' && value.trim() ? value : '—'
}

/** "Waiting 3 days" / "Waiting 5 hours" / "Waiting 20 min" / "Just now" since `createdAt`, or null without a time. */
export function waitingFor(createdAt: unknown, now: Date = new Date()): string | null {
  const d = parseDay(createdAt)
  if (!d) return null
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `Waiting ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Waiting ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const days = Math.floor(hours / 24)
  return `Waiting ${days} ${days === 1 ? 'day' : 'days'}`
}

/** How urgent a wait looks: under a day "fresh", 1-2 days "aging", 3 days or more "old". */
export function waitTone(createdAt: unknown, now: Date = new Date()): 'fresh' | 'aging' | 'old' {
  const d = parseDay(createdAt)
  if (!d) return 'fresh'
  const days = (now.getTime() - d.getTime()) / 86_400_000
  return days >= 3 ? 'old' : days >= 1 ? 'aging' : 'fresh'
}

// ---- empty states --------------------------------------------------------------------------------------------------

export interface EmptyCopy {
  title: string
  description: string
}

/**
 * What an empty list says. `hodInPipeline` false = HR's pipeline for this kind has no Department Head step, so nothing
 * will ever wait for this head (the decided history can still hold requests HR decided).
 */
export function emptyCopy(
  category: ApprovalCategory,
  status: ApprovalStatus,
  opts: { search?: string; hodInPipeline?: boolean } = {},
): EmptyCopy {
  const what = CATEGORY_LABEL[category].toLowerCase().replace(/s$/, '')
  const q = opts.search?.trim()
  if (q) return { title: 'No match', description: `No ${STATUS_LABEL[status].toLowerCase()} ${what} requests for "${q}".` }
  if (status === 'pending') {
    return opts.hodInPipeline === false
      ? { title: 'Nothing for you here', description: 'These requests go to HR only, so none come to you.' }
      : { title: 'All caught up', description: `No ${what} requests are waiting for you.` }
  }
  return status === 'approved'
    ? { title: 'No approved requests yet', description: `Approved ${what} requests from your team will show here.` }
    : { title: 'No rejected requests', description: `Rejected ${what} requests from your team will show here.` }
}

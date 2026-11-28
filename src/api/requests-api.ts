// The request pages' own API calls and shapes (Leave, Casual Leave, Outpass), added for the 2026-10-31 rebuild so they
// send and read exactly what the mobile app does. The shared api/resources.ts keeps its older calls for other pages.
//
//   Leave:        POST /leave-requests with type "Leave" + reasonCategory -> the server stores type "Leave" and deducts
//                 NO leave balance (before, the web sent no type and the server deducted from every balance).
//   Casual Leave: list rows carry portion / portionLabel / days / reviewedBy...; POST takes `portion` (left out for a
//                 full day, so an older server sees what it always did); my-eligibility adds per-month left / usedParts /
//                 usedHalves, waitingThisYear and the shift halves. 2026-11-02 (yearly balance): my-eligibility adds
//                 `balance`, `rule`, `monthsUsage` and per month `rule` / `remaining` / `usedFullDates`; list rows add
//                 `source` ("employee" | "hr_edit") + `hrEditRequestId`; GET /casual-leaves/history is new.
//   Outpass:      rows carry passType / expectedReturnAt; POST takes both (optional).

import { ApiError, apiRequest } from './client'
import {
  asPortion,
  asRule,
  asStatus,
  readBalance,
  readHistory,
  readMonthsUsage,
  type CLBalance,
  type CLHistory,
  type CLLeft,
  type CLMonth,
  type CLMonthUsage,
  type CLPart,
  type CLPortion,
  type CLRule,
  type CLSource,
  type CLStatus,
  type ShiftHalves,
} from '@/lib/casual-leave'
import { readClSummary, type CLSummary } from '@/lib/cl-summary'
import type { ReasonCategory, HalfSlot } from '@/lib/leave-form'
import type { OutpassPassType } from '@/lib/outpass-open'
import type { ApprovalProgress, LeaveRequest, OutpassRequest } from '@/types'

// ---- Leave ----

export interface LeaveRow extends LeaveRequest {
  /** 'sick' | 'emergency' | 'personal' | 'other'; '' on older requests. */
  reasonCategory?: string | null
  reasonCategoryLabel?: string | null
}

export const leaveRequestsApi = {
  list: (employeeId: string) =>
    apiRequest<LeaveRow[]>({ method: 'GET', url: '/leave-requests', params: { employeeId } }).then((r) => (Array.isArray(r) ? r : [])),
  apply: (body: {
    employeeId: string
    type: string
    reasonCategory: ReasonCategory
    startDate: string
    endDate: string
    reason: string
    isHalfDay?: boolean
    halfDaySlot?: HalfSlot
  }) => apiRequest<LeaveRow>({ method: 'POST', url: '/leave-requests', data: body }),
}

// ---- Casual Leave ----

export interface CasualLeaveRow {
  id: string
  date: string
  reason: string
  status: CLStatus
  createdAt: string
  approval?: ApprovalProgress | null
  /** Full day or one half of the shift (2026-10-31). "full" on an older backend. */
  portion: CLPortion
  /** Who decided it (old rows without an approval block), with their note. */
  reviewedBy?: string | null
  reviewerRole?: string | null
  reviewComment?: string | null
  reviewedAt?: string | null
  /** 2026-11-02: "hr_edit" = written by an approved HR attendance edit (shown "by HR"); "employee" otherwise. */
  source?: CLSource
  hrEditRequestId?: number | null
}

export interface CLEligibilityFull {
  eligible: boolean
  reason: string | null
  year: number | null
  yearlyEntitlement: number | null
  usedThisYear: number | null
  remainingThisYear: number | null
  waitingThisYear: number | null
  /** Per-month answers; undefined on an older server (then `eligible` decides on its own). */
  months?: CLMonth[]
  /** The shift split into the two halves a half-day covers (null without a shift). */
  shift: ShiftHalves | null
  /** 2026-11-02: the yearly balance; null on an older server (then the one-per-month wording stays). */
  balance: CLBalance | null
  /** 2026-11-02: the rule today's requests follow. */
  rule: CLRule | null
  /** 2026-11-02: the year month by month as the server counts it (incl. Casual Leave HR proposed that still waits). */
  monthsUsage: CLMonthUsage[] | null
  /** 2026-11-28: the balance in detail (lib/cl-summary.ts); null / absent on an older server. */
  summary?: CLSummary | null
}

type Raw = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null)

function readParts(raw: unknown): CLPart[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((p): p is Raw => !!p && typeof (p as Raw).date === 'string')
    .map((p) => ({ id: (p.id as number | string | undefined) ?? undefined, date: p.date as string, portion: asPortion(p.portion), status: asStatus(p.status) }))
}

function readMonths(raw: unknown): CLMonth[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter((m): m is Raw => !!m && typeof (m as Raw).month === 'string')
    .map((m) => {
      const eligible = !!m.eligible
      const left: CLLeft = m.left === 'full' || m.left === 'one_half' || m.left === 'nothing' ? m.left : eligible ? 'full' : 'nothing'
      return {
        month: m.month as string,
        label: str(m.label) ?? (m.month as string),
        eligible,
        reason: str(m.reason),
        left,
        usedParts: readParts(m.usedParts),
        usedHalves: readParts(m.usedHalves).map(({ date, portion }) => ({ date, portion })),
        rule: asRule(m.rule),
        remaining: num(m.remaining),
        usedFullDates: Array.isArray(m.usedFullDates) ? m.usedFullDates.filter((d): d is string => typeof d === 'string').map((d) => d.slice(0, 10)) : [],
      }
    })
}

function readShift(raw: unknown): ShiftHalves | null {
  const s = raw as Raw | null
  if (!s || typeof s.start !== 'string' || typeof s.end !== 'string') return null
  return {
    name: str(s.name),
    start: s.start,
    end: s.end,
    firstHalfEnd: str(s.firstHalfEnd) ?? s.start,
    secondHalfStart: str(s.secondHalfStart) ?? s.end,
  }
}

function readClRow(r: Raw): CasualLeaveRow {
  return {
    id: String(r.id),
    date: String(r.date ?? ''),
    reason: str(r.reason) ?? '',
    status: asStatus(r.status),
    createdAt: str(r.createdAt) ?? String(r.date ?? ''),
    approval: (r.approval as ApprovalProgress | null | undefined) ?? null,
    portion: asPortion(r.portion),
    reviewedBy: str(r.reviewedBy),
    reviewerRole: str(r.reviewerRole),
    reviewComment: str(r.reviewComment),
    reviewedAt: str(r.reviewedAt),
    source: r.source === 'hr_edit' ? 'hr_edit' : 'employee',
    hrEditRequestId: num(r.hrEditRequestId),
  }
}

export const casualLeaveRequestsApi = {
  /** Every Casual Leave request of the employee (a few a year): one call, so switching years is instant. */
  list: async (employeeId: string): Promise<CasualLeaveRow[]> => {
    const raw = await apiRequest<unknown>({ method: 'GET', url: '/casual-leaves', params: { employeeId } })
    const items = Array.isArray(raw) ? raw : Array.isArray((raw as Raw)?.items) ? ((raw as Raw).items as unknown[]) : []
    return items.filter((r): r is Raw => !!r && typeof r === 'object').map(readClRow)
  },
  /** GET /casual-leaves/my-eligibility (self-scoped). Unlike the older resources call this one throws, so a failed load
   *  shows Try again instead of looking like "no answer". */
  eligibility: async (): Promise<CLEligibilityFull> => {
    const d = ((await apiRequest<unknown>({ method: 'GET', url: '/casual-leaves/my-eligibility' })) ?? {}) as Raw
    return {
      eligible: !!d.eligible,
      reason: str(d.reason),
      year: num(d.year),
      yearlyEntitlement: num(d.yearlyEntitlement),
      usedThisYear: num(d.usedThisYear),
      remainingThisYear: num(d.remainingThisYear),
      waitingThisYear: num(d.waitingThisYear),
      months: readMonths(d.months),
      shift: readShift(d.shift),
      balance: readBalance(d.balance),
      rule: asRule(d.rule),
      monthsUsage: readMonthsUsage(d.monthsUsage),
      summary: readClSummary(d.summary),
    }
  },
  /** GET /casual-leaves/history?year= (self-scoped): the year's balance as a running story. null on an older server (no
   *  such endpoint), so the page simply leaves the section out. */
  history: async (year: number): Promise<CLHistory | null> => {
    try {
      const raw = await apiRequest<unknown>({ method: 'GET', url: '/casual-leaves/history', params: { year } })
      const history = readHistory(raw)
      // 2026-11-28: the same balance in detail as my-eligibility, for this year.
      return history && { ...history, summary: readClSummary((raw as Raw | null)?.summary) }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405)) return null
      throw err
    }
  },
  /** `portion` is left out for a full day, so an older server (which knows no portion) sees what it always did. */
  apply: (body: { employeeId: string; date: string; reason: string; portion: CLPortion }) => {
    const { portion, ...rest } = body
    return apiRequest<unknown>({
      method: 'POST',
      url: '/casual-leaves',
      data: portion === 'full' ? rest : { ...rest, portion },
    })
  },
}

// ---- Outpass ----

export interface OutpassRow extends OutpassRequest {
  passType?: OutpassPassType | null
  expectedReturnAt?: string | null
}

export const outpassRequestsApi = {
  // Both self-scope to the logged-in employee server-side (backend/api/outpass_request_views.py).
  list: () => apiRequest<OutpassRow[]>({ method: 'GET', url: '/outpass-requests' }).then((r) => (Array.isArray(r) ? r : [])),
  apply: (body: { destination: string; reason: string; passType?: OutpassPassType; expectedReturnAt?: string }) =>
    apiRequest<OutpassRow>({ method: 'POST', url: '/outpass-requests', data: body }),
}

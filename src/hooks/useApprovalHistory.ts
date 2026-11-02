import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approvalsHistoryApi } from '@/api/approvals-history'
import { managerApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { retryTransient } from '@/hooks/retry'
import {
  CATEGORY_LABEL,
  nextPageParam,
  normalizeHistoryPage,
  normalizeSummary,
  type ApprovalCategory,
  type ApprovalItem,
  type ApprovalStatus,
} from '@/lib/approvals-history'
import { describeClaim } from '@/lib/holiday-work'
import { waitingText } from '@/lib/approval'
import type { ApprovalProgress, PendingHolidayWorkClaim, RequestStatus } from '@/types'

export const MANAGER_REQUESTS_KEY = ['manager-requests'] as const

/** No such route on this server (an older backend): the page falls back to the old pending list. */
const isMissingRoute = (err: unknown) => err instanceof ApiError && (err.status === 404 || err.status === 405)

/**
 * Pending / Approved / Rejected numbers per category (GET /manager/requests/summary), polled every 30 s like the old page.
 * `data` is null when the server has no such route (an older backend).
 */
export function useApprovalCounts(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...MANAGER_REQUESTS_KEY, 'summary'],
    queryFn: async () => {
      try {
        const summary = normalizeSummary(await approvalsHistoryApi.summary())
        if (!summary) throw new ApiError('The server sent an answer this page could not read.', 200)
        return summary
      } catch (err) {
        if (isMissingRoute(err)) return null
        throw err
      }
    },
    enabled: enabled && !!user,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: retryTransient,
  })
}

/** One category's list (one status), page by page, searched on the server. */
export function useApprovalHistoryList(category: ApprovalCategory, status: ApprovalStatus, search: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...MANAGER_REQUESTS_KEY, 'list', category, status, search],
    queryFn: async ({ pageParam }) =>
      normalizeHistoryPage(await approvalsHistoryApi.list({ category, status, search, page: pageParam }), pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    enabled,
    refetchInterval: status === 'pending' ? 30_000 : false,
    refetchIntervalInBackground: false,
    retry: retryTransient,
  })
}

/** The older GET /manager/pending-requests (every category's pending list at once), for a server without the history. */
export function useLegacyPendingRequests(enabled: boolean) {
  return useQuery({
    queryKey: ['manager-pending-requests'],
    queryFn: managerApi.pendingRequests,
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}

type Action = (id: string, status: RequestStatus, comment?: string) => Promise<unknown>

const ACTIONS: Record<ApprovalCategory, Action> = {
  leave: managerApi.updateLeaveStatus,
  permission: managerApi.updatePermissionStatus,
  casual_leave: managerApi.updateCasualLeaveStatus,
  attendance: managerApi.updateAttendanceStatus,
  missing_punch: managerApi.updateMissingPunchStatus,
  on_duty: managerApi.updateOnDutyStatus,
  outpass: managerApi.updateOutpassStatus,
  holiday_work: managerApi.updateHolidayWorkStatus,
  resignation: managerApi.updateResignationAction,
}

export interface DecideArgs {
  category: ApprovalCategory
  item: ApprovalItem
  decision: 'approved' | 'rejected'
  comment?: string
}

/** The words for a decision that went through: where an approval sent the request next, or what it added. */
export function decisionToast(args: DecideArgs, result: unknown): { title: string; description?: string } {
  const what = CATEGORY_LABEL[args.category] === 'Resignations' ? 'Resignation' : `${CATEGORY_LABEL[args.category]} request`
  if (args.decision === 'rejected') return { title: `${what} rejected`, description: 'The employee will be told.' }
  const r = (result && typeof result === 'object' ? result : {}) as { approval?: ApprovalProgress | null; credited?: unknown }
  if (args.category === 'holiday_work' && r.credited) {
    const claim = describeClaim(args.item as unknown as PendingHolidayWorkClaim)
    return { title: 'Compensation approved', description: `Added to ${claim.name}'s compensation balance.` }
  }
  const next = waitingText(r.approval)
  return { title: `${what} approved`, description: next ? `${next} now.` : 'The decision is final.' }
}

/**
 * Approve / reject one request through the existing PATCH endpoints (unchanged). On success or a refusal (the request
 * has moved on: not this head's turn any more, already decided, switch turned off) every list and count is read again.
 */
export function useApprovalDecision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: DecideArgs) => ACTIONS[args.category](String(args.item.id), args.decision, args.comment?.trim() || undefined),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: MANAGER_REQUESTS_KEY })
      qc.invalidateQueries({ queryKey: ['manager-pending-requests'] })
      qc.invalidateQueries({ queryKey: ['manager-me'] })
    },
  })
}

/** A refusal (the server said no) rather than a failure to reach it: what is on screen is out of date. */
export function isRefusal(err: unknown): boolean {
  return err instanceof ApiError && [400, 403, 404, 409].includes(err.status ?? 0)
}

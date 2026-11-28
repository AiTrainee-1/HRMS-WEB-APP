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
  type StatusCounts,
} from '@/lib/approvals-history'
import { feedOrder, feedStart, nextFeedCursor, type ApprovalFilter, type FeedCursor } from '@/lib/approvals-feed'
import { claimDecisionToast } from '@/lib/holiday-work'
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

export interface FeedPage {
  /** Each row carries `listStatus`: the list it came from (lib/approvals-feed.ts rowStatus). */
  items: ApprovalItem[]
  /** The category's Pending / Approved / Rejected numbers, from the first list read for this page. */
  counts: StatusCounts
  /** Where the next page starts, or null when every list of the filter has been read. */
  next: FeedCursor | null
}

/**
 * One category's list of every status together (owner 2026-11-25, lib/approvals-feed.ts): every page of Pending, then
 * Approved, then Rejected (`filter` 'all'), or one status alone. The server's three lists are unchanged (20 a page); one
 * page here fills up to 20 rows, reading on into the next status when a list ends.
 */
export function useApprovalFeed(category: ApprovalCategory, filter: ApprovalFilter, search: string, enabled: boolean) {
  const order = feedOrder(filter)
  return useInfiniteQuery({
    queryKey: [...MANAGER_REQUESTS_KEY, 'feed', category, filter, search],
    initialPageParam: feedStart(filter) as FeedCursor,
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const items: ApprovalItem[] = []
      let counts: StatusCounts | null = null
      let cursor: FeedCursor | undefined = pageParam
      while (cursor) {
        const status: ApprovalStatus = cursor.status
        const page = normalizeHistoryPage(await approvalsHistoryApi.list({ category, status, search, page: cursor.page }), cursor.page)
        counts = counts ?? page.counts
        for (const item of page.items) items.push({ ...item, listStatus: status })
        cursor = nextFeedCursor({ status, page: page.page }, page.hasMore, order)
        if (items.length >= FEED_PAGE_SIZE) break
      }
      return { items, counts: counts ?? { pending: 0, approved: 0, rejected: 0 }, next: cursor ?? null }
    },
    getNextPageParam: (last) => last.next ?? undefined,
    // While only the search text changes the previous rows stay (no skeleton flash per keystroke); another category or
    // filter never shows the last one's rows.
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey as readonly unknown[] | undefined
      return key && key[1] === 'feed' && key[2] === category && key[3] === filter ? previous : undefined
    },
    enabled,
    // Pending is what the head has to act on: keep a list that holds it as fresh as the counts. History changes rarely.
    refetchInterval: order.includes('pending') ? 30_000 : false,
    refetchIntervalInBackground: false,
    retry: retryTransient,
  })
}

const FEED_PAGE_SIZE = 20

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
  birthday_compensation: managerApi.updateBirthdayCompensationStatus,
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
  const r = (result && typeof result === 'object' ? result : {}) as { approval?: ApprovalProgress | null }
  if (args.category === 'holiday_work') {
    // Any compensation claim kind: the server's own `effect` sentence, else what the kind does (credited, allowance, day off).
    const claim = claimDecisionToast(args.item as unknown as PendingHolidayWorkClaim, args.decision, result)
    if (claim) return claim
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

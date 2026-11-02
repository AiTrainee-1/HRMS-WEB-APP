import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Redirect, useSearch } from 'wouter'
import { BellRing, CheckCheck, CheckCircle2, ClipboardCheck, Clock, Info, Loader2, RefreshCw, Search, WifiOff, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EmptyState,
  ErrorState,
  KpiTile,
  PageHero,
  PageShell,
  SectionHeader,
  SkeletonList,
  StatusViews,
  listItem,
  type RequestView,
} from '@/components/kit'
import { CategoryRail } from '@/components/approvals/CategoryRail'
import { ApprovalRequestCard } from '@/components/approvals/ApprovalRequestCard'
import { DecisionDialog, type DialogTarget } from '@/components/approvals/DecisionDialog'
import { CATEGORY_META } from '@/components/approvals/categoryMeta'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { ApiError } from '@/api/client'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { useApprovalSummary } from '@/hooks/useApprovalSummary'
import {
  decisionToast,
  isRefusal,
  useApprovalCounts,
  useApprovalDecision,
  useApprovalHistoryList,
  useLegacyPendingRequests,
} from '@/hooks/useApprovalHistory'
import { useNow } from '@/hooks/useNow'
import { takesPart } from '@/lib/approval'
import { focusKey, nextToTry, readFocusParams } from '@/lib/focus-item'
import {
  APPROVAL_STATUSES,
  CATEGORY_LABEL,
  CATEGORY_WORKFLOW,
  categoryFromWire,
  emptyCopy,
  legacyItems,
  legacyPendingCounts,
  matchesSearch,
  statusFromParam,
  visibleCategories,
  type ApprovalCategory,
  type ApprovalItem,
  type ApprovalStatus,
  type CategoryCounts,
} from '@/lib/approvals-history'
import { loadErrorMessage } from '@/lib/load-error'
import { cn } from '@/lib/utils'

const TO_VIEW: Record<ApprovalStatus, RequestView> = { pending: 'waiting', approved: 'approved', rejected: 'rejected' }
const TO_STATUS: Partial<Record<RequestView, ApprovalStatus>> = { waiting: 'pending', approved: 'approved', rejected: 'rejected' }
const VIEWS: readonly RequestView[] = ['waiting', 'approved', 'rejected']

// Phones (< 768px), kit/MOBILE.md: the app's title row keeps its pill / round button at the right of the title (PageHero
// would put actions on a row of their own) and shows no KPI tiles (the app has none on this tab).
const PHONE_HERO = 'max-md:[&>div.flex]:items-center max-md:[&>div.flex>div+div]:w-auto max-md:[&>div.grid]:hidden'

/** `value`, once it has stopped changing for `ms` (the search asks the server after the typing pauses). */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = React.useState(value)
  React.useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return settled
}

/**
 * Manager Approvals for a Department Head (mirror of the mobile app's Approvals tab, 2026-10-31). Each kind of request the
 * head may see has three lists: Pending (waiting for YOUR decision now: Approve / Reject, each confirmed with an optional
 * comment), Approved (finally approved, or approved by you and now with HR) and Rejected, with WHO decided each one shown
 * prominently. Search by name or code. Server: GET /manager/requests(/summary); decisions use the unchanged PATCH
 * endpoints. An older server without the history gets the old pending list (searched here) and a note.
 * `?category=on_duty&status=approved` opens a given list.
 */
export default function Approvals() {
  const { isManager, flags, isLoading: managerLoading } = useManagerStatus()
  const summary = useApprovalSummary()
  const search = useSearch()
  const params = React.useMemo(() => new URLSearchParams(search), [search])

  const [category, setCategory] = React.useState<ApprovalCategory>(() => categoryFromWire(params.get('category')) ?? 'leave')
  const [status, setStatus] = React.useState<ApprovalStatus>(() => statusFromParam(params.get('status')) ?? 'pending')
  const [searchText, setSearchText] = React.useState('')
  const query = useDebounced(searchText.trim(), 300)
  const [target, setTarget] = React.useState<DialogTarget | null>(null)
  const nowMs = useNow()
  const now = React.useMemo(() => new Date(nowMs), [nowMs])

  // A link (a notification) may name the list to open.
  React.useEffect(() => {
    const c = categoryFromWire(params.get('category'))
    if (c) setCategory(c)
    const s = statusFromParam(params.get('status'))
    if (s) setStatus(s)
  }, [params])

  // ── data ──
  const countsQuery = useApprovalCounts(isManager)
  // null = the server has no history endpoints (an older backend): the old pending list stands in.
  const legacy = countsQuery.data === null
  const historyReady = isManager && (countsQuery.data != null || countsQuery.isError)
  const listQuery = useApprovalHistoryList(category, status, query, historyReady)
  const legacyQuery = useLegacyPendingRequests(isManager && legacy)
  const decision = useApprovalDecision()

  // Which kinds this head sees: the server's own list, else the head's switches (Leave and Permission always).
  const categories = React.useMemo(
    () => countsQuery.data?.categories ?? visibleCategories(flags as unknown as Record<string, unknown> | null),
    [countsQuery.data, flags],
  )
  // Known once the server's list or the head's switches have arrived (before that, the Leave + Permission stand-in list
  // would throw away a link's category).
  const categoriesKnown = !!countsQuery.data?.categories || flags !== null
  React.useEffect(() => {
    // HR can switch a kind off while it is open: fall back to the first one still listed.
    if (categoriesKnown && categories.length && !categories.includes(category)) setCategory(categories[0])
  }, [categoriesKnown, categories, category])

  const legacyLists = legacyQuery.data as unknown as Record<string, unknown> | undefined
  const counts: CategoryCounts = countsQuery.data?.counts ?? (legacy ? legacyPendingCounts(legacyLists) : {})
  const statusCounts = legacy ? counts[category] : (listQuery.data?.pages[0]?.counts ?? counts[category])

  const items: ApprovalItem[] = React.useMemo(() => {
    if (legacy) return status === 'pending' ? legacyItems(legacyLists, category).filter((i) => matchesSearch(i, query)) : []
    return listQuery.data?.pages.flatMap((p) => p.items) ?? []
  }, [legacy, status, legacyLists, category, query, listQuery.data])

  const active = legacy ? legacyQuery : listQuery
  const waitingFirst = countsQuery.isPending || (historyReady ? listQuery.isPending : legacy && legacyQuery.isPending)

  // A notification's View button opens ?category=<c>&focus=<id>: the item is looked for in Pending, then (decided since)
  // Approved and Rejected, a few pages each; found = scrolled to and ringed, else a note and back to the first list.
  const focusId = React.useMemo(() => readFocusParams(search).focus, [search])
  const [startStatus] = React.useState<ApprovalStatus>(() => statusFromParam(params.get('status')) ?? 'pending')
  const [focusTried, setFocusTried] = React.useState<ApprovalStatus[]>([])
  const nextStatus = focusId && !legacy ? nextToTry(APPROVAL_STATUSES, [...focusTried, status], (s) => statusCounts?.[s]) : null
  const focus = useFocusItem({
    scope: 'approvals',
    rows: waitingFirst || (active.isError && !items.length) ? undefined : items,
    idOf: (i) => i.id,
    hasMore: !legacy && (!!listQuery.hasNextPage || nextStatus !== null),
    loadMore: () => {
      if (listQuery.hasNextPage) {
        void listQuery.fetchNextPage()
      } else if (nextStatus) {
        setFocusTried((t) => [...t, status])
        setStatus(nextStatus)
      }
    },
    loadingMore: listQuery.isFetchingNextPage,
  })
  React.useEffect(() => {
    if (focus.missing) setStatus(startStatus)
  }, [focus.missing, startStatus])
  const loadError = active.isError && !items.length
  const staleError = active.isError && items.length > 0

  const totals = categories.reduce(
    (t, c) => ({
      pending: t.pending + (counts[c]?.pending ?? 0),
      approved: t.approved + (counts[c]?.approved ?? 0),
      rejected: t.rejected + (counts[c]?.rejected ?? 0),
    }),
    { pending: 0, approved: 0, rejected: 0 },
  )

  if (!managerLoading && !isManager) return <Redirect to="/employee/dashboard" />

  const changeCategory = (c: ApprovalCategory) => {
    setCategory(c)
    setSearchText('')
  }

  const refreshAll = () => {
    void countsQuery.refetch()
    void (legacy ? legacyQuery.refetch() : listQuery.refetch())
  }

  const decide = async (d: 'approved' | 'rejected', comment: string): Promise<boolean> => {
    if (!target) return false
    const args = { category: target.category, item: target.item, decision: d, comment }
    try {
      const result = await decision.mutateAsync(args)
      const t = decisionToast(args, result)
      if (d === 'approved') toast.success(t.title, { description: t.description })
      else toast(t.title, { description: t.description })
      return true
    } catch (err) {
      // The server's own words (not your turn any more, switched off, already decided ...).
      toast.error(err instanceof ApiError ? err.message : 'Could not send your decision. Check your connection and try again.')
      // A refusal means what is on screen is out of date: the lists are read again (onSettled) and the dialog closes.
      if (isRefusal(err)) setTarget(null)
      return false
    }
  }

  const label = CATEGORY_LABEL[category]
  const workflow = summary.data?.[CATEGORY_WORKFLOW[category]]
  const empty = emptyCopy(category, status, { search: query, hodInPipeline: workflow ? takesPart(workflow, 'hod') : undefined })
  const meta = CATEGORY_META[category]
  const legacyHistory = legacy && status !== 'pending'

  return (
    <>
      <PageShell width="wide">
        <PageHero
          icon={<ClipboardCheck />}
          title="Approvals"
          subtitle={
            <>
              <span className="max-md:hidden">Requests from your team. Decide the ones waiting for you, and see who decided the rest.</span>
              <span className="hidden max-md:inline">Decide your team's requests and see past decisions</span>
            </>
          }
          className={PHONE_HERO}
          actions={
            <>
              {/* Phones: the app's "N waiting" / "All clear" pill across every category, and a round refresh (no pull-to-refresh on the web). */}
              {!countsQuery.isPending && (
                <span
                  className={cn(
                    'hidden max-md:inline-flex max-md:items-center max-md:gap-[5px] max-md:rounded-full max-md:px-2.5 max-md:py-1.5 max-md:text-[12px] max-md:font-semibold max-md:whitespace-nowrap',
                    totals.pending === 0 ? 'max-md:bg-approved-bg max-md:text-approved' : 'max-md:bg-waiting-bg max-md:text-waiting',
                  )}
                >
                  {totals.pending === 0 ? <CheckCheck className="max-md:size-3.5" aria-hidden="true" /> : <BellRing className="max-md:size-3.5" aria-hidden="true" />}
                  {totals.pending === 0 ? 'All clear' : `${totals.pending} waiting`}
                </span>
              )}
              <Button variant="glass" onClick={refreshAll} disabled={active.isFetching || countsQuery.isFetching} aria-label="Refresh approvals" className="max-md:hidden">
                <RefreshCw className={active.isFetching || countsQuery.isFetching ? 'animate-spin' : undefined} aria-hidden="true" /> Refresh
              </Button>
              <Button
                variant="glass"
                size="icon"
                onClick={refreshAll}
                disabled={active.isFetching || countsQuery.isFetching}
                aria-label="Refresh approvals"
                className="hidden max-md:inline-flex max-md:size-9 max-md:rounded-full"
              >
                <RefreshCw className={active.isFetching || countsQuery.isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
              </Button>
            </>
          }
          kpis={
            countsQuery.isPending ? undefined : (
              <>
                <KpiTile label="Waiting for you" value={totals.pending} icon={Clock} tone="amber" hint={totals.pending ? 'across your team' : 'all caught up'} />
                {!legacy && <KpiTile label="Approved" value={totals.approved} icon={CheckCircle2} tone="emerald" hint="incl. with HR" />}
                {!legacy && <KpiTile label="Rejected" value={totals.rejected} icon={XCircle} tone="rose" hint="by you or HR" />}
              </>
            )
          }
        />

        <div className="grid gap-5 max-md:gap-3 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-6">
          {managerLoading ? (
            <SkeletonList variant="rows" count={5} label="Loading categories" />
          ) : (
            <CategoryRail categories={categories} value={category} counts={counts} onChange={changeCategory} panelId="approvals-list" />
          )}

          <section aria-labelledby="approvals-title" className="flex min-w-0 flex-col gap-4 max-md:gap-2.5">
            <SectionHeader
              id="approvals-title"
              icon={meta.icon}
              tone={meta.tone}
              title={`${label} requests`}
              description={
                workflow && !takesPart(workflow, 'hod')
                  ? 'HR decides these. You can still see what was decided.'
                  : status === 'pending'
                    ? 'Oldest first: the longest wait is at the top.'
                    : status === 'approved'
                      ? 'Finally approved, or approved by you and now with HR.'
                      : 'Rejected by you or by HR.'
              }
            />

            <StatusViews
              value={TO_VIEW[status]}
              onChange={(v) => setStatus(TO_STATUS[v] ?? 'pending')}
              counts={{ waiting: statusCounts?.pending ?? 0, approved: statusCounts?.approved ?? 0, rejected: statusCounts?.rejected ?? 0 }}
              views={VIEWS}
              labels={{ waiting: 'Pending' }}
              panelId="approvals-list"
              ariaLabel={`Show ${label.toLowerCase()} requests`}
              // Phones: the app's StatusSwitcher - three equal count cards across the row.
              className="max-md:[&_[role=tab]]:w-auto max-md:[&_[role=tab]]:flex-1"
            />

            <div className="relative">
              <label htmlFor="approvals-search" className="sr-only">
                Search {label.toLowerCase()} requests by name or employee code
              </label>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="approvals-search"
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={`Search ${label.toLowerCase()} by name or code`}
                className="h-11 pr-10 pl-9 max-md:h-11 max-md:pr-10"
                autoComplete="off"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText('')}
                  className="focus-ring absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {legacyHistory && (
              <p role="status" className="flex items-start gap-2 rounded-lg border border-info-border bg-info-bg px-3 py-2.5 text-[13px] text-info max-md:border-0 max-md:py-[9px] max-md:text-[12px] max-md:leading-4 max-md:font-semibold">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Approved and rejected history needs the latest server update. Your pending requests are under Pending.
              </p>
            )}
            {staleError && (
              <p role="status" className="flex items-start gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2.5 text-[13px] text-waiting max-md:border-0 max-md:py-[9px] max-md:text-[12px] max-md:leading-4 max-md:font-semibold">
                <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Could not refresh just now. Showing what was loaded before.
                <button type="button" onClick={refreshAll} className="focus-ring ml-auto rounded font-semibold underline underline-offset-2">
                  Try again
                </button>
              </p>
            )}
            {focus.missing && <FocusMissNote onDismiss={focus.dismiss} />}

            <div id="approvals-list" role="tabpanel" aria-label={`${label} requests`} aria-busy={waitingFirst} className="min-w-0">
              {waitingFirst ? (
                <SkeletonList variant="cards" count={3} label={`Loading ${label.toLowerCase()} requests`} />
              ) : loadError ? (
                <ErrorState
                  error={active.error}
                  message={loadErrorMessage(active.error, 'your team’s requests')}
                  onRetry={refreshAll}
                  retrying={active.isFetching}
                />
              ) : legacyHistory ? null : items.length === 0 ? (
                <EmptyState
                  icon={query ? Search : status === 'pending' ? CheckCircle2 : meta.icon}
                  tone={status === 'pending' && !query ? 'emerald' : 'sapphire'}
                  title={empty.title}
                  description={empty.description}
                />
              ) : (
                <ul className="grid gap-4 max-md:gap-2.5 xl:grid-cols-2">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {items.map((item, i) => (
                      <motion.li key={`${category}-${item.id}`} {...listItem(i)} layout="position" className="min-w-0" data-focus-key={focusKey('approvals', item.id)}>
                        <ApprovalRequestCard
                          category={category}
                          status={status}
                          item={item}
                          now={now}
                          busy={decision.isPending}
                          onOpen={() => setTarget({ category, status, item })}
                          onDecide={(d) => setTarget({ category, status, item, decision: d })}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
              {!legacy && listQuery.hasNextPage && items.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={() => void listQuery.fetchNextPage()} disabled={listQuery.isFetchingNextPage}>
                    {listQuery.isFetchingNextPage ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                    {listQuery.isFetchingNextPage ? 'Loading more…' : 'Show more'}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </PageShell>

      <DecisionDialog target={target} onClose={() => setTarget(null)} onDecide={decide} busy={decision.isPending} />
    </>
  )
}

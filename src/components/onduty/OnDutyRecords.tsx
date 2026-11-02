import * as React from 'react'
import { useSearch } from 'wouter'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, ChevronDown, Loader2, Route, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ApprovalState,
  EmptyState,
  ErrorState,
  GlassCard,
  SkeletonList,
  StatusViews,
  Stepper,
  collapse,
  deciderFromStamps,
  listItem,
  monthEmptyText,
  useRequestViews,
  type ViewOptions,
} from '@/components/kit'
import { PhoneMonthBar } from '@/components/employee/MonthYearPicker'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { monthPickerProps } from '@/components/requests/month-picker'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useOnDutyRecords } from '@/hooks/useOnDutyRecords'
import { clock12 } from '@/lib/approvals-items'
import { formatWhen } from '@/lib/decider'
import { focusKey, readFocusParams } from '@/lib/focus-item'
import { isCurrentMonth, monthBounds, monthKey, monthOf, monthViewHint, monthViewLabel, sameMonth, type CalMonth } from '@/lib/month-switch'
import { dayText } from '@/lib/my-requests'
import {
  formatDistance,
  monthCovered,
  onDutyDay,
  onDutyRowDetail,
  onDutyViewOptions,
  punchCells,
  type OnDutyRecord,
} from '@/lib/onduty-records'
import { cn } from '@/lib/utils'
import { JourneyDialog } from './JourneyDialog'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const BAR: Record<'approved' | 'pending' | 'rejected', { bar: string; word: string }> = {
  approved: { bar: 'bg-success', word: 'counted' },
  pending: { bar: 'bg-warning', word: 'waiting' },
  rejected: { bar: 'bg-destructive', word: 'not counted' },
}

function dayParts(date: string | null): { day: string; month: string; weekday: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '')
  if (!m) return { day: '–', month: '', weekday: '' }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return { day: String(d.getDate()).padStart(2, '0'), month: MONTHS[d.getMonth()], weekday: WEEKDAYS[d.getDay()] }
}

/** The day's four geo-punches as four bars: green counted, amber waiting, rose not counted, dashed none. */
function PunchBars({ record }: { record: OnDutyRecord }) {
  const cells = punchCells(record.punches)
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={`${record.punchCount} of 4 punches recorded`}>
      {cells.map((p, i) => {
        const n = i + 1
        const type = p ? (p.punchType === 'OUT' ? 'Out' : 'In') : n % 2 ? 'In' : 'Out'
        return (
          <li key={n} className="flex min-w-0 flex-col gap-1">
            <span className="relative h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden="true">
              {p && (
                <motion.span
                  className={cn('absolute inset-0 origin-left rounded-full', BAR[p.status].bar)}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
            </span>
            <span className={cn('truncate text-[11.5px] font-semibold tabular-nums', p ? 'text-foreground/85' : 'text-muted-foreground')}>
              {type} {p ? clock12(p.punchTime) : '—'}
              <span className="sr-only">{p ? `, ${BAR[p.status].word}` : ', not recorded'}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function RecordCard({ record, onRoute }: { record: OnDutyRecord; onRoute: () => void }) {
  const [open, setOpen] = React.useState(false)
  const { day, month, weekday } = dayParts(record.date)
  const detail = onDutyRowDetail(record)
  const mocked = record.punches.some((p) => p.isMocked)
  const fallback = deciderFromStamps({
    status: record.approvalStatus === 'active' || record.approvalStatus === 'completed' ? 'approved' : record.approvalStatus,
    hodBy: record.hodReviewedBy,
    hodAt: record.hodReviewedAt,
    hrBy: record.hrReviewedBy,
    hrAt: record.hrReviewedAt,
  })
  const comments = [
    record.hodReviewComment && `Department Head${record.hodReviewedBy ? ` (${record.hodReviewedBy})` : ''}: ${record.hodReviewComment}`,
    record.hrReviewComment && `HR${record.hrReviewedBy ? ` (${record.hrReviewedBy})` : ''}: ${record.hrReviewComment}`,
  ].filter(Boolean) as string[]
  const sent = record.createdAt ? formatWhen(record.createdAt) : null
  const panelId = `od-record-${record.id}`

  return (
    // Phones: the app's record card - 14px padding, 10px rhythm, an amber date tile, the place at 14px.
    <GlassCard className="flex flex-col gap-3 max-md:gap-2.5 max-md:p-3.5!" data-testid={`on-duty-record-${record.id}`}>
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-info-border bg-info-bg py-1.5 text-info max-md:w-12 max-md:rounded-lg max-md:border-0 max-md:bg-waiting-bg max-md:text-waiting"
        >
          <span className="font-display text-[22px] leading-6 font-semibold text-foreground max-md:text-[18px] max-md:leading-[22px] max-md:font-bold">{day}</span>
          <span className="text-[10.5px] font-bold tracking-wider max-md:text-[10px] max-md:font-black">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-5 font-semibold break-words max-md:text-[14px] max-md:leading-[19px]">{record.destination}</h3>
          <p className="text-[12.5px] text-muted-foreground max-md:text-[11.5px]">
            <span className="sr-only">{record.date ? `${weekday} ${day} ${month}` : ''} · </span>
            <span aria-hidden="true">{weekday}</span>
            {record.branchName ? ` · ${record.branchName}` : ''}
          </p>
          {detail && <p className="mt-0.5 text-[12.5px] font-medium text-foreground/80">{detail}</p>}
        </div>
      </div>

      <PunchBars record={record} />

      {mocked && (
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rejected">
          <ShieldAlert className="size-3.5" aria-hidden="true" /> Your phone said a punch location may be faked
        </p>
      )}

      <ApprovalState approval={record.approval} fallback={fallback} status={record.approvalStatus} pendingLabel="Waiting for approval" />

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={panelId} key="more" variants={collapse} initial="hidden" animate="show" exit="hidden" className="overflow-hidden">
            <div className="flex flex-col gap-3 pt-1">
              <Stepper approval={record.approval} sentAt={record.createdAt} orientation="vertical" />
              {comments.map((c) => (
                <p key={c} className="rounded-md bg-foreground/[0.04] px-3 py-1.5 text-[12.5px] italic">
                  {c}
                </p>
              ))}
              <p className="text-[11.5px] font-semibold text-muted-foreground">
                #OD-{record.id}
                {sent ? ` · Sent ${sent}` : ''}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-2 border-t hairline pt-3 max-md:border-t-0 max-md:pt-0">
        {record.journey ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRoute}
            className="min-h-11 max-md:border-0 max-md:bg-accent max-md:text-[12px] max-md:font-[800] max-md:text-primary sm:min-h-8"
          >
            <Route aria-hidden="true" /> See route{record.journey.distanceM > 0 ? ` · ${formatDistance(record.journey.distanceM)}` : ''}
          </Button>
        ) : (
          <span className="text-[12px] text-muted-foreground">No route recorded (routes are recorded by the mobile app)</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId} className="ml-auto min-h-11 sm:min-h-8">
          {open ? 'Less' : 'Details'}
          <ChevronDown className={cn('transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
        </Button>
      </div>
    </GlassCard>
  )
}

/** How many pages an older server (one that ignores `?month=`) may be paged through to cover a month. */
const MAX_AUTO_PAGES = 50

/**
 * On-Duty -> View Records: the On-Duty requests of the month the switcher shows (owner 2026-11-02; the day each one is
 * for), in the four views (Waiting / This month or "All in Sep" / Approved / Rejected - all about that month), each
 * with the day, the place, the four punches as bars, who approved or rejected it, the approval path, and "See route"
 * when the mobile app recorded the journey. The desktop month control sits in the page's section heading; the phone
 * month bar is drawn here, above the four count cards.
 *
 * Data: GET /on-duty-sessions/mine?month=YYYY-MM. A server that applies the filter echoes the month: its counts are
 * that month's. An older server ignores it: then pages are loaded (newest first) until they reach back past the start
 * of the month, and the counts are worked out here.
 */
export function OnDutyRecords({ onApply, month, onMonthChange }: { onApply: () => void; month: CalMonth; onMonthChange: (month: CalMonth) => void }) {
  const q = useOnDutyRecords(true, { month })
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items), [q.data])
  const serverMonth = q.data?.pages[0]?.month === monthKey(month)
  const pages = q.data?.pages.length ?? 0
  // An older server: keep loading older pages until the month is covered (a few pages at most in practice).
  const covered = !!q.data && (serverMonth || pages >= MAX_AUTO_PAGES || monthCovered(items ?? [], monthBounds(month).first, !!q.hasNextPage))
  const autoLoading = !!q.data && !covered && !q.isFetchNextPageError
  const { fetchNextPage, isFetchingNextPage } = q
  React.useEffect(() => {
    if (autoLoading && !isFetchingNextPage) void fetchNextPage()
  }, [autoLoading, isFetchingNextPage, fetchNextPage, pages])

  const viewOptions: ViewOptions<OnDutyRecord> = { ...onDutyViewOptions(), scope: { ...month, daysOf: onDutyDay } }
  const v = useRequestViews(items, viewOptions)
  // The server's figures cover the whole month even before every page of it is loaded; else count what is loaded.
  const counts = (serverMonth ? q.data?.pages[0]?.counts : null) ?? v.counts

  // A notification's View button opens ?mode=records&focus=<session id> (or &date= for an On-Duty punch of a day): the
  // record's month first, then the view holding it, scrolled to and ringed. A date link opens on that day's month (the
  // page starts there). A session id says nothing about its month, so it is looked up once in the full list (older pages
  // loaded when needed) and the switcher then moves to its month.
  const search = useSearch()
  const link = React.useMemo(() => readFocusParams(search), [search])
  const [located, setLocated] = React.useState<string | null>(null)
  const locator = useOnDutyRecords(!!link.focus && located !== link.focus, { poll: false })
  const locItems = React.useMemo(() => locator.data?.pages.flatMap((p) => p.items), [locator.data])
  const linkMonth = monthOf(link.date)
  const focus = useFocusItem({
    scope: 'od',
    rows: link.focus ? locItems : items,
    idOf: (r) => r.id,
    dateOf: onDutyDay,
    views: v,
    viewOptions,
    setMonth: onMonthChange,
    // A date link waits until its month is the one on screen (the page moves there when the link changes).
    enabled: !!link.focus || !linkMonth || sameMonth(linkMonth, month),
    hasMore: link.focus ? locator.hasNextPage : serverMonth ? q.hasNextPage : !covered,
    loadMore: () => void (link.focus ? locator.fetchNextPage() : q.fetchNextPage()),
    loadingMore: link.focus ? locator.isFetchingNextPage : q.isFetchingNextPage || autoLoading,
  })
  React.useEffect(() => {
    if (link.focus && (focus.found || focus.missing)) setLocated(link.focus)
  }, [link.focus, focus.found, focus.missing])
  const [route, setRoute] = React.useState<OnDutyRecord | null>(null)
  const empty = monthEmptyText(v.view, 'On-Duty requests', month, counts.month)

  return (
    <div className="flex flex-col gap-4">
      <PhoneMonthBar {...monthPickerProps(month, onMonthChange)} label="On-Duty records" className="max-md:-mb-2" />
      {!(q.isError && !q.data) && (
        <StatusViews
          value={v.view}
          onChange={v.setView}
          counts={counts}
          labels={{ month: monthViewLabel(month) }}
          monthKind="submitted"
          hint={monthViewHint('On-Duty requests', month)}
          panelId="od-records"
          ariaLabel="Show On-Duty records"
        />
      )}
      {q.isError && !!q.data && <ErrorState compact title="Could not refresh" error={q.error} what="your On-Duty records" onRetry={() => q.refetch()} retrying={q.isFetching} />}
      {focus.missing && (
        <FocusMissNote onDismiss={focus.dismiss}>
          {focus.missingBy === 'date' && focus.requested ? `There is no On-Duty record for ${dayText(focus.requested)} in this list.` : undefined}
        </FocusMissNote>
      )}

      <div id="od-records" role="tabpanel" aria-label="On-Duty records" aria-busy={q.isPending || autoLoading}>
        {q.isPending || (autoLoading && v.rows.length === 0) ? (
          <SkeletonList variant="cards" count={3} label="Loading your On-Duty records" />
        ) : q.isError && !q.data ? (
          <ErrorState error={q.error} what="your On-Duty records" onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : v.rows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={empty.title}
            description={empty.subtitle}
            action={
              v.view !== 'rejected' && isCurrentMonth(month) ? (
                <Button variant="outline" onClick={onApply}>
                  <Briefcase aria-hidden="true" /> Start On-Duty
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-4 max-md:gap-2.5 md:grid-cols-2">
            {v.rows.map((r, i) => (
              <motion.li key={r.id} {...listItem(i)} className="min-w-0" data-focus-key={focusKey('od', r.id)}>
                <RecordCard record={r} onRoute={() => setRoute(r)} />
              </motion.li>
            ))}
          </ul>
        )}
        {/* More of this month (a server that filters by month pages it too). */}
        {serverMonth && q.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="ghost" onClick={() => void q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              {q.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden="true" />}
              {q.isFetchingNextPage ? 'Loading more records…' : 'Show more records'}
            </Button>
          </div>
        )}
        {autoLoading && v.rows.length > 0 && (
          <p role="status" className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading older records…
          </p>
        )}
      </div>

      <JourneyDialog
        journeyId={route?.journey?.id ?? null}
        title={route ? `${route.destination}${route.date ? ` · ${dayParts(route.date).weekday} ${dayParts(route.date).day} ${dayParts(route.date).month}` : ''}` : ''}
        onClose={() => setRoute(null)}
      />
    </div>
  )
}

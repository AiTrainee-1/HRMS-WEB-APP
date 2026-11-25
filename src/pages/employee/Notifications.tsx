import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Bell, CheckCheck, ChevronDown, Inbox, MailOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, GlassCard, PageHero, PageShell, SegmentedControl, SkeletonList, useReducedMotion } from '@/components/kit'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { NotificationRow } from '@/components/notifications/NotificationRow'
import { NotificationDetailDialog } from '@/components/notifications/NotificationDetailDialog'
import { notificationApi } from '@/api/resources'
import { useEmploymentType } from '@/hooks/useEmploymentType'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { useNow } from '@/hooks/useNow'
import { focusKey } from '@/lib/focus-item'
import type { NotificationLinkViewer } from '@/lib/notification-target'
import {
  groupNotifications,
  shortTime,
  unreadCount,
  visibleNotifications,
  type NotificationFilter,
  type NotificationListRow,
} from '@/lib/notification-list'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'

/** Rows drawn at first (and added by "Show more"). */
const PAGE = 40
/** How long a just-ticked row stays on the Unread list, so the tick can be seen before it leaves. */
const LINGER_MS = 900
/** "Mark all read": each row's tick waits this much longer than the one above it (the first rows only). */
const RIPPLE_STEP_MS = 45
const RIPPLE_ROWS = 12

type HeaderRow = Extract<NotificationListRow<Notification>, { kind: 'header' }>

/** The list's rows as day groups: each header with the notifications under it. */
function dayGroups(rows: readonly NotificationListRow<Notification>[]): { header: HeaderRow; items: Notification[] }[] {
  const out: { header: HeaderRow; items: Notification[] }[] = []
  for (const r of rows) {
    if (r.kind === 'header') out.push({ header: r, items: [] })
    else out[out.length - 1]?.items.push(r.item)
  }
  return out
}

/**
 * The inbox as a clean to-do list (owner 2026-11-25, mirror of the mobile app's Notifications tab): grouped Today /
 * Yesterday / Earlier, one compact row each (type icon, headline, one line of the message, the time, an unread dot) with
 * a round check that marks it read (a small tick animation). Filter All / Unread with counts; Mark all read ripples the
 * ticks down the list. Clicking a row opens it in a larger, readable dialog with ONE small link to the page it is about
 * (the server's `target`, lib/notification-target.ts); the list itself never navigates.
 * `?highlight=<id>` (the bell, a push) scrolls to that notification, rings it and opens it.
 */
export default function Notifications() {
  const qc = useQueryClient()
  const reduced = useReducedMotion()
  const { isManager, isLoading: managerLoading } = useManagerStatus()
  const { isStaff, isProduction } = useEmploymentType()
  const [filter, setFilter] = React.useState<NotificationFilter>('all')
  const [lingering, setLingering] = React.useState<ReadonlySet<string>>(() => new Set())
  const [rippling, setRippling] = React.useState(false)
  const [limit, setLimit] = React.useState(PAGE)
  const [openId, setOpenId] = React.useState<string | null>(null)
  // The notification on show, kept while the dialog fades out after closing.
  const [shown, setShown] = React.useState<Notification | null>(null)
  const nowMs = useNow()
  const now = React.useMemo(() => new Date(nowMs), [nowMs])

  // Timers this page starts (lingering rows, the ripple), cleared when it goes.
  const timers = React.useRef<number[]>([])
  React.useEffect(() => {
    const list = timers.current
    return () => list.forEach((t) => window.clearTimeout(t))
  }, [])
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }

  // The same key as the bell in the top bar, so both stay in step.
  const q = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list })

  const setRead = (ids: Set<string> | 'all') =>
    qc.setQueryData<Notification[]>(['notifications'], (old) => old?.map((n) => (ids === 'all' || ids.has(String(n.id)) ? { ...n, isRead: true } : n)))

  const markRead = useMutation({
    mutationFn: notificationApi.markRead,
    onMutate: (id: string) => setRead(new Set([String(id)])),
    // The server answers with the row itself (incl. its `target`): keep the cache in step with it.
    onSuccess: (row, id) => {
      if (!row || typeof row !== 'object' || String(row.id) !== String(id)) return
      qc.setQueryData<Notification[]>(['notifications'], (old) => old?.map((n) => (String(n.id) === String(id) ? { ...n, ...row, isRead: true } : n)))
    },
    onError: () => {
      toast.error('Could not mark it as read. Please try again.')
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAll = useMutation({
    mutationFn: notificationApi.markAllRead,
    // Ticked at once (the ripple shows it); put back from the server if it fails.
    onMutate: () => setRead('all'),
    onError: () => {
      toast.error('Could not mark them as read. Please try again.')
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const all = React.useMemo(() => q.data ?? [], [q.data])
  const unread = unreadCount(all)
  const visible = React.useMemo(() => visibleNotifications(all, filter, lingering), [all, filter, lingering])
  const groups = React.useMemo(() => dayGroups(groupNotifications(visible.slice(0, limit), now)), [visible, limit, now])
  const hasMore = visible.length > limit
  const viewer: NotificationLinkViewer = {
    isManager: managerLoading ? null : isManager,
    isStaff: isProduction ? false : isStaff ? true : null,
  }

  const changeFilter = (f: NotificationFilter) => {
    setFilter(f)
    setLimit(PAGE)
  }

  const tick = (n: Notification) => {
    if (n.isRead) return
    markRead.mutate(n.id)
    if (filter === 'unread') {
      const id = String(n.id)
      setLingering((s) => new Set(s).add(id))
      later(() => {
        setLingering((s) => {
          const next = new Set(s)
          next.delete(id)
          return next
        })
      }, LINGER_MS)
    }
  }

  const onMarkAll = () => {
    if (!unread || markAll.isPending) return
    const ids = all.filter((n) => !n.isRead).map((n) => String(n.id))
    if (!reduced) {
      setRippling(true)
      later(() => setRippling(false), RIPPLE_ROWS * RIPPLE_STEP_MS + 800)
    }
    if (filter === 'unread') {
      setLingering(new Set(ids))
      later(() => setLingering(new Set()), LINGER_MS + RIPPLE_ROWS * RIPPLE_STEP_MS)
    }
    markAll.mutate()
  }

  // Opening it is reading it: the row's check ticks behind the dialog.
  const openDetail = (n: Notification) => {
    setShown(n)
    setOpenId(String(n.id))
    if (!n.isRead) markRead.mutate(n.id)
  }
  const openItem = (openId ? all.find((n) => String(n.id) === openId) : null) ?? shown

  // ?highlight=<id>: point at that notification (showing All when it is read and Unread is on, and drawing the list down
  // to it), then open it.
  const highlight = useFocusItem({
    scope: 'notification',
    param: 'highlight',
    rows: q.data,
    idOf: (n) => n.id,
    reveal: (n) => {
      if (filter === 'unread' && n.isRead) setFilter('all')
      const at = all.findIndex((x) => String(x.id) === String(n.id))
      if (at >= limit) setLimit(at + PAGE)
    },
  })
  const highlighted = highlight.found
  const openRef = React.useRef(openDetail)
  openRef.current = openDetail
  React.useEffect(() => {
    if (!highlighted) return
    const t = window.setTimeout(() => openRef.current(highlighted), 550)
    return () => window.clearTimeout(t)
  }, [highlighted])

  // Each row's place in the list, for the entrance stagger and the "Mark all read" ripple.
  let position = 0
  const readShare = all.length ? (all.length - unread) / all.length : 0

  return (
    <>
      <PageShell width="narrow">
        <>
          <PageHero
            className="max-md:hidden"
            icon={<Bell />}
            title="Notifications"
            subtitle={
              q.data
                ? unread > 0
                  ? `${unread} unread. Tick one off, or open it to read it in full.`
                  : 'All caught up.'
                : 'Decisions on your requests, reminders and news from HR.'
            }
            actions={
              unread > 0 ? (
                <Button variant="outline" onClick={onMarkAll} disabled={markAll.isPending} data-testid="notifications-mark-all">
                  <CheckCheck aria-hidden="true" /> Mark all read
                </Button>
              ) : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-4">
              <SegmentedControl<NotificationFilter>
                ariaLabel="Show notifications"
                value={filter}
                onChange={changeFilter}
                options={[
                  { value: 'all', label: 'All', icon: Inbox, count: q.data ? all.length : undefined },
                  { value: 'unread', label: 'Unread', icon: MailOpen, count: q.data ? unread : undefined },
                ]}
              />
              {all.length > 0 && <ReadProgress share={readShare} className="min-w-[140px] flex-1 sm:max-w-[220px]" />}
            </div>
          </PageHero>
          {/* Phones (< 768px): the mobile app's header - "Notifications" with the "N New" pill and "N unread" / "All caught
              up", "Read All" at the right, the read-share line, then the All / Unread pills. */}
          <div className="hidden max-md:block">
            <div className="max-md:flex max-md:items-start max-md:gap-2.5">
              <div className="max-md:min-w-0 max-md:flex-1">
                <div className="max-md:flex max-md:items-center max-md:gap-2">
                  <h1 className="max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-7 max-md:font-bold">Notifications</h1>
                  {unread > 0 && (
                    <span className="max-md:rounded-full max-md:bg-primary max-md:px-2 max-md:py-0.5 max-md:text-[10px] max-md:font-[800] max-md:text-primary-foreground max-md:tabular-nums">
                      {unread} New
                    </span>
                  )}
                </div>
                <p className="max-md:mt-0.5 max-md:text-[12px] max-md:text-muted-foreground">
                  {q.data ? (unread > 0 ? `${unread} unread` : 'All caught up') : 'Decisions, reminders and news from HR'}
                </p>
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={onMarkAll}
                  disabled={markAll.isPending}
                  aria-label="Mark all notifications as read"
                  className="focus-ring max-md:-my-1 max-md:flex max-md:min-h-11 max-md:shrink-0 max-md:items-center max-md:gap-1 max-md:rounded-full max-md:bg-accent max-md:px-3 max-md:text-[11px] max-md:font-bold max-md:text-primary max-md:disabled:opacity-60"
                >
                  <CheckCheck className="max-md:size-3.5" aria-hidden="true" /> Read All
                </button>
              )}
            </div>
            {all.length > 0 && <ReadProgress share={readShare} className="max-md:mt-2.5" />}
            <div role="group" aria-label="Show notifications" className="max-md:mt-3 max-md:flex max-md:gap-2">
              {[
                { value: 'all' as const, label: 'All', count: all.length },
                { value: 'unread' as const, label: 'Unread', count: unread },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => changeFilter(f.value)}
                  aria-pressed={filter === f.value}
                  className={cn(
                    'focus-ring max-md:min-h-9 max-md:rounded-full max-md:border max-md:px-3.5 max-md:text-[12px] max-md:font-bold',
                    filter === f.value
                      ? 'max-md:border-primary max-md:bg-primary max-md:text-primary-foreground'
                      : 'max-md:border-border max-md:bg-card max-md:text-secondary-foreground',
                  )}
                >
                  {f.label}
                  {q.data ? ` ${f.count}` : ''}
                </button>
              ))}
            </div>
          </div>
        </>

        <section aria-label={filter === 'unread' ? 'Unread notifications' : 'All notifications'} aria-busy={q.isPending}>
          {q.isPending ? (
            <SkeletonList variant="rows" count={6} label="Loading notifications" />
          ) : q.isError && !q.data ? (
            <ErrorState error={q.error} what="your notifications" onRetry={() => q.refetch()} retrying={q.isFetching} />
          ) : visible.length === 0 ? (
            filter === 'unread' && all.length > 0 ? (
              <EmptyState
                icon={CheckCheck}
                tone="emerald"
                title="You're all caught up"
                description="Nothing unread. Your older notifications are under All."
                action={
                  <Button variant="outline" onClick={() => changeFilter('all')}>
                    Show all
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Bell} title="No notifications yet" description="When HR decides one of your requests or sends you news, it shows here." />
            )
          ) : (
            <div className="flex flex-col gap-5 max-md:gap-4">
              {q.isError && (
                <ErrorState compact title="Could not refresh" error={q.error} what="your notifications" onRetry={() => q.refetch()} retrying={q.isFetching} />
              )}
              {highlight.missing && <FocusMissNote onDismiss={highlight.dismiss}>That notification is no longer in your list.</FocusMissNote>}
              {groups.map((g) => (
                <div key={g.header.key} className="flex flex-col gap-2">
                  <h2 className="flex items-center gap-2 px-1 text-[12px] font-bold tracking-[0.04em] text-muted-foreground uppercase max-md:text-[11px]">
                    {g.header.label}
                    <span className="font-semibold tabular-nums">· {g.header.count}</span>
                    {g.header.unread > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-px text-[11px] font-bold tracking-normal text-primary tabular-nums normal-case">
                        {g.header.unread} unread
                      </span>
                    )}
                    <span className="h-px flex-1 bg-foreground/10" aria-hidden="true" />
                  </h2>
                  <GlassCard padding="none" className="overflow-hidden">
                    <ul className="divide-y divide-foreground/[0.07]">
                      <AnimatePresence initial={false}>
                        {g.items.map((n) => {
                          const at = position++
                          return (
                            <motion.li
                              key={n.id}
                              layout="position"
                              initial={reduced ? false : { opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0, transition: { duration: 0.28, delay: Math.min(at, 12) * 0.025 } }}
                              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: 0.22 } }}
                              data-focus-key={focusKey('notification', n.id)}
                            >
                              <NotificationRow
                                n={n}
                                time={shortTime(n.createdAt, now)}
                                tickDelay={rippling ? Math.min(at, RIPPLE_ROWS) * RIPPLE_STEP_MS : 0}
                                onOpen={() => openDetail(n)}
                                onTick={() => tick(n)}
                              />
                            </motion.li>
                          )
                        })}
                      </AnimatePresence>
                    </ul>
                  </GlassCard>
                </div>
              ))}
              {hasMore && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                    <ChevronDown aria-hidden="true" /> Show more
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>
      </PageShell>

      <NotificationDetailDialog n={openItem} open={openId !== null} now={now} viewer={viewer} onClose={() => setOpenId(null)} />
    </>
  )
}

/** How much of the inbox has been read, as a thin line with its words. */
function ReadProgress({ share, className }: { share: number; className?: string }) {
  const pct = Math.round(share * 100)
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.08]"
        role="progressbar"
        aria-label="Notifications read"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <motion.div className="h-full rounded-full bg-success" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: 0.45, ease: 'easeOut' }} />
      </div>
      <span className="text-[11.5px] font-semibold whitespace-nowrap text-muted-foreground tabular-nums">{pct}% read</span>
    </div>
  )
}

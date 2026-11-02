import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'wouter'
import { toast } from 'sonner'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BellRing,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCheck,
  DoorOpen,
  FileSignature,
  FileText,
  Fingerprint,
  HandCoins,
  Inbox,
  MailOpen,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Send,
  Timer,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  GlassCard,
  PageHero,
  PageShell,
  SegmentedControl,
  SkeletonList,
  TONE_SOFT,
  listItem,
  relativeTime,
  type Tone,
} from '@/components/kit'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { notificationApi } from '@/api/resources'
import { useEmploymentType } from '@/hooks/useEmploymentType'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useManagerStatus } from '@/hooks/useManagerStatus'
import { focusKey } from '@/lib/focus-item'
import { notificationLink, targetOf, type NotificationLinkViewer } from '@/lib/notification-target'
import { groupByDay, isApprovalNudge, timeOfDay } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import type { Notification } from '@/types'

// Every `type` the backend sends that has an icon of its own (push_messages.notification_type, approval_workflow,
// mobile_reminder_views ...); anything else gets the generic bell.
const ICONS: Record<string, { icon: LucideIcon; tone: Tone }> = {
  leave: { icon: Send, tone: 'sapphire' },
  permission: { icon: Timer, tone: 'violet' },
  casual_leave: { icon: CalendarClock, tone: 'violet' },
  attendance: { icon: CalendarCheck, tone: 'emerald' },
  resignation: { icon: FileSignature, tone: 'rose' },
  chat: { icon: MessageCircle, tone: 'sapphire' },
  on_duty: { icon: Briefcase, tone: 'sapphire' },
  missing_punch: { icon: Fingerprint, tone: 'amber' },
  outpass: { icon: DoorOpen, tone: 'slate' },
  employee_request: { icon: FileText, tone: 'sapphire' },
  compensation: { icon: HandCoins, tone: 'violet' },
  holiday_work: { icon: PartyPopper, tone: 'amber' },
  approval_reminder: { icon: BellRing, tone: 'amber' },
  salary_slip: { icon: Wallet, tone: 'emerald' },
  id_card: { icon: BadgeCheck, tone: 'sapphire' },
  offer_letter: { icon: FileText, tone: 'sapphire' },
  experience_letter: { icon: FileText, tone: 'sapphire' },
  resignation_letter: { icon: FileText, tone: 'sapphire' },
  general: { icon: Megaphone, tone: 'sapphire' },
}

type Filter = 'all' | 'unread'

// Phones: the app's NotificationCard has a 3px left edge in the notification's colour.
const PHONE_EDGE: Record<Tone, string> = {
  sapphire: 'max-md:border-l-info!',
  amber: 'max-md:border-l-waiting!',
  emerald: 'max-md:border-l-approved!',
  rose: 'max-md:border-l-rejected!',
  violet: 'max-md:border-l-violet!',
  slate: 'max-md:border-l-neutral!',
}

/**
 * The inbox: every notification the employee was sent, newest first, grouped by day (Today, Yesterday, ...). Titles from
 * WhatsApp-made notifications show in bold over the message. Each one has two buttons (owner 2026-11-02):
 *   Read - marks it read (a read one shows a quiet "Read" instead);
 *   View - when it is about something with a page: marks it read and opens that exact request / event (the server's
 *          `target`, lib/notification-target.ts; a leave decision opens that leave, "... is waiting for your approval"
 *          opens it in Approvals for a head). The card itself no longer navigates.
 * `?highlight=<id>` (the bell, a push tap) scrolls to that notification and rings it. Filter All / Unread; mark all read.
 */
export default function Notifications() {
  const qc = useQueryClient()
  const { isManager, isLoading: managerLoading } = useManagerStatus()
  const { isStaff, isProduction } = useEmploymentType()
  const [filter, setFilter] = React.useState<Filter>('all')

  // The same key as the bell in the top bar, so both stay in step.
  const q = useQuery({ queryKey: ['notifications'], queryFn: notificationApi.list })

  const setRead = (ids: Set<string> | 'all') =>
    qc.setQueryData<Notification[]>(['notifications'], (old) => old?.map((n) => (ids === 'all' || ids.has(n.id) ? { ...n, isRead: true } : n)))

  const markRead = useMutation({
    mutationFn: notificationApi.markRead,
    onMutate: (id: string) => setRead(new Set([id])),
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
    onSuccess: (r) => {
      setRead('all')
      toast.success(r?.updated ? `Marked ${r.updated} as read` : 'All caught up')
    },
    onError: () => toast.error('Could not mark them as read. Please try again.'),
  })

  const all = q.data ?? []
  const unread = all.filter((n) => !n.isRead).length
  const shown = filter === 'unread' ? all.filter((n) => !n.isRead) : all
  const groups = React.useMemo(() => groupByDay(shown, (n) => n.createdAt), [shown])
  const viewer: NotificationLinkViewer = {
    isManager: managerLoading ? null : isManager,
    isStaff: isProduction ? false : isStaff ? true : null,
  }

  // ?highlight=<id>: point at that notification (showing All when it is read and Unread is on).
  const highlight = useFocusItem({
    scope: 'notification',
    param: 'highlight',
    rows: q.data,
    idOf: (n) => n.id,
    reveal: (n) => {
      if (filter === 'unread' && n.isRead) setFilter('all')
    },
  })

  let index = 0
  return (
    // Phones (< 768px): the mobile app's Notifications tab (app/(tabs)/notifications.tsx, kit/MOBILE.md) - "Notifications"
    // with the "N New" pill and "N unread" / "All caught up", the "Read All" pill at the right, All / Unread filter pills,
    // then the cards (a 3px coloured left edge, round icon, Read / View pills under the text).
    <PageShell width="narrow">
      <>
        <PageHero
          className="max-md:hidden"
          icon={<Bell />}
          title="Notifications"
          subtitle="Decisions on your requests, reminders and news from HR."
          actions={
            unread > 0 ? (
              <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
                <CheckCheck aria-hidden="true" /> Mark all read
              </Button>
            ) : undefined
          }
        >
          <SegmentedControl<Filter>
            ariaLabel="Show notifications"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', icon: Inbox, count: q.data ? all.length : undefined },
              { value: 'unread', label: 'Unread', icon: MailOpen, count: q.data ? unread : undefined },
            ]}
          />
        </PageHero>
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
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                aria-label="Mark all notifications as read"
                className="focus-ring max-md:-my-1 max-md:flex max-md:min-h-11 max-md:shrink-0 max-md:items-center max-md:gap-1 max-md:rounded-full max-md:bg-accent max-md:px-3 max-md:text-[11px] max-md:font-bold max-md:text-primary max-md:disabled:opacity-60"
              >
                <CheckCheck className="max-md:size-3.5" aria-hidden="true" /> Read All
              </button>
            )}
          </div>
          <div role="group" aria-label="Show notifications" className="max-md:mt-3 max-md:flex max-md:gap-2">
            {([
              { value: 'all' as const, label: 'All', count: all.length },
              { value: 'unread' as const, label: 'Unread', count: unread },
            ]).map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
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
        ) : shown.length === 0 ? (
          filter === 'unread' && all.length > 0 ? (
            <EmptyState
              icon={CheckCheck}
              tone="emerald"
              title="You're all caught up"
              description="Nothing unread. Your older notifications are under All."
              action={
                <Button variant="outline" onClick={() => setFilter('all')}>
                  Show all
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Bell} title="No notifications yet" description="When HR decides one of your requests or sends you news, it shows here." />
          )
        ) : (
          <div className="flex flex-col gap-6 max-md:gap-4">
            {q.isError && (
              <ErrorState compact title="Could not refresh" error={q.error} what="your notifications" onRetry={() => q.refetch()} retrying={q.isFetching} />
            )}
            {highlight.missing && <FocusMissNote onDismiss={highlight.dismiss}>That notification is no longer in your list.</FocusMissNote>}
            {groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-2">
                <h2 className="label-caps flex items-center gap-2 px-1 text-muted-foreground">
                  {g.label}
                  <span className="h-px flex-1 bg-foreground/10" aria-hidden="true" />
                  <span className="tabular-nums">{g.items.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {g.items.map((n) => (
                      <motion.li key={n.id} {...listItem(index++)} layout="position" data-focus-key={focusKey('notification', n.id)}>
                        <NotificationRow n={n} viewer={viewer} onRead={() => markRead.mutate(n.id)} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}

/**
 * One notification: its icon, title, message and time, then the two actions. Read marks it read (a read one shows a
 * quiet "Read" instead of the button); View (only when it is about something with a page) marks it read and opens it.
 * The card itself is not a link any more, so a stray tap never leaves the page.
 */
function NotificationRow({ n, viewer, onRead }: { n: Notification; viewer: NotificationLinkViewer; onRead: () => void }) {
  const target = targetOf(n)
  const nudge = target?.role === 'approver' || isApprovalNudge(n.type, n.message)
  const iconOf = (key: string | undefined) => (key && Object.hasOwn(ICONS, key) ? ICONS[key] : undefined)
  const meta = iconOf(n.type) ?? (nudge ? ICONS.approval_reminder : (iconOf(target?.kind) ?? { icon: Bell, tone: 'slate' as Tone }))
  const Icon = meta.icon
  const link = notificationLink(n, viewer)
  const unread = !n.isRead
  // Says which notification a button is for (every row has the same two buttons).
  const name = (n.title || n.message || '').replace(/\s+/g, ' ').trim().slice(0, 60)
  // Phones: a long message folds to 6 lines with "Show more" (the app's NotificationCard). `clamped` is measured on the
  // real text (it is only ever true on a phone, where the clamp applies); desktop shows the whole message as before.
  const [expanded, setExpanded] = React.useState(false)
  const [clamped, setClamped] = React.useState(false)
  const messageRef = React.useRef<HTMLParagraphElement>(null)
  React.useEffect(() => {
    const el = messageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => setClamped(el.scrollHeight - el.clientHeight > 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [n.message, expanded])

  return (
    <div className={cn('relative rounded-xl', unread && 'bg-info-bg/40 max-md:bg-transparent')} data-testid="notification" data-unread={unread}>
      {unread && <span aria-hidden="true" className="bg-silk absolute inset-y-2 left-0 w-[3px] rounded-full max-md:hidden" />}
      <GlassCard padding="sm" className={cn('flex min-w-0 items-start gap-3 max-md:relative max-md:border-l-[3px]! max-md:p-3.5', PHONE_EDGE[meta.tone])}>
        <span
          aria-hidden="true"
          className={cn('relative grid size-10 shrink-0 place-items-center rounded-xl border max-md:size-[42px] max-md:rounded-full max-md:border-0', TONE_SOFT[meta.tone], !unread && 'max-md:opacity-75')}
        >
          <Icon className="size-[18px] max-md:size-5" />
          {unread && <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-card bg-primary max-md:hidden" />}
        </span>
        {unread && <span aria-hidden="true" className="hidden max-md:absolute max-md:top-[18px] max-md:right-3.5 max-md:block max-md:size-2 max-md:rounded-full max-md:bg-primary" />}
        <div className="min-w-0 flex-1 max-md:pr-3">
          {n.title && (
            <p className={cn('text-[14px] leading-5 break-words max-md:font-semibold', unread ? 'font-bold' : 'font-semibold max-md:text-secondary-foreground max-md:opacity-75')}>{n.title}</p>
          )}
          <p
            ref={messageRef}
            id={`n-msg-${n.id}`}
            className={cn(
              'text-[13.5px] leading-5 break-words whitespace-pre-line max-md:mt-0.5 max-md:text-[13px] max-md:leading-[18px]',
              unread && !n.title ? 'font-semibold text-foreground' : 'text-foreground/85 max-md:text-secondary-foreground',
              !unread && 'max-md:opacity-75',
              !expanded && 'max-md:line-clamp-6',
            )}
          >
            {n.message}
          </p>
          {(expanded || clamped) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={`n-msg-${n.id}`}
              className="focus-ring hidden max-md:-mb-1 max-md:inline-flex max-md:min-h-9 max-md:items-center max-md:rounded-md max-md:text-[12px] max-md:font-bold max-md:text-primary"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          <p className={cn('mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground max-md:text-[11px]', !unread && 'max-md:opacity-75')}>
            <time dateTime={n.createdAt} title={relativeTime(n.createdAt)}>
              {timeOfDay(n.createdAt)}
            </time>
            {unread && <span className="font-semibold text-info">· New</span>}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 max-md:mt-2.5">
            {unread ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRead}
                className="min-h-11 max-md:border-[1.5px] max-md:border-primary max-md:bg-card max-md:px-3.5 max-md:text-[13px] max-md:font-[800] max-md:text-primary sm:min-h-8"
                aria-label={`Mark as read: ${name}`}
              >
                <Check aria-hidden="true" /> Read
              </Button>
            ) : (
              <span className="inline-flex min-h-8 items-center gap-1.5 px-1 text-[12.5px] font-medium text-muted-foreground max-md:min-h-11 max-md:font-bold">
                <CheckCheck className="size-4" aria-hidden="true" />
                <span className="sr-only">Already read</span>
                <span aria-hidden="true">Read</span>
              </span>
            )}
            {link && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="min-h-11 border-info-border bg-info-bg text-info hover:border-info hover:bg-info-bg max-md:border-transparent max-md:bg-primary max-md:px-4 max-md:text-[13px] max-md:font-[800] max-md:text-primary-foreground sm:min-h-8"
              >
                <Link
                  href={link.href}
                  onClick={() => {
                    if (unread) onRead()
                  }}
                  aria-label={`${link.label}: ${name}`}
                >
                  {link.label} <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

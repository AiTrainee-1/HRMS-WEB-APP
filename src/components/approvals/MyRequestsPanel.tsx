import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  BellRing,
  CalendarClock,
  CalendarCog,
  CalendarX2,
  Clock,
  DoorOpen,
  FileSignature,
  FileText,
  Fingerprint,
  HandCoins,
  Hourglass,
  Loader2,
  MapPin,
  MessageSquareText,
  Send,
  Timer,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DecisionBadge,
  EmptyState,
  ErrorState,
  GlassCard,
  RingMeter,
  SectionHeader,
  SkeletonList,
  StatusPill,
  Stepper,
  SuccessCheck,
  listItem,
  popIn,
} from '@/components/kit'
import { FocusMissNote } from '@/components/requests/FocusMissNote'
import { useFocusItem } from '@/hooks/useFocusItem'
import { useMyPendingRequests, useRemindApprover } from '@/hooks/useMyPendingRequests'
import { useNow } from '@/hooks/useNow'
import { focusKey } from '@/lib/focus-item'
import {
  cooldownProgress,
  cooldownText,
  decisionLine,
  remindErrorText,
  remindLabel,
  retryAfterSeconds,
  secondsUntilRemind,
  shortDateTime,
  stepperSteps,
  waitingSinceText,
  type PendingRequest,
  type RecentHrEdit,
} from '@/lib/pending-reminders'
import { cn } from '@/lib/utils'

const MODULE_ICON: Record<string, LucideIcon> = {
  leave: Send,
  permission: Timer,
  casual_leave: CalendarClock,
  missing_punch: Fingerprint,
  on_duty: MapPin,
  outpass: DoorOpen,
  attendance_correction: CalendarCog,
  resignation: FileSignature,
  advance: HandCoins,
  request: MessageSquareText,
}

/** A request's wait as it is NOW: from the server's own figure at fetch time, or from a reminder this page just sent. */
interface Override {
  remindInSeconds: number
  at: number
  lastRemindedAt: string | null
}

/**
 * My Department Head -> "My Requests": the employee's own requests still waiting for an answer (and the attendance changes
 * HR raised for them), each with where it stands, the approval path, and "Remind Department Head / HR" - once per request
 * every 24 hours, counted down from the server's own figure. Under it, HR's attendance changes of the last 30 days.
 */
export function MyRequestsPanel() {
  const q = useMyPendingRequests()
  const remind = useRemindApprover()
  const now = useNow(30_000)
  const [overrides, setOverrides] = React.useState<Record<string, Override>>({})
  const [sent, setSent] = React.useState<{ key: string; name: string } | null>(null)
  const [busyKey, setBusyKey] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!sent) return
    const t = window.setTimeout(() => setSent(null), 2600)
    return () => window.clearTimeout(t)
  }, [sent])

  // A fresh list from the server replaces what this page counted itself.
  React.useEffect(() => {
    setOverrides({})
  }, [q.dataUpdatedAt])

  // A notification's View button opens ?tab=requests&focus=<module>-<id> (an attendance change HR proposed:
  // "attendance_correction-<id>"): found among the waiting requests or HR's recent changes, scrolled to and ringed.
  const focusRows = React.useMemo(() => (q.data ? [...q.data.items, ...q.data.recentHrEdits] : undefined), [q.data])
  const focus = useFocusItem({ scope: 'my-requests', rows: focusRows, idOf: (r) => r.key })

  if (q.isPending) return <SkeletonList variant="cards" count={3} label="Loading your requests" />
  if (q.isError && !q.data) {
    return <ErrorState error={q.error} what="your waiting requests" onRetry={() => q.refetch()} retrying={q.isFetching} />
  }
  const data = q.data

  const secondsLeft = (item: PendingRequest) => {
    const o = overrides[item.key]
    if (o) return Math.max(0, o.remindInSeconds - Math.floor((now - o.at) / 1000))
    return secondsUntilRemind(item, q.dataUpdatedAt, now)
  }

  const onRemind = async (item: PendingRequest) => {
    setBusyKey(item.key)
    try {
      const result = await remind.mutateAsync({ module: item.module, id: item.id })
      const wait = result.item?.remindInSeconds ?? data.cooldownHours * 3600
      setOverrides((o) => ({ ...o, [item.key]: { remindInSeconds: wait, at: Date.now(), lastRemindedAt: result.item?.lastRemindedAt ?? new Date().toISOString() } }))
      setSent({ key: item.key, name: item.approver.role === 'hod' ? item.approver.name : 'HR' })
      toast.success('Reminder sent', { description: result.message })
    } catch (err) {
      toast.error(remindErrorText(err))
      const wait = retryAfterSeconds(err)
      if (wait) setOverrides((o) => ({ ...o, [item.key]: { remindInSeconds: wait, at: Date.now(), lastRemindedAt: item.lastRemindedAt } }))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-md:gap-3">
      {q.isError && (
        <ErrorState compact title="Could not refresh" error={q.error} what="your waiting requests" onRetry={() => q.refetch()} retrying={q.isFetching} />
      )}
      {focus.missing && (
        <FocusMissNote onDismiss={focus.dismiss}>That request is no longer in this list. It may have been decided already.</FocusMissNote>
      )}

      <section aria-labelledby="my-requests-title" className="flex flex-col gap-4 max-md:gap-3">
        <SectionHeader
          id="my-requests-title"
          icon={Hourglass}
          tone="amber"
          title="Waiting for an answer"
          count={data.count}
          description={`If one has waited too long, remind whoever must act now. You can remind once every ${data.cooldownHours} hours for each request.`}
          className="max-md:hidden"
        />
        {/* Phones: the app's intro note in place of the section title (the title stays the region's name). */}
        {data.items.length > 0 && (
          <p className="hidden max-md:flex max-md:items-start max-md:gap-2 max-md:rounded-xl max-md:bg-accent max-md:p-3 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-foreground">
            <BellRing className="max-md:mt-px max-md:size-4 max-md:shrink-0 max-md:text-primary" aria-hidden="true" />
            <span>
              {data.items.length === 1 ? '1 request is' : `${data.items.length} requests are`} still waiting for an answer. If one is taking long,
              remind the approver: once every {data.cooldownHours} hours per request.
            </span>
          </p>
        )}
        {data.items.length === 0 ? (
          <EmptyState icon={BellRing} tone="emerald" title="Nothing waiting" description="All your requests have an answer. New ones show here until they are decided." />
        ) : (
          <ul className="grid gap-4 max-md:gap-3 lg:grid-cols-2">
            {data.items.map((item, i) => (
              <motion.li key={item.key} {...listItem(i)} className="min-w-0" data-focus-key={focusKey('my-requests', item.key)}>
                <RequestCard
                  item={item}
                  nowMs={now}
                  secondsLeft={secondsLeft(item)}
                  cooldownHours={data.cooldownHours}
                  lastRemindedAt={overrides[item.key]?.lastRemindedAt ?? item.lastRemindedAt}
                  busy={busyKey === item.key}
                  sentTo={sent?.key === item.key ? sent.name : null}
                  onRemind={() => onRemind(item)}
                />
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <RecentHrEdits edits={data.recentHrEdits} days={data.recentDays} />
    </div>
  )
}

function RequestCard({
  item,
  nowMs,
  secondsLeft,
  cooldownHours,
  lastRemindedAt,
  busy,
  sentTo,
  onRemind,
}: {
  item: PendingRequest
  nowMs: number
  secondsLeft: number
  cooldownHours: number
  lastRemindedAt: string | null
  busy: boolean
  sentTo: string | null
  onRemind: () => void
}) {
  const Icon = MODULE_ICON[item.module] ?? FileText
  const waited = waitingSinceText(item.submittedAt, nowMs)
  const label = remindLabel(item)
  return (
    <GlassCard className="flex h-full flex-col gap-3 max-md:p-4!" data-testid={`my-request-${item.key}`}>
      <div className="flex items-start gap-3 max-md:items-center">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-info-border bg-info-bg text-info max-md:size-[42px] max-md:rounded-full max-md:border-0 max-md:bg-accent max-md:text-primary"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-5 font-semibold break-words">{item.title}</h3>
          <p className="text-[12.5px] text-muted-foreground max-md:mt-0.5 max-md:text-[11.5px]">
            {item.moduleLabel}
            {item.summary ? ` · ${item.summary}` : ''}
          </p>
        </div>
        {waited && (
          <StatusPill tone="waiting" size="sm" icon={Hourglass} dot={false}>
            {waited}
          </StatusPill>
        )}
      </div>

      {item.raisedBy === 'hr' && (
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-violet-border bg-violet-bg px-2.5 py-0.5 text-[12px] font-semibold text-violet">
          <UserCog className="size-3.5" aria-hidden="true" /> Raised by HR{item.raisedByName ? ` (${item.raisedByName})` : ''}
        </span>
      )}

      {item.change && (
        <div className="rounded-lg border border-violet-border/70 bg-violet-bg/50 px-3 py-2.5">
          <p className="label-caps text-violet">Change HR asked for</p>
          <p className="mt-1 text-[13.5px] font-semibold tabular-nums">{item.change.text}</p>
          {item.reason && <p className="mt-1 text-[12.5px] text-foreground/80">HR's reason: {item.reason}</p>}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-info max-md:w-fit max-md:max-w-full max-md:rounded-full max-md:bg-info-bg max-md:px-2.5 max-md:py-[5px] max-md:text-[11.5px]">
        <Clock className="size-3.5 shrink-0" aria-hidden="true" /> {item.stage}
      </p>

      <div className="scrollbar-none -mx-1 overflow-x-auto px-1 max-md:mx-0 max-md:rounded-lg max-md:bg-muted max-md:px-2 max-md:py-3">
        <Stepper steps={stepperSteps(item)} />
      </div>

      {!item.change && item.reason && <p className="line-clamp-2 border-l-2 border-foreground/15 pl-3 text-[13px] text-foreground/80 italic">“{item.reason}”</p>}

      {item.details.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {item.details.slice(0, 4).map((d) => (
            <div key={d.label} className="min-w-0 rounded-md bg-foreground/[0.04] px-2.5 py-1.5">
              <dt className="label-caps truncate text-muted-foreground">{d.label}</dt>
              <dd className="truncate text-[13px] font-semibold" title={d.value}>
                {d.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {item.trail.length > 0 && (
        <ul className="flex flex-col gap-1">
          {item.trail.map((t, i) => (
            <li key={i} className="text-[12.5px] text-muted-foreground">
              {t.roleLabel} {t.decision}
              {t.by ? ` (${t.by})` : ''}
              {t.at ? ` · ${shortDateTime(t.at)}` : ''}
              {t.comment ? ` · “${t.comment}”` : ''}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto border-t hairline pt-3 max-md:border-t-0 max-md:pt-1" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {sentTo ? (
            <motion.div
              key="sent"
              variants={popIn}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex items-center gap-3 max-md:min-h-[46px] max-md:rounded-lg max-md:bg-approved-bg max-md:px-3 max-md:py-2"
            >
              <SuccessCheck size={40} label="Reminder sent" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-approved">Reminder sent</p>
                <p className="truncate text-[12.5px] text-muted-foreground">{sentTo} has been asked to review it</p>
              </div>
            </motion.div>
          ) : secondsLeft > 0 ? (
            <motion.div
              key="wait"
              variants={popIn}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex items-center gap-3 max-md:min-h-[46px] max-md:rounded-lg max-md:bg-muted max-md:px-3 max-md:py-2"
            >
              <RingMeter value={cooldownProgress(secondsLeft, cooldownHours)} max={1} size={44} thickness={5} tone="amber" label="Time until you can remind again">
                <Clock className="size-4 text-waiting" aria-hidden="true" />
              </RingMeter>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tabular-nums">{cooldownText(secondsLeft)}</p>
                {lastRemindedAt && <p className="text-[12px] text-muted-foreground">Last reminded {shortDateTime(lastRemindedAt)}</p>}
              </div>
            </motion.div>
          ) : !item.workflowEnabled ? (
            <motion.p key="off" variants={popIn} initial="hidden" animate="show" exit="exit" className="text-[12.5px] text-muted-foreground">
              HR has paused this kind of request, so reminders are off.
            </motion.p>
          ) : (
            <motion.div key="go" variants={popIn} initial="hidden" animate="show" exit="exit" className="flex flex-wrap items-center gap-3 max-md:gap-2">
              {/* Phones: the app's full-width 46px Remind pill. */}
              <motion.div whileTap={{ scale: 0.96 }} className="max-md:w-full">
                <Button onClick={onRemind} disabled={busy} className="min-h-11 max-md:h-[46px] max-md:w-full sm:min-h-9" aria-label={`${label} about ${item.title}`}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
                  {busy ? 'Sending reminder…' : label}
                </Button>
              </motion.div>
              {item.reminderCount > 0 && (
                <span className="text-[12px] text-muted-foreground">
                  Reminded {item.reminderCount} {item.reminderCount === 1 ? 'time' : 'times'}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  )
}

function RecentHrEdits({ edits, days }: { edits: RecentHrEdit[]; days: number }) {
  return (
    <section aria-labelledby="hr-edits-title" className="flex flex-col gap-4 max-md:mt-2 max-md:gap-2.5">
      <SectionHeader id="hr-edits-title" icon={CalendarCog} tone="violet" title="Attendance changes by HR" count={edits.length} description={`Decided in the last ${days} days.`} />
      {edits.length === 0 ? (
        <EmptyState compact icon={CalendarX2} tone="violet" title="No changes" description={`HR has not changed your attendance in the last ${days} days.`} />
      ) : (
        <ul className="grid gap-3 max-md:gap-2 md:grid-cols-2">
          {edits.map((e, i) => (
            <motion.li key={e.key} {...listItem(i)} data-focus-key={focusKey('my-requests', e.key)}>
              <GlassCard className="flex h-full flex-col gap-2 max-md:p-3!">
                <p className="text-[14px] font-semibold tabular-nums">{e.change?.text || e.summary || e.title}</p>
                <DecisionBadge text={decisionLine(e)} tone={e.status === 'approved' ? 'approved' : 'rejected'} />
                {e.reason && <p className="text-[12.5px] text-foreground/80">HR's reason: {e.reason}</p>}
                {e.comment && <p className={cn('text-[12.5px] text-muted-foreground italic')}>Note: “{e.comment}”</p>}
              </GlassCard>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}

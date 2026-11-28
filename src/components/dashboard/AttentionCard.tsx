import { Link } from 'wouter'
import { motion } from 'framer-motion'
import {
  AlarmClock, BellRing, Briefcase, CalendarHeart, ChevronRight, DoorOpen, HandCoins, Hourglass, QrCode, type LucideIcon,
} from 'lucide-react'
import { GlassCard, SectionHeader, TONE_COLOR, TONE_SOFT, TONE_TEXT, EASE_OUT, listItem, type Tone } from '@/components/kit'
import {
  useAdvanceEligibilityLite, useClEligibility, useGeoStatusOnce, useOutpassList, usePendingRequestsLite, useSecondNow,
} from '@/hooks/useHomeSources'
import {
  CL_REMIND_DAYS, advanceAttention, casualLeaveAttention, clockText, daysLeftInMonth, onDutyAttention, openKind, openPassClock,
  outpassAttention, pendingRequestsAttention, pickOpenPass, sortAttention, type AttentionItem, type AttentionTone, type OpenPassInput,
} from '@/lib/home-attention'
import { formatSpanShort, formatTickerShort } from '@/lib/outpass-open'
import { cn } from '@/lib/utils'

const TONE: Record<AttentionTone, Tone> = { urgent: 'rose', active: 'sapphire', waiting: 'amber', money: 'emerald', leave: 'violet' }

function iconFor(item: AttentionItem): LucideIcon {
  switch (item.key) {
    case 'outpass':
      return item.tone === 'urgent' ? AlarmClock : item.title.startsWith('Gate pass ready') ? QrCode : DoorOpen
    case 'onDuty':
      return Briefcase
    case 'pending':
      return Hourglass
    case 'advance':
      return HandCoins
    default:
      return CalendarHeart
  }
}

/**
 * "Needs your attention": the few things waiting on the employee or running right now, each one click from its page
 * (most urgent first): an open gate pass with a live timer, an On-Duty day in progress, requests waiting for an answer,
 * Loan & Advance applications open, and unused Casual Leave (staff, last week of the month: this month's under the old
 * one-per-month rule; under the yearly balance only in the last week of December, when unused days lapse).
 *
 * Quiet by design: nothing shows until every source has answered once (so it appears in one go), a failed source gives
 * no row and no error, and with nothing to show the whole card is absent.
 */
export function AttentionCard({ isStaff, now }: { isStaff: boolean; now: Date }) {
  const pending = usePendingRequestsLite()
  const advances = useAdvanceEligibilityLite()
  const geo = useGeoStatusOnce()
  const outpass = useOutpassList()
  const clOn = isStaff && daysLeftInMonth(now) < CL_REMIND_DAYS
  const cl = useClEligibility(clOn)

  // The gate pass (if any) re-words itself every second; nothing else re-renders on the tick.
  const openPass = pickOpenPass<OpenPassInput>(outpass.data, Date.now())
  const settled = !pending.isLoading && !advances.isLoading && !geo.isLoading && !outpass.isLoading && !(clOn && cl.isLoading)
  if (!settled) return null

  const nowMs = Date.now()
  const rows = sortAttention([
    onDutyAttention(geo.data?.onDutySession ?? null),
    pendingRequestsAttention(pending.data, nowMs),
    advanceAttention(advances.data),
    clOn ? casualLeaveAttention(cl.data?.months, now) : null,
  ])
  const count = rows.length + (openPass ? 1 : 0)
  if (count === 0) return null

  return (
    <GlassCard
      variant="stitched"
      tone="amber"
      padding="lg"
      className="flex h-full flex-col gap-3 max-md:mb-5 max-md:gap-0 max-md:border-l! max-md:px-3.5! max-md:pt-3! max-md:pb-1! max-md:[--stitch:var(--border)]!"
    >
      <SectionHeader
        as="h2"
        id="attention-title"
        icon={BellRing}
        tone="amber"
        title="Needs your attention"
        count={count}
        description="Things waiting on you or running right now."
        className="max-md:hidden"
      />
      {/* Phones: the app's header row - bell, title, the count in a blue pill at the right. */}
      <div className="hidden max-md:mb-1 max-md:flex max-md:items-center max-md:gap-2">
        <BellRing className="max-md:size-4 max-md:shrink-0 max-md:text-primary" aria-hidden="true" />
        <h2 className="max-md:flex-1 max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold">Needs your attention</h2>
        <span className="max-md:min-w-[22px] max-md:rounded-full max-md:bg-accent max-md:px-[7px] max-md:py-0.5 max-md:text-center max-md:text-[11px] max-md:font-[800] max-md:text-primary max-md:tabular-nums">
          {count}
        </span>
      </div>
      <ul aria-labelledby="attention-title" className="flex flex-col gap-2 max-md:gap-0 max-md:[&>li+li]:border-t max-md:[&>li+li]:border-border">
        {openPass && <OutpassRow pass={openPass} />}
        {rows.map((row, i) => (
          <motion.li key={row.key} {...listItem(i + 1)}>
            <AttentionRow item={row} />
          </motion.li>
        ))}
      </ul>
    </GlassCard>
  )
}

/** The gate-pass row: re-worded every second while the tab is visible (its timer). */
function OutpassRow({ pass }: { pass: OpenPassInput }) {
  const nowMs = useSecondNow(true)
  const item = openKind(pass, nowMs) ? outpassAttention(pass, nowMs) : null
  if (!item) return null
  return (
    <motion.li {...listItem(0)}>
      <AttentionRow item={item} live phoneDetail={phoneOutpassDetail(pass, nowMs)} />
    </motion.li>
  )
}

/**
 * Phones: the same sentence as outpassAttention's, with the short figures the Outpass page uses on phones - "52 d 18 h"
 * from a day up, "4 h 12 m" from an hour up, the ticking "mm:ss" only under an hour - so a pass left open for weeks never
 * reads "Out for 1266 h 49 min". Null when there is no open pass (the row is gone then anyway).
 */
function phoneOutpassDetail(pass: OpenPassInput, nowMs: number): string | null {
  const clock = openPassClock(pass, nowMs)
  if (!clock) return null
  if (clock.kind === 'ready') return `Show the QR at the gate: ${formatTickerShort(clock.exitWindowMs)} left to go out`
  if (clock.returnInMs == null) return `Out for ${formatSpanShort(clock.elapsedMs)}`
  const back = clockText(pass.expectedReturnAt)
  if (clock.overdue) return `You were due back at ${back}: late by ${formatTickerShort(-clock.returnInMs)}`
  return `Back by ${back}: ${formatTickerShort(clock.returnInMs)} left`
}

function AttentionRow({ item, live, phoneDetail }: { item: AttentionItem; live?: boolean; phoneDetail?: string | null }) {
  const tone = TONE[item.tone]
  const Icon = iconFor(item)
  return (
    <Link
      href={item.href}
      aria-label={item.a11y}
      className="group focus-ring flex min-h-14 items-center gap-3 rounded-lg border hairline bg-card/60 p-3 transition-[background-color,border-color,transform] duration-200 hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.06] max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:py-2.5 max-md:active:opacity-75 dark:bg-white/[0.03] max-md:dark:bg-transparent"
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg border max-md:size-9 max-md:border-0', TONE_SOFT[tone], item.tone === 'urgent' && 'pulse-ring')} aria-hidden="true">
        <Icon className="size-[18px] transition-transform duration-300 group-hover:scale-110" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[14px] leading-5 font-semibold max-md:truncate max-md:text-[13px]', item.tone === 'urgent' && TONE_TEXT.rose)}>{item.title}</span>
        <span
          className={cn(
            'block text-[12.5px] leading-5 text-muted-foreground max-md:text-[12px] max-md:leading-4',
            phoneDetail ? 'max-md:hidden' : 'max-md:line-clamp-2',
            live && 'tabular-nums',
          )}
        >
          {item.detail}
        </span>
        {phoneDetail && (
          <span className="hidden max-md:line-clamp-2 max-md:text-[12px] max-md:leading-4 max-md:text-muted-foreground max-md:tabular-nums">{phoneDetail}</span>
        )}
        {item.progress != null && (
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-foreground/10 max-md:mt-[5px] max-md:bg-muted" aria-hidden="true">
            <motion.span
              className="block h-full rounded-full"
              style={{ backgroundColor: TONE_COLOR[tone] }}
              initial={false}
              animate={{ width: `${Math.round(item.progress * 100)}%` }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
            />
          </span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground max-md:size-[18px]" aria-hidden="true" />
    </Link>
  )
}

import * as React from 'react'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import {
  CalendarHeart, ChevronDown, ChevronRight, ChevronUp, Clock, Coffee, DoorOpen, Fingerprint, House, LogIn, LogOut, MapPin, Moon,
  PartyPopper, Pointer, RefreshCw, RotateCcw, Sofa, Umbrella, type LucideIcon,
} from 'lucide-react'
import { EASE_OUT, SkeletonBlock, useReducedMotion } from '@/components/kit'
import { DayMarkerChips } from '@/components/employee/DayMarkerChips'
import { InProgressNote } from '@/components/employee/InProgressNote'
import { inProgressView } from '@/lib/day-progress'
import { useMinuteNow } from '@/hooks/useHomeSources'
import { dateKey } from '@/lib/home-attention'
import {
  PUNCH_ROWS_FOLDED,
  axisNow,
  barFraction,
  dayBarModel,
  dayOffOf,
  hourText,
  pickShiftDay,
  presenceLineFor,
  punchA11y,
  punchMeta,
  punchTimeline,
  shiftProgressAt,
  shiftProgressToday,
  shiftStatusText,
  shiftTitle,
  shiftWindow,
  to12h,
  visiblePunches,
  type DayBarModel,
  type DayOffKind,
  type DayRecordLike,
  type PunchKind,
  type TimelineStep,
} from '@/lib/home-punches'
import type { DayMarkerHit } from '@/lib/attendance-flags'
import type { AssignedShift } from '@/types'
import { cn } from '@/lib/utils'

// PHONE ONLY (< 768px): the mobile app's Home "Right now / Today's punches" panel (uktextiles-employee-app
// src/components/home/TodayPanel.tsx), in place of the old four-slot tracker: the live clock, the shift with how far into it
// we are, and today's punches as a day bar plus a list labelled by what each punch is. It sits inside PhoneHomeTop's
// phone-only wrapper, so it never paints on desktop, and every class here carries the max-md: variant (kit/MOBILE.md).
// Rules: lib/home-punches.ts (the phone section). Fed by the Dashboard's month attendance and shift summary.

const KIND_ICON: Record<PunchKind, LucideIcon> = {
  arrived: LogIn,
  came_back: RotateCcw,
  in_again: LogIn,
  stepped_out: Coffee,
  out: LogOut,
  left: House,
}

const KIND_TONE: Record<PunchKind, string> = {
  arrived: 'max-md:bg-approved-bg max-md:text-approved',
  came_back: 'max-md:bg-approved-bg max-md:text-approved',
  in_again: 'max-md:bg-approved-bg max-md:text-approved',
  stepped_out: 'max-md:bg-waiting-bg max-md:text-waiting',
  out: 'max-md:bg-waiting-bg max-md:text-waiting',
  left: 'max-md:bg-info-bg max-md:text-info',
}

const DAY_OFF_LOOK: Record<DayOffKind, { icon: LucideIcon; cls: string }> = {
  leave: { icon: Umbrella, cls: 'max-md:bg-violet-bg max-md:text-violet' },
  casual_leave: { icon: CalendarHeart, cls: 'max-md:bg-violet-bg max-md:text-violet' },
  holiday: { icon: PartyPopper, cls: 'max-md:bg-waiting-bg max-md:text-waiting' },
  weekly_off: { icon: Sofa, cls: 'max-md:bg-neutral-bg max-md:text-neutral' },
}

export function PhoneTodayPanel({
  records,
  shift,
  shiftLoading,
  markers,
  loading,
  failed,
  retrying,
  onRetry,
}: {
  /** This month's attendance records (today's, and yesterday's for a night worker still on last night's shift). */
  records: readonly DayRecordLike[]
  shift: AssignedShift | null | undefined
  shiftLoading: boolean
  markers: DayMarkerHit[]
  loading: boolean
  failed: boolean
  retrying: boolean
  onRetry: () => void
}) {
  const now = useMinuteNow()
  const reduced = useReducedMotion()
  const [expanded, setExpanded] = React.useState(false)

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const start = shift?.startTime ?? null
  const end = shift?.endTime ?? null
  const { record, carried } = pickShiftDay(records, {
    today: dateKey(now),
    yesterday: dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)),
    shiftStart: start,
    shiftEnd: end,
    nowMinutes: nowMin,
  })
  const steps = punchTimeline(record?.punches, { shiftStart: start, shiftEnd: end })
  const dayOff = carried ? null : dayOffOf(record)
  // Today while its shift is still running (owner 2026-11-26): "In progress", shifts "—", when it will be counted.
  const dayProgress = carried ? null : inProgressView(record, now)
  const win = shiftWindow(start, end)
  const nowAxis = axisNow(nowMin, carried)
  const progress = win ? (carried ? shiftProgressAt(win, nowAxis) : shiftProgressToday(start, end, nowMin)) : null
  const inside = !!steps[steps.length - 1]?.isIn
  // A day off with no punch has nothing to measure; a worked holiday still shows how far into the shift it is.
  const showProgress = progress != null && !(dayOff && steps.length === 0)
  const chip = carried
    ? { icon: Moon, text: 'Night shift · since yesterday', cls: 'max-md:bg-info-bg max-md:text-info' }
    : dayOff
      ? { icon: DAY_OFF_LOOK[dayOff.kind].icon, text: dayOff.short, cls: DAY_OFF_LOOK[dayOff.kind].cls }
      : null

  return (
    <section
      aria-labelledby="m-today-title"
      className="max-md:relative max-md:mb-5 max-md:overflow-hidden max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]"
    >
      <span
        aria-hidden="true"
        className="max-md:pointer-events-none max-md:absolute max-md:-top-[90px] max-md:-right-[60px] max-md:size-[210px] max-md:rounded-full max-md:bg-accent max-md:opacity-50"
      />
      <div className="max-md:relative">
        {/* Right now: clock, where the employee is, the shift */}
        <div className="max-md:flex max-md:min-h-[22px] max-md:items-center max-md:justify-between max-md:gap-2">
          <p className="label-caps max-md:text-muted-foreground">Right now</p>
          {chip && (
            <span className={cn('max-md:flex max-md:min-w-0 max-md:items-center max-md:gap-1 max-md:rounded-full max-md:px-2 max-md:py-[3px] max-md:text-[11px] max-md:font-bold', chip.cls)}>
              <chip.icon className="max-md:size-3 max-md:shrink-0" aria-hidden="true" />
              <span className="max-md:truncate">{chip.text}</span>
            </span>
          )}
        </div>
        <PhoneClock now={now} />
        {loading ? (
          <SkeletonBlock className="max-md:mt-2 max-md:h-[18px] max-md:w-48" />
        ) : failed ? null : (
          <p className="max-md:mt-1 max-md:flex max-md:items-center max-md:gap-[9px] max-md:text-[15px] max-md:font-semibold max-md:text-foreground max-md:tabular-nums">
            <span
              aria-hidden="true"
              className={cn('max-md:size-2.5 max-md:shrink-0 max-md:rounded-full', inside ? 'pulse-ring max-md:bg-success max-md:text-success' : 'max-md:bg-foreground/25')}
            />
            {presenceLineFor(steps, { dayOff, shiftStart: start, shiftEnd: end, nowMinutes: nowMin })}
          </p>
        )}
        {!failed && !loading && dayProgress && <InProgressNote view={dayProgress} className="max-md:mt-2.5" />}
        {!failed && markers.length > 0 && <DayMarkerChips markers={markers} className="max-md:mt-2.5" />}

        {shift ? (
          <div className="max-md:mt-3.5 max-md:flex max-md:flex-col max-md:gap-2 max-md:rounded-lg max-md:border max-md:border-border max-md:bg-foreground/[0.03] max-md:p-3">
            <div className="max-md:flex max-md:items-center max-md:gap-1.5">
              <Clock className="max-md:size-4 max-md:shrink-0 max-md:text-info" aria-hidden="true" />
              <span className="max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:text-[13px] max-md:font-semibold max-md:text-foreground">{shiftTitle(shift.name)}</span>
              <span className="max-md:shrink-0 max-md:text-[12.5px] max-md:text-muted-foreground max-md:tabular-nums">
                {to12h(start)} – {to12h(end)}
              </span>
            </div>
            {showProgress && progress != null && (
              <>
                <div
                  className="max-md:relative max-md:h-1.5 max-md:overflow-hidden max-md:rounded-full max-md:bg-foreground/10"
                  role="progressbar"
                  aria-label="How far into today's shift"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                >
                  <motion.span
                    className="max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:rounded-full max-md:bg-silk"
                    initial={reduced ? false : { width: 0 }}
                    animate={{ width: `${progress * 100}%` }}
                    transition={{ duration: 0.9, ease: EASE_OUT }}
                  />
                </div>
                <p className="max-md:text-[12px] max-md:text-muted-foreground max-md:tabular-nums">
                  {shiftStatusText(progress, { start, nowMinutes: nowMin, graceMinutes: shift.gracePeriodMinutes })}
                </p>
              </>
            )}
          </div>
        ) : shiftLoading ? (
          <SkeletonBlock className="max-md:mt-3.5 max-md:h-[66px] max-md:w-full max-md:rounded-lg" />
        ) : (
          <p className="max-md:mt-3 max-md:text-[13px] max-md:text-muted-foreground">No shift is assigned to you yet.</p>
        )}

        <div aria-hidden="true" className="max-md:my-4 max-md:h-px max-md:bg-border" />

        {/* Today's punches */}
        <div className="max-md:mb-3 max-md:flex max-md:items-center max-md:gap-2">
          <Fingerprint className="max-md:size-[18px] max-md:shrink-0 max-md:text-[#5E35B1] max-md:dark:text-[#9575CD]" aria-hidden="true" />
          <h2 id="m-today-title" className="max-md:flex-1 max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-semibold">
            {carried ? "This shift's punches" : "Today's punches"}
          </h2>
          {!failed && !loading && steps.length > 0 && (
            <span className="max-md:shrink-0 max-md:rounded-full max-md:bg-info-bg max-md:px-[9px] max-md:py-[3px] max-md:text-[11px] max-md:font-bold max-md:text-info max-md:tabular-nums">
              {steps.length} recorded
            </span>
          )}
        </div>

        {failed ? (
          <div className="max-md:flex max-md:items-center max-md:gap-3">
            <p className="max-md:flex-1 max-md:text-[12.5px] max-md:text-muted-foreground">Today's punches could not be loaded just now.</p>
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="focus-ring max-md:flex max-md:min-h-11 max-md:shrink-0 max-md:items-center max-md:gap-1.5 max-md:rounded-full max-md:bg-accent max-md:px-3.5 max-md:text-[12.5px] max-md:font-semibold max-md:text-primary max-md:disabled:opacity-60"
            >
              <RefreshCw className={cn('max-md:size-3.5', retrying && 'animate-spin')} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : loading ? (
          <div className="max-md:flex max-md:flex-col max-md:gap-2.5">
            <SkeletonBlock className="max-md:h-9 max-md:w-full max-md:rounded-full" />
            <SkeletonBlock className="max-md:h-[52px] max-md:w-full max-md:rounded-lg" />
          </div>
        ) : steps.length === 0 ? (
          <PhoneNoPunches dayOff={dayOff?.kind ?? null} over={!dayOff && progress != null && progress >= 1} />
        ) : (
          <>
            <PhoneDayBar model={dayBarModel(steps, { shiftStart: start, shiftEnd: end, nowAxis })} />
            <PhonePunchList steps={steps} expanded={expanded} onToggle={setExpanded} />
          </>
        )}
      </div>
    </section>
  )
}

/** "2:47" with a small "PM" beside it; re-renders once a minute with the panel. */
function PhoneClock({ now }: { now: Date }) {
  const h = now.getHours()
  const text = `${h % 12 === 0 ? 12 : h % 12}:${String(now.getMinutes()).padStart(2, '0')}`
  const ampm = h >= 12 ? 'PM' : 'AM'
  return (
    <time dateTime={now.toISOString()} aria-label={`Time now ${text} ${ampm}`} className="max-md:mt-0.5 max-md:flex max-md:items-start">
      <span className="max-md:font-[family-name:var(--font-display)] max-md:text-[46px] max-md:leading-[52px] max-md:font-bold max-md:tracking-[-1px] max-md:text-foreground max-md:tabular-nums">
        {text}
      </span>
      <span className="max-md:mt-2 max-md:ml-1.5 max-md:text-[15px] max-md:font-semibold max-md:text-muted-foreground">{ampm}</span>
    </time>
  )
}

/**
 * The day as a bar: the shift window lightly tinted, time spent inside filled in, one dot per punch, and a "now" marker.
 * aria-hidden: the list under it says the same in words.
 */
function PhoneDayBar({ model }: { model: DayBarModel }) {
  const pct = (m: number) => `${barFraction(model, m) * 100}%`
  const width = (a: number, b: number) => `${(barFraction(model, b) - barFraction(model, a)) * 100}%`
  return (
    <div aria-hidden="true" className="max-md:mb-3.5 max-md:select-none">
      <div className="max-md:relative max-md:h-11">
        <div className="max-md:absolute max-md:inset-x-0 max-md:top-4 max-md:h-3 max-md:rounded-full max-md:bg-foreground/[0.07]" />
        {model.shift && (
          <div
            className="max-md:absolute max-md:top-4 max-md:h-3 max-md:rounded-full max-md:border max-md:border-dashed max-md:border-primary/45 max-md:bg-primary/10"
            style={{ left: pct(model.shift.from), width: width(model.shift.from, model.shift.to) }}
          />
        )}
        {model.inside.map((seg, i) => (
          <motion.div
            key={seg.from}
            className="max-md:absolute max-md:top-4 max-md:h-3 max-md:origin-left max-md:rounded-full max-md:bg-linear-to-r max-md:from-success/70 max-md:to-success"
            style={{ left: pct(seg.from), width: width(seg.from, seg.to) }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.2 + i * 0.1 }}
          />
        ))}
        {model.dots.map((d, i) => (
          <motion.span
            key={d.key}
            className={cn(
              'max-md:absolute max-md:top-3 max-md:grid max-md:size-5 max-md:-translate-x-1/2 max-md:place-items-center max-md:rounded-full max-md:border-2 max-md:border-card max-md:shadow-[0_1px_2px_rgb(15_23_42/0.15)]',
              d.isIn ? 'max-md:bg-success' : 'max-md:bg-warning',
            )}
            style={{ left: pct(d.at) }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24, delay: 0.3 + i * 0.08 }}
          >
            {d.isIn ? <LogIn className="max-md:size-[11px] max-md:text-success-foreground" /> : <DoorOpen className="max-md:size-[11px] max-md:text-warning-foreground" />}
          </motion.span>
        ))}
        {model.now != null && (
          <span className="max-md:absolute max-md:inset-y-0 max-md:w-3 max-md:-translate-x-1/2" style={{ left: pct(model.now) }}>
            <span className="max-md:absolute max-md:top-1.5 max-md:bottom-1 max-md:left-1/2 max-md:w-px max-md:-translate-x-1/2 max-md:bg-foreground/50" />
            <span className="pulse-ring max-md:absolute max-md:top-0 max-md:left-1/2 max-md:size-2 max-md:-translate-x-1/2 max-md:rounded-full max-md:bg-foreground max-md:text-foreground" />
          </span>
        )}
      </div>
      <div className="max-md:relative max-md:mt-0.5 max-md:h-4 max-md:text-[11px] max-md:text-muted-foreground max-md:tabular-nums">
        {model.ticks.map((t) => {
          const f = barFraction(model, t)
          return (
            <span
              key={t}
              className={cn('max-md:absolute max-md:whitespace-nowrap', f > 0.94 ? 'max-md:-translate-x-full' : f >= 0.06 && 'max-md:-translate-x-1/2')}
              style={{ left: `${f * 100}%` }}
            >
              {hourText(t)}
            </span>
          )
        })}
      </div>
      <div className="max-md:mt-1.5 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-1 max-md:text-[11.5px] max-md:text-muted-foreground">
        <span className="max-md:flex max-md:items-center max-md:gap-1.5">
          <span className="max-md:h-2 max-md:w-4 max-md:rounded-full max-md:bg-success" /> Inside
        </span>
        {model.shift && (
          <span className="max-md:flex max-md:items-center max-md:gap-1.5">
            <span className="max-md:h-2 max-md:w-4 max-md:rounded-full max-md:border max-md:border-dashed max-md:border-primary/50 max-md:bg-primary/10" /> Shift time
          </span>
        )}
        <span className="max-md:flex max-md:items-center max-md:gap-1.5">
          <span className="max-md:size-2 max-md:rounded-full max-md:bg-foreground" /> Now
        </span>
      </div>
    </div>
  )
}

/** The punches in words, oldest first; past four, the latest four with "Show N earlier" above them. */
function PhonePunchList({ steps, expanded, onToggle }: { steps: TimelineStep[]; expanded: boolean; onToggle: (v: boolean) => void }) {
  const { shown, earlier } = visiblePunches(steps, expanded)
  const moreCls =
    'focus-ring max-md:flex max-md:min-h-11 max-md:w-full max-md:items-center max-md:justify-center max-md:gap-1 max-md:text-[12.5px] max-md:font-semibold max-md:text-primary max-md:active:opacity-75'
  return (
    <div className="max-md:overflow-hidden max-md:rounded-lg max-md:border max-md:border-border max-md:bg-foreground/[0.03]">
      {earlier > 0 && (
        <button type="button" onClick={() => onToggle(true)} className={moreCls}>
          <ChevronUp className="max-md:size-4" aria-hidden="true" /> Show {earlier} earlier punch{earlier === 1 ? '' : 'es'}
        </button>
      )}
      <ol aria-label="Today's punches in order">
        {shown.map((s, i) => (
          <PhonePunchRow key={s.key} step={s} index={i} divider={i > 0 || earlier > 0} />
        ))}
      </ol>
      {expanded && steps.length > PUNCH_ROWS_FOLDED && (
        <button type="button" onClick={() => onToggle(false)} className={cn(moreCls, 'max-md:border-t max-md:border-border')}>
          <ChevronDown className="max-md:size-4" aria-hidden="true" /> Show fewer
        </button>
      )}
    </div>
  )
}

function PhonePunchRow({ step, index, divider }: { step: TimelineStep; index: number; divider: boolean }) {
  const Icon = KIND_ICON[step.kind]
  const meta = punchMeta(step)
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: EASE_OUT, delay: 0.15 + index * 0.05 }}
      className={cn('max-md:flex max-md:min-h-[54px] max-md:items-center max-md:gap-3 max-md:px-3 max-md:py-[9px]', divider && 'max-md:border-t max-md:border-border')}
    >
      <span className="sr-only">{punchA11y(step)}</span>
      <span aria-hidden="true" className={cn('max-md:grid max-md:size-[34px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full', KIND_TONE[step.kind])}>
        <Icon className="max-md:size-[17px]" />
      </span>
      <span aria-hidden="true" className="max-md:min-w-0 max-md:flex-1">
        <span className="max-md:block max-md:truncate max-md:text-[13.5px] max-md:font-semibold max-md:text-foreground">{step.label}</span>
        {meta && <span className="max-md:block max-md:truncate max-md:text-[12px] max-md:text-muted-foreground">{meta}</span>}
      </span>
      <span aria-hidden="true" className="max-md:shrink-0 max-md:text-[13.5px] max-md:font-semibold max-md:text-foreground max-md:tabular-nums">
        {step.time}
      </span>
    </motion.li>
  )
}

/** No punch on the day: why that is fine (a day off), what to do (shift over: ask for the missing punch), or how punches arrive. */
function PhoneNoPunches({ dayOff, over }: { dayOff: DayOffKind | null; over: boolean }) {
  const Icon = dayOff ? DAY_OFF_LOOK[dayOff].icon : over ? Pointer : Fingerprint
  const text = dayOff
    ? 'No punch is expected today. If you do work, your punches show here.'
    : over
      ? 'No punch was recorded for your shift. If you were at work, ask for the missing punch.'
      : 'No punch yet. Biometric punches show here once the device sends them, or punch from your phone with Geo punch.'
  const link = dayOff
    ? null
    : over
      ? { href: '/employee/missing-punch', label: 'Request a missing punch', icon: ChevronRight }
      : { href: '/employee/attendance-request', label: 'Geo punch', icon: MapPin }
  return (
    <div className="max-md:flex max-md:items-start max-md:gap-2.5 max-md:rounded-lg max-md:border max-md:border-dashed max-md:border-input max-md:p-3.5">
      <Icon className="max-md:mt-px max-md:size-5 max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
      <div className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:items-start max-md:gap-0.5">
        <p className="max-md:text-[13px] max-md:leading-[19px] max-md:text-muted-foreground">{text}</p>
        {link && (
          <Link
            href={link.href}
            className="focus-ring max-md:-mb-2 max-md:flex max-md:min-h-11 max-md:items-center max-md:gap-1 max-md:text-[13px] max-md:font-semibold max-md:text-primary max-md:active:opacity-75"
          >
            {link.label} <link.icon className="max-md:size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  )
}

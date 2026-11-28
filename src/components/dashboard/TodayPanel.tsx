import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { Clock, Coffee, DoorOpen, Fingerprint, Home, LogIn, LogOut, MapPin, RotateCcw, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard, SkeletonBlock, StatusPill, EASE_OUT, TONE_SOFT, useReducedMotion, type Tone } from '@/components/kit'
import { DayMarkerChips } from '@/components/employee/DayMarkerChips'
import { InProgressNote } from '@/components/employee/InProgressNote'
import type { InProgressView } from '@/lib/day-progress'
import { useMinuteNow } from '@/hooks/useHomeSources'
import { minutesOf, presenceLine, punchStory, shiftProgress, to12h, type PunchKind, type PunchStep } from '@/lib/home-punches'
import type { DayMarkerHit } from '@/lib/attendance-flags'
import type { AssignedShift, AttendancePunch } from '@/types'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<PunchKind, LucideIcon> = {
  arrived: LogIn,
  came_back: RotateCcw,
  in_again: LogIn,
  stepped_out: Coffee,
  out: LogOut,
  left: Home,
}

const KIND_TONE: Record<PunchKind, Tone> = {
  arrived: 'emerald',
  came_back: 'emerald',
  in_again: 'emerald',
  stepped_out: 'amber',
  out: 'amber',
  left: 'sapphire',
}

/** The live clock: hh:mm, updated on each minute boundary (only this text re-renders). */
export function LiveClock({ className }: { className?: string }) {
  const now = useMinuteNow()
  const h = now.getHours()
  const text = `${h % 12 === 0 ? 12 : h % 12}:${String(now.getMinutes()).padStart(2, '0')}`
  return (
    <time dateTime={now.toISOString()} className={cn('metric tabular-nums', className)} aria-label={`Time now ${text} ${h >= 12 ? 'PM' : 'AM'}`}>
      {text}
      <span className="ml-1.5 align-top text-[0.38em] font-semibold text-muted-foreground">{h >= 12 ? 'PM' : 'AM'}</span>
    </time>
  )
}

/**
 * Today at a glance: the live clock, the shift and how far into it we are, and today's punches drawn on the day as a
 * bar (time inside the factory filled in, a dot per punch, "now") plus the same punches in words, labelled by what they
 * are ("Arrived", "Stepped out", "Came back", "Left for the day").
 */
export function TodayPanel({
  punches,
  shift,
  markers,
  dayProgress = null,
  loading,
}: {
  punches: AttendancePunch[]
  shift: AssignedShift | null | undefined
  markers: DayMarkerHit[]
  /** Today while its shift is still running (lib/day-progress.ts): "In progress", shifts "—", when it is counted. */
  dayProgress?: InProgressView | null
  loading: boolean
}) {
  const now = useMinuteNow()
  const reduced = useReducedMotion()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const end = shift?.endTime
  const steps = punchStory(punches, { shiftEnd: end })
  const progress = shiftProgress(shift?.startTime, shift?.endTime, nowMin)
  const last = steps[steps.length - 1]

  return (
    <GlassCard variant="raised" padding="lg" className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)] lg:items-start">
        {/* Clock + shift */}
        <div className="flex flex-col gap-3">
          <p className="label-caps text-muted-foreground">Right now</p>
          <LiveClock className="text-[46px] leading-none sm:text-[54px]" />
          {loading ? (
            <SkeletonBlock className="h-5 w-48" />
          ) : (
            <p className="flex items-center gap-2 text-[15px] font-semibold">
              <span
                className={cn('size-2.5 shrink-0 rounded-full', last?.isIn ? 'bg-success pulse-ring text-success' : 'bg-foreground/25')}
                aria-hidden="true"
              />
              {presenceLine(steps)}
            </p>
          )}
          {shift ? (
            <div className="flex flex-col gap-2 rounded-lg border hairline bg-foreground/[0.03] p-3">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                  <Clock className="size-4 shrink-0 text-info" aria-hidden="true" />
                  <span className="truncate">{shift.name}</span>
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {to12h(shift.startTime)} – {to12h(shift.endTime)}
                </span>
              </div>
              {progress != null && (
                <div>
                  <div
                    className="relative h-1.5 overflow-hidden rounded-full bg-foreground/10"
                    role="progressbar"
                    aria-label="How far into today's shift"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                  >
                    <motion.span
                      className="bg-silk absolute inset-y-0 left-0 rounded-full"
                      initial={reduced ? false : { width: 0 }}
                      animate={{ width: `${progress * 100}%` }}
                      transition={{ duration: 0.9, ease: EASE_OUT }}
                    />
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {progress <= 0 ? 'Shift not started yet' : progress >= 1 ? 'Shift time is over' : `${Math.round(progress * 100)}% of the shift done`}
                    {shift.gracePeriodMinutes ? ` · ${shift.gracePeriodMinutes} min grace` : ''}
                  </p>
                </div>
              )}
            </div>
          ) : (
            !loading && <p className="text-[13px] text-muted-foreground">No shift is assigned to you yet.</p>
          )}
          {!loading && dayProgress && <InProgressNote view={dayProgress} />}
          <DayMarkerChips markers={markers} />
        </div>

        {/* The day */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display flex items-center gap-2 text-xl font-semibold">
              <Fingerprint className="size-5 text-info" aria-hidden="true" /> Today's punches
            </h2>
            {steps.length > 0 && <StatusPill tone="info" icon={false} size="sm">{steps.length} recorded</StatusPill>}
          </div>
          {loading ? (
            <div className="flex flex-col gap-3">
              <SkeletonBlock className="h-10 w-full rounded-full" />
              <SkeletonBlock className="h-16 w-full" />
            </div>
          ) : steps.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-foreground/15 p-4 sm:flex-row sm:items-center">
              <p className="flex-1 text-sm text-muted-foreground">
                No punch yet today. Machine punches show here once the biometric device sends them.
              </p>
              <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
                <Link href="/employee/attendance-request">
                  <MapPin /> Geo punch
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <DayBar steps={steps} shift={shift} nowMin={nowMin} />
              <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Today's punches in order">
                {steps.map((s, i) => (
                  <PunchChip key={s.key} step={s} index={i} />
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

function PunchChip({ step, index }: { step: PunchStep; index: number }) {
  const Icon = KIND_ICON[step.kind]
  const tone = KIND_TONE[step.kind]
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: EASE_OUT, delay: 0.15 + index * 0.06 }}
      className="flex items-center gap-3 rounded-lg border hairline bg-foreground/[0.03] p-3"
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full border', TONE_SOFT[tone])} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{step.label}</span>
        <span className="block text-[12.5px] text-muted-foreground tabular-nums">
          {step.time}
          {step.source ? ` · ${step.source}` : ''}
        </span>
      </span>
    </motion.li>
  )
}

/**
 * The day as a bar: the shift window lightly tinted, time spent inside (each IN to the next OUT, or to now) filled in,
 * one dot per punch, and a "now" marker. Decorative (aria-hidden): the list next to it says the same in words.
 */
function DayBar({ steps, shift, nowMin }: { steps: PunchStep[]; shift: AssignedShift | null | undefined; nowMin: number }) {
  const times = steps.map((s) => s.minutes).filter((t): t is number => t != null)
  const sStart = minutesOf(shift?.startTime)
  const sEnd = minutesOf(shift?.endTime)
  const night = sStart != null && sEnd != null && sEnd <= sStart
  // A night shift is drawn from the punches only (the axis would have to wrap midnight).
  const candidates = [...times, nowMin, ...(!night && sStart != null ? [sStart] : []), ...(!night && sEnd != null ? [sEnd] : [])]
  const lo = Math.max(0, Math.floor((Math.min(...candidates) - 30) / 60) * 60)
  const hi = Math.min(24 * 60, Math.ceil((Math.max(...candidates) + 30) / 60) * 60)
  const span = Math.max(60, hi - lo)
  const pct = (m: number) => `${((Math.min(hi, Math.max(lo, m)) - lo) / span) * 100}%`

  // Time inside: each IN to the punch after it when that is an OUT, or to now when it is the last punch.
  const inside: { from: number; to: number }[] = []
  steps.forEach((s, i) => {
    if (!s.isIn || s.minutes == null) return
    const next = steps[i + 1]
    if (next?.isIn) return
    const to = next ? next.minutes : nowMin
    if (to != null && to > s.minutes) inside.push({ from: s.minutes, to })
  })

  const ticks: number[] = []
  const step = span > 10 * 60 ? 180 : span > 5 * 60 ? 120 : 60
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t)

  return (
    <div aria-hidden="true" className="select-none">
      <div className="relative h-11">
        {/* track */}
        <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-foreground/[0.07]" />
        {/* shift window */}
        {!night && sStart != null && sEnd != null && (
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full border border-dashed border-primary/40 bg-primary/10"
            style={{ left: pct(sStart), width: `calc(${pct(sEnd)} - ${pct(sStart)})` }}
          />
        )}
        {/* inside the factory */}
        {inside.map((seg, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 h-3 origin-left -translate-y-1/2 rounded-full bg-linear-to-r from-success/70 to-success"
            style={{ left: pct(seg.from), width: `calc(${pct(seg.to)} - ${pct(seg.from)})` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.2 + i * 0.1 }}
          />
        ))}
        {/* punches */}
        {steps.map((s, i) => {
          const m = s.minutes
          if (m == null) return null
          return (
            <motion.span
              key={s.key}
              className={cn(
                'absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-card shadow-clay-sm',
                s.isIn ? 'bg-success' : 'bg-warning',
              )}
              style={{ left: pct(m) }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24, delay: 0.3 + i * 0.08 }}
            >
              {s.isIn ? (
                <LogIn className="size-2.5 text-success-foreground" />
              ) : (
                <DoorOpen className="size-2.5 text-warning-foreground" />
              )}
            </motion.span>
          )
        })}
        {/* now */}
        {nowMin >= lo && nowMin <= hi && (
          <span className="absolute top-0 bottom-0 -translate-x-1/2" style={{ left: pct(nowMin) }}>
            <span className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-foreground/50" />
            <span className="pulse-ring absolute -top-0.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-foreground text-foreground" />
          </span>
        )}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted-foreground tabular-nums">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(t) }}>
            {hourLabel(t)}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-success" /> Inside</span>
        {!night && sStart != null && <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full border border-dashed border-primary/50 bg-primary/10" /> Shift time</span>}
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-foreground" /> Now</span>
      </div>
    </div>
  )
}

function hourLabel(min: number): string {
  const h = Math.floor(min / 60) % 24
  return `${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`
}

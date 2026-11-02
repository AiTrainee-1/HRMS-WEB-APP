import { Link } from 'wouter'
import { motion } from 'framer-motion'
import { CalendarRange, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BarList, GlassCard, RingMeter, SectionHeader, SkeletonBlock, TONE_COLOR, staggerDelay, type Tone } from '@/components/kit'
import { DAY_STATUS_LABEL, getDayMarkers } from '@/lib/attendance-flags'
import { dayCountText, type MonthSnapshot } from '@/lib/home-attention'
import { useLastSevenDays } from '@/hooks/useLastSevenDays'
import type { AttendanceDay, ShiftPolicy } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<string, Tone> = {
  present: 'emerald',
  half_shift: 'amber',
  absent: 'rose',
  on_leave: 'sapphire',
  holiday: 'violet',
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * This month so far: one silk ring for attendance, the days by kind as bars, and the last seven days as a strip (each day
 * written out for screen readers). Everything comes from the month's attendance the top bar already loads, plus last
 * month's from the 1st to the 6th, when the strip reaches back into it (hooks/useLastSevenDays.ts).
 */
export function MonthCard({
  snapshot,
  records,
  policy,
  now,
  loading,
}: {
  snapshot: MonthSnapshot
  records: AttendanceDay[]
  policy: ShiftPolicy | null
  now: Date
  loading: boolean
}) {
  // From the 1st to the 6th the strip reaches into last month: those days come from last month's attendance (one more
  // request, shared with the Attendance page), not from `records`, which only holds this month.
  const last7 = useLastSevenDays(now, records)
  const pct = snapshot.attendancePercent

  return (
    // Phones: the mobile Home has no such card (its navy month card, PhoneHome.tsx, carries the figures).
    <GlassCard padding="lg" className="flex h-full flex-col gap-5 max-md:hidden">
      <SectionHeader
        as="h2"
        icon={CalendarRange}
        title="This month so far"
        description={`${snapshot.workingDays} working ${snapshot.workingDays === 1 ? 'day' : 'days'} up to today`}
        action={
          <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-8">
            <Link href="/employee/attendance">
              Calendar <ChevronRight />
            </Link>
          </Button>
        }
      />
      {loading ? (
        <div className="flex items-center gap-5">
          <SkeletonBlock className="size-28 rounded-full" />
          <div className="flex flex-1 flex-col gap-3">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-3/5" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <RingMeter value={pct ?? 0} max={100} silk size={120} thickness={11} label="Attendance this month, percent">
            <span className="metric text-[26px] leading-none">{pct == null ? '—' : `${pct}%`}</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">attendance</span>
          </RingMeter>
          <BarList
            className="w-full flex-1"
            max={Math.max(1, snapshot.workingDays)}
            format={dayCountText}
            items={[
              { key: 'p', label: 'Present', value: snapshot.presentDays, tone: 'emerald', hint: snapshot.halfDays ? `includes ${snapshot.halfDays} half ${snapshot.halfDays === 1 ? 'day' : 'days'}` : undefined },
              { key: 'l', label: 'On leave', value: snapshot.leaveDays, tone: 'sapphire' },
              { key: 'a', label: 'Absent', value: snapshot.absentDays, tone: 'rose' },
            ]}
          />
        </div>
      )}

      <div>
        <p className="label-caps mb-2 text-muted-foreground">Last 7 days</p>
        <ol className="grid grid-cols-7 gap-1.5" aria-label="Your last seven days">
          {last7.map(({ date: d, key, rec, isToday, state }, i) => {
            const status = rec?.status ?? 'no_record'
            const tone = STATUS_TONE[status]
            // A last-month day whose month is still loading or could not be loaded: neutral, never "No record".
            const pending = state === 'loading' || state === 'unavailable'
            const flagged = rec ? getDayMarkers(rec, policy).filter((m) => m.key === 'late' || m.key === 'earlyOut' || m.key === 'excess') : []
            const words = [
              isToday ? 'Today' : `${WEEKDAY[d.getDay()]} ${d.getDate()}`,
              state === 'loading'
                ? 'loading'
                : state === 'unavailable'
                  ? 'last month, not loaded, see the attendance calendar'
                  : status === 'future' && isToday
                    ? 'in progress'
                    : (DAY_STATUS_LABEL[status] ?? 'No record'),
              ...flagged.map((m) => m.label),
            ].join(', ')
            return (
              <motion.li
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: staggerDelay(i, 0.04) + 0.1 }}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg py-2',
                  isToday ? 'border border-primary/50 bg-primary/10' : 'bg-foreground/[0.04]',
                )}
              >
                <span className="sr-only">{words}</span>
                <span aria-hidden="true" className={cn('text-[10.5px] font-semibold uppercase', isToday ? 'text-foreground' : 'text-muted-foreground')}>
                  {WEEKDAY[d.getDay()]}
                </span>
                {state === 'loading' ? (
                  <SkeletonBlock className="size-3 rounded-full" />
                ) : (
                  <span
                    aria-hidden="true"
                    title={state === 'unavailable' ? 'Last month could not be loaded here: open the Calendar' : undefined}
                    className={cn(
                      'size-3 rounded-full',
                      pending ? 'bg-foreground/15' : !tone && 'border border-dashed border-foreground/30',
                      flagged.length > 0 && 'ring-2 ring-warning ring-offset-1 ring-offset-card',
                    )}
                    style={tone ? { backgroundColor: TONE_COLOR[tone] } : undefined}
                  />
                )}
                <span aria-hidden="true" className={cn('text-[11px] tabular-nums', isToday ? 'font-bold text-info' : 'text-muted-foreground')}>
                  {isToday ? 'Today' : d.getDate()}
                </span>
              </motion.li>
            )
          })}
        </ol>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground" aria-hidden="true">
          {(['present', 'half_shift', 'absent', 'on_leave', 'holiday'] as const).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: TONE_COLOR[STATUS_TONE[s]] }} /> {DAY_STATUS_LABEL[s]}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full ring-2 ring-warning" /> Flagged late / early
          </span>
        </p>
      </div>
    </GlassCard>
  )
}

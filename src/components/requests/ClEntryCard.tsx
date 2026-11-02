import { Link } from 'wouter'
import { ArrowRight, CalendarClock, CalendarHeart, ChevronRight } from 'lucide-react'
import { ErrorState, GlassCard, SkeletonBlock, StatusPill, TONE_SOFT } from '@/components/kit'
import { balanceBreakdown, daysText, halfNum, type CLBalance, type MonthCardState, type YearMonth } from '@/lib/casual-leave'
import { cn } from '@/lib/utils'
import { CL_STATE } from './cl-state'
import { CL_PHONE_COLOURS, ClDial, ClYearGrid } from './ClYearView'

/**
 * The Casual Leave card at the top of the Leave page (owner 2026-10-31): this month's state in words (full day
 * available / one half-day left / used / not available + why), the year as 12 mini dials, and the way to the Casual
 * Leave page. The whole card is one link.
 * Phones: the mobile app's ClEntryCard - a 40px amber well, "Casual Leave (CL)" with "One paid day a month, or two
 * half-days" and a chevron; this month as a tinted chip + one line; the year as a strip of 12 small dials with month
 * initials (this month in sapphire); "N days taken in YEAR" under it.
 * 2026-11-02 (yearly balance): with `balance` the card speaks of the year's balance ("11 of 12 CL left in 2026 · resets
 * on 1 Jan") instead of this month; without it (an older server) it stays as it was.
 */
export function ClEntryCard({
  state,
  months,
  year,
  takenDays,
  waitingDays,
  balance,
  loading,
  failed,
  error,
  onRetry,
  retrying,
}: {
  state: MonthCardState | null
  months: YearMonth[] | null
  year: number
  takenDays: number
  waitingDays: number
  balance?: CLBalance | null
  loading: boolean
  failed: boolean
  error?: unknown
  onRetry: () => void
  retrying: boolean
}) {
  if (failed) {
    return <ErrorState error={error} what="this month's Casual Leave" onRetry={onRetry} retrying={retrying} title="Could not check your Casual Leave" />
  }
  const meta = state ? CL_STATE[state.tone] : null
  const Icon = meta?.icon ?? CalendarClock
  const now = new Date()
  const thisMonth = year === now.getFullYear() ? now.getMonth() + 1 : null
  return (
    <GlassCard variant="interactive" asChild className="group flex flex-col gap-4 overflow-hidden max-md:gap-3 max-md:p-3.5!">
      <Link href="/employee/casual-leave" aria-label={state ? `Casual Leave: ${state.title}. ${state.detail} Open Casual Leave.` : 'Open Casual Leave'}>
        <div className="flex flex-wrap items-start gap-4 max-md:hidden">
          <span className={cn('grid size-12 shrink-0 place-items-center rounded-2xl border', TONE_SOFT[meta?.tone ?? 'violet'])} aria-hidden="true">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="label-caps text-violet">{balance ? `Casual Leave · your ${balance.year} balance` : 'Casual Leave · this month'}</p>
            {loading || !state ? (
              <div className="mt-2 flex flex-col gap-2" aria-hidden="true">
                <SkeletonBlock className="h-5 w-40" />
                <SkeletonBlock className="h-3.5 w-64 max-w-full" />
              </div>
            ) : (
              <>
                <p className="font-display mt-1 text-xl font-semibold">{state.title}</p>
                <p className="mt-0.5 text-[13.5px] text-muted-foreground">{state.detail}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {meta && <StatusPill tone={meta.status}>{meta.word}</StatusPill>}
            <ArrowRight
              className="size-5 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground motion-reduce:transition-none"
              aria-hidden="true"
            />
          </div>
        </div>
        {months && (
          <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3 max-md:hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
              <span className="label-caps text-muted-foreground">{year} at a glance</span>
              {balance && balance.year === year ? (
                <span className="text-muted-foreground tabular-nums">{balanceBreakdown(balance)} · resets on 1 Jan</span>
              ) : (
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{daysText(takenDays)}</span> taken
                  {waitingDays > 0 && (
                    <>
                      {' · '}
                      <span className="font-semibold text-waiting">{daysText(waitingDays)}</span> waiting
                    </>
                  )}
                </span>
              )}
            </div>
            <ClYearGrid months={months} year={year} compact />
          </div>
        )}
        <span className="text-[13px] font-semibold text-brand-blue max-md:hidden">Apply or see all your Casual Leave</span>

        {/* Phones: the mobile app's card (same data). */}
        <div className="hidden max-md:flex max-md:items-center max-md:gap-3">
          <span className="max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-lg max-md:bg-waiting-bg max-md:text-waiting" aria-hidden="true">
            <CalendarHeart className="max-md:size-5" />
          </span>
          <span className="max-md:min-w-0 max-md:flex-1">
            <span className="font-display max-md:block max-md:text-[15px] max-md:leading-5 max-md:font-semibold">Casual Leave (CL)</span>
            <span className="max-md:mt-0.5 max-md:block max-md:text-[11.5px] max-md:leading-4 max-md:text-muted-foreground">
              {balance ? `${halfNum(balance.total)} paid days a year, full or half days` : 'One paid day a month, or two half-days'}
            </span>
          </span>
          <ChevronRight className="max-md:size-[22px] max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
        </div>
        {loading || !state ? (
          <div className="hidden max-md:flex max-md:flex-col max-md:gap-2" aria-hidden="true">
            <SkeletonBlock className="max-md:h-[18px] max-md:w-[55%]" />
            <SkeletonBlock className="max-md:h-3 max-md:w-[90%]" />
          </div>
        ) : (
          <div className="hidden max-md:flex max-md:flex-col max-md:gap-1.5">
            <span
              className={cn(
                'max-md:inline-flex max-md:w-fit max-md:items-center max-md:gap-1.5 max-md:rounded-full max-md:border-0 max-md:px-2.5 max-md:py-1 max-md:text-[12px] max-md:font-[800]',
                TONE_SOFT[meta?.tone ?? 'slate'],
              )}
            >
              <Icon className="max-md:size-3.5" aria-hidden="true" />
              {state.title}
            </span>
            <span className="max-md:line-clamp-2 max-md:text-[12px] max-md:leading-[17px] max-md:text-secondary-foreground">{state.detail}</span>
          </div>
        )}
        {months && (
          <div className="hidden max-md:block">
            <span className={cn('max-md:flex max-md:justify-between', CL_PHONE_COLOURS)} aria-hidden="true">
              {months.map((m) => (
                <span key={m.month} className="max-md:flex max-md:flex-col max-md:items-center max-md:gap-[3px]">
                  <ClDial slots={m.slots} size={18} />
                  <span className={cn('max-md:text-[9.5px] max-md:leading-3 max-md:font-semibold max-md:text-muted-foreground', m.month === thisMonth && 'max-md:font-[800] max-md:text-primary')}>
                    {m.short.charAt(0)}
                  </span>
                </span>
              ))}
            </span>
            <span className="max-md:mt-2 max-md:block max-md:text-[11.5px] max-md:text-muted-foreground max-md:tabular-nums">
              {balance && balance.year === year ? (
                `${balanceBreakdown(balance)} · resets on 1 Jan`
              ) : (
                <>
                  {daysText(takenDays)} taken in {year}
                  {waitingDays > 0 ? ` · ${daysText(waitingDays)} waiting` : ''}
                </>
              )}
            </span>
          </div>
        )}
      </Link>
    </GlassCard>
  )
}

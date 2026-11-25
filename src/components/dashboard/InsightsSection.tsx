import * as React from 'react'
import { useInView } from 'framer-motion'
import {
  Activity,
  BriefcaseBusiness,
  CalendarCheck,
  ChartColumn,
  ChartPie,
  CircleCheck,
  Clock,
  Eye,
  EyeOff,
  Flag,
  HandCoins,
  LogOut,
  MoveRight,
  Sparkles,
  Sunrise,
  Timer,
  TrendingDown,
  TrendingUp,
  Umbrella,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AnimatedNumber,
  EmptyState,
  ErrorState,
  GlassCard,
  KpiTile,
  RingMeter,
  SectionHeader,
  SegmentedControl,
  SkeletonBlock,
  TONE_SOFT,
  useReducedMotion,
  type Tone,
} from '@/components/kit'
import { useMyInsights } from '@/hooks/useMyInsights'
import { useSalaryShown } from '@/hooks/useSalaryShown'
import {
  arrivalText,
  countText,
  currentMonth,
  durationText,
  healthScore,
  insightLines,
  insightsEmpty,
  payChart,
  pctText,
  periodsFor,
  totalsOf,
  trendBars,
  type InsightIcon,
  type InsightTone,
  type InsightsScope,
  type ScoreTone,
} from '@/lib/my-insights'
import { cn } from '@/lib/utils'
import { Meter, PayBars, TrendChart } from './InsightsCharts'
import { INSIGHTS_VARS, SERIES } from './insights-colors'

const SCORE_TONE: Record<ScoreTone, Tone> = { great: 'emerald', good: 'sapphire', fair: 'amber', low: 'rose', none: 'slate' }
const LINE_TONE: Record<InsightTone, Tone> = { good: 'emerald', warn: 'amber', bad: 'rose', info: 'sapphire' }
const LINE_ICON: Record<InsightIcon, LucideIcon> = {
  onTime: Clock,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
  trendFlat: MoveRight,
  attendance: CalendarCheck,
  arriveLate: Timer,
  arriveEarly: Sunrise,
  fullDays: CircleCheck,
  earlyOut: LogOut,
  overtime: Timer,
  onDuty: BriefcaseBusiness,
  payLost: HandCoins,
  payKept: WalletCards,
}

/**
 * The Dashboard's "My Insights" (owner 2026-11-25; the mobile Home's components/home/InsightsSection.tsx): a small health
 * report of the employee's own last 6 months, after Quick Actions and Last salary. An attendance health score (ring,
 * 0-100, with a plain grade and what holds it back), short highlight sentences, the attendance / on-time trend, six stat
 * tiles (on time, days present, early outs, leave days, On-Duty days, overtime) and pay earned vs lost to attendance -
 * masked while the Dashboard's salary eye is closed (shared with the Last salary card, hooks/useSalaryShown.ts).
 *
 * Numbers: GET /my/analytics (backend api/mobile_analytics.py); the score and every sentence: lib/my-insights.ts. The
 * charts draw themselves the first time the section scrolls into view (at once under reduced motion). Desktop: score +
 * trend side by side, the tiles in one row, highlights + pay side by side. Phones (< 768px): one column in the app's
 * order (score, highlights, trend, tiles two by two, pay), on the app's flat cards.
 */
export function InsightsSection() {
  const rootRef = React.useRef<HTMLElement>(null)
  const inView = useInView(rootRef, { once: true, amount: 0.15 })
  const reduced = useReducedMotion()
  const query = useMyInsights()
  const data = query.data
  // The charts start drawn-out (bars flat, line hidden) and draw in the first time the section is on screen WITH its data:
  // a frame after both, so the flat start is painted first (also when the section was in view before the data came).
  // Reduced motion: drawn from the start.
  const [drawn, setDrawn] = React.useState(false)
  const ready = inView && !!data
  React.useEffect(() => {
    if (!ready || drawn) return
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setDrawn(true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [ready, drawn])
  const revealed = drawn || reduced
  const [shown, setShown] = useSalaryShown()
  const hidden = !shown
  const [scope, setScope] = React.useState<InsightsScope>('window')

  const periods = React.useMemo(() => periodsFor(data, scope), [data, scope])
  const score = React.useMemo(() => healthScore(periods), [periods])
  const totals = React.useMemo(() => totalsOf(periods), [periods])
  const lines = React.useMemo(() => insightLines(data, hidden).slice(0, 5), [data, hidden])
  const trend = React.useMemo(() => trendBars(data), [data])
  const pay = React.useMemo(() => payChart(data, hidden), [data, hidden])
  const months = data?.periods.length || 6
  const production = data?.employmentType === 'production'
  const cur = currentMonth(data)
  const empty = !!data && insightsEmpty(data)

  const header = (
    <SectionHeader
      id="insights-title"
      icon={Activity}
      tone="sapphire"
      title="My Insights"
      description="Your attendance health report"
      action={
        data && !empty ? (
          <SegmentedControl
            ariaLabel="Period"
            size="sm"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'window', label: `${months} months` },
              { value: 'month', label: 'This month' },
            ]}
          />
        ) : undefined
      }
    />
  )

  let body: React.ReactNode
  if (query.isPending) {
    body = (
      <div className="grid gap-6 max-md:gap-3 lg:grid-cols-12" aria-busy="true" aria-label="Loading your insights">
        <GlassCard padding="lg" className="flex items-center gap-5 max-md:p-4! lg:col-span-5">
          <SkeletonBlock className="size-[120px] shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2.5">
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-6 w-2/3" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-5/6" />
          </div>
        </GlassCard>
        <GlassCard padding="lg" className="flex flex-col gap-3 max-md:p-4! lg:col-span-7">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-40 w-full rounded-xl" />
        </GlassCard>
      </div>
    )
  } else if (!data) {
    body = (
      <GlassCard padding="md">
        <ErrorState
          compact
          title="Couldn’t load your insights"
          error={query.error}
          what="your insights"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </GlassCard>
    )
  } else if (empty) {
    body = (
      <GlassCard padding="md">
        <EmptyState
          compact
          icon={ChartPie}
          title="Your insights will appear here"
          description="Once you have working days this month, your attendance health score, trends and pay summary show up here."
        />
      </GlassCard>
    )
  } else {
    const periodCaption =
      scope === 'month'
        ? `${cur?.label ?? 'This month'} so far`
        : `${data.periods[0]?.shortLabel ?? ''} – ${data.periods[data.periods.length - 1]?.label ?? ''}`
    const tone = SCORE_TONE[score.tone]
    const parts = [
      { key: 'a', label: 'Attendance', value: score.parts.attendance, color: SERIES.attendance },
      { key: 'p', label: 'On time', value: score.parts.punctuality, color: SERIES.onTime },
      { key: 'f', label: 'Full days', value: score.parts.fullDays, color: SERIES.kept },
    ]
    const onTimeValue = score.parts.punctuality == null ? null : Math.round(score.parts.punctuality)

    body = (
      <div className="grid gap-6 max-md:flex max-md:flex-col max-md:gap-3 lg:grid-cols-12">
        {/* ─── The score ─── */}
        <GlassCard padding="lg" className="flex flex-col gap-5 max-md:order-1 max-md:gap-4 max-md:p-4! lg:col-span-5">
          <div className="flex items-center gap-5 max-md:gap-4">
            {/* The wrapper names the ring (its own label would say "0 of 100" until the section is in view). */}
            <div
              role="img"
              className="shrink-0"
              aria-label={score.score == null ? 'Attendance health: no score yet' : `Attendance health score ${score.score} of 100: ${score.grade}`}
            >
              <RingMeter value={revealed ? (score.score ?? 0) : 0} max={100} size={120} thickness={12} tone={tone} label="Attendance health score">
                <ScoreFigure score={score.score} revealed={revealed} />
              </RingMeter>
            </div>
            <div className="min-w-0 flex-1">
              <p className="label-caps text-muted-foreground">Attendance health</p>
              <span className={cn('mt-1.5 inline-flex rounded-full border px-2.5 py-0.5 text-[13.5px] font-bold max-md:border-0 max-md:py-1', TONE_SOFT[tone])}>
                {score.grade}
              </span>
              <p className="mt-2 text-[13.5px] leading-5 text-foreground/85 max-md:text-[12.5px] max-md:leading-[17px] max-md:text-secondary-foreground">{score.summary}</p>
              <p className="mt-1.5 text-[12px] text-muted-foreground max-md:text-[11px]">{periodCaption}</p>
            </div>
          </div>
          <dl className="flex flex-col gap-2.5">
            {parts.map((p) => (
              <div key={p.key} className="grid grid-cols-[84px_minmax(0,1fr)_44px] items-center gap-3 max-md:grid-cols-[76px_minmax(0,1fr)_40px] max-md:gap-2.5">
                <dt className="text-[12.5px] font-semibold text-muted-foreground max-md:text-[12px] max-md:text-secondary-foreground">{p.label}</dt>
                <Meter value={p.value} color={p.color} revealed={revealed} />
                <dd className="text-right text-[12.5px] font-bold tabular-nums max-md:text-[12px]">{pctText(p.value)}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        {/* ─── Trend ─── */}
        <GlassCard padding="lg" className="flex min-w-0 flex-col gap-3 max-md:order-3 max-md:p-4! lg:col-span-7">
          <SectionHeader as="h3" icon={ChartColumn} title="Attendance trend" description={`Last ${months} months`} />
          <TrendChart bars={trend} revealed={revealed} />
        </GlassCard>

        {/* ─── Stat tiles ─── */}
        <ul className="grid grid-cols-2 gap-4 max-md:order-4 max-md:gap-2.5 sm:grid-cols-3 lg:col-span-12 xl:grid-cols-6" aria-label="Your figures">
          <li className="min-w-0">
            <KpiTile
              label="On time"
              value={onTimeValue}
              format={(n) => `${Math.round(n)}%`}
              icon={Clock}
              tone="amber"
              hint={
                totals.arrivals > 0
                  ? `${countText(totals.onTime)} of ${countText(totals.arrivals)} days · ${arrivalText(totals.avgArrivalDelta)}${
                      data.shift?.start && totals.avgArrivalDelta != null ? ` vs ${data.shift.start}` : ''
                    }`
                  : 'No arrivals yet'
              }
              className="max-md:p-3!"
            />
          </li>
          <li className="min-w-0">
            <KpiTile
              label="Days present"
              value={`${countText(totals.attended)}/${countText(totals.working)}`}
              icon={CalendarCheck}
              tone="sapphire"
              hint={`${countText(totals.absent)} absent · ${countText(totals.half)} half day${totals.half === 1 ? '' : 's'}`}
              className="max-md:p-3!"
            />
          </li>
          <li className="min-w-0">
            <KpiTile
              label={totals.earlyOutDays === 1 ? 'Early out' : 'Early outs'}
              value={totals.earlyOutDays}
              format={countText}
              icon={LogOut}
              tone="rose"
              hint={totals.earlyOutDays > 0 ? `${durationText(totals.earlyOutMinutes)} left early` : 'Full days every time'}
              className="max-md:p-3!"
            />
          </li>
          <li className="min-w-0">
            {production ? (
              <KpiTile
                label="Holidays"
                value={totals.holidays}
                format={countText}
                icon={Flag}
                tone="violet"
                hint="Company holidays in this period"
                className="max-md:p-3!"
              />
            ) : (
              <KpiTile
                label={totals.leave === 1 ? 'Leave day' : 'Leave days'}
                value={totals.leave}
                format={countText}
                icon={Umbrella}
                tone="violet"
                hint={`${countText(totals.permissions)} permission${totals.permissions === 1 ? '' : 's'} · ${countText(totals.casualLeave)} casual leave`}
                className="max-md:p-3!"
              />
            )}
          </li>
          <li className="min-w-0">
            <KpiTile
              label={totals.onDutyDays === 1 ? 'On-Duty day' : 'On-Duty days'}
              value={totals.onDutyDays}
              format={countText}
              icon={BriefcaseBusiness}
              tone="slate"
              hint={totals.onDutyDays > 0 ? 'Worked away from the branch' : 'None in this period'}
              className="max-md:p-3!"
            />
          </li>
          <li className="min-w-0">
            <KpiTile
              label="Overtime"
              value={durationText(totals.overtimeMinutes)}
              icon={Timer}
              tone="emerald"
              hint="Worked past your shift end"
              className="max-md:p-3!"
            />
          </li>
        </ul>

        {/* ─── Highlights ─── */}
        {lines.length > 0 && (
          <GlassCard padding="lg" className="flex flex-col gap-2 max-md:order-2 max-md:p-4! lg:col-span-5">
            <SectionHeader as="h3" icon={Sparkles} tone="violet" title="Highlights" />
            <ul className="flex flex-col">
              {lines.map((l) => {
                const Icon = LINE_ICON[l.icon]
                return (
                  <li key={l.key} className="flex items-center gap-3 py-1.5 max-md:gap-2.5">
                    <span
                      className={cn('grid size-8 shrink-0 place-items-center rounded-full border max-md:size-7 max-md:border-0', TONE_SOFT[LINE_TONE[l.tone]])}
                      aria-hidden="true"
                    >
                      <Icon className="size-4 max-md:size-[15px]" />
                    </span>
                    <span className="min-w-0 flex-1 text-[13.5px] leading-5 max-md:text-[13px] max-md:leading-[18px]">{l.text}</span>
                  </li>
                )
              })}
            </ul>
          </GlassCard>
        )}

        {/* ─── Pay: earned vs lost to attendance ─── */}
        <GlassCard padding="lg" className={cn('flex min-w-0 flex-col gap-3 max-md:order-5 max-md:p-4!', lines.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12')}>
          <SectionHeader
            as="h3"
            icon={HandCoins}
            tone="emerald"
            title="Pay: earned vs lost"
            description="From your salary slips"
            action={
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShown(!shown)}
                aria-pressed={shown}
                aria-label={shown ? 'Hide salary amounts' : 'Show salary amounts'}
                className="size-11 rounded-full sm:size-9 max-md:bg-muted max-md:text-secondary-foreground"
              >
                {shown ? <EyeOff /> : <Eye />}
              </Button>
            }
          />
          {pay.any ? (
            <>
              <dl className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <dt className="label-caps text-muted-foreground">Earned</dt>
                  <dd className="metric mt-1 truncate text-[22px] leading-7 max-md:text-[18px] max-md:leading-6">
                    {hidden ? <span aria-label="Amount hidden">{pay.totalEarnedText}</span> : pay.totalEarnedText}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="label-caps text-muted-foreground">Lost to attendance</dt>
                  <dd className="metric mt-1 truncate text-[22px] leading-7 max-md:text-[18px] max-md:leading-6">
                    {hidden ? <span aria-label="Amount hidden">{pay.totalLostText}</span> : pay.totalLostText}
                  </dd>
                </div>
              </dl>
              {pay.keptPct != null && (
                <p className="text-[12.5px] text-muted-foreground max-md:text-[12px] max-md:text-secondary-foreground">
                  You kept <span className="font-semibold text-foreground">{pay.keptPct}%</span> of your fixed pay over these months.
                </p>
              )}
              <PayBars chart={pay} revealed={revealed} hidden={hidden} />
            </>
          ) : (
            <p className="py-2 text-[13px] text-muted-foreground max-md:text-[12.5px]">No salary slips in the last {months} months yet.</p>
          )}
        </GlassCard>
      </div>
    )
  }

  return (
    <section ref={rootRef} aria-labelledby="insights-title" className={cn('flex flex-col gap-4 max-md:mb-5 max-md:gap-3', INSIGHTS_VARS)}>
      {header}
      {body}
    </section>
  )
}

/** The score in the ring: counts up once the section is in view; a dash while there is nothing to score. */
function ScoreFigure({ score, revealed }: { score: number | null; revealed: boolean }) {
  if (score == null) return <span className="metric text-[30px] leading-none text-muted-foreground">—</span>
  return (
    <>
      <span className="metric text-[32px] leading-none max-md:text-[30px]">
        <AnimatedNumber value={revealed ? score : 0} />
      </span>
      <span className="mt-0.5 text-[10.5px] font-bold text-muted-foreground">of 100</span>
    </>
  )
}

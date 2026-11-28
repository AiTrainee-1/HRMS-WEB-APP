import * as React from 'react'
import { Link } from 'wouter'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  BadgeCheck,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  HandCoins,
  Hourglass,
  PlusCircle,
  ReceiptText,
  ShieldCheck,
  TrendingDown,
  type LucideIcon,
} from 'lucide-react'
import { BarCompare, BarList, EASE_OUT, GlassCard, MoneyText, StatusPill, TONE_COLOR, staggerDelay } from '@/components/kit'
import { formatINR } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  compareRows,
  cycleText,
  lossSentence,
  moneyWentRows,
  periodLoss,
  slipCycleLabel,
  slipPeriodLabel,
  type SalaryInsights,
  type SalaryPeriod,
  type YearSummary,
} from '@/lib/salary-insights'
import { readSlipCasualLeaveShort, slipClChip, type SlipCasualLeaveShort } from '@/lib/slip-casual-leave'
import type { PaySlipListItem } from '@/api/pay-salary'
import { formatINRShort } from './phone'

const rupees = (n: number) => formatINR(Math.round(n))

/** The period's label as a link to its slip (the chart rows open the slip). */
function SlipLink({ slipId, children }: { slipId: number; children: React.ReactNode }) {
  return (
    <Link
      href={`/employee/salary/${slipId}`}
      className="focus-ring group/link inline-flex min-h-6 items-center gap-1 rounded-sm text-foreground underline-offset-4 hover:text-brand-blue hover:underline pointer-coarse:min-h-11"
    >
      {children}
      <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

/**
 * Allocated vs earned for every pay period of the year (oldest first), each row's label opening its slip. A production
 * period has no fixed salary: those years are drawn as plain earned bars instead, never as a comparison.
 */
export function PeriodChart({ periods, production, className }: { periods: readonly SalaryPeriod[]; production: boolean; className?: string }) {
  const rows = compareRows(periods)
  if (production) {
    return (
      <BarList
        className={className}
        format={rupees}
        items={rows.map((r) => ({
          key: r.key,
          label: <SlipLink slipId={r.slipId}>{r.label}</SlipLink>,
          value: r.value,
          tone: 'emerald' as const,
          hint: `Payable ${rupees(r.net)}`,
        }))}
      />
    )
  }
  return (
    <BarCompare
      className={className}
      totalLabel="Allocated salary"
      valueLabel="Earned for attendance"
      tone="emerald"
      format={rupees}
      items={rows.map((r) => ({
        key: r.key,
        label: <SlipLink slipId={r.slipId}>{r.label}</SlipLink>,
        total: r.total,
        value: r.value,
        hint: (
          <>
            Payable <span className="font-semibold text-foreground tabular-nums">{rupees(r.net)}</span>
            {r.hasAllocated && r.lost != null && r.lost > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-rejected tabular-nums">lost {rupees(r.lost)}</span>
              </>
            )}
            {!r.hasAllocated && ' · no fixed salary recorded on this slip'}
          </>
        ),
      }))}
    />
  )
}

/**
 * Where the year's money went: one woven ribbon (every rupee of the year, split by where it ended up) and the same
 * figures as ranked rows, so nothing depends on colour or bar length alone.
 */
export function MoneyWent({ summary, className }: { summary: YearSummary; className?: string }) {
  const rows = moneyWentRows(summary)
  const ribbon = rows.filter((r) => r.key !== 'ot')
  const total = ribbon.reduce((s, r) => s + r.value, 0)
  if (rows.length === 0) return <p className={cn('text-sm text-muted-foreground', className)}>Nothing was paid or deducted this year.</p>
  const spoken = ribbon.map((r) => `${r.label} ${rupees(r.value)}`).join(', ')
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {total > 0 && (
        <div>
          <div role="img" aria-label={`Where the year's money went: ${spoken}.`} className="flex h-4 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
            {ribbon.map((r, i) => (
              <motion.span
                key={r.key}
                aria-hidden="true"
                className="h-full origin-left first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(r.value / total) * 100}%`, background: TONE_COLOR[r.tone] }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: EASE_OUT, delay: staggerDelay(i, 0.08) }}
                title={`${r.label}: ${rupees(r.value)}`}
              />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground" aria-hidden="true">
            {ribbon.map((r) => (
              <li key={r.key} className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: TONE_COLOR[r.tone] }} />
                {r.label} {Math.round((r.value / total) * 100)}%
              </li>
            ))}
          </ul>
        </div>
      )}
      <BarList format={rupees} items={rows.map((r) => ({ key: r.key, label: r.label, value: r.value, tone: r.tone, hint: r.hint }))} />
    </div>
  )
}

function PeriodBadge({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span
      aria-hidden="true"
      className="weave-static grid size-12 shrink-0 place-items-center rounded-xl border border-primary/25 bg-card/70 text-center leading-none shadow-clay-sm max-md:hidden"
    >
      <span>
        <span className="font-label block text-[13px] font-bold">{top}</span>
        <span className="mt-0.5 block text-[10.5px] text-muted-foreground tabular-nums">{bottom}</span>
      </span>
    </span>
  )
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The Casual Leave of a slip row (2026-11-28): "CL 1.5 days · ₹1,500 paid", only when Casual Leave was used. */
function ClChip({ text }: { text: string | null }) {
  if (!text) return null
  return <span className="chip chip-violet">{text}</span>
}

/** The phone body of a slip card (the mobile app's SalarySlipCard): period + cycle chip, net pay big, one loss line. */
function PhoneSlipBody({
  label,
  cycle,
  net,
  loss,
  badge,
  clChip,
}: {
  label: string
  cycle: string | null
  net: number | string | null
  loss?: React.ReactNode
  badge?: React.ReactNode
  /** The month's Casual Leave (slipClChip), when any. */
  clChip?: string | null
}) {
  return (
    <span className="hidden max-md:flex max-md:min-w-0 max-md:flex-1 max-md:items-center max-md:justify-between max-md:gap-2">
      <span className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:flex-col max-md:gap-1 max-md:pr-2">
        <span className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-1.5">
          <span className="max-md:text-[13px] max-md:text-secondary-foreground max-md:break-words">{label}</span>
          {cycle && (
            <span className="max-md:rounded-full max-md:bg-info-bg max-md:px-2 max-md:py-0.5 max-md:text-[10.5px] max-md:leading-4 max-md:font-bold max-md:text-info">{cycle}</span>
          )}
          {clChip && (
            <span className="max-md:rounded-full max-md:bg-violet-bg max-md:px-2 max-md:py-0.5 max-md:text-[10.5px] max-md:leading-4 max-md:font-bold max-md:text-violet">{clChip}</span>
          )}
        </span>
        <MoneyText value={net} className="max-md:font-[family-name:var(--font-display)] max-md:text-[22px] max-md:leading-7 max-md:font-bold max-md:text-primary" />
        {loss}
      </span>
      <span className="max-md:flex max-md:shrink-0 max-md:flex-col max-md:items-end max-md:gap-2">
        {badge}
        <ChevronRight className="max-md:size-5 max-md:text-muted-foreground" aria-hidden="true" />
      </span>
    </span>
  )
}

/** One slip of the year: period (production periods with their dates and "Weekly pay"), payable, and what attendance cost;
 *  the month's Casual Leave when any was used (`casualLeave`: the slip list's short form, 2026-11-28). */
export function SlipRow({ period: p, casualLeave }: { period: SalaryPeriod; casualLeave?: SlipCasualLeaveShort | null }) {
  const loss = periodLoss(p)
  const clChip = slipClChip(casualLeave)
  const cycle = cycleText(p)
  const lossIsLate = p.attendanceLoss == null
  const label = p.period.label || `Slip ${p.slipNumber}`
  return (
    <GlassCard variant="interactive" asChild padding="sm" className="group max-md:p-4">
      <Link href={`/employee/salary/${p.slipId}`} className="flex items-center gap-3 sm:gap-4">
        <PeriodBadge top={p.kind === 'production' && p.period.start ? p.period.shortLabel.split(' ').pop() ?? '' : MON[p.month - 1] ?? '—'} bottom={String(p.year)} />
        <span className="min-w-0 flex-1 max-md:hidden">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold break-words">{label}</span>
            {cycle && (
              <StatusPill tone="info" size="sm" icon={false}>
                {cycle}
              </StatusPill>
            )}
            <ClChip text={clChip} />
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            {loss == null ? (
              'Details not recorded on this slip'
            ) : loss > 0 ? (
              <span className="font-semibold text-rejected">
                {lossIsLate ? 'Late deduction' : 'Lost to attendance'} {formatINR(loss)}
              </span>
            ) : (
              <span className="font-semibold text-approved">{lossIsLate ? 'No late deduction' : 'Nothing lost to attendance'}</span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end max-md:hidden">
          <span className="label-caps text-muted-foreground">Payable</span>
          <MoneyText value={p.netPayable} className="text-[16px] font-bold" />
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 max-md:hidden" aria-hidden="true" />
        <PhoneSlipBody
          label={label}
          cycle={cycle}
          clChip={clChip}
          net={p.netPayable}
          loss={
            loss == null ? (
              <span className="max-md:text-[11.5px] max-md:text-muted-foreground">Details not recorded on this slip</span>
            ) : (
              <span className={cn('max-md:flex max-md:items-center max-md:gap-1 max-md:text-[11.5px] max-md:font-bold max-md:tabular-nums', loss > 0 ? 'max-md:text-rejected' : 'max-md:text-approved')}>
                {loss > 0 ? <TrendingDown className="max-md:size-[13px] max-md:shrink-0" aria-hidden="true" /> : <CheckCircle2 className="max-md:size-[13px] max-md:shrink-0" aria-hidden="true" />}
                {loss > 0
                  ? `${formatINR(loss)} ${lossIsLate ? 'late deduction' : 'lost to attendance'}`
                  : lossIsLate
                    ? 'No late deduction'
                    : 'Nothing lost to attendance'}
              </span>
            )
          }
        />
      </Link>
    </GlassCard>
  )
}

/** A slip from GET /my/salary-slips (shown when the year's figures cannot load). */
export function FallbackSlipRow({ slip }: { slip: PaySlipListItem }) {
  const cycle = slipCycleLabel(slip)
  const clChip = slipClChip(readSlipCasualLeaveShort(slip.casualLeave))
  return (
    <GlassCard variant="interactive" asChild padding="sm" className="group max-md:p-4">
      <Link href={`/employee/salary/${slip.id}`} className="flex items-center gap-3 sm:gap-4">
        <span
          aria-hidden="true"
          className={cn('grid size-12 shrink-0 place-items-center rounded-xl border border-primary/25 bg-card/70 text-brand-blue max-md:hidden')}
        >
          <FileText className="size-5" />
        </span>
        <span className="min-w-0 flex-1 max-md:hidden">
          <span className="block font-semibold break-words">{slipPeriodLabel(slip)}</span>
          {cycle && <span className="block text-[12.5px] text-muted-foreground">{cycle}</span>}
          {clChip && (
            <span className="mt-1 flex">
              <ClChip text={clChip} />
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-col items-end max-md:hidden">
          <span className="label-caps text-muted-foreground">Net pay</span>
          <MoneyText value={slip.netSalary ?? null} className="text-[16px] font-bold" />
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 max-md:hidden" aria-hidden="true" />
        <PhoneSlipBody
          label={slipPeriodLabel(slip)}
          cycle={cycle}
          clChip={clChip}
          net={slip.netSalary ?? null}
          badge={
            <StatusPill tone={slip.emailedAt ? 'approved' : 'neutral'} size="sm" icon={false}>
              {slip.emailedAt ? 'Emailed' : 'Generated'}
            </StatusPill>
          }
        />
      </Link>
    </GlassCard>
  )
}

// ---- the phone view (< 768px): the mobile app's Salary Slips screen -------------------------------------------

function HeroFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="max-md:min-w-0 max-md:flex-1">
      <p className="max-md:text-[11px] max-md:font-semibold max-md:text-white/75">{label}</p>
      <p className="max-md:mt-0.5 max-md:font-[family-name:var(--font-display)] max-md:text-[clamp(14px,4.4vw,17px)] max-md:leading-6 max-md:font-bold max-md:break-words max-md:tabular-nums">
        {value}
      </p>
    </div>
  )
}

/**
 * The year at a glance on phones (the app's gradient hero): "2026 · 10 PAY PERIODS", allocated / earned / payable, and
 * what attendance cost. It sits in PageHero's KPI grid (the desktop KPI tiles are hidden on phones), spanning both columns.
 */
export function PhoneSalaryHero({ data, production }: { data: SalaryInsights; production: boolean }) {
  const s = data.summary
  if (data.periods.length === 0) return null
  return (
    <div className="bg-brand-gradient hidden max-md:relative max-md:col-span-2 max-md:block max-md:overflow-hidden max-md:rounded-xl max-md:p-[18px] max-md:text-white max-md:shadow-[var(--m-shadow-low)]">
      <span aria-hidden="true" className="max-md:pointer-events-none max-md:absolute max-md:-top-10 max-md:-right-[30px] max-md:size-[140px] max-md:rounded-full max-md:bg-white/[0.08]" />
      <p className="max-md:relative max-md:text-[10.5px] max-md:font-[800] max-md:tracking-[0.08em] max-md:text-white/75">
        {data.year} · {s.periods} {s.periods === 1 ? 'PAY PERIOD' : 'PAY PERIODS'}
      </p>
      <div className="max-md:relative max-md:mt-2.5 max-md:flex max-md:gap-2.5">
        {!production && <HeroFigure label="Allocated" value={s.allocated == null ? '—' : rupees(s.allocated)} />}
        <HeroFigure label={production ? 'Earned for shifts' : 'Earned'} value={rupees(s.earnedGross)} />
        <HeroFigure label="Payable" value={rupees(s.netPayable)} />
      </div>
      {s.attendanceLoss != null && (
        <p className="max-md:relative max-md:mt-3.5 max-md:inline-flex max-md:items-center max-md:gap-1.5 max-md:rounded-full max-md:bg-[rgb(127_29_29/0.45)] max-md:px-3 max-md:py-1.5 max-md:text-[12.5px] max-md:font-semibold max-md:text-[#fee2e2]">
          <TrendingDown className="max-md:size-4 max-md:shrink-0 max-md:text-[#fecaca]" aria-hidden="true" />
          <span>
            Lost to attendance:{' '}
            <span className="max-md:font-[family-name:var(--font-display)] max-md:font-bold max-md:text-white max-md:tabular-nums">{rupees(s.attendanceLoss)}</span>
          </span>
        </p>
      )}
      {production && data.notes[0] && <p className="max-md:relative max-md:mt-2.5 max-md:text-[11.5px] max-md:leading-4 max-md:text-white/80">{data.notes[0]}</p>}
    </div>
  )
}

/** The latest slip as one tappable line (the app's "Latest: October 2026" card). */
export function PhoneLatestCard({ latest }: { latest: SalaryPeriod }) {
  const lost = (latest.attendanceLoss ?? latest.lateDeduction ?? 0) > 0
  const cycle = cycleText(latest)
  const title = `${latest.period.label || 'Pay period'}${cycle ? ` · ${cycle}` : ''}`
  const sentence = lossSentence(latest)
  return (
    <GlassCard variant="interactive" asChild padding="none" className="hidden max-md:flex max-md:items-center max-md:gap-3 max-md:p-3.5">
      <Link href={`/employee/salary/${latest.slipId}`} aria-label={`Latest: ${title}. ${sentence} Open the slip.`}>
        <span
          aria-hidden="true"
          className={cn(
            'max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full',
            lost ? 'max-md:bg-rejected-bg max-md:text-rejected' : 'max-md:bg-approved-bg max-md:text-approved',
          )}
        >
          {lost ? <AlertCircle className="max-md:size-5" /> : <BadgeCheck className="max-md:size-5" />}
        </span>
        <span className="max-md:min-w-0 max-md:flex-1">
          <span className="max-md:block max-md:text-[13.5px] max-md:font-semibold">Latest: {title}</span>
          <span className="max-md:mt-0.5 max-md:block max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">{sentence}</span>
        </span>
        <ChevronRight className="max-md:size-5 max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
      </Link>
    </GlassCard>
  )
}

/** How many periods the phone chart shows before "Show all" (weekly pay has ~52 a year). */
const CHART_ROWS = 6

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * The app's comparison bars, newest first: per period a grey track (allocated salary), a sapphire fill (earned for
 * attendance) and a green tick (payable), the payable and the loss written at the right. Each row opens its slip.
 */
export function PhoneCompareChart({ periods, production }: { periods: readonly SalaryPeriod[]; production: boolean }) {
  const [showAll, setShowAll] = React.useState(false)
  const scale = Math.max(1, ...periods.map((p) => Math.max(p.allocated ?? 0, p.earnedGross + p.otPay, p.netPayable)))
  const bars = [...periods].reverse().map((p) => ({
    slipId: p.slipId,
    label: p.period.shortLabel || p.period.label || `Slip ${p.slipNumber || p.slipId}`,
    allocated: p.allocated,
    earned: p.earnedGross,
    net: p.netPayable,
    lost: p.attendanceLoss,
    allocatedRatio: clamp01((p.allocated ?? p.earnedGross + p.otPay) / scale),
    earnedRatio: clamp01(p.earnedGross / scale),
    netRatio: clamp01(p.netPayable / scale),
  }))
  const shown = showAll ? bars : bars.slice(0, CHART_ROWS)
  return (
    <div className="hidden max-md:block">
      <h3 className="max-md:font-[family-name:var(--font-display)] max-md:text-[14.5px] max-md:font-semibold">
        {production ? 'Earned vs payable' : 'Allocated vs earned'}
      </h3>
      <p className="max-md:mt-0.5 max-md:text-[11.5px] max-md:text-muted-foreground">Tap a period to open its slip</p>
      <div className="max-md:mt-2.5 max-md:mb-1.5 max-md:flex max-md:flex-wrap max-md:gap-3 max-md:text-[11px] max-md:text-secondary-foreground" aria-hidden="true">
        {!production && (
          <span className="max-md:inline-flex max-md:items-center max-md:gap-[5px]">
            <span className="max-md:size-2.5 max-md:rounded-[3px] max-md:bg-border" /> Allocated
          </span>
        )}
        <span className="max-md:inline-flex max-md:items-center max-md:gap-[5px]">
          <span className="max-md:size-2.5 max-md:rounded-[3px] max-md:bg-primary" /> {production ? 'Earned' : 'Earned for attendance'}
        </span>
        <span className="max-md:inline-flex max-md:items-center max-md:gap-[5px]">
          <span className="max-md:h-3 max-md:w-[3px] max-md:rounded-[1px] max-md:bg-success" /> Payable
        </span>
      </div>
      <ul>
        {shown.map((b, i) => (
          <li key={b.slipId}>
            <Link
              href={`/employee/salary/${b.slipId}`}
              aria-label={`${b.label}: ${b.allocated != null ? `allocated ${rupees(b.allocated)}, ` : ''}earned ${rupees(b.earned)}, payable ${rupees(b.net)}${b.lost ? `, lost ${rupees(b.lost)}` : ''}`}
              className="focus-ring max-md:flex max-md:min-h-11 max-md:items-center max-md:gap-2.5 max-md:rounded-lg max-md:py-[7px] max-md:active:opacity-70"
            >
              <span className="max-md:w-[62px] max-md:shrink-0 max-md:truncate max-md:text-[11.5px] max-md:font-semibold max-md:text-secondary-foreground">{b.label}</span>
              <span className="max-md:relative max-md:h-4 max-md:flex-1" aria-hidden="true">
                <span className="max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:rounded-[5px] max-md:bg-border" style={{ width: `${b.allocatedRatio * 100}%` }} />
                <motion.span
                  className="max-md:absolute max-md:top-[3px] max-md:bottom-[3px] max-md:left-0 max-md:origin-left max-md:rounded max-md:bg-primary"
                  style={{ width: `${b.earnedRatio * 100}%` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, ease: EASE_OUT, delay: staggerDelay(i, 0.04) }}
                />
                <span className="max-md:absolute max-md:-top-[3px] max-md:-bottom-[3px] max-md:-ml-[1.5px] max-md:w-[3px] max-md:rounded-sm max-md:bg-success" style={{ left: `${b.netRatio * 100}%` }} />
              </span>
              <span className="max-md:flex max-md:w-[62px] max-md:shrink-0 max-md:flex-col max-md:items-end">
                <span className="max-md:text-[12px] max-md:font-bold max-md:tabular-nums">{formatINRShort(b.net)}</span>
                {b.lost ? (
                  <span className="max-md:text-[10.5px] max-md:font-bold max-md:text-rejected max-md:tabular-nums">-{formatINRShort(b.lost)}</span>
                ) : (
                  <span className="max-md:text-[10.5px] max-md:font-semibold max-md:text-approved">{b.lost === 0 ? 'no loss' : ' '}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {bars.length > CHART_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="focus-ring max-md:flex max-md:min-h-9 max-md:w-full max-md:items-center max-md:justify-center max-md:gap-1 max-md:rounded-lg max-md:pt-2 max-md:text-[12.5px] max-md:font-semibold max-md:text-primary"
        >
          {showAll ? 'Show fewer' : `Show all ${bars.length} periods`}
          {showAll ? <ChevronUp className="max-md:size-4" aria-hidden="true" /> : <ChevronDown className="max-md:size-4" aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}

function WhyRow({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number | null; tone: 'loss' | 'gain' | 'neutral' }) {
  const sign = value ? (tone === 'gain' ? '+ ' : '- ') : ''
  const text = value == null ? 'Not recorded' : `${sign}${formatINR(value)}`
  return (
    <li className="max-md:flex max-md:items-center max-md:gap-2.5 max-md:border-b max-md:border-input max-md:py-2 max-md:last:border-b-0">
      <Icon className="max-md:size-4 max-md:shrink-0 max-md:text-muted-foreground" aria-hidden="true" />
      <span className="max-md:flex-1 max-md:text-[13px]">{label}</span>
      <span
        className={cn(
          'max-md:text-[13px] max-md:font-bold max-md:tabular-nums',
          !value ? 'max-md:text-muted-foreground' : tone === 'loss' ? 'max-md:text-rejected' : tone === 'gain' ? 'max-md:text-approved' : 'max-md:text-foreground',
        )}
      >
        {text}
      </span>
    </li>
  )
}

/** "Where the money went in 2026" as the app's plain rows (icon, label, signed figure). */
export function PhoneMoneyWent({ summary: s, production, year }: { summary: YearSummary; production: boolean; year: number }) {
  return (
    <div className="hidden max-md:block">
      <h3 className="max-md:font-[family-name:var(--font-display)] max-md:text-[14.5px] max-md:font-semibold">Where the money went in {year}</h3>
      <ul className="max-md:mt-1">
        {!production && <WhyRow icon={CalendarX} label="Days not paid" value={s.absentLoss} tone="loss" />}
        <WhyRow icon={Clock} label="Late deductions" value={s.lateDeduction} tone="loss" />
        {!production && <WhyRow icon={Hourglass} label="Permission deductions" value={s.permissionDeduction} tone="loss" />}
        <WhyRow icon={ShieldCheck} label="PF, ESI and TDS" value={s.statutory} tone="neutral" />
        <WhyRow icon={HandCoins} label="Advance / loan recovery" value={s.advance} tone="neutral" />
        {s.otherDeductions > 0 && <WhyRow icon={ReceiptText} label="Other deductions" value={s.otherDeductions} tone="neutral" />}
        {s.otPay > 0 && <WhyRow icon={PlusCircle} label="Overtime pay added" value={s.otPay} tone="gain" />}
      </ul>
    </div>
  )
}

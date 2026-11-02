import * as React from 'react'
import { Link } from 'wouter'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from './AnimatedNumber'
import { GlassCard } from './GlassCard'
import { Sparkline } from './Sparkline'
import { TONE_COLOR, TONE_SOFT, type Tone } from './tones'

/**
 * One headline figure: a tinted icon, a caps label, a big counting number, a short hint, optionally a sparkline. Goes in
 * PageHero's `kpis` row or a dashboard grid (2 per row on phones, 4 on desktop). With `href` the whole tile is a link
 * (lift + glow on hover). Give `value` a number to count up; a string (e.g. "09:14 AM") is shown as is.
 *
 *   <KpiTile label="Waiting" value={3} icon={Clock} tone="amber" hint="for a decision" />
 *   <KpiTile label="Net pay" value={net} format={(n) => formatINR(Math.round(n))} icon={Wallet} tone="emerald" href="/employee/salary" />
 */
export function KpiTile({
  label,
  value,
  format,
  icon: Icon,
  tone = 'sapphire',
  hint,
  unit,
  trend,
  href,
  onClick,
  className,
}: {
  label: string
  value: number | string | null | undefined
  /** How a numeric value is written while counting and at rest (default: whole number with Indian grouping). */
  format?: (n: number) => string
  icon?: LucideIcon
  tone?: Tone
  /** A short line under the figure ("for a decision", "since 1 Oct"). */
  hint?: React.ReactNode
  /** Small text right after the figure ("days", "hrs"). */
  unit?: string
  /** Recent values, oldest first, for a sparkline along the foot. */
  trend?: number[]
  href?: string
  onClick?: () => void
  className?: string
}) {
  const interactive = !!href || !!onClick
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border', TONE_SOFT[tone])} aria-hidden="true">
            <Icon className="size-[18px]" />
          </span>
        )}
        {interactive && (
          <ArrowUpRight
            className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="label-caps mt-3 text-muted-foreground max-md:mt-2.5">{label}</p>
      <p className="metric mt-1 flex items-baseline gap-1.5 text-[28px] leading-8 max-md:text-[22px]! max-md:leading-7 sm:text-[30px]">
        {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : <span>{value ?? '—'}</span>}
        {unit && <span className="font-label text-[13px] font-semibold text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[12.5px] leading-4 text-muted-foreground max-md:text-[11.5px]">{hint}</p>}
      {trend && trend.length > 1 && <Sparkline data={trend} color={TONE_COLOR[tone]} className="mt-3 h-8 w-full" label={`${label} trend`} />}
    </>
  )

  const cls = cn('group flex h-full flex-col', className)
  if (href) {
    return (
      <GlassCard variant="interactive" asChild className={cls}>
        <Link href={href}>{body}</Link>
      </GlassCard>
    )
  }
  if (onClick) {
    return (
      <GlassCard variant="interactive" asChild className={cn(cls, 'text-left')}>
        <button type="button" onClick={onClick}>
          {body}
        </button>
      </GlassCard>
    )
  }
  return <GlassCard className={cls}>{body}</GlassCard>
}

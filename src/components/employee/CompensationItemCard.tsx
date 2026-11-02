import { format, parseISO } from 'date-fns'
import { CalendarDays, History, Megaphone, Sparkles, UserCheck, type LucideIcon } from 'lucide-react'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { GlassCard } from '@/components/kit'
import { cn } from '@/lib/utils'
import { formatMinutes, formatShifts, kindInfo, statusInfo, type CompensationItem } from '@/lib/compensation'

const OVERTIME_KINDS = new Set(['ot_shift', 'ot_shift_relaxation', 'ot_shift_pay'])

/** 'Mon, 12 Oct 2026' for a YYYY-MM-DD string (the parsers only let real calendar dates through). */
function dayText(iso: string): string {
  return format(parseISO(iso), 'EEE, d MMM yyyy')
}

export type CompensationSource = 'hr' | 'automatic' | 'company'

const SOURCE: Record<CompensationSource, { label: string; icon: LucideIcon; cls: string }> = {
  hr: { label: 'Given by HR', icon: UserCheck, cls: 'bg-violet-bg text-violet border-violet-border' },
  automatic: { label: 'Automatic', icon: Sparkles, cls: 'bg-info-bg text-info border-info-border' },
  company: { label: 'For everyone', icon: Megaphone, cls: 'bg-neutral-bg text-neutral border-neutral-border' },
}

/** Where an item came from, in words with an icon (never colour alone). */
export function SourceBadge({ source, className }: { source: CompensationSource; className?: string }) {
  const s = SOURCE[source]
  const Icon = s.icon
  return (
    <span className={cn('font-label inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-bold', s.cls, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {s.label}
    </span>
  )
}

// Phones (< 768px): the mobile app's item card has a 4px left border in the kind's own colour (its kindTone /
// historyKindTone "solid" colours). Literal classes so Tailwind generates them; all inside the phone media query.
const PHONE_ACCENT: Record<string, string> = {
  ot_allowance: 'max-md:border-l-[#4d7c0f]!',
  ot_shift: 'max-md:border-l-[#b45309]!',
  ot_shift_relaxation: 'max-md:border-l-[#047857]!',
  ot_shift_pay: 'max-md:border-l-[#15803d]!',
  holiday_work: 'max-md:border-l-[#6d28d9]!',
  redemption: 'max-md:border-l-[#047857]!',
  window_late_in: 'max-md:border-l-[#0369a1]!',
  window_early_out: 'max-md:border-l-[#a21caf]!',
  birthday: 'max-md:border-l-[#e11d48]!',
  compensation_day: 'max-md:border-l-[#0f766e]!',
  balance_credit: 'max-md:border-l-[#4338ca]!',
  alternative_day: 'max-md:border-l-[#57534e]!',
}
const PHONE_ACCENT_OTHER = 'max-md:border-l-[#475569]!'

// The app's source chip: HR's mark in sapphire, the automatic / company ones quiet.
const PHONE_SOURCE: Record<CompensationSource, string> = {
  hr: 'max-md:border-primary max-md:bg-accent max-md:text-primary',
  automatic: 'max-md:border-border max-md:bg-muted max-md:text-muted-foreground',
  company: 'max-md:border-border max-md:bg-muted max-md:text-muted-foreground',
}

/**
 * One compensation item: what kind it is (chip + symbol), where it stands (status chip, in the server's words), the
 * server's title and explanation, the date and the shifts / minutes it is worth, and (year timeline) where it came from.
 * A kind or status this app has never heard of is drawn with a neutral chip and a generic symbol: never hidden.
 * Phones: the app's card - kind chip and status at the two ends, the source on its own row, the title, a calendar line
 * with the date, the explanation, then the figures as grey pills.
 */
export function CompensationItemCard({ item, source, className }: { item: CompensationItem; source?: CompensationSource; className?: string }) {
  const kind = kindInfo(item.kind)
  const status = statusInfo(item)
  const shifts = formatShifts(item.shifts)
  // `minutes` is what the late-in allowance grants, but for a shift compensation it is the extra time worked past the
  // shift end; `minutesUsed` is what the arrival actually used of an allowance.
  const minutes = formatMinutes(item.minutes)
  const minutesLabel = !minutes
    ? ''
    : item.kind === 'ot_allowance'
      ? `${minutes} allowance`
      : OVERTIME_KINDS.has(item.kind)
        ? `${minutes} past shift end`
        : minutes
  const minutesUsed = item.minutesUsed != null && item.minutesUsed > 0 ? formatMinutes(item.minutesUsed) : ''
  const facts = [
    shifts && { label: shifts, key: 'shifts' },
    minutesLabel && { label: minutesLabel, key: 'minutes' },
    minutesUsed && { label: `Used ${minutesUsed}`, key: 'used' },
    item.time && { label: `At ${item.time}`, key: 'time' },
  ].filter((f): f is { label: string; key: string } => !!f)
  const workedOn = item.workDate && item.workDate !== item.date ? item.workDate : null

  return (
    <GlassCard
      data-testid="compensation-item"
      data-kind={item.kind}
      className={cn(
        'flex gap-3 max-md:flex-col max-md:gap-2 max-md:border-l-4! max-md:p-3.5! sm:gap-4',
        PHONE_ACCENT[item.kind] ?? PHONE_ACCENT_OTHER,
        className,
      )}
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg border max-md:hidden', kind.chip)} aria-hidden="true">
        <MarkerSymbol name={kind.symbol} className="size-5" />
      </span>
      <div className="min-w-0 flex-1 max-md:flex max-md:flex-col max-md:gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 max-md:justify-between">
          <span className={cn('chip', kind.chip)}>
            <MarkerSymbol name={kind.symbol} className="hidden max-md:inline-block max-md:size-[13px]" />
            {kind.label}
          </span>
          <span className={cn('chip', status.chip)}>
            <span className={cn('pip', status.live && 'pip-live')} />
            {status.label}
          </span>
          {source && <SourceBadge source={source} className="max-md:hidden" />}
          {item.legacy && <span className="chip chip-muted max-md:hidden">Earlier record</span>}
        </div>
        {(source || item.legacy) && (
          <div className="hidden max-md:flex max-md:flex-wrap max-md:gap-1.5">
            {source && <SourceBadge source={source} className={cn('max-md:px-2.5 max-md:text-[11px]', PHONE_SOURCE[source])} />}
            {item.legacy && (
              <span className="max-md:inline-flex max-md:items-center max-md:gap-1 max-md:rounded-full max-md:bg-neutral-bg max-md:px-2.5 max-md:py-0.5 max-md:text-[11px] max-md:font-bold max-md:text-neutral">
                <History className="max-md:size-3" aria-hidden="true" />
                Earlier record
              </span>
            )}
          </div>
        )}
        <h3 className="mt-2 text-[15px] leading-snug font-semibold break-words max-md:mt-0 max-md:text-[14px] max-md:leading-5">{item.title}</h3>
        <p className="hidden max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-1.5 max-md:gap-y-0.5 max-md:text-[12px] max-md:font-semibold max-md:text-muted-foreground">
          <CalendarDays className="max-md:size-[13px] max-md:shrink-0" aria-hidden="true" />
          <span>{item.date ? dayText(item.date) : 'Date not given'}</span>
          {workedOn && <span className="max-md:font-normal">· Worked on {dayText(workedOn)}</span>}
        </p>
        {item.detail && (
          <p className="mt-1 text-[13.5px] text-muted-foreground max-md:mt-0 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">{item.detail}</p>
        )}
        <div className={cn('mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] max-md:mt-0 max-md:gap-1.5', facts.length === 0 && 'max-md:hidden')}>
          <span className="font-label font-semibold text-brand-blue max-md:hidden">{item.date ? dayText(item.date) : 'Date not given'}</span>
          {workedOn && <span className="text-muted-foreground max-md:hidden">Worked on {dayText(workedOn)}</span>}
          {facts.map((f) => (
            <span
              key={f.key}
              className="rounded-md bg-foreground/[0.06] px-2 py-0.5 font-semibold tabular-nums max-md:rounded-full max-md:bg-muted max-md:px-2.5 max-md:py-1 max-md:text-[11.5px] max-md:text-secondary-foreground"
            >
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

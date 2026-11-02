import * as React from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function step(month: number, year: number, delta: number): [number, number] {
  let m = month + delta
  let y = year
  if (m > 12) {
    m = 1
    y += 1
  } else if (m < 1) {
    m = 12
    y -= 1
  }
  return [m, y]
}

function atOrAfterNow(month: number, year: number): boolean {
  const now = new Date()
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)
}

/** A month bound for the arrows (`min`: the earliest the ‹ arrow reaches; `max`: the latest the › arrow reaches). */
type MinMonth = { month: number; year: number } | null | undefined

function atOrBeforeMin(month: number, year: number, min: MinMonth): boolean {
  return !!min && (year < min.year || (year === min.year && month <= min.month))
}

/** Whether the › arrow is off: at `max` when a page gives one (a records page whose latest record lies in a later
 *  month), else - with disableFuture - at the current month. */
function nextIsOff(month: number, year: number, max: MinMonth, disableFuture: boolean): boolean {
  if (max) return year > max.year || (year === max.year && month >= max.month)
  return disableFuture && atOrAfterNow(month, year)
}

export function MonthYearPicker({
  month,
  year,
  onChange,
  disableFuture = true,
  min,
  max,
  label,
  className,
}: {
  month: number
  year: number
  onChange: (month: number, year: number) => void
  disableFuture?: boolean
  /** Optional: the earliest month (the ‹ arrow turns off there). Unbounded when left out. */
  min?: MinMonth
  /** Optional: the latest month (the › arrow turns off there) instead of the current month. */
  max?: MinMonth
  /** Optional: what the months filter, read out with the month ("Leave requests"); the arrows' names include it. */
  label?: string
  /** Extra classes for the root (a page hides it on phones when it shows PhoneMonthBar instead). */
  className?: string
}) {
  function shift(delta: number) {
    const [m, y] = step(month, year, delta)
    onChange(m, y)
  }

  return (
    <div className={cn('flex items-center gap-2', className)} role={label ? 'group' : undefined} aria-label={label ? `${label}: month` : undefined}>
      <Button variant="outline" size="icon" onClick={() => shift(-1)} disabled={atOrBeforeMin(month, year, min)} aria-label="Previous month">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-semibold" aria-live={label ? 'polite' : undefined}>
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => shift(1)}
        disabled={nextIsOff(month, year, max, disableFuture)}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

/**
 * PHONE ONLY (< 768px): the mobile app's month card (app/(tabs)/attendance.tsx `monthCard`) - a white card with the
 * previous / next chevrons around "November 2026", and whatever the page puts at the right (`trailing`, e.g. the
 * Synced / Pending Sync pill). display:none at >= 768px, where the page keeps MonthYearPicker.
 */
export function PhoneMonthBar({
  month,
  year,
  onChange,
  disableFuture = true,
  min,
  max,
  label,
  trailing,
  className,
}: {
  month: number
  year: number
  onChange: (month: number, year: number) => void
  disableFuture?: boolean
  /** Optional: the earliest month (the ‹ arrow turns off there). Unbounded when left out. */
  min?: MinMonth
  /** Optional: the latest month (the › arrow turns off there) instead of the current month. */
  max?: MinMonth
  /** Optional: what the months filter ("Leave requests"), for screen readers. */
  label?: string
  trailing?: React.ReactNode
  className?: string
}) {
  const nextOff = nextIsOff(month, year, max, disableFuture)
  const prevOff = atOrBeforeMin(month, year, min)
  const btn =
    'focus-ring max-md:-my-1 max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:text-foreground max-md:active:bg-foreground/[0.06] max-md:disabled:text-input'
  return (
    <div
      className={cn(
        'hidden max-md:flex max-md:min-h-[52px] max-md:items-center max-md:gap-1 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:px-1.5 max-md:py-1.5 max-md:pr-2.5 max-md:shadow-[var(--m-shadow-low)]',
        className,
      )}
      role={label ? 'group' : undefined}
      aria-label={label ? `${label}: month` : undefined}
    >
      <button type="button" onClick={() => onChange(...step(month, year, -1))} disabled={prevOff} aria-label="Previous month" className={btn}>
        <ChevronLeft className="max-md:size-5" aria-hidden="true" />
      </button>
      <span className="max-md:flex max-md:items-center max-md:gap-1.5" aria-live="polite">
        <CalendarDays className="max-md:size-[15px] max-md:text-muted-foreground" aria-hidden="true" />
        <span className="max-md:text-[13px] max-md:font-semibold max-md:whitespace-nowrap max-md:text-foreground">
          {MONTH_NAMES[month - 1]} {year}
        </span>
      </span>
      <button type="button" onClick={() => onChange(...step(month, year, 1))} disabled={nextOff} aria-label="Next month" className={btn}>
        <ChevronRight className="max-md:size-5" aria-hidden="true" />
      </button>
      <span className="max-md:flex-1" aria-hidden="true" />
      {trailing}
    </div>
  )
}

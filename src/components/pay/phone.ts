import { cn } from '@/lib/utils'

// Plain helpers of the PHONE view (< 768px) of the pay pages (kept apart from PhoneParts.tsx so that file exports only
// components). Every class string here is `max-md:`-prefixed (src/components/kit/MOBILE.md).

/** "₹1.2L", "₹45.3K", "₹900": a short figure for the chart rows (the mobile app's formatInrShort). */
export function formatINRShort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const a = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(a >= 1000000 ? 0 : 1).replace(/\.0$/, '')}L`
  if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`
  return `${sign}₹${Math.round(a)}`
}

/** The class string of an app filter chip (white pill + hairline; the chosen one filled sapphire). */
export function phoneChipClass(selected: boolean): string {
  return selected
    ? 'max-md:border-primary max-md:bg-primary max-md:bg-none max-md:text-primary-foreground'
    : 'max-md:border-border max-md:bg-card max-md:text-secondary-foreground'
}

/** The count pill inside an app filter chip. */
export function phoneCountClass(selected: boolean): string {
  return cn(
    'max-md:min-w-[22px] max-md:rounded-full max-md:px-1.5 max-md:py-0.5 max-md:text-center max-md:text-[11px] max-md:leading-4 max-md:font-[800]',
    selected ? 'max-md:bg-white/25 max-md:text-primary-foreground' : 'max-md:bg-muted max-md:text-muted-foreground',
  )
}

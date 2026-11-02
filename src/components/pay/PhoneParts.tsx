import type * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Small building blocks of the PHONE view (< 768px) of the pay pages (Salary, Salary slip, Compensation, Advances),
// modelled on the Employee mobile app's screens. Every element here is phone-only: the wrappers carry `hidden max-md:*`
// and every inner class is `max-md:`-prefixed, so none of it reaches the desktop view or the desktop CSS
// (src/components/kit/MOBILE.md).

const WELL = {
  sapphire: 'max-md:bg-accent max-md:text-primary',
  info: 'max-md:bg-info-bg max-md:text-info',
  emerald: 'max-md:bg-approved-bg max-md:text-approved',
  rose: 'max-md:bg-rejected-bg max-md:text-rejected',
  amber: 'max-md:bg-waiting-bg max-md:text-waiting',
  violet: 'max-md:bg-violet-bg max-md:text-violet',
} as const

export type PhoneTone = keyof typeof WELL

/** The app's card title row: a 22px tinted circle with a 14px icon, then the title (14px Plus Jakarta semibold). */
export function PhoneCardTitle({
  icon: Icon,
  tone = 'sapphire',
  title,
  as: Heading = 'h3',
  className,
}: {
  icon: LucideIcon
  tone?: PhoneTone
  title: React.ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('hidden max-md:mb-2 max-md:flex max-md:items-center max-md:gap-2', className)}>
      <span className={cn('max-md:grid max-md:size-[22px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full', WELL[tone])} aria-hidden="true">
        <Icon className="max-md:size-3.5" />
      </span>
      <Heading className="max-md:font-[family-name:var(--font-display)] max-md:text-[14px] max-md:leading-5 max-md:font-semibold">{title}</Heading>
    </div>
  )
}

/** A figure row of an app card: label (+ a small line under it) on the left, the value on the right, a hairline under. */
export function PhoneRow({
  label,
  sub,
  value,
  tone,
  highlight,
}: {
  label: React.ReactNode
  sub?: React.ReactNode
  value: React.ReactNode
  tone?: 'gain' | 'loss' | 'muted'
  highlight?: boolean
}) {
  return (
    <div className="max-md:flex max-md:items-center max-md:justify-between max-md:gap-3 max-md:border-b max-md:border-input max-md:py-[9px] max-md:last:border-b-0">
      <div className="max-md:min-w-0 max-md:flex-1">
        <p className="max-md:text-[13px]">{label}</p>
        {sub && <p className="max-md:mt-px max-md:text-[10.5px] max-md:text-muted-foreground">{sub}</p>}
      </div>
      <p
        className={cn(
          'max-md:shrink-0 max-md:text-[13px] max-md:font-semibold max-md:tabular-nums',
          highlight && 'max-md:text-[14px] max-md:font-[800]',
          tone === 'gain' && 'max-md:text-approved',
          tone === 'loss' && 'max-md:text-rejected',
          tone === 'muted' && 'max-md:text-muted-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** The app's small grey label above a block ("All salary slips", "ATTENDANCE BEHIND THIS PAY"): 11px, extra bold. */
export function PhoneLabel({ children, as: Tag = 'h2', className }: { children: React.ReactNode; as?: 'h2' | 'h3' | 'p'; className?: string }) {
  return (
    <Tag className={cn('hidden max-md:block max-md:text-[11px] max-md:font-[800] max-md:tracking-[0.05em] max-md:text-muted-foreground', className)}>
      {children}
    </Tag>
  )
}

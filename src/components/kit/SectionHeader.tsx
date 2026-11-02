import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TONE_SOFT, type Tone } from './tones'

/**
 * The heading of a section inside a page (an h2 by default; the page's h1 is PageHero's). A small tinted icon, the
 * title, an optional count, a one-line description, and actions on the right.
 * Phones (< 768px): the mobile app's section title - Plus Jakarta semibold 16px (15px as a card title, h3), the icon
 * bare in its tone colour (no tile), the description 12px muted (kit/MOBILE.md).
 *
 *   <SectionHeader icon={History} title="Past requests" count={12} description="Your last 12 months." action={<Button variant="ghost" size="sm">See all</Button>} />
 */
export function SectionHeader({
  title,
  description,
  icon: Icon,
  tone = 'sapphire',
  count,
  action,
  as: Heading = 'h2',
  id,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  tone?: Tone
  count?: number
  action?: React.ReactNode
  /** h2 for a page section, h3 inside a card. */
  as?: 'h2' | 'h3'
  /** Put on the heading so a region can use aria-labelledby. */
  id?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-2 max-md:items-center', className)}>
      <div className="flex min-w-0 items-center gap-3 max-md:gap-2">
        {Icon && (
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg border max-md:size-auto max-md:border-0 max-md:bg-transparent',
              TONE_SOFT[tone],
            )}
            aria-hidden="true"
          >
            <Icon className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <Heading
            id={id}
            className={cn(
              'font-display flex items-center gap-2 font-semibold',
              Heading === 'h2' ? 'text-xl max-md:text-base' : 'text-[17px] max-md:text-[15px]',
            )}
          >
            {title}
            {count !== undefined && (
              <span className="font-label rounded-full bg-foreground/[0.07] px-2 py-px text-[12px] font-bold text-foreground/75 tabular-nums">
                {count}
              </span>
            )}
          </Heading>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground max-md:text-[12px]">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}

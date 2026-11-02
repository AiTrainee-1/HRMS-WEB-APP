import * as React from 'react'
import { motion } from 'framer-motion'
import { SPRING, TONE_SOFT } from '@/components/kit'
import { rovingKeyDown } from '@/components/kit/roving'
import { CATEGORY_LABEL, type ApprovalCategory, type CategoryCounts } from '@/lib/approvals-history'
import { cn } from '@/lib/utils'
import { CATEGORY_META, PHONE_TONE_FILL } from './categoryMeta'

/**
 * The kinds of request a head decides, each with its Pending number (amber while something waits). A column on desktop,
 * a row that scrolls sideways on phones. The chosen one gets a sapphire pill that springs between items. Arrow keys move.
 * Phones (< 768px): the mobile app's CategoryRail - outlined white pills running to the screen edges, a round tinted
 * icon, a red count only while something waits; the chosen pill fills with the category's colour.
 */
export function CategoryRail({
  categories,
  value,
  counts,
  onChange,
  panelId,
}: {
  categories: readonly ApprovalCategory[]
  value: ApprovalCategory
  counts: CategoryCounts
  onChange: (c: ApprovalCategory) => void
  panelId?: string
}) {
  const id = React.useId()
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  return (
    <div
      role="tablist"
      aria-label="Kind of request"
      onKeyDown={(e) => rovingKeyDown(e, categories, value, () => false, onChange, refs.current)}
      className="glass scrollbar-none -mx-4 flex gap-1 overflow-x-auto rounded-none p-1.5 max-md:gap-2 max-md:border-0! max-md:bg-transparent! max-md:px-4 max-md:py-0.5 sm:mx-0 sm:rounded-xl sm:max-md:-mx-4 sm:max-md:rounded-none lg:sticky lg:top-24 lg:flex-col lg:self-start lg:p-2"
    >
      {categories.map((c, i) => {
        const meta = CATEGORY_META[c]
        const Icon = meta.icon
        const active = c === value
        const pending = counts[c]?.pending ?? 0
        return (
          <button
            key={c}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(c)}
            className={cn(
              'font-label focus-ring group relative flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold transition-colors duration-200 lg:w-full',
              active ? 'text-white' : 'text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground',
              // Phones: an outlined white pill (icon well 28px, label 13px), the chosen one filled with its colour.
              'max-md:min-h-10 max-md:gap-[7px] max-md:rounded-full max-md:border max-md:py-[5px] max-md:pr-3 max-md:pl-[5px] max-md:text-[13px] max-md:active:opacity-85',
              active ? cn('max-md:border-transparent', PHONE_TONE_FILL[meta.tone]) : 'max-md:border-input max-md:bg-card max-md:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={`rail-${id}`}
                transition={SPRING}
                aria-hidden="true"
                className="bg-brand-gradient absolute inset-0 rounded-lg shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_8px_20px_-10px_rgb(37_99_235/0.8)] max-md:hidden"
              >
                <span className="bg-silk absolute inset-y-2 left-0 hidden w-[3px] rounded-full lg:block" />
              </motion.span>
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-md border transition-transform duration-200 group-hover:scale-105',
                active ? 'border-white/30 bg-white/15 text-white' : TONE_SOFT[meta.tone],
                'max-md:rounded-full max-md:border-0',
                active && 'max-md:bg-white/20 max-md:text-current',
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <span className="relative z-10 flex-1 whitespace-nowrap">{CATEGORY_LABEL[c]}</span>
            <span
              className={cn(
                'relative z-10 grid min-w-6 place-items-center rounded-full px-1.5 text-[11.5px] leading-5 font-bold tabular-nums',
                pending > 0 ? (active ? 'bg-white/25 text-white' : 'bg-waiting-bg text-waiting') : active ? 'text-white/80' : 'text-muted-foreground',
                // Phones: the app's red count, only while something waits (white on the chosen pill).
                pending > 0
                  ? cn('max-md:h-5 max-md:min-w-5 max-md:px-[5px] max-md:text-[11px] max-md:leading-5 max-md:font-[800]', active ? 'max-md:bg-card max-md:text-foreground' : 'max-md:bg-destructive max-md:text-destructive-foreground')
                  : 'max-md:hidden',
              )}
            >
              {pending}
              <span className="sr-only"> waiting</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

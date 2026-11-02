import * as React from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SPRING } from './motion'
import { rovingKeyDown } from './roving'

export interface SegmentOption<V extends string> {
  value: V
  label: React.ReactNode
  icon?: LucideIcon
  /** A small number after the label (hidden when undefined). */
  count?: number
  disabled?: boolean
  /** Accessible name when the label is only an icon. */
  ariaLabel?: string
}

/**
 * Pick one of 2-5 options: a glass track with a sapphire pill that springs to the chosen option (shared layout). Use it
 * for page-level switches (Office / On-Duty, Month / Year, List / Calendar). For the four request views use
 * <StatusViews>; for in-card content tabs the restyled ui/tabs is fine too.
 * Phones (< 768px): the app's section bar - a white card track, the chosen option filled sapphire (no silk foot).
 *
 *   <SegmentedControl ariaLabel="Show" value={mode} onChange={setMode}
 *     options={[{ value: 'list', label: 'List', icon: List }, { value: 'calendar', label: 'Calendar', icon: CalendarDays }]} />
 */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  fullWidth,
  className,
}: {
  options: readonly SegmentOption<V>[]
  value: V
  onChange: (value: V) => void
  /** What is being chosen ("Request type"). Required: screen readers announce it. */
  ariaLabel: string
  size?: 'sm' | 'md'
  /** Stretch to the container, options sharing the width equally. */
  fullWidth?: boolean
  className?: string
}) {
  const id = React.useId()
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])
  const values = options.map((o) => o.value)
  const isDisabled = (v: V) => !!options.find((o) => o.value === v)?.disabled

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={(e) => rovingKeyDown(e, values, value, isDisabled, onChange, refs.current)}
      className={cn('glass flex max-w-full gap-1 overflow-x-auto rounded-xl p-1 scrollbar-none', fullWidth ? 'w-full' : 'w-fit', className)}
    >
      {options.map((o, i) => {
        const active = o.value === value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'font-label focus-ring relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 font-semibold whitespace-nowrap transition-colors duration-200 disabled:pointer-events-none disabled:opacity-45',
              size === 'sm' ? 'min-h-9 text-[12.5px] pointer-coarse:min-h-11' : 'min-h-11 text-[13.5px]',
              fullWidth && 'flex-1',
              active ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={SPRING}
                aria-hidden="true"
                className="bg-brand-gradient absolute inset-0 rounded-lg shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_6px_18px_-8px_rgb(37_99_235/0.7)] max-md:shadow-none"
              >
                <span className="bg-silk absolute inset-x-3 bottom-[3px] h-[2px] rounded-full opacity-80 max-md:hidden" />
              </motion.span>
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon && <Icon className="size-4" aria-hidden="true" />}
              {o.label}
              {o.count !== undefined && (
                <span
                  className={cn(
                    'grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] leading-5 font-bold tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-foreground/[0.07] text-foreground/80',
                  )}
                >
                  {o.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

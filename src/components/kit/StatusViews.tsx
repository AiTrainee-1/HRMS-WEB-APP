import * as React from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react'
import { MONTH_HINT, REQUEST_VIEWS, VIEW_LABELS, type RequestView } from '@/lib/request-views'
import { cn } from '@/lib/utils'
import { SPRING } from './motion'
import { rovingKeyDown } from './roving'

const VIEW_ICON: Record<RequestView, LucideIcon> = {
  waiting: Clock,
  month: CalendarDays,
  approved: CheckCircle2,
  rejected: XCircle,
}

// The active view's thread + count colour; each passes AA in both themes.
// Phones (m*): the mobile app's RequestViewSwitcher - every card tinted with its colour, the chosen one filled with it
// (fill + its foreground: AA in both phone themes).
const VIEW_TONE: Record<
  RequestView,
  { text: string; thread: string; count: string; ring: string; mFill: string; mTint: string; mIcon: string }
> = {
  waiting: {
    text: 'text-waiting',
    thread: 'bg-warning',
    count: 'bg-waiting-bg text-waiting',
    ring: 'ring-waiting-border',
    mFill: 'max-md:bg-warning max-md:text-warning-foreground',
    mTint: 'max-md:bg-waiting-bg',
    mIcon: 'max-md:text-waiting',
  },
  month: {
    text: 'text-info',
    thread: 'bg-primary',
    count: 'bg-info-bg text-info',
    ring: 'ring-info-border',
    mFill: 'max-md:bg-primary max-md:text-primary-foreground',
    mTint: 'max-md:bg-info-bg',
    mIcon: 'max-md:text-info',
  },
  approved: {
    text: 'text-approved',
    thread: 'bg-success',
    count: 'bg-approved-bg text-approved',
    ring: 'ring-approved-border',
    mFill: 'max-md:bg-success max-md:text-success-foreground',
    mTint: 'max-md:bg-approved-bg',
    mIcon: 'max-md:text-approved',
  },
  rejected: {
    text: 'text-rejected',
    thread: 'bg-destructive',
    count: 'bg-rejected-bg text-rejected',
    ring: 'ring-rejected-border',
    mFill: 'max-md:bg-destructive max-md:text-destructive-foreground',
    mTint: 'max-md:bg-rejected-bg',
    mIcon: 'max-md:text-rejected',
  },
}

/**
 * The four-view switcher every request page uses: Waiting / This month / Approved / Rejected, each with its count.
 * The active view gets a raised tile that springs between options (shared layout) with a coloured thread along its
 * foot; a non-zero Waiting count is always amber so it catches the eye. 2x2 on small screens, one row from `sm`.
 * Phones (< 768px): the mobile app's RequestViewSwitcher instead - a sideways-scrolling row of 104px count cards running
 * to the screen edges (icon + big count on top, label under), each tinted with its colour, the chosen one filled.
 * Pair it with `useRequestViews` (sorting + counts + default view) and give the list `id={panelId}` + `role="tabpanel"`.
 *
 *   const v = useRequestViews(leaves, { statusOf: (l) => l.status, month: { dateOf: (l) => l.fromDate, kind: 'taken' } })
 *   <StatusViews value={v.view} onChange={v.setView} counts={v.counts} monthKind="taken" panelId="leave-list" />
 *   <div id="leave-list" role="tabpanel">{v.rows.map(...)}</div>
 */
export function StatusViews({
  value,
  onChange,
  counts,
  labels,
  views = REQUEST_VIEWS,
  monthKind,
  hint,
  panelId,
  ariaLabel = 'Show requests',
  className,
}: {
  value: RequestView
  onChange: (view: RequestView) => void
  counts: Partial<Record<RequestView, number>>
  /** Override any label ("Taken this month", "Sent this month", "Not allowed"). */
  labels?: Partial<Record<RequestView, string>>
  /** Which views, in which order (default all four). */
  views?: readonly RequestView[]
  /** Shows the plain-English hint under the switcher while "This month" is open. */
  monthKind?: 'taken' | 'submitted'
  /** Replaces that hint (a month-scoped page: "All your leave requests for September 2026, whatever their status."). */
  hint?: React.ReactNode
  /** The id of the list this switcher controls (aria-controls). */
  panelId?: string
  ariaLabel?: string
  className?: string
}) {
  const id = React.useId()
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={(e) => rovingKeyDown(e, views, value, () => false, onChange, refs.current)}
        className={cn(
          'glass grid gap-1 rounded-xl p-1',
          views.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-flow-col auto-cols-fr',
          'max-md:-mx-4 max-md:flex max-md:gap-2 max-md:overflow-x-auto max-md:rounded-none max-md:border-0! max-md:bg-transparent! max-md:px-4 max-md:py-1.5 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden',
        )}
      >
        {views.map((view, i) => {
          const active = view === value
          const tone = VIEW_TONE[view]
          const Icon = VIEW_ICON[view]
          const count = counts[view] ?? 0
          const label = labels?.[view] ?? VIEW_LABELS[view]
          const alert = view === 'waiting' && count > 0
          return (
            <button
              key={view}
              ref={(el) => {
                refs.current[i] = el
              }}
              id={`${id}-${view}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(view)}
              className={cn(
                'font-label focus-ring relative flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold transition-colors duration-200',
                active ? 'text-foreground' : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
                'max-md:grid max-md:w-[104px] max-md:shrink-0 max-md:grid-cols-[1fr_auto] max-md:gap-x-2 max-md:gap-y-1 max-md:rounded-xl max-md:px-3 max-md:py-2.5 max-md:transition-[background-color,color,scale,translate] max-md:duration-[220ms]',
                active ? cn('max-md:-translate-y-0.5', tone.mFill) : cn('max-md:scale-[0.97] max-md:text-foreground', tone.mTint),
              )}
            >
              {active && (
                <motion.span
                  layoutId={`views-${id}`}
                  transition={SPRING}
                  aria-hidden="true"
                  className={cn('absolute inset-0 rounded-lg bg-card shadow-clay-sm ring-1 max-md:hidden dark:bg-white/[0.07]', tone.ring)}
                >
                  <span className={cn('absolute inset-x-3 bottom-0 h-[2px] rounded-full', tone.thread)} />
                </motion.span>
              )}
              {/* Phones: this wrapper dissolves (contents) so icon, count and label sit on the card's own 2x2 grid. */}
              <span className="relative z-10 flex min-w-0 items-center gap-2 max-md:contents">
                <Icon
                  className={cn(
                    'size-4 shrink-0',
                    active || alert ? tone.text : 'opacity-70',
                    'max-md:col-start-1 max-md:row-start-1',
                    active ? 'max-md:text-current' : cn('max-md:opacity-100', tone.mIcon),
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'truncate max-md:col-span-2 max-md:row-start-2 max-md:text-[11px] max-md:leading-[14px] max-md:font-bold',
                    !active && 'max-md:text-secondary-foreground',
                  )}
                >
                  {label}
                </span>
              </span>
              <span
                className={cn(
                  'relative z-10 grid min-w-6 place-items-center rounded-full px-1.5 text-[11.5px] leading-5 font-bold tabular-nums',
                  active || alert ? tone.count : 'bg-foreground/[0.06] text-foreground/75',
                  'max-md:col-start-2 max-md:row-start-1 max-md:min-w-0 max-md:place-items-end max-md:bg-transparent max-md:px-0 max-md:font-[family-name:var(--font-display)] max-md:text-[20px] max-md:leading-6 max-md:text-current',
                )}
              >
                {count}
                <span className="sr-only"> {count === 1 ? 'request' : 'requests'}</span>
              </span>
            </button>
          )
        })}
      </div>
      {(hint || monthKind) && value === 'month' && (
        <p className="mt-2 px-1 text-xs text-muted-foreground max-md:mt-1 max-md:px-0" aria-live="polite">
          {hint ?? (monthKind ? MONTH_HINT[monthKind] : null)}
        </p>
      )}
    </div>
  )
}

import { CheckCircle2, Clock, ListFilter, XCircle, type LucideIcon } from 'lucide-react'
import { APPROVAL_STATUSES, STATUS_LABEL, type ApprovalStatus, type StatusCounts } from '@/lib/approvals-history'
import { filterCaption, type ApprovalFilter } from '@/lib/approvals-feed'
import { cn } from '@/lib/utils'

// `mTint`: phones tint every tile with its colour (the mobile app's StatusSwitcher).
const META: Record<ApprovalStatus, { icon: LucideIcon; text: string; mTint: string; fill: string; edge: string }> = {
  pending: {
    icon: Clock,
    text: 'text-waiting',
    mTint: 'max-md:bg-waiting-bg',
    fill: 'bg-warning text-warning-foreground border-warning',
    edge: 'border-waiting-border',
  },
  approved: {
    icon: CheckCircle2,
    text: 'text-approved',
    mTint: 'max-md:bg-approved-bg',
    fill: 'bg-success text-success-foreground border-success',
    edge: 'border-approved-border',
  },
  rejected: {
    icon: XCircle,
    text: 'text-rejected',
    mTint: 'max-md:bg-rejected-bg',
    fill: 'bg-destructive text-destructive-foreground border-destructive',
    edge: 'border-rejected-border',
  },
}

/**
 * Pending / Approved / Rejected of the chosen category as three count tiles that double as quick filters (owner
 * 2026-11-25, mirror of the mobile app's StatusSwitcher): the list shows every status by default (Pending first);
 * clicking a tile shows only that status, clicking it again shows them all (`onToggle`, lib/approvals-feed.ts
 * toggleFilter). The chosen tile is filled with its status colour; a Pending tile with requests waiting keeps an amber
 * edge. `counts` null = not known yet (a dash, never a wrong 0).
 */
export function StatusFilter({
  value,
  counts,
  onToggle,
  onShowAll,
  controls,
  hideDecided,
}: {
  value: ApprovalFilter
  counts: Partial<StatusCounts> | null | undefined
  onToggle: (status: ApprovalStatus) => void
  onShowAll: () => void
  /** The id of the list these tiles filter (aria-controls). */
  controls?: string
  /** An older server without the history: only the Pending tile. */
  hideDecided?: boolean
}) {
  const statuses = hideDecided ? (['pending'] as const) : APPROVAL_STATUSES
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label="Filter by status" className={cn('grid gap-2 max-md:gap-2', hideDecided ? 'grid-cols-1 sm:max-w-xs' : 'grid-cols-3')}>
        {statuses.map((s) => {
          const m = META[s]
          const Icon = m.icon
          const active = value === s
          const count = counts?.[s]
          const known = typeof count === 'number'
          const waiting = s === 'pending' && known && count > 0 && !active
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              aria-controls={controls}
              title={active ? 'Show every request again' : `Show only ${STATUS_LABEL[s].toLowerCase()} requests`}
              onClick={() => onToggle(s)}
              className={cn(
                'focus-ring group relative flex min-h-[64px] flex-col justify-between gap-1 rounded-xl border px-3 py-2.5 text-left transition-[background-color,border-color,color,translate,box-shadow] duration-200',
                active
                  ? cn(m.fill, '-translate-y-0.5 shadow-clay-sm')
                  : cn('glass text-foreground hover:-translate-y-0.5', waiting ? 'border-[1.5px] border-warning' : m.edge, !waiting && 'max-md:border-transparent', m.mTint),
              )}
              data-testid={`approvals-status-${s}`}
            >
              <span className="flex items-center justify-between gap-2">
                <Icon className={cn('size-4 shrink-0', active ? 'text-current' : m.text)} aria-hidden="true" />
                {active ? (
                  <ListFilter className="size-3.5 shrink-0 text-current opacity-90" aria-hidden="true" />
                ) : (
                  waiting && <span className="size-2 rounded-full bg-warning" aria-hidden="true" />
                )}
              </span>
              <span className="flex items-end justify-between gap-2">
                <span className={cn('text-[12.5px] font-semibold max-md:text-[11.5px] max-md:font-bold', active ? 'text-current' : 'text-secondary-foreground')}>
                  {STATUS_LABEL[s]}
                </span>
                <span className={cn('font-display text-[22px] leading-6 font-bold tabular-nums max-md:text-[20px]', active ? 'text-current' : 'text-foreground')}>
                  {known ? count : '–'}
                  <span className="sr-only"> {count === 1 ? 'request' : 'requests'}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-3 px-1">
        <p className="min-w-0 flex-1 text-[12px] text-muted-foreground max-md:text-[11.5px]" aria-live="polite" data-testid="approvals-filter-caption">
          {filterCaption(value)}
        </p>
        {value !== 'all' && (
          <button
            type="button"
            onClick={onShowAll}
            className="focus-ring shrink-0 rounded text-[12.5px] font-semibold text-primary underline-offset-2 hover:underline"
            data-testid="approvals-show-all"
          >
            Show all
          </button>
        )}
      </div>
    </div>
  )
}

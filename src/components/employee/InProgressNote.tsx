import { StatusPill } from '@/components/kit'
import type { InProgressView } from '@/lib/day-progress'
import { cn } from '@/lib/utils'

/** "In progress" with a small live dot (neutral: no Present / Half Day colour while the shift is still running). */
export function InProgressPill({ label = 'In progress', className }: { label?: string; className?: string }) {
  return (
    <StatusPill tone="neutral" dot size="sm" className={className}>
      {label}
    </StatusPill>
  )
}

/**
 * Today's day while its shift is still running (owner 2026-11-26, lib/day-progress.ts): shifts as "—" (never 1), the
 * first punch ("In 09:06 · at work") and when it will be counted; no verdict. The day panel shows the live pill in its
 * header, so it passes `pill={false}`; `compact` drops the box (the dashboard's Right now panels).
 */
export function InProgressNote({
  view,
  pill = true,
  compact = false,
  className,
}: {
  view: InProgressView
  pill?: boolean
  compact?: boolean
  className?: string
}) {
  return (
    <div
      data-testid="day-in-progress"
      className={cn(
        'flex flex-col gap-1 text-sm',
        !compact && 'rounded-lg border hairline bg-foreground/[0.03] px-3 py-2.5 max-md:border-0 max-md:bg-muted',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        {pill ? <InProgressPill label={view.label} /> : <p className="label-caps text-muted-foreground">Earned Shift</p>}
        <p className="flex items-baseline gap-2 text-right font-semibold tabular-nums">
          {pill && <span className="label-caps font-normal text-muted-foreground">Shift</span>}
          <span aria-hidden="true">{view.shifts}</span>
          <span className="sr-only">not counted yet</span>
        </p>
      </div>
      {view.arrival && <p className="font-semibold tabular-nums">{view.arrival}</p>}
      <p className="text-[12.5px] text-muted-foreground tabular-nums max-md:text-[12px]">{view.counted}</p>
    </div>
  )
}

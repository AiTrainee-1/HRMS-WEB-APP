import { format, parseISO } from 'date-fns'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { cn } from '@/lib/utils'
import { formatMinutes, formatShifts, kindInfo, statusInfo, type CompensationItem } from '@/lib/compensation'

const OVERTIME_KINDS = new Set(['ot_shift', 'ot_shift_relaxation', 'ot_shift_pay'])

/** 'Mon, 12 Oct 2026' for a YYYY-MM-DD string (parseCompensation only lets real calendar dates through). */
function dayText(iso: string): string {
  return format(parseISO(iso), 'EEE, d MMM yyyy')
}

/**
 * One compensation item: what kind it is (chip + symbol), where it stands (status chip, in the server's words), the
 * server's title and explanation, the date and the shifts / minutes it is worth. A kind or status this app has never
 * heard of is drawn with a neutral chip and a generic symbol: never hidden, never a crash.
 */
export function CompensationItemCard({ item }: { item: CompensationItem }) {
  const kind = kindInfo(item.kind)
  const status = statusInfo(item)
  const shifts = formatShifts(item.shifts)
  // `minutes` is what the late-in allowance grants, but for a shift compensation it is the extra time worked past the
  // shift end; `minutesUsed` is what the arrival actually used of an allowance.
  const minutes = formatMinutes(item.minutes)
  const minutesLabel = !minutes ? '' : item.kind === 'ot_allowance' ? `${minutes} allowance` : OVERTIME_KINDS.has(item.kind) ? `${minutes} extra` : minutes
  const minutesUsed = item.minutesUsed != null && item.minutesUsed > 0 ? formatMinutes(item.minutesUsed) : ''
  const facts = [
    shifts && { label: shifts, key: 'shifts' },
    minutesLabel && { label: minutesLabel, key: 'minutes' },
    minutesUsed && { label: `Used ${minutesUsed}`, key: 'used' },
    item.time && { label: `Time ${item.time}`, key: 'time' },
  ].filter((f): f is { label: string; key: string } => !!f)

  return (
    <article
      data-testid="compensation-item"
      data-kind={item.kind}
      className="glass-raised flex gap-3 rounded-lg p-4 sm:gap-4 sm:p-5"
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-md border', kind.chip)}>
        <MarkerSymbol name={kind.symbol} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className={cn('chip', kind.chip)}>{kind.label}</span>
          <span className={cn('chip', status.chip)}>
            <span className={cn('pip', status.live && 'pip-live')} />
            {status.label}
          </span>
          {item.legacy && <span className="chip chip-muted">Earlier record</span>}
        </div>
        <h3 className="mt-2 text-[15px] leading-snug font-semibold">{item.title}</h3>
        {item.detail && <p className="mt-1 text-[13.5px] text-muted-foreground">{item.detail}</p>}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px]">
          <span className="font-label font-semibold text-brand-blue">{item.date ? dayText(item.date) : 'Date not given'}</span>
          {item.workDate && item.workDate !== item.date && (
            <span className="text-muted-foreground">Worked on {dayText(item.workDate)}</span>
          )}
          {facts.map((f) => (
            <span key={f.key} className="rounded-md bg-foreground/[0.06] px-2 py-0.5 font-semibold tabular-nums">
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

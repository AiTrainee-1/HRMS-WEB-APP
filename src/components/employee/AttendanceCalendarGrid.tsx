import { cn } from '@/lib/utils'
import {
  COMPENSATION_MARKER, DAY_STATUS_LABEL, compensationLegend, dayHeadline, getDayMarkers, hasCurrentPermissionFlags,
  legendMarkers,
} from '@/lib/attendance-flags'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import type { AttendanceDay, ShiftPolicy } from '@/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const statusStyles: Record<string, string> = {
  present: 'bg-success/20 text-success border-success/40',
  half_shift: 'bg-warning/20 text-warning border-warning/40',
  absent: 'bg-destructive/15 text-destructive border-destructive/30',
  on_leave: 'bg-primary/15 text-primary border-primary/30',
  holiday: 'bg-muted text-muted-foreground border-transparent',
  future: 'bg-transparent text-muted-foreground border-dashed',
  no_record: 'bg-transparent text-muted-foreground border-transparent',
}

export function AttendanceCalendarGrid({
  month,
  year,
  days,
  onSelectDay,
  policy,
  showCompensationLegend = false,
}: {
  month: number
  year: number
  days: AttendanceDay[]
  onSelectDay: (day: AttendanceDay) => void
  /** Company rules, when the backend sends them: a check that is switched off gets no dot and no legend entry. */
  policy?: ShiftPolicy | null
  /** List the compensation colours and symbols in the legend (a staff employee on a backend that sends them). A day that
   * carries a compensation marker is drawn with it whatever this says. */
  showCompensationLegend?: boolean
}) {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const firstOfMonth = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingBlanks = firstOfMonth.getDay()

  const cells: (AttendanceDay | null)[] = Array.from({ length: leadingBlanks }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(byDate.get(dateStr) ?? { date: dateStr, status: 'no_record' })
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs font-medium text-muted-foreground py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />
          const dayNum = Number(cell.date.slice(-2))
          // Lateness, early-outs and permissions are independent of the day's
          // Present / Half Day colour (HRMS tracks them as separate flags), so
          // each gets its own small dot along the bottom edge instead of a
          // second status colour. Legend below.
          const markers = getDayMarkers(cell, policy)
          // A compensation marker is a coloured ring plus a symbol in the corner (so colour is not the only cue); the
          // other markers stay dots along the bottom edge.
          const dots = markers.filter((m) => !m.symbol)
          const compensation = markers.find((m) => m.symbol)
          return (
            <button
              key={cell.date}
              onClick={() => onSelectDay(cell)}
              title={compensation?.detail}
              aria-label={[
                cell.date,
                dayHeadline(cell),
                ...markers.map((m) => m.label.toLowerCase()),
                cell.isCompensationDay ? 'compensation day' : null,
                cell.totalPunches ? `${cell.totalPunches} punches` : null,
              ].filter(Boolean).join(', ')}
              className={cn(
                'relative aspect-square rounded-md border text-xs font-medium flex flex-col items-center justify-center transition-colors hover:opacity-80',
                statusStyles[cell.status] ?? statusStyles.no_record,
                compensation && ['ring-2 ring-inset', compensation.ring],
              )}
            >
              <span>{dayNum}</span>
              {compensation && (
                <MarkerSymbol name={compensation.symbol} className={cn('absolute top-0.5 right-0.5 size-3 sm:top-1 sm:right-1 sm:size-4', compensation.text)} />
              )}
              {dots.length > 0 && (
                <span className="absolute bottom-0.5 inset-x-0 flex justify-center gap-0.5">
                  {dots.map((m) => (
                    <span key={m.key} className={cn('size-1.5 rounded-full border border-background', m.dot)} />
                  ))}
                </span>
              )}
              {cell.isCompensationDay && (
                <span className={cn('absolute top-0.5 left-0.5 size-1.5 rounded-full border border-background', COMPENSATION_MARKER.dot)} />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {(['present', 'half_shift', 'absent', 'on_leave', 'holiday'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full border', statusStyles[s])} />
            <span className="text-muted-foreground">{DAY_STATUS_LABEL[s]}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-2 text-xs">
        {[...legendMarkers(policy, days.length > 0 && !hasCurrentPermissionFlags(days)), COMPENSATION_MARKER].map((m) => (
          <div key={m.label} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', m.dot)} />
            <span className="text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>
      {showCompensationLegend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs" data-testid="compensation-legend">
          <span className="font-medium text-foreground/80">Compensation</span>
          {compensationLegend().map((m) => (
            <div key={m.key} className="flex items-center gap-1.5">
              <span className={cn('grid size-5 place-items-center rounded-[5px] ring-2 ring-inset', m.ring)}>
                <MarkerSymbol name={m.symbol} className={cn('size-3', m.text)} />
              </span>
              <span className="text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

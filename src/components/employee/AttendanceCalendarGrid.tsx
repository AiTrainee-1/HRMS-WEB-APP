import { cn } from '@/lib/utils'
import {
  COMPENSATION_MARKER, DAY_STATUS_LABEL, getDayMarkers, hasCurrentPermissionFlags, legendMarkers,
} from '@/lib/attendance-flags'
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
}: {
  month: number
  year: number
  days: AttendanceDay[]
  onSelectDay: (day: AttendanceDay) => void
  /** Company rules, when the backend sends them: a check that is switched off gets no dot and no legend entry. */
  policy?: ShiftPolicy | null
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
          return (
            <button
              key={cell.date}
              onClick={() => onSelectDay(cell)}
              aria-label={[
                cell.date,
                DAY_STATUS_LABEL[cell.status],
                ...markers.map((m) => m.label.toLowerCase()),
                cell.isCompensationDay ? 'compensation day' : null,
                cell.totalPunches ? `${cell.totalPunches} punches` : null,
              ].filter(Boolean).join(', ')}
              className={cn(
                'relative aspect-square rounded-md border text-xs font-medium flex flex-col items-center justify-center transition-colors hover:opacity-80',
                statusStyles[cell.status] ?? statusStyles.no_record,
              )}
            >
              <span>{dayNum}</span>
              {markers.length > 0 && (
                <span className="absolute bottom-0.5 inset-x-0 flex justify-center gap-0.5">
                  {markers.map((m) => (
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
    </div>
  )
}

import { cn } from '@/lib/utils'
import type { AttendanceDay } from '@/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const statusStyles: Record<string, string> = {
  present: 'bg-success/20 text-success border-success/40',
  half_shift: 'bg-warning/20 text-warning-foreground border-warning/40',
  absent: 'bg-destructive/15 text-destructive border-destructive/30',
  on_leave: 'bg-primary/15 text-primary border-primary/30',
  holiday: 'bg-muted text-muted-foreground border-transparent',
  future: 'bg-transparent text-muted-foreground border-dashed',
  no_record: 'bg-transparent text-muted-foreground border-transparent',
}

const statusLabel: Record<string, string> = {
  present: 'Present',
  half_shift: 'Half Shift',
  absent: 'Absent',
  on_leave: 'Leave',
  holiday: 'Holiday',
  future: 'Upcoming',
  no_record: 'No record',
}

export function AttendanceCalendarGrid({
  month,
  year,
  days,
  onSelectDay,
}: {
  month: number
  year: number
  days: AttendanceDay[]
  onSelectDay: (day: AttendanceDay) => void
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
          // A day can be Half Shift/Present AND late at once (HRMS tracks
          // these as two independent flags) — the small corner dot surfaces
          // the late arrival without needing a second status color.
          const showLateDot = !!cell.isLate && (cell.status === 'present' || cell.status === 'half_shift')
          return (
            <button
              key={cell.date}
              onClick={() => onSelectDay(cell)}
              aria-label={`${cell.date}, ${statusLabel[cell.status]}${cell.isLate ? ', late arrival' : ''}${cell.totalPunches ? `, ${cell.totalPunches} punches` : ''}`}
              className={cn(
                'relative aspect-square rounded-md border text-xs font-medium flex flex-col items-center justify-center transition-colors hover:opacity-80',
                statusStyles[cell.status] ?? statusStyles.no_record,
              )}
            >
              <span>{dayNum}</span>
              {showLateDot && (
                <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-warning border border-background" />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        {(['present', 'half_shift', 'absent', 'on_leave', 'holiday'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full border', statusStyles[s])} />
            <span className="text-muted-foreground">{statusLabel[s]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

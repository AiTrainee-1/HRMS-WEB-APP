import type { AttendanceDay } from '@/types'

const STATUS_FILL: Record<string, string> = {
  present: 'var(--success)',
  half_shift: 'var(--warning)',
  absent: 'var(--destructive)',
  on_leave: 'var(--primary)',
  holiday: 'var(--muted-foreground)',
  future: 'var(--muted-foreground)',
  no_record: 'var(--muted-foreground)',
}

const STATUS_HEIGHT_RATIO: Record<string, number> = {
  present: 1,
  half_shift: 0.55,
  on_leave: 0.75,
  absent: 0.15,
  holiday: 0.1,
  future: 0.1,
  no_record: 0.1,
}

/** Hand-rolled inline SVG bar chart (no charting library installed) — one
 * bar per day of the month, already fetched for the calendar grid above, so
 * this needs no extra API call. Late arrivals get a small marker on top of
 * their bar, mirroring the calendar grid's late dot. */
export function AttendanceTrendChart({ records }: { records: AttendanceDay[] }) {
  const chartW = 600
  const chartH = 84
  const gap = 2

  if (records.length === 0) {
    return <p className="text-center text-xs text-muted-foreground py-6">No attendance data for this month yet.</p>
  }

  const barW = Math.max(2, (chartW - (records.length - 1) * gap) / records.length)

  return (
    <div>
      <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height={chartH} preserveAspectRatio="none">
        {records.map((r, i) => {
          const ratio = STATUS_HEIGHT_RATIO[r.status] ?? 0.1
          const barH = Math.max(2, chartH * ratio)
          const x = i * (barW + gap)
          const y = chartH - barH
          const showLateDot = !!r.isLate && (r.status === 'present' || r.status === 'half_shift')
          return (
            <g key={r.date}>
              <rect x={x} y={y} width={barW} height={barH} rx={1} fill={STATUS_FILL[r.status] ?? 'var(--muted-foreground)'} />
              {showLateDot && <circle cx={x + barW / 2} cy={Math.max(2, y - 3)} r={1.6} fill="var(--warning)" />}
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between mt-1 px-0.5 text-[10px] text-muted-foreground">
        <span>1</span>
        <span>{records.length}</span>
      </div>
    </div>
  )
}

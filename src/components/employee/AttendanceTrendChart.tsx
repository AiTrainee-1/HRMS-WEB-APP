import { motion } from 'framer-motion'
import { COMPENSATION_MARKER, DAY_STATUS_LABEL, getDayMarkers } from '@/lib/attendance-flags'
import { useReducedMotion } from '@/components/kit'
import { IN_PROGRESS_STATUS, displayStatus } from '@/lib/day-progress'
import type { AttendanceDay, ShiftPolicy } from '@/types'

// Horizontal gap between markers stacked on one bar (a bar is ~18 units wide).
const MARKER_SPACING = 3.6

const STATUS_FILL: Record<string, string> = {
  present: 'var(--success)',
  half_shift: 'var(--warning)',
  absent: 'var(--destructive)',
  on_leave: 'var(--primary)',
  holiday: 'var(--brand-violet)',
  future: 'var(--muted-foreground)',
  no_record: 'var(--muted-foreground)',
  // Today while the shift is still running (lib/day-progress.ts): neutral, no verdict yet.
  [IN_PROGRESS_STATUS]: 'var(--muted-foreground)',
}

// Phones (< 768px): the same hues as the phone calendar (the mobile app's DAY_TONES solids). A CSS fill beats the SVG
// fill attribute, so desktop keeps STATUS_FILL.
const PHONE_FILL: Record<string, string> = {
  present: 'max-md:fill-[#16A34A]',
  half_shift: 'max-md:fill-[#EA580C]',
  absent: 'max-md:fill-[#DC2626]',
  on_leave: 'max-md:fill-[#7C3AED]',
  holiday: 'max-md:fill-[#DB2777]',
}

const STATUS_HEIGHT_RATIO: Record<string, number> = {
  present: 1,
  half_shift: 0.55,
  on_leave: 0.75,
  absent: 0.15,
  holiday: 0.3,
  future: 0.06,
  no_record: 0.06,
  [IN_PROGRESS_STATUS]: 0.5,
}

/** One bar per day of the month (already fetched for the calendar, so no extra request): tall = present, half = half
 * day, short = absent. Late-Ins, Early-Outs and permissions get small markers on top, in the calendar's colours. The
 * chart has an accessible summary; the calendar below has every day in words. */
export function AttendanceTrendChart({ records, policy }: { records: AttendanceDay[]; policy?: ShiftPolicy | null }) {
  const reduced = useReducedMotion()
  const chartW = 600
  const chartH = 96
  const gap = 2

  if (records.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No attendance for this month yet.</p>
  }

  const statusOf = (r: AttendanceDay) => displayStatus(r)
  const counts = records.reduce<Record<string, number>>((acc, r) => {
    const s = statusOf(r)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})
  const summary = (['present', 'half_shift', 'absent', 'on_leave', 'holiday', IN_PROGRESS_STATUS] as const)
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${DAY_STATUS_LABEL[s].toLowerCase()}`)
    .join(', ')

  const barW = Math.max(2, (chartW - (records.length - 1) * gap) / records.length)

  return (
    <div>
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        width="100%"
        height={chartH}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Days this month: ${summary || 'nothing recorded yet'}`}
      >
        {records.map((r, i) => {
          const status = statusOf(r)
          const ratio = STATUS_HEIGHT_RATIO[status] ?? 0.06
          const barH = Math.max(3, chartH * ratio - 8)
          const x = i * (barW + gap)
          const y = chartH - barH
          const markers = getDayMarkers(r, policy)
          return (
            <g key={r.date}>
              <motion.rect
                className={PHONE_FILL[status]}
                x={x}
                width={barW}
                rx={2}
                fill={STATUS_FILL[status] ?? 'var(--muted-foreground)'}
                fillOpacity={status === 'future' || status === 'no_record' ? 0.3 : status === IN_PROGRESS_STATUS ? 0.45 : 0.9}
                initial={reduced ? false : { height: 0, y: chartH }}
                animate={{ height: barH, y }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : Math.min(i, 31) * 0.012 }}
              />
              {markers.map((m, mi) => (
                <circle
                  key={m.key}
                  cx={x + barW / 2 + (mi - (markers.length - 1) / 2) * MARKER_SPACING}
                  cy={Math.max(2, y - 4)}
                  r={1.8}
                  fill={m.fill}
                />
              ))}
              {r.isCompensationDay && <circle cx={x + barW / 2} cy={Math.min(chartH - 2, y + barH + 3)} r={1.6} fill={COMPENSATION_MARKER.fill} />}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between px-0.5 text-[11px] text-muted-foreground tabular-nums" aria-hidden="true">
        <span>1</span>
        <span>{Math.ceil(records.length / 2)}</span>
        <span>{records.length}</span>
      </div>
    </div>
  )
}

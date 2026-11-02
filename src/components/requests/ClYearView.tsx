import * as React from 'react'
import { motion } from 'framer-motion'
import { TONE_COLOR, popIn, useReducedMotion } from '@/components/kit'
import {
  MONTH_LONG,
  PORTION_LABEL,
  dayMarks,
  dialWords,
  longDate,
  monthShapeText,
  monthWeeks,
  type CLRow,
  type DayMark,
  type DialSlot,
  type YearMonth,
} from '@/lib/casual-leave'
import { cn } from '@/lib/utils'

// Casual Leave's year at a glance. Colours: approved = violet (the kit's Casual Leave role), waiting = amber.
// Phones: approved is sapphire, as in the mobile app's ClDial - a wrapper with CL_PHONE_COLOURS sets --cl-ok there; the
// desktop never sets it, so the fallback (violet) is what it always was.
const APPROVED = `var(--cl-ok, ${TONE_COLOR.violet})`
const WAITING = TONE_COLOR.amber

/** Put on the element around Casual Leave dials / calendars: on phones their "approved" colour becomes the app's sapphire. */
export const CL_PHONE_COLOURS = 'max-md:[--cl-ok:var(--primary)]'

const slotColor = (s: DialSlot) => (s?.status === 'approved' ? APPROVED : s ? WAITING : null)

/**
 * One month's dial: the LEFT half is the first half-day taken that month, the RIGHT half the second; a full day fills
 * both. Each half is coloured by its own state (approved violet, waiting amber), which the kit's one-tone MonthDial
 * cannot show. Decorative: the month tile around it carries the words.
 */
export function ClDial({ slots, size = 40, current, className }: { slots: [DialSlot, DialSlot]; size?: number; current?: boolean; className?: string }) {
  const r = 16
  const left = slotColor(slots[0])
  const right = slotColor(slots[1])
  const full = !!slots[0] && slots[0].portion === 'full'
  const half = (sweep: 0 | 1) => `M20,${20 - r} A${r},${r} 0 0 ${sweep} 20,${20 + r} Z`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={cn('overflow-visible', className)}>
      {/* Phones mark this month on the tile's border instead (the app's month cell). */}
      {current && <circle cx="20" cy="20" r="19" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 2.5" className="max-md:hidden" />}
      <circle cx="20" cy="20" r={r} fill="currentColor" className="text-foreground/[0.06]" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={APPROVED} strokeOpacity="0.45" strokeWidth="1.5" />
      {full && left ? (
        <motion.circle cx="20" cy="20" r={r} fill={left} variants={popIn} initial="hidden" animate="show" style={{ originX: '20px', originY: '20px' }} />
      ) : (
        <>
          {left && <motion.path d={half(0)} fill={left} variants={popIn} initial="hidden" animate="show" style={{ originX: '20px', originY: '20px' }} />}
          {right && <motion.path d={half(1)} fill={right} variants={popIn} initial="hidden" animate="show" style={{ originX: '20px', originY: '20px' }} />}
          {(left || right) && <line x1="20" y1={20 - r} x2="20" y2={20 + r} stroke="var(--card)" strokeWidth="1.5" />}
        </>
      )}
    </svg>
  )
}

/**
 * Twelve month tiles, each with its dial. A tile is a button: it opens that month's calendar below.
 * Phones: the app's month cells - four to a row, white bordered tiles, 32px dials, this month on a sapphire border, the
 * chosen month on the blue tint.
 */
export function ClYearGrid({
  months,
  year,
  selected,
  onSelect,
  calendarId,
  compact,
  pickUntil,
}: {
  months: YearMonth[]
  year: number
  selected?: number | null
  onSelect?: (month: number) => void
  /** The id of the calendar the tiles control. */
  calendarId?: string
  /** A small read-only row (the Leave page card). */
  compact?: boolean
  /** The last month a tile may pick (the Casual Leave page's month switcher stops there); later tiles are off. */
  pickUntil?: { year: number; month: number } | null
}) {
  const now = new Date()
  const reduced = useReducedMotion()
  return (
    <ul
      className={cn('grid', compact ? 'grid-cols-6 gap-1.5 sm:grid-cols-12' : 'grid-cols-3 gap-2 min-[480px]:grid-cols-4 md:grid-cols-6 max-md:grid-cols-4', CL_PHONE_COLOURS)}
      aria-label={`Casual Leave in ${year}`}
    >
      {months.map((m, i) => {
        const current = year === now.getFullYear() && m.month === now.getMonth() + 1
        const future = year > now.getFullYear() || (year === now.getFullYear() && m.month > now.getMonth() + 1)
        const active = selected === m.month
        const words = `${MONTH_LONG[m.month - 1]} ${year}: ${dialWords(m)}${current ? ' (this month)' : ''}`
        const body = (
          <>
            <ClDial slots={m.slots} size={compact ? 30 : 38} current={current} className={compact ? undefined : 'max-md:size-8'} />
            <span
              className={cn(
                'font-label text-[11.5px] font-semibold max-md:text-[12px]',
                current || active ? 'text-foreground' : 'text-muted-foreground',
                !compact && 'max-md:text-foreground',
                active && 'max-md:text-primary',
              )}
            >
              {m.short}
            </span>
            {!compact && (
              <span className={cn('text-[10.5px] max-md:text-[10px]', m.shape === 'none' ? 'text-muted-foreground/70 max-md:text-muted-foreground' : 'text-foreground/75 max-md:text-secondary-foreground')}>
                {monthShapeText(m)}
              </span>
            )}
            {/* 2026-11-02: Casual Leave given or proposed by HR on an attendance edit. */}
            {!compact && m.byHr && <span className="text-[10px] leading-none font-bold text-info">by HR</span>}
          </>
        )
        return (
          <motion.li
            key={m.month}
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reduced ? 0 : Math.min(i, 11) * 0.03, duration: 0.24 }}
            className="min-w-0"
          >
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(m.month)}
                disabled={!!pickUntil && (year > pickUntil.year || (year === pickUntil.year && m.month > pickUntil.month))}
                aria-pressed={active}
                aria-controls={calendarId}
                aria-label={words}
                className={cn(
                  'focus-ring flex w-full flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
                  'max-md:gap-[3px] max-md:py-2.5',
                  active
                    ? 'border-primary bg-primary/10 shadow-clay-sm max-md:bg-accent max-md:shadow-none!'
                    : cn('border-foreground/10 bg-foreground/[0.02] hover:border-primary/40 max-md:bg-card', current ? 'max-md:border-primary' : 'max-md:border-border'),
                  future && !active && 'opacity-55 max-md:opacity-50',
                )}
              >
                {body}
              </button>
            ) : (
              <div role="img" aria-label={words} className={cn('flex flex-col items-center gap-0.5', future && 'opacity-55')}>
                {body}
              </div>
            )}
          </motion.li>
        )
      })}
    </ul>
  )
}

/** What the dial colours mean. */
export function ClLegend({ className, yearly }: { className?: string; /** The yearly balance (2026-11-02): a month may hold more than a day. */ yearly?: boolean }) {
  const dot = (color: string, half = false) => (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6" fill="none" stroke={color} strokeOpacity="0.5" strokeWidth="1" />
      {half ? <path d="M7,1 A6,6 0 0 0 7,13 Z" fill={color} /> : <circle cx="7" cy="7" r="6" fill={color} />}
    </svg>
  )
  return (
    <ul
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground max-md:justify-center max-md:gap-x-3.5 max-md:text-[11px]', CL_PHONE_COLOURS, className)}
      aria-label="What the colours mean"
    >
      <li className="flex items-center gap-1.5">{dot(APPROVED)} Approved</li>
      <li className="flex items-center gap-1.5">{dot(WAITING)} Waiting</li>
      <li className="flex items-center gap-1.5">
        {dot(APPROVED, true)} Left half = first half-day, right half = second{yearly ? '; more than a day fills the dial' : ''}
      </li>
    </ul>
  )
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function markWords(mark: DayMark | undefined): string {
  if (!mark || (!mark.first && !mark.second)) return ''
  const w = (s: DayMark['first']) => (s === 'approved' ? 'approved' : 'waiting')
  if (mark.first && mark.second) return mark.first === mark.second ? `, Casual Leave full day ${w(mark.first)}` : `, first half ${w(mark.first)}, second half ${w(mark.second)}`
  return mark.first ? `, Casual Leave first half ${w(mark.first)}` : `, Casual Leave second half ${w(mark.second)}`
}

/** One month as a small calendar: Casual Leave days filled, a half-day filled on its half (left = first half). */
export function ClMonthCalendar({ year, month, rows, id }: { year: number; month: number; rows: CLRow[]; id?: string }) {
  const marks = React.useMemo(() => dayMarks(rows), [rows])
  const now = new Date()
  const prefix = `${year}-${String(month).padStart(2, '0')}-`
  const parts = rows.filter((r) => r.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date))
  // A tint, not a solid fill, so the day number stays readable (never white on amber) in both themes.
  const color = (s: DayMark['first']) =>
    s === 'approved' ? `color-mix(in srgb, ${APPROVED} 42%, transparent)` : s === 'pending' ? `color-mix(in srgb, ${WAITING} 42%, transparent)` : 'transparent'

  return (
    <div id={id} className={cn('flex flex-col gap-3 max-md:gap-2', CL_PHONE_COLOURS)}>
      <p className="font-display text-base font-semibold max-md:text-[14px]" aria-live="polite">
        {MONTH_LONG[month - 1]} {year}
      </p>
      <table className="w-full table-fixed border-separate border-spacing-1 text-center">
        <caption className="sr-only">
          Casual Leave in {MONTH_LONG[month - 1]} {year}
        </caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className={cn('text-[11px] font-semibold text-muted-foreground max-md:font-bold', d === 'Sun' && 'text-rejected')}>
                <span aria-hidden="true">{d.slice(0, 1)}</span>
                <span className="sr-only">{d}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(year, month).map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day == null) return <td key={di} />
                const iso = `${prefix}${String(day).padStart(2, '0')}`
                const mark = marks[iso]
                const marked = !!mark && (!!mark.first || !!mark.second)
                const today = year === now.getFullYear() && month === now.getMonth() + 1 && day === now.getDate()
                return (
                  <td key={di} className="p-0">
                    <span
                      className={cn(
                        'relative mx-auto grid aspect-square w-full max-w-10 place-items-center overflow-hidden rounded-lg text-[12.5px] tabular-nums max-md:rounded-[10px] max-md:text-[12px]',
                        today && 'ring-2 ring-primary',
                        marked ? 'font-bold text-foreground' : di === 0 ? 'text-rejected' : 'text-foreground/85',
                      )}
                    >
                      {marked && (
                        <span className="absolute inset-0 flex" aria-hidden="true">
                          <span className="h-full w-1/2" style={{ background: color(mark.first) }} />
                          <span className="h-full w-1/2" style={{ background: color(mark.second) }} />
                        </span>
                      )}
                      <span className="relative">
                        {day}
                        <span className="sr-only">{markWords(mark)}{today ? ', today' : ''}</span>
                      </span>
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {parts.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {parts.map((p) => (
            <li key={String(p.id)} className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-3 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{longDate(p.date)}</span>
                <span className="text-muted-foreground"> · {PORTION_LABEL[p.portion]}</span>
                {p.source === 'hr_edit' && <span className="font-semibold text-info"> · by HR</span>}
              </span>
              <span className={cn('text-xs font-bold', p.status === 'approved' ? 'text-violet' : p.status === 'pending' ? 'text-waiting' : 'text-rejected')}>
                {p.status === 'approved' ? 'Approved' : p.status === 'pending' ? 'Waiting' : 'Rejected'}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">No Casual Leave in this month.</p>
      )}
    </div>
  )
}

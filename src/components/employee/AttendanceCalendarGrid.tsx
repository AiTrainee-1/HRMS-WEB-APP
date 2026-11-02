import * as React from 'react'
import { motion } from 'framer-motion'
import { Check, Contrast, PartyPopper, Umbrella, X, type LucideIcon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  COMPENSATION_MARKER, DAY_STATUS_LABEL, compensationLegend, dayHeadline, getDayMarkers, hasCurrentPermissionFlags,
  legendMarkers,
} from '@/lib/attendance-flags'
import { HR_EDIT_CELL, countHrEdits, hrEditAria, hrEditMonthText, hrEditOf, hrEditStatusWord, isHrEditApplied } from '@/lib/hr-edit'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { HrEditBang, HrEditDetails } from '@/components/employee/HrEditDetails'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useReducedMotion } from '@/components/kit'
import type { AttendanceDay, HrEdit, ShiftPolicy } from '@/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Colour roles from the kit (AA in both themes); the words are in each cell's accessible name and in the legend.
const statusStyles: Record<string, string> = {
  present: 'bg-approved-bg text-approved border-approved-border',
  half_shift: 'bg-waiting-bg text-waiting border-waiting-border',
  absent: 'bg-rejected-bg text-rejected border-rejected-border',
  on_leave: 'bg-info-bg text-info border-info-border',
  holiday: 'bg-violet-bg text-violet border-violet-border',
  future: 'bg-transparent text-muted-foreground border-dashed border-foreground/15',
  no_record: 'bg-transparent text-muted-foreground border-transparent',
}

// Phones (< 768px): the mobile app's calendar colours (src/lib/attendanceVisual.ts DAY_TONES - a soft fill and a deeper
// ink per kind, their own pairs in dark mode) and its small symbol over the date. Added after statusStyles, so on a phone
// these win; desktop never sees them.
const phoneStatusStyles: Record<string, string> = {
  present: 'max-md:border-transparent max-md:bg-[#DCFCE7] max-md:text-[#15803D] max-md:dark:bg-[#16A34A38] max-md:dark:text-[#86EFAC]',
  half_shift: 'max-md:border-transparent max-md:bg-[#FFEDD5] max-md:text-[#C2410C] max-md:dark:bg-[#EA580C38] max-md:dark:text-[#FDBA74]',
  absent: 'max-md:border-transparent max-md:bg-[#FEE2E2] max-md:text-[#B91C1C] max-md:dark:bg-[#DC262638] max-md:dark:text-[#FCA5A5]',
  on_leave: 'max-md:border-transparent max-md:bg-[#EDE9FE] max-md:text-[#6D28D9] max-md:dark:bg-[#7C3AED38] max-md:dark:text-[#C4B5FD]',
  holiday: 'max-md:border-transparent max-md:bg-[#FCE7F3] max-md:text-[#BE185D] max-md:dark:bg-[#DB277738] max-md:dark:text-[#F9A8D4]',
  future: 'max-md:border-solid max-md:border-input max-md:bg-muted max-md:text-muted-foreground',
  no_record: '',
}

const PHONE_SYMBOL: Record<string, LucideIcon> = {
  present: Check,
  half_shift: Contrast,
  absent: X,
  on_leave: Umbrella,
  holiday: PartyPopper,
}

/**
 * DESKTOP (>= 768px): the "!" of a day HR edited, as a button in the corner of the cell. Click or Enter opens a popover:
 * what HR changed, from -> to, why, who raised it and when, the approval stage, who decided and when, the comment, and
 * a way into the whole day. Phones draw a plain mark instead (the day sheet carries the same section).
 */
function HrEditPopover({ edit, date, onOpenDay }: { edit: HrEdit; date: string; onOpenDay: () => void }) {
  const day = format(parseISO(date), 'd MMMM')
  const headingId = `hr-edit-${date}`
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`HR edit on ${day}: ${edit.typeLabel}, ${hrEditStatusWord(edit.status)}. Show details`}
          className="focus-ring absolute -top-1.5 -left-1.5 z-10 rounded-full ring-2 ring-card max-md:hidden"
        >
          <HrEditBang status={edit.status} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex flex-col gap-3 max-md:hidden" aria-labelledby={headingId}>
        <p className="label-caps text-muted-foreground">{format(parseISO(date), 'EEEE, d MMMM yyyy')}</p>
        <HrEditDetails edit={edit} plain headingId={headingId} />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            setOpen(false)
            onOpenDay()
          }}
        >
          See the whole day
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const reduced = useReducedMotion()
  const byDate = new Map(days.map((d) => [d.date, d]))
  const firstOfMonth = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const leadingBlanks = firstOfMonth.getDay()
  const today = todayKey()

  const cells: (AttendanceDay | null)[] = Array.from({ length: leadingBlanks }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push(byDate.get(dateStr) ?? { date: dateStr, status: 'no_record' })
  }
  // HR attendance edits (owner 2026-11-02): a "!" on every edited day, the "Edited by HR" colour once applied.
  const hrEditLine = hrEditMonthText(countHrEdits(days))

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1 max-md:mb-2 sm:gap-1.5" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <div key={w} className="label-caps py-1 text-center text-muted-foreground max-md:py-0 max-md:text-[10px]! max-md:font-[800]!">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} aria-hidden="true" />
          const dayNum = Number(cell.date.slice(-2))
          const isToday = cell.date === today
          // Lateness, early-outs and permissions are independent of the day's Present / Half Day colour, so each gets
          // its own small dot along the bottom edge instead of a second status colour. Legend below.
          const markers = getDayMarkers(cell, policy)
          const dots = markers.filter((m) => !m.symbol)
          const compensation = markers.find((m) => m.symbol)
          const StatusSymbol = PHONE_SYMBOL[cell.status]
          const edit = hrEditOf(cell)
          // The cell and its "!" are siblings (never a button inside a button); the wrapper carries the entry animation
          // and the hover lift, so the "!" rises with its day.
          return (
            <motion.div
              key={cell.date}
              initial={reduced ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22, delay: reduced ? 0 : Math.min(i, 40) * 0.008 }}
              className="group relative transition-transform duration-200 hover:z-10 hover:-translate-y-0.5"
            >
              <button
                type="button"
                onClick={() => onSelectDay(cell)}
                aria-label={[
                  cell.date,
                  isToday ? 'today' : null,
                  dayHeadline(cell),
                  edit ? hrEditAria(edit) : null,
                  ...markers.map((m) => m.label.toLowerCase()),
                  cell.isCompensationDay ? 'compensation day' : null,
                  cell.totalPunches ? `${cell.totalPunches} punches` : null,
                  'open details',
                ].filter(Boolean).join(', ')}
                className={cn(
                  'focus-ring relative flex aspect-square w-full min-h-10 flex-col items-center justify-center rounded-lg border text-[13px] font-semibold tabular-nums transition-[transform,box-shadow] duration-200 group-hover:shadow-clay max-md:rounded-sm max-md:text-[11px] max-md:leading-none max-md:font-[800]',
                  statusStyles[cell.status] ?? statusStyles.no_record,
                  phoneStatusStyles[cell.status],
                  // Owner 2026-11-02: a day whose HR edit was APPLIED takes the "Edited by HR" colour (after the status
                  // colours, so it wins on desktop and phones); the status stays in its name, its symbol and the dialog.
                  isHrEditApplied(edit) && HR_EDIT_CELL,
                  compensation && ['ring-2 ring-inset', compensation.ring],
                  isToday && 'outline-2 outline-offset-2 outline-primary',
                )}
              >
                {StatusSymbol && <StatusSymbol className="hidden max-md:mb-px max-md:block max-md:size-3" strokeWidth={2.75} aria-hidden="true" />}
                <span>{dayNum}</span>
                {compensation && (
                  <MarkerSymbol name={compensation.symbol} className={cn('absolute top-0.5 right-0.5 size-3 sm:top-1 sm:right-1 sm:size-4', compensation.text)} />
                )}
                {dots.length > 0 && (
                  <span className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5" aria-hidden="true">
                    {dots.map((m) => (
                      <span key={m.key} className={cn('size-1.5 rounded-full ring-1 ring-card', m.dot)} />
                    ))}
                  </span>
                )}
                {cell.isCompensationDay && (
                  // The "!" takes the top-left corner of an HR-edited day, so the dot moves down there.
                  <span className={cn('absolute size-1.5 rounded-full ring-1 ring-card', edit ? 'bottom-1 left-1' : 'top-1 left-1', COMPENSATION_MARKER.dot)} aria-hidden="true" />
                )}
              </button>
              {edit && (
                <>
                  <HrEditPopover edit={edit} date={cell.date} onOpenDay={() => onSelectDay(cell)} />
                  {/* Phones: the "!" is a mark only; a tap on the day opens the day sheet with the HR edit at the top. */}
                  <HrEditBang
                    status={edit.status}
                    className="pointer-events-none absolute hidden ring-2 ring-card max-md:-top-1 max-md:-left-1 max-md:grid max-md:size-[15px] max-md:text-[10px]"
                  />
                </>
              )}
            </motion.div>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {(['present', 'half_shift', 'absent', 'on_leave', 'holiday'] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn('size-3 rounded-[4px] border max-md:size-3.5', statusStyles[s], phoneStatusStyles[s])} aria-hidden="true" />
            <span className="text-muted-foreground">{DAY_STATUS_LABEL[s]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5" data-testid="hr-edit-legend">
          <span className={cn('size-3 rounded-[4px] max-md:size-3.5', HR_EDIT_CELL)} aria-hidden="true" />
          <span className="text-muted-foreground">Edited by HR</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs">
        {[...legendMarkers(policy, days.length > 0 && !hasCurrentPermissionFlags(days)), COMPENSATION_MARKER].map((m) => (
          <div key={m.label} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', m.dot)} aria-hidden="true" />
            <span className="text-muted-foreground">{m.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="flex gap-0.5" aria-hidden="true">
            {(['waiting_hr', 'applied', 'rejected'] as const).map((s) => (
              <HrEditBang key={s} status={s} className="size-3.5 text-[9px] ring-1 ring-card" />
            ))}
          </span>
          <span className="text-muted-foreground">
            HR changed this day: waiting, applied or rejected <span className="max-md:hidden">(click ! for details)</span>
            <span className="hidden max-md:inline">(tap the day for details)</span>
          </span>
        </div>
      </div>
      {hrEditLine && <p className="mt-2 text-[12px] text-muted-foreground max-md:text-[11.5px]">{hrEditLine}</p>}
      {showCompensationLegend && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" data-testid="compensation-legend">
          <span className="font-medium text-foreground/80">Compensation</span>
          {compensationLegend().map((m) => (
            <div key={m.key} className="flex items-center gap-1.5">
              <span className={cn('grid size-5 place-items-center rounded-[5px] ring-2 ring-inset', m.ring)} aria-hidden="true">
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

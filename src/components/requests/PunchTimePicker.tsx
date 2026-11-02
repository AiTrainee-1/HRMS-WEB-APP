import { motion } from 'framer-motion'
import { AlertCircle, Clock, Info, Sparkles, Zap } from 'lucide-react'
import { SPRING, TONE_COLOR, useReducedMotion } from '@/components/kit'
import {
  barPosition,
  buildTimeChips,
  clampMinutes,
  dayBarRange,
  from12h,
  hourCells,
  minuteCells,
  nudge,
  slotTargets,
  to12h,
  to12hLabel,
  type Meridiem,
  type PunchSlot,
  type ShiftTimes,
} from '@/lib/punch-time-picker'
import type { DayPunch } from '@/hooks/useMissingPunchRequests'
import { cn } from '@/lib/utils'

const cell =
  'focus-ring grid min-h-11 place-items-center rounded-lg border text-[15px] font-semibold tabular-nums transition-[background-color,border-color,color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-10'
const cellOn = 'border-primary bg-brand-gradient text-white shadow-[0_6px_16px_-8px_rgb(37_99_235/0.8)]'
const cellOff = 'border-foreground/12 bg-foreground/[0.03] text-foreground hover:border-primary/45 hover:bg-primary/[0.07]'

/**
 * The Missing Punch time picker (owner, 2026-10-31: make picking the time much easier). Three ways in, from fastest:
 * one-tap chips of the employee's own shift times (+ "Now" today), a big hour / minute grid with AM-PM, and -5 / -1 /
 * +1 / +5 nudges for the exact minute. A "Your day" bar shows the picked time against the shift and the punches already
 * recorded that day. A time still to come today cannot be picked. Rules: lib/punch-time-picker.ts (tested).
 */
export function PunchTimePicker({
  value,
  onChange,
  shift,
  slot,
  nowMinutes,
  dayPunches,
  problem,
  hint,
}: {
  value: number
  onChange: (minutes: number) => void
  shift: ShiftTimes
  slot: PunchSlot
  /** The time now when the chosen day is today, else null. */
  nowMinutes: number | null
  dayPunches: DayPunch[] | 'loading' | 'error'
  /** Blocking problem (rose). */
  problem?: string | null
  /** Gentle hint (amber). */
  hint?: string | null
}) {
  const reduced = useReducedMotion()
  const { hour12, minute, meridiem } = to12h(value)
  // Never let a tap land on a time still to come today: pull it back to now.
  const set = (m: number) => onChange(nowMinutes != null ? Math.min(clampMinutes(m), nowMinutes) : clampMinutes(m))

  const chips = buildTimeChips(shift, slot, nowMinutes)
  const hours = hourCells(meridiem, nowMinutes)
  const minutes = minuteCells(hour12, meridiem, nowMinutes)
  const pmLocked = nowMinutes != null && from12h(12, 0, 'PM') > nowMinutes
  const display = `${hour12}:${String(minute).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3 sm:p-4">
      {/* The picked time, big, with AM / PM beside it */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-info-border bg-info-bg text-info" aria-hidden="true">
            <Clock className="size-5" />
          </span>
          <div>
            <p className="label-caps text-muted-foreground">Missed punch time</p>
            <motion.p
              key={display + meridiem}
              initial={reduced ? false : { opacity: 0.3, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="metric text-[34px] leading-10"
              aria-live="polite"
            >
              {display} <span className="text-lg text-muted-foreground">{meridiem}</span>
            </motion.p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Morning or afternoon" className="glass flex gap-1 rounded-full p-1">
          {(['AM', 'PM'] as const).map((m: Meridiem) => {
            const active = m === meridiem
            const locked = m === 'PM' && pmLocked
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={m === 'AM' ? 'AM, morning' : 'PM, afternoon or evening'}
                disabled={locked}
                onClick={() => !active && set(from12h(hour12, minute, m))}
                className={cn(
                  'focus-ring min-h-11 min-w-14 rounded-full px-3 text-sm font-bold transition-colors disabled:opacity-35 sm:min-h-9',
                  active ? 'bg-brand-gradient text-white' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>

      {/* One tap: the shift's own times */}
      <div className="flex flex-col gap-2">
        <p className="label-caps text-muted-foreground" id="punch-quick">Quick pick</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="punch-quick">
          {chips.map((c) => {
            const active = c.minutes === value
            return (
              <button
                key={c.key}
                type="button"
                disabled={c.disabled}
                aria-pressed={active}
                aria-label={`${c.label}, ${to12hLabel(c.minutes)}${c.disabled ? ', not yet today' : ''}`}
                onClick={() => set(c.minutes)}
                className={cn(
                  'focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-[background-color,border-color,transform] duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9',
                  active ? cellOn : c.suggested ? 'border-primary/50 bg-primary/10 text-foreground hover:bg-primary/15' : cellOff,
                )}
              >
                {c.key === 'now' ? <Zap className="size-3.5" aria-hidden="true" /> : c.suggested ? <Sparkles className="size-3.5" aria-hidden="true" /> : null}
                <span className="font-semibold">{c.label}</span>
                <span className={cn('tabular-nums', active ? 'text-white/85' : 'text-muted-foreground')}>{to12hLabel(c.minutes)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Or choose: hour, then minute */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="label-caps text-muted-foreground" id="punch-hour">Hour ({meridiem})</p>
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-labelledby="punch-hour">
            {hours.map((h) => {
              const active = h.hour12 === hour12
              return (
                <button key={h.hour12} type="button" disabled={h.disabled} aria-pressed={active} aria-label={`${h.hour12} ${meridiem}`}
                  onClick={() => set(from12h(h.hour12, minute, meridiem))} className={cn(cell, active ? cellOn : cellOff)}>
                  {h.hour12}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="label-caps text-muted-foreground" id="punch-minute">Minute</p>
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-labelledby="punch-minute">
            {minutes.map((m) => {
              const active = m.minute === minute
              return (
                <button key={m.minute} type="button" disabled={m.disabled} aria-pressed={active} aria-label={`${m.minute} minutes past`}
                  onClick={() => set(from12h(hour12, m.minute, meridiem))} className={cn(cell, 'text-[13.5px]', active ? cellOn : cellOff)}>
                  :{String(m.minute).padStart(2, '0')}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* The exact minute */}
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Fine-tune the minute">
        {[-5, -1, 1, 5].map((d) => {
          const blocked = d > 0 && nowMinutes != null && value >= nowMinutes
          return (
            <button key={d} type="button" disabled={blocked} onClick={() => set(nudge(value, d))}
              aria-label={`${d > 0 ? 'Add' : 'Take away'} ${Math.abs(d)} minute${Math.abs(d) === 1 ? '' : 's'}`}
              className={cn(cell, cellOff, 'text-[13px]')}>
              {d > 0 ? `+${d}` : `−${Math.abs(d)}`} min
            </button>
          )
        })}
      </div>

      <DayBar value={value} shift={shift} dayPunches={dayPunches} />

      {problem ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-rejected-border bg-rejected-bg px-3 py-2 text-[13px] font-medium text-rejected">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {problem}
        </p>
      ) : hint ? (
        <p className="flex items-start gap-2 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** The picked time against the shift and the day's recorded punches, on a small horizontal day bar. */
function DayBar({ value, shift, dayPunches }: { value: number; shift: ShiftTimes; dayPunches: DayPunch[] | 'loading' | 'error' }) {
  const targets = slotTargets(shift)
  const punches = Array.isArray(dayPunches) ? dayPunches : []
  const range = dayBarRange([targets.morning_in.minutes, targets.evening_out.minutes, value, ...punches.map((p) => p.minutes)])
  const pct = (m: number) => `${barPosition(m, range) * 100}%`
  const shiftLeft = barPosition(targets.morning_in.minutes, range) * 100
  const shiftWidth = Math.max(0.5, barPosition(targets.evening_out.minutes, range) * 100 - shiftLeft)
  const summary =
    `Missed punch at ${to12hLabel(value)}. Shift ${to12hLabel(targets.morning_in.minutes)} to ${to12hLabel(targets.evening_out.minutes)}. ` +
    (punches.length
      ? `Recorded that day: ${punches.map((p) => `${p.type === 'IN' ? 'in' : 'out'} at ${to12hLabel(p.minutes)}`).join(', ')}.`
      : 'No punch recorded that day.')

  return (
    <div className="flex flex-col gap-2" role="img" aria-label={summary}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps text-muted-foreground">Your day</p>
        <ul className="flex items-center gap-3 text-[11.5px] text-muted-foreground" aria-hidden="true">
          <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: TONE_COLOR.emerald }} /> In</li>
          <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: TONE_COLOR.amber }} /> Out</li>
          <li className="flex items-center gap-1"><span className="size-2 rounded-full" style={{ background: TONE_COLOR.sapphire }} /> Missed punch</li>
        </ul>
      </div>
      <div className="relative h-8" aria-hidden="true">
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-foreground/[0.07]" />
        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-primary/25" style={{ left: `${shiftLeft}%`, width: `${shiftWidth}%` }} />
        {punches.map((p, i) => (
          <span
            key={`${p.minutes}-${i}`}
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
            style={{ left: pct(p.minutes), background: p.type === 'IN' ? TONE_COLOR.emerald : TONE_COLOR.amber }}
          />
        ))}
        <motion.span
          className="absolute top-0 flex h-8 -translate-x-1/2 flex-col items-center"
          initial={false}
          animate={{ left: pct(value) }}
          transition={SPRING}
        >
          <span className="h-8 w-[3px] rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />
        </motion.span>
      </div>
      <div className="flex justify-between gap-2 text-[11.5px] text-muted-foreground tabular-nums" aria-hidden="true">
        <span>{to12hLabel(range.start)}</span>
        <span className="text-center">
          {dayPunches === 'loading'
            ? 'Loading that day’s punches…'
            : dayPunches === 'error'
              ? 'Could not load that day’s punches'
              : punches.length
                ? `${punches.length} punch${punches.length === 1 ? '' : 'es'} recorded that day`
                : 'No punch recorded that day'}
        </span>
        <span>{to12hLabel(Math.min(range.end, 1439))}</span>
      </div>
    </div>
  )
}

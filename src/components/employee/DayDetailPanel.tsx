import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { LogIn, LogOut } from 'lucide-react'
import { Timeline } from '@/components/kit'
import { punchStory, to12h } from '@/lib/home-punches'
import { DayMarkerChips } from '@/components/employee/DayMarkerChips'
import { HrEditDetails } from '@/components/employee/HrEditDetails'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { hrEditOf } from '@/lib/hr-edit'
import {
  dayHeadline, earlyOutShown, getCompensationMarker, getDayFlags, getDayMarkers, halfDayRule, isPunchlessRelaxation,
  lateInShown,
} from '@/lib/attendance-flags'
import { cn } from '@/lib/utils'
import type { AttendanceDay, ShiftPolicy } from '@/types'
import { format, parseISO } from 'date-fns'

// One plain-language line per flag on a worked day (plus the backend's late
// reason on any day that has one), so an employee can read back exactly why a
// day was marked (Late Detection, permissions, Half-Day Detection). Older
// backends only know the deprecated permission-zone flags, so they get the
// older with/without-request wording instead.
function dayNotes(day: AttendanceDay, policy?: ShiftPolicy | null): string[] {
  const f = getDayFlags(day)
  const notes: string[] = []
  // The backend's own account of the deadline that was missed. Shown whenever it
  // sends one, whatever else is flagged, and it replaces the generic sentences below.
  if (f.lateReason) notes.push(`Reason: ${f.lateReason}`)
  if (day.status !== 'present' && day.status !== 'half_shift') return notes
  if (f.late && lateInShown(policy) && !f.lateReason && !f.legacy) {
    notes.push('Late-In: your first punch was after shift start plus grace.')
  }
  if (f.earlyOut && earlyOutShown(policy) && !f.lateReason) {
    notes.push('Early Out: your last punch was before shift end minus grace.')
  }
  // A compensation day taken (relaxation) with no punches is a Half Day / Present only because HR topped the date up:
  // "you have a punch in only one half" would be untrue, and the compensation line above says what happened.
  if (f.halfDay && !f.legacy && !isPunchlessRelaxation(day)) {
    // The company's real windows when the backend states them; never a guessed time.
    const rule = halfDayRule(policy)
    notes.push(
      rule
        ? `Half Day: only one half of the day has a punch. ${rule.morning}. ${rule.evening}.`
        : 'Half Day: you have a punch in only one half of the day (before First Half End, or at/after Second Half Start).',
    )
  }
  if (f.legacy) {
    const request = (withRequest?: boolean) => (withRequest ? 'with a permission request' : 'without a permission request')
    if (f.morningApplied) notes.push(`Morning permission zone, ${request(day.permissionMorningWithRequest)}.`)
    if (f.afternoon) notes.push(`Afternoon permission zone, ${request(day.permissionAfternoonWithRequest)}.`)
    if (f.eveningApplied) notes.push(`Departure permission zone, ${request(day.permissionDepartureWithRequest)}.`)
  } else {
    if (f.morningApplied) notes.push('Morning Late-In permission applied: your shift start moved 60 minutes later today.')
    if (f.eveningApplied) notes.push('Evening Early-Out permission applied: your shift end moved 60 minutes earlier today.')
  }
  if (f.morningExcess) {
    notes.push('Your Morning Late-In permission is Overdue / Excess (past this month\'s limit): it did not protect today and counts toward late deductions.')
  }
  if (f.eveningExcess) {
    notes.push('Your Evening Early-Out permission is Overdue / Excess (past this month\'s limit): it did not protect today and counts toward late deductions.')
  }
  if (f.middle) notes.push('A Middle One-Hour Permission covers today. It does not move your shift.')
  return notes
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DayDetailPanel({
  day, onClose, policy,
}: {
  day: AttendanceDay | null
  onClose: () => void
  /** Company rules, when the backend sends them (half-day windows, which checks are on). */
  policy?: ShiftPolicy | null
}) {
  const notes = day ? dayNotes(day, policy) : []
  // What compensation did to this day: its colour + symbol + the server's sentence (or a fixed one for the kind).
  const compensation = day ? getCompensationMarker(day) : null
  // The day's punches labelled by what they are (Arrived, Stepped out, ...); a past day is over, so its last OUT is "left".
  const steps = day?.punches?.length ? punchStory(day.punches, { dayIsOver: day.date < todayKey() }) : []
  // What HR changed on this day and where its approval stands (owner 2026-11-02): first, it explains the day's colour.
  const hrEdit = hrEditOf(day)
  return (
    <Dialog open={!!day} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>{format(parseISO(day.date), 'EEEE, MMMM d, yyyy')}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <span>{dayHeadline(day)}</span>
                <DayMarkerChips markers={getDayMarkers(day, policy)} />
                {day.isCompensationDay && (
                  <span className="rounded-full border border-violet-border bg-violet-bg px-2 py-0.5 text-xs font-semibold text-violet">
                    Compensation Day
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {hrEdit && <HrEditDetails edit={hrEdit} headingId={`day-hr-edit-${day.date}`} />}
            {day.status === 'no_record' || day.status === 'future' || !day.firstPunch ? (
              // A real record without any punch: a compensation day (birthday leave, a relaxation day), or a day HR set
              // through an attendance edit (Casual Leave, On-Duty, a status change).
              <p className="text-sm text-muted-foreground">
                {day.status !== 'no_record' && day.status !== 'future'
                  ? 'No punches on this day.'
                  : 'No attendance record for this day.'}
              </p>
            ) : (
              <div className="flex flex-col gap-4 text-sm">
                <dl className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border hairline bg-foreground/[0.03] p-2.5 max-md:border-0 max-md:bg-muted">
                    <dt className="label-caps text-muted-foreground">First in</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{to12h(day.firstPunch)}</dd>
                  </div>
                  <div className="rounded-lg border hairline bg-foreground/[0.03] p-2.5 max-md:border-0 max-md:bg-muted">
                    <dt className="label-caps text-muted-foreground">Last out</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{day.lastPunch ? to12h(day.lastPunch) : '—'}</dd>
                  </div>
                  <div className="rounded-lg border hairline bg-foreground/[0.03] p-2.5 max-md:border-0 max-md:bg-muted">
                    <dt className="label-caps text-muted-foreground">Punches</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">{day.totalPunches ?? 0}</dd>
                  </div>
                </dl>
                {steps.length > 0 && (
                  <Timeline
                    ariaLabel="Punches on this day"
                    items={steps.map((st) => ({
                      key: st.key,
                      title: st.label,
                      time: st.time,
                      description: st.source || undefined,
                      icon: st.isIn ? LogIn : LogOut,
                      tone: st.isIn ? 'emerald' : 'amber',
                    }))}
                  />
                )}
              </div>
            )}
            {compensation && (
              <div
                data-testid="day-compensation"
                className={cn('flex items-start gap-2 rounded-md p-3 text-xs ring-1 ring-inset', compensation.ring)}
              >
                <MarkerSymbol name={compensation.symbol} className={cn('mt-0.5 size-4', compensation.text)} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-[13px] font-semibold text-foreground">{compensation.label}</p>
                  {compensation.detail && <p className="text-muted-foreground">{compensation.detail}</p>}
                </div>
              </div>
            )}
            {notes.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border hairline bg-foreground/[0.03] p-3 text-[12.5px] text-muted-foreground max-md:border-0 max-md:bg-muted max-md:text-[12px] max-md:leading-[17px]">
                {notes.map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

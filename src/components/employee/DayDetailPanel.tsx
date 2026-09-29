import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { DayMarkerChips } from '@/components/employee/DayMarkerChips'
import {
  dayStatusLabel, earlyOutShown, getDayFlags, getDayMarkers, halfDayRule, lateInShown,
} from '@/lib/attendance-flags'
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
  if (f.halfDay && !f.legacy) {
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

export function DayDetailPanel({
  day, onClose, policy,
}: {
  day: AttendanceDay | null
  onClose: () => void
  /** Company rules, when the backend sends them (half-day windows, which checks are on). */
  policy?: ShiftPolicy | null
}) {
  const notes = day ? dayNotes(day, policy) : []
  return (
    <Dialog open={!!day} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>{format(parseISO(day.date), 'EEEE, MMMM d, yyyy')}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                <span>{dayStatusLabel(day.status)}</span>
                <DayMarkerChips markers={getDayMarkers(day, policy)} />
                {day.isCompensationDay && (
                  <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-600">
                    Compensation Day
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {day.status === 'no_record' || day.status === 'future' || !day.firstPunch ? (
              <p className="text-sm text-muted-foreground">No attendance record for this day.</p>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First Punch In</span>
                  <span className="font-medium">{day.firstPunch}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Punch Out</span>
                  <span className="font-medium">{day.lastPunch ?? '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Punches</span>
                  <span className="font-medium">{day.totalPunches ?? 0}</span>
                </div>
              </div>
            )}
            {notes.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
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

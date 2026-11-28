import { Link } from 'wouter'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CalendarClock, Fingerprint, Hand, LogIn, LogOut, MessageCircleQuestion, Umbrella, type LucideIcon } from 'lucide-react'
import { Timeline } from '@/components/kit'
import { DayPunchStrip } from '@/components/employee/DayPunchStrip'
import { punchStory } from '@/lib/home-punches'
import {
  dayActions, dayPunchViews, earnedShiftHint, earnedShiftText, type DayActionKey, type DayPunchFields, type DayPunchWire,
} from '@/lib/day-punches'
import { getRequestWindow } from '@/lib/request-window'
import { DayMarkerChips } from '@/components/employee/DayMarkerChips'
import { HrEditDetails } from '@/components/employee/HrEditDetails'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { InProgressNote, InProgressPill } from '@/components/employee/InProgressNote'
import { inProgressView } from '@/lib/day-progress'
import { hrEditOf } from '@/lib/hr-edit'
import {
  dayHeadline, earlyOutShown, getCompensationMarker, getDayFlags, getDayMarkers, halfDayRule, isPunchlessBirthdayComp,
  isPunchlessRelaxation, lateInShown,
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
  // A compensation day taken (relaxation) with no punches is a Half Day / Present only because HR topped the date up, and
  // a Birthday Compensation half with no punches is a Half Day because the placement paid that half: "you have a punch
  // in only one half" would be untrue, and the compensation line above says what happened.
  if (f.halfDay && !f.legacy && !isPunchlessRelaxation(day) && !isPunchlessBirthdayComp(day)) {
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

// The chips' look: the mobile app's colour per remedy (fixed hues readable in both themes).
const ACTION_LOOK: Record<DayActionKey, { icon: LucideIcon; className: string }> = {
  leave: { icon: Umbrella, className: 'border-[#8E44AD]/40 bg-[#8E44AD]/10 text-[#7D3C98] dark:text-[#C39BD3]' },
  casual_leave: { icon: CalendarClock, className: 'border-[#B7791F]/40 bg-[#B7791F]/10 text-[#975A16] dark:text-[#F6C177]' },
  missing_punch: { icon: Fingerprint, className: 'border-[#5E35B1]/40 bg-[#5E35B1]/10 text-[#5E35B1] dark:text-[#B39DDB]' },
  permission: { icon: Hand, className: 'border-[#2980B9]/40 bg-[#2980B9]/10 text-[#21618C] dark:text-[#85C1E9]' },
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DayDetailPanel({
  day, onClose, policy, isStaff = false,
}: {
  day: AttendanceDay | null
  onClose: () => void
  /** Company rules, when the backend sends them (half-day windows, which checks are on). */
  policy?: ShiftPolicy | null
  /** A staff employee: an absent day also offers Casual Leave. */
  isStaff?: boolean
}) {
  const notes = day ? dayNotes(day, policy) : []
  // What compensation did to this day: its colour + symbol + the server's sentence (or a fixed one for the kind).
  const compensation = day ? getCompensationMarker(day) : null
  // The day's punches labelled by what they are (Arrived, Stepped out, ...); a past day is over, so its last OUT is "left".
  const steps = day?.punches?.length ? punchStory(day.punches, { dayIsOver: day.date < todayKey() }) : []
  // What HR changed on this day and where its approval stands (owner 2026-11-02): first, it explains the day's colour.
  const hrEdit = hrEditOf(day)
  // Owner 2026-11-24: every punch of the day with its source (the full list from a current server, else the plain
  // punches), the shift the day earned, and what the employee can do about the day (each chip opens the request form on
  // that day, while the request window still takes it).
  const extra = day as (AttendanceDay & DayPunchFields) | null
  const punchViews = day ? dayPunchViews(extra?.allPunches, day.punches as DayPunchWire[] | undefined) : []
  const earned = earnedShiftText(extra?.shiftsEarned)
  const earnedHint = earnedShiftHint(extra?.shiftsEarned)
  const flags = day ? getDayFlags(day) : null
  // Today while the shift is still running (owner 2026-11-26): "In progress", shifts "—", no verdict, when it is counted.
  const progress = day ? inProgressView(day) : null
  const actions =
    day && flags
      ? dayActions(
          {
            date: day.date,
            // No Half Day / Absent remedy for a day that has no verdict yet.
            status: progress ? 'present' : day.status,
            compensationKind: day.compensationKind,
            late: flags.late && lateInShown(policy),
            earlyOut: flags.earlyOut && earlyOutShown(policy),
          },
          getRequestWindow(new Date()),
          isStaff,
        )
      : null
  const noRecord = !day || day.status === 'no_record' || day.status === 'future'
  return (
    <Dialog open={!!day} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>{format(parseISO(day.date), 'EEEE, MMMM d, yyyy')}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 flex-wrap">
                {progress ? <InProgressPill label={progress.label} /> : <span>{dayHeadline(day)}</span>}
                <DayMarkerChips markers={getDayMarkers(day, policy)} />
                {day.isCompensationDay && (
                  <span className="rounded-full border border-violet-border bg-violet-bg px-2 py-0.5 text-xs font-semibold text-violet">
                    Compensation Day
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {actions && actions.actions.length > 0 && (
              <nav aria-label="Fix this day" className="flex flex-wrap gap-2">
                {actions.actions.map((a) => {
                  const look = ACTION_LOOK[a.key]
                  return (
                    <Link
                      key={a.key}
                      href={a.href}
                      onClick={onClose}
                      className={cn(
                        'focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-opacity hover:opacity-85 sm:min-h-8',
                        look.className,
                      )}
                    >
                      <look.icon className="size-3.5" aria-hidden="true" />
                      {a.label}
                    </Link>
                  )
                })}
              </nav>
            )}
            {actions?.closed && (
              <p className="rounded-lg border hairline bg-foreground/[0.03] p-3 text-[12.5px] text-muted-foreground max-md:border-0 max-md:bg-muted">
                This day is outside the request window, so the request forms cannot take it any more. If something is wrong,{' '}
                <Link href="/employee/enquiries" onClick={onClose} className="focus-ring inline-flex items-center gap-1 rounded font-semibold text-brand-blue underline-offset-2 hover:underline">
                  <MessageCircleQuestion className="size-3.5" aria-hidden="true" />
                  ask HR with an enquiry
                </Link>
                .
              </p>
            )}
            {hrEdit && <HrEditDetails edit={hrEdit} headingId={`day-hr-edit-${day.date}`} />}
            {progress ? (
              <InProgressNote view={progress} pill={false} />
            ) : earned && !noRecord && (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border hairline bg-foreground/[0.03] px-3 py-2.5 text-sm max-md:border-0 max-md:bg-muted"
                data-testid="day-earned-shift"
              >
                <p className="label-caps text-muted-foreground">Earned Shift</p>
                <p className="text-right font-semibold tabular-nums">
                  {earned}
                  {earnedHint && <span className="font-normal text-muted-foreground"> · {earnedHint}</span>}
                </p>
              </div>
            )}
            {noRecord || (!day.firstPunch && punchViews.length === 0) ? (
              // A real record without any punch: a compensation day (birthday leave, Birthday Compensation, a relaxation
              // day), or a day HR set through an attendance edit (Casual Leave, On-Duty, a status change).
              <p className="text-sm text-muted-foreground">
                {day.status !== 'no_record' && day.status !== 'future'
                  ? 'No punches on this day.'
                  : 'No attendance record for this day.'}
              </p>
            ) : (
              <div className="flex flex-col gap-4 text-sm">
                <DayPunchStrip punches={punchViews} inProgress={!!progress} />
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

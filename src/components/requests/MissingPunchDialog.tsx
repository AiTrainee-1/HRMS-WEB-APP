import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarSearch, LogIn, LogOut, Utensils, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TextareaField } from '@/components/employee/TextareaField'
import { missingPunchApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff } from '@/hooks/useApprovalSummary'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import { overlapNotice, type OverlapRow } from '@/lib/missing-punch-overlap'
import { waitingPhrase } from '@/lib/my-requests'
import {
  SLOT_LABEL,
  SLOT_ORDER,
  nowMinutesIfToday,
  parseClock,
  slotTargets,
  slotTimeHint,
  startTimeFor,
  timeProblem,
  to12hLabel,
  toHHmm,
  type PunchSlot,
  type ShiftTimes,
} from '@/lib/punch-time-picker'
import { checkRequestDate, getRequestWindow, windowHint } from '@/lib/request-window'
import { ChoiceTiles, FormError, FormNote, OffNotice, SentState, StepLabel } from './FormBits'
import { PHONE_BUTTON_ROW, PHONE_NO_CANCEL, PHONE_SUBMIT } from './phone'
import { cn } from '@/lib/utils'
import { TimePickerField } from '@/components/employee/TimePickerField'
import { isQueued } from '@/offline/submit'
import { queuedRequests } from '@/offline/queued-requests'
import { QUEUED_MESSAGE } from '@/lib/offline-ops'

const SLOT_ICON: Record<PunchSlot, LucideIcon> = { morning_in: LogIn, lunch_out: UtensilsCrossed, lunch_in: Utensils, evening_out: LogOut }

/**
 * Report a missing punch (owner 2026-10-31): the day (never after today), which of the four punches, the time with the
 * easy picker, and a reason. A same-day request for the same punch only brings a friendly reminder (never a block), and
 * the day's other punches already asked for are listed - 2 or 3 different punches a day are fine.
 */
export function MissingPunchDialog({
  open,
  onOpenChange,
  shift,
  rows,
  pipeline,
  offNote,
  onSent,
  initialDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Open on this day (YYYY-MM-DD) instead of today: the attendance day panel's chips (owner 2026-11-24). Checked by the page. */
  initialDate?: string | null
  /** After a successful send, with the punch date (YYYY-MM-DD): the page opens its month. */
  onSent?: (day: string) => void
  shift: ShiftTimes
  /** The employee's own requests (for the "already asked" reminder). */
  rows: readonly OverlapRow[]
  pipeline: string | null
  offNote: string | null
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [date, setDate] = React.useState('')
  const [slot, setSlot] = React.useState<PunchSlot>('morning_in')
  const [minutes, setMinutes] = React.useState(9 * 60)
  const [touched, setTouched] = React.useState(false)
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<string | null>(null)

  // A punch cannot be missed tomorrow: the window ends today.
  const w = getRequestWindow(new Date())
  const maxDate = w.today < w.max ? w.today : w.max

  React.useEffect(() => {
    if (!open) return
    const now = new Date()
    const win = getRequestWindow(now)
    const today = initialDate || (win.today >= win.min ? win.today : win.min)
    setDate(today)
    setSlot('morning_in')
    setMinutes(startTimeFor(shift, 'morning_in', nowMinutesIfToday(today, now)))
    setTouched(false)
    setReason('')
    setError(null)
    setSent(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The time follows the shift until the employee touches it (the shift can arrive after the dialog opened).
  React.useEffect(() => {
    if (open && !touched && date) setMinutes(startTimeFor(shift, slot, nowMinutesIfToday(date, new Date())))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift])

  const nowMin = nowMinutesIfToday(date, new Date())
  const targets = slotTargets(shift)
  const problem = timeProblem(minutes, nowMin)
  const hint = problem ? null : slotTimeHint(slot, minutes, shift)
  const overlap = date ? overlapNotice(rows, date, slot) : { repeat: null, also: null }

  const apply = useMutation({
    // Works offline too (owner 2026-11-24): saved on this device and sent once back online.
    mutationFn: (body: Parameters<typeof missingPunchApi.apply>[0]) => queuedRequests.missingPunch<Awaited<ReturnType<typeof missingPunchApi.apply>>>(body),
    onSuccess: (result) => {
      if (isQueued(result)) {
        setSent(QUEUED_MESSAGE)
        toast.info('Saved on this device', { description: 'It will be sent automatically when you are back online.' })
        return
      }
      const created = result
      qc.invalidateQueries({ queryKey: ['missing-punch'] })
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
      const who = waitingPhrase(created?.approval)
      setSent(`${who ? `It has gone to ${who} for approval.` : (pipeline ?? 'It has gone for approval.')} Once approved, the punch is added to your attendance.`)
      toast.success('Missing punch reported')
      onSent?.(created?.date ?? date)
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not send it. Please try again.')
      refreshIfWorkflowOff(qc, err)
    },
  })

  function pickSlot(next: PunchSlot) {
    setSlot(next)
    // Picking the punch jumps straight to its usual time (then fine-tune).
    setMinutes(startTimeFor(shift, next, nowMinutesIfToday(date, new Date())))
    setTouched(false)
    setError(null)
  }

  function pickDate(next: string) {
    setDate(next)
    setError(null)
    // A time still to come today is pulled back to now.
    const limit = nowMinutesIfToday(next, new Date())
    if (limit != null && minutes > limit) setMinutes(limit)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const at = new Date()
    const dateProblem = !date ? 'Pick the day.' : checkRequestDate(date, at, { noFuture: true })
    if (dateProblem) return setError(dateProblem)
    const t = timeProblem(minutes, nowMinutesIfToday(date, at))
    if (t) return setError(t)
    if (reason.trim().length < 5) return setError('Please give a reason (at least 5 letters).')
    if (reason.length > 200) return setError('The reason is too long (200 letters at most).')
    apply.mutate({ employeeId: user!.employeeId, date, punchTime: toHHmm(minutes), punchSlot: slot, reason: reason.trim() })
  }

  const dateHint = w.graceOpen ? `${windowHint(w).split(' to ')[0]} to today` : `${windowHint(w)}, up to today`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Missing punch reported' : 'Report a missing punch'}</DialogTitle>
          {!sent && <DialogDescription>Tell us the punch the machine missed. {pipeline ?? 'It goes for approval.'}</DialogDescription>}
        </DialogHeader>
        {sent ? (
          <SentState title="Your missing punch was reported." detail={sent} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {offNote && <OffNotice text={offNote} />}
            <div className="flex flex-col gap-1.5">
              <StepLabel n={1}>Which day?</StepLabel>
              <Label htmlFor="mp-date" className="sr-only">Date</Label>
              <Input id="mp-date" type="date" min={w.min} max={maxDate} value={date} aria-describedby="mp-date-hint" onChange={(e) => pickDate(e.target.value)} />
              <p id="mp-date-hint" className="text-xs text-muted-foreground">{dateHint}</p>
            </div>

            <div className="flex flex-col gap-2">
              <StepLabel n={2} id="mp-slot" hint="One punch per request">Which punch was missed?</StepLabel>
              <ChoiceTiles
                name="mp-slot"
                labelledBy="mp-slot"
                value={slot}
                onChange={pickSlot}
                choices={SLOT_ORDER.map((s) => ({
                  value: s,
                  label: SLOT_LABEL[s],
                  hint: `${targets[s].fromShift ? 'Your shift' : 'Usually'}: ${to12hLabel(targets[s].minutes)}`,
                  icon: SLOT_ICON[s],
                }))}
              />
            </div>

            <div className="flex flex-col gap-2">
              <StepLabel n={3}>What time was it?</StepLabel>
              {/* The same hour / minute / AM-PM picker as the Permission form (owner 2026-11-02). */}
              <TimePickerField
                label="Time of the missed punch"
                value={toHHmm(minutes)}
                onChange={(v) => {
                  const m = parseClock(v)
                  if (m == null) return
                  setMinutes(m)
                  setTouched(true)
                  setError(null)
                }}
              />
              {problem ? (
                <p className="text-sm font-medium text-rejected" role="alert">{problem}</p>
              ) : hint ? (
                <p className="text-sm text-muted-foreground">{hint}</p>
              ) : null}
            </div>

            {(overlap.repeat || overlap.also) && (
              <div className="flex flex-col gap-2" aria-live="polite">
                {overlap.repeat && <FormNote tone="waiting" icon={CalendarSearch}>{overlap.repeat}</FormNote>}
                {overlap.also && <FormNote>{overlap.also}</FormNote>}
              </div>
            )}

            <TextareaField id="mp-reason" label={<><span className="max-md:hidden">4 · </span>Reason</>} rows={3} minLength={5} maxLength={200} value={reason}
              placeholder="For example: the machine did not read my finger"
              onChange={(e) => { setReason(e.target.value); setError(null) }} />

            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={apply.isPending || !!offNote || !!problem}>
                {apply.isPending ? 'Sending…' : `Report ${to12hLabel(minutes)}`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

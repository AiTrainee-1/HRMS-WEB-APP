import * as React from 'react'
import { Link } from 'wouter'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CalendarDays, CalendarRange, Ellipsis, HeartHandshake, Siren, Stethoscope, Sun, Sunset, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TextareaField } from '@/components/employee/TextareaField'
import { leaveRequestsApi } from '@/api/requests-api'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff } from '@/hooks/useApprovalSummary'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import { REASON_CATEGORIES, buildLeaveBody, leaveFormProblem, type HalfSlot, type ReasonCategory } from '@/lib/leave-form'
import { checkRequestDate, checkRequestRange, getRequestWindow, windowHint } from '@/lib/request-window'
import { waitingPhrase } from '@/lib/my-requests'
import { ChoiceTiles, FormError, OffNotice, SentState, StepLabel } from './FormBits'
import { PHONE_BUTTON_ROW, PHONE_NO_CANCEL, PHONE_SUBMIT, PHONE_FIELD_LABEL } from './phone'
import { cn } from '@/lib/utils'

const CATEGORY_ICON: Record<ReasonCategory, LucideIcon> = { sick: Stethoscope, emergency: Siren, personal: HeartHandshake, other: Ellipsis }

type Mode = 'single' | 'range' | 'half'

const MODES: readonly { value: Mode; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'single', label: 'One day', hint: 'A single full day', icon: CalendarDays },
  { value: 'range', label: 'Several days', hint: 'From one date to another', icon: CalendarRange },
  { value: 'half', label: 'Half day', hint: 'Morning or afternoon', icon: Sun },
]

const SLOTS: readonly { value: HalfSlot; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'morning', label: 'Morning', hint: 'The first half of your shift', icon: Sun },
  { value: 'afternoon', label: 'Afternoon', hint: 'The second half of your shift', icon: Sunset },
]

/**
 * Apply for leave (owner 2026-10-31): WHY first (Sick Leave / Emergency / Personal / Other Reasons, required), then how
 * long (one day / several days / half day), the date(s) and a reason. Casual Leave is NOT here: it is its own request.
 * Sends exactly what the mobile app sends - type "Leave" + reasonCategory - so the server deducts no leave balance.
 */
export function LeaveApplyDialog({
  open,
  onOpenChange,
  pipeline,
  offNote,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipeline: string | null
  offNote: string | null
  /** After a successful send, with the first day of the new request (YYYY-MM-DD): the page opens its month. */
  onSent?: (day: string) => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [category, setCategory] = React.useState<ReasonCategory | ''>('')
  const [mode, setMode] = React.useState<Mode>('single')
  const [start, setStart] = React.useState('')
  const [end, setEnd] = React.useState('')
  const [slot, setSlot] = React.useState<HalfSlot | ''>('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<string | null>(null)

  // Every opening starts fresh from today as of now (the page can stay open for days).
  React.useEffect(() => {
    if (!open) return
    const w = getRequestWindow(new Date())
    const today = w.today >= w.min && w.today <= w.max ? w.today : w.min
    setCategory('')
    setMode('single')
    setStart(today)
    setEnd(today)
    setSlot('')
    setReason('')
    setError(null)
    setSent(null)
  }, [open])

  const apply = useMutation({
    mutationFn: leaveRequestsApi.apply,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] })
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
      const who = waitingPhrase(created?.approval)
      setSent(who ? `It has gone to ${who} for approval.` : (pipeline ?? 'It has gone for approval.'))
      toast.success('Leave request sent')
      onSent?.(start)
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Could not send your leave request. Please try again.'
      setError(message)
      refreshIfWorkflowOff(qc, err)
    },
  })

  const w = getRequestWindow(new Date())
  const endMin = start > w.min ? start : w.min

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const problem = leaveFormProblem({ reasonCategory: category, reason, mode, halfDaySlot: slot })
    if (problem) return setError(problem)
    // 'Now' is read here, at submit: the dialog can sit open across midnight.
    const now = new Date()
    const dateProblem = mode === 'range' ? checkRequestRange(start, end, now) : !start ? 'Pick the date.' : checkRequestDate(start, now)
    if (dateProblem) return setError(dateProblem)
    apply.mutate(
      buildLeaveBody({
        employeeId: user!.employeeId,
        reasonCategory: category as ReasonCategory,
        mode,
        startDate: start,
        endDate: end,
        halfDaySlot: slot || undefined,
        reason,
      }),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Leave request sent' : 'Apply for leave'}</DialogTitle>
          {!sent && <DialogDescription>{pipeline ?? 'Your request goes for approval.'}</DialogDescription>}
        </DialogHeader>
        {sent ? (
          <SentState title="Your leave request was sent." detail={sent} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {offNote && <OffNotice text={offNote} />}
            <div className="flex flex-col gap-2">
              <StepLabel n={1} id="leave-why">Why do you need leave?</StepLabel>
              <ChoiceTiles
                name="leave-category"
                labelledBy="leave-why"
                value={category}
                onChange={(v) => {
                  setCategory(v)
                  setError(null)
                }}
                invalid={error === 'Choose why you need leave.'}
                choices={REASON_CATEGORIES.map((c) => ({ value: c.key, label: c.label, hint: c.hint, icon: CATEGORY_ICON[c.key] }))}
              />
              <p className="text-xs text-muted-foreground">
                Casual Leave is applied separately, on the{' '}
                <Link href="/employee/casual-leave" className="focus-ring rounded font-semibold text-brand-blue underline-offset-2 hover:underline" onClick={() => onOpenChange(false)}>
                  Casual Leave page
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <StepLabel n={2} id="leave-length">How long?</StepLabel>
              <ChoiceTiles name="leave-mode" labelledBy="leave-length" value={mode} onChange={(v) => { setMode(v); setError(null) }} columns={3} choices={MODES} />
            </div>

            <div className="flex flex-col gap-2">
              <StepLabel n={3}>{mode === 'range' ? 'Which days?' : 'Which day?'}</StepLabel>
              {mode === 'range' ? (
                <div className="grid grid-cols-1 gap-3 max-md:grid-cols-1! min-[420px]:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="leave-start" className={PHONE_FIELD_LABEL}>From</Label>
                    <Input id="leave-start" type="date" min={w.min} max={w.max} value={start} aria-describedby="leave-window"
                      onChange={(e) => { setStart(e.target.value); if (end < e.target.value) setEnd(e.target.value); setError(null) }} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="leave-end" className={PHONE_FIELD_LABEL}>To</Label>
                    <Input id="leave-end" type="date" min={endMin} max={w.max} value={end} aria-describedby="leave-window"
                      onChange={(e) => { setEnd(e.target.value); setError(null) }} />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="leave-date" className={PHONE_FIELD_LABEL}>Date</Label>
                  <Input id="leave-date" type="date" min={w.min} max={w.max} value={start} aria-describedby="leave-window"
                    onChange={(e) => { setStart(e.target.value); setEnd(e.target.value); setError(null) }} />
                </div>
              )}
              <p id="leave-window" className="text-xs text-muted-foreground">{windowHint(w)}</p>
              {mode === 'half' && (
                <div className="mt-1 flex flex-col gap-2">
                  <p id="leave-half" className={cn('text-sm font-medium', PHONE_FIELD_LABEL)}>Which half?</p>
                  <ChoiceTiles name="leave-half" labelledBy="leave-half" value={slot} onChange={(v) => { setSlot(v); setError(null) }}
                    invalid={error === 'Choose the morning or the afternoon.'} choices={SLOTS} />
                </div>
              )}
            </div>

            <TextareaField id="leave-reason" label="Reason" rows={3} minLength={5} maxLength={300} value={reason}
              placeholder="A few words about why you need leave"
              onChange={(e) => { setReason(e.target.value); setError(null) }} />

            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={apply.isPending || !!offNote}>
                {apply.isPending ? 'Sending…' : 'Send leave request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

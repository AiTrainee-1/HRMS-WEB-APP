import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TextareaField } from '@/components/employee/TextareaField'
import { ApiError } from '@/api/client'
import { refreshIfWorkflowOff } from '@/hooks/useApprovalSummary'
import { useApplyCasualLeave } from '@/hooks/useCasualLeave'
import {
  CL_PORTIONS,
  PORTION_LABEL,
  balanceLine,
  clFormProblem,
  clock12,
  defaultApplyDate,
  firstAllowed,
  monthBlock,
  monthOfDate,
  portionChoices,
  portionMeaning,
  type CLBalance,
  type CLMonth,
  type CLPortion,
  type ShiftHalves,
} from '@/lib/casual-leave'
import { checkRequestDate, getRequestWindow, windowHint } from '@/lib/request-window'
import { ChoiceTiles, FormError, OffNotice, SentState, StepLabel } from './FormBits'
import { PHONE_BUTTON_ROW, PHONE_NO_CANCEL, PHONE_SUBMIT } from './phone'
import { cn } from '@/lib/utils'

const PORTION_ICON: Record<CLPortion, LucideIcon> = { full: Sun, first_half: Sunrise, second_half: Sunset }

/**
 * Apply for Casual Leave (owner 2026-10-31): a date, then Full day / First half / Second half - each explained in the
 * employee's own shift times when the shift is known - and a reason. A part the month no longer allows is greyed with
 * the reason. The server decides; its refusal is shown here in words.
 * 2026-11-02 (yearly balance): any date of an open month while the balance lasts; on one date never the same half twice
 * and never a full day over a half (lib/casual-leave.ts portionChoices); the description names the balance.
 */
export function ClApplyDialog({
  open,
  onOpenChange,
  months,
  balance,
  shift,
  pipeline,
  offNote,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** After a successful send, with the day it is for (YYYY-MM-DD): the page opens its month. */
  onSent?: (day: string) => void
  months: CLMonth[] | undefined
  /** The yearly balance (null on an older server: the one-per-month wording stays). */
  balance?: CLBalance | null
  shift: ShiftHalves | null | undefined
  pipeline: string | null
  offNote: string | null
}) {
  const qc = useQueryClient()
  const apply = useApplyCasualLeave()
  const [date, setDate] = React.useState('')
  const [portion, setPortion] = React.useState<CLPortion | null>('full')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<string | null>(null)

  // Every opening starts fresh: today (or the open month), the first part still allowed, no reason, no messages.
  // `months` is read at opening on purpose: a refetch while the dialog is open must not wipe what was typed.
  React.useEffect(() => {
    if (!open) return
    const start = defaultApplyDate(new Date(), months)
    setDate(start)
    setPortion(firstAllowed(portionChoices(monthOfDate(months, start), start)))
    setReason('')
    setError(null)
    setSent(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const month = monthOfDate(months, date)
  const choices = React.useMemo(() => portionChoices(month, date), [month, date])
  const block = monthBlock(months, date)

  // A new date can rule out the chosen part (that half of that date is taken): move to one that is still allowed.
  React.useEffect(() => {
    if (portion && !choices[portion].enabled) setPortion(firstAllowed(choices))
  }, [choices, portion])

  const w = getRequestWindow(new Date())

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const dateProblem = !date ? 'Pick the date.' : checkRequestDate(date, new Date())
    if (dateProblem) return setError(dateProblem)
    if (block) return setError(block)
    const problem = clFormProblem({ portion, reason })
    if (problem) return setError(problem)
    apply.mutate(
      { date, reason: reason.trim(), portion: portion! },
      {
        onSuccess: () => {
          setSent(
            portion === 'full'
              ? (pipeline ?? 'Your Casual Leave request has gone for approval.')
              : `Half a day (${PORTION_LABEL[portion!].toLowerCase()}). ${pipeline ?? 'It has gone for approval.'}`,
          )
          toast.success('Casual Leave request sent')
          onSent?.(date)
        },
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : 'Could not send it. Please try again.')
          refreshIfWorkflowOff(qc, err)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Casual Leave request sent' : 'Apply for Casual Leave'}</DialogTitle>
          {!sent && (
            <DialogDescription>
              {balance
                ? `${balanceLine(balance)}. Take a full day or a half-day on any date while the balance lasts.`
                : 'One paid day a month: a full day, or two half-days on any dates of that month.'}
            </DialogDescription>
          )}
        </DialogHeader>
        {sent ? (
          <SentState title="Your Casual Leave request was sent." detail={sent} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {offNote && <OffNotice text={offNote} />}
            <div className="flex flex-col gap-1.5">
              <StepLabel n={1}>Which day?</StepLabel>
              <Label htmlFor="cl-date" className="sr-only">Date</Label>
              <Input
                id="cl-date"
                type="date"
                min={w.min}
                max={w.max}
                value={date}
                aria-describedby="cl-date-hint"
                aria-invalid={!!block || undefined}
                onChange={(e) => {
                  setDate(e.target.value)
                  setError(null)
                }}
              />
              <p id="cl-date-hint" className={block ? 'text-xs font-medium text-rejected' : 'text-xs text-muted-foreground'}>
                {block ?? windowHint(w)}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <StepLabel n={2} id="cl-part" hint={shift ? `Your shift: ${clock12(shift.start)} - ${clock12(shift.end)}` : undefined}>
                Which part of the day?
              </StepLabel>
              <ChoiceTiles
                name="cl-portion"
                labelledBy="cl-part"
                value={portion}
                onChange={(v) => {
                  setPortion(v)
                  setError(null)
                }}
                columns={1}
                choices={CL_PORTIONS.map((p) => ({
                  value: p,
                  label: PORTION_LABEL[p],
                  hint: portionMeaning(p, shift),
                  icon: PORTION_ICON[p],
                  disabled: !choices[p].enabled,
                  why: choices[p].why,
                }))}
              />
            </div>

            <TextareaField id="cl-reason" label="Reason" rows={3} minLength={5} maxLength={200} value={reason}
              placeholder="A few words about why"
              onChange={(e) => { setReason(e.target.value); setError(null) }} />

            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={apply.isPending || !!offNote || !portion}>
                {apply.isPending ? 'Sending…' : 'Send Casual Leave request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

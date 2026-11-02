import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Briefcase, HeartPulse, LogOut, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TextareaField } from '@/components/employee/TextareaField'
import { TimePickerField } from '@/components/employee/TimePickerField'
import { outpassRequestsApi } from '@/api/requests-api'
import { ApiError } from '@/api/client'
import { refreshIfWorkflowOff } from '@/hooks/useApprovalSummary'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import { waitingPhrase } from '@/lib/my-requests'
import { PASS_TYPES, expectedReturnIso, type OutpassPassType } from '@/lib/outpass-open'
import { ChoiceTiles, FormError, OffNotice, SentState, StepLabel } from './FormBits'
import { PHONE_BUTTON_ROW, PHONE_NO_CANCEL, PHONE_SUBMIT, PHONE_FIELD_LABEL } from './phone'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<OutpassPassType, LucideIcon> = { official: Briefcase, personal: HeartPulse, early_dismissal: LogOut }

function inTwoHours(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Ask for a gate pass (outpass): what kind, where to, when you will be back (it drives the "time to return" clock on
 * the open pass; a time earlier than now means tomorrow) and why. Once approved, the pass shows a QR to scan at the
 * gate within 60 minutes.
 */
export function OutpassApplyDialog({
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
  /** After a successful send, with the day it was asked (YYYY-MM-DD or a date-time): the page opens its month. */
  onSent?: (day: string) => void
}) {
  const qc = useQueryClient()
  const [passType, setPassType] = React.useState<OutpassPassType>('official')
  const [destination, setDestination] = React.useState('')
  const [back, setBack] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setPassType('official')
    setDestination('')
    setBack(inTwoHours())
    setReason('')
    setError(null)
    setSent(null)
  }, [open])

  const apply = useMutation({
    mutationFn: outpassRequestsApi.apply,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['outpass-requests'] })
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
      const who = waitingPhrase(created?.approval)
      setSent(`${who ? `It has gone to ${who} for approval.` : (pipeline ?? 'It has gone for approval.')} Once approved, show the QR at the gate within 60 minutes.`)
      toast.success('Outpass request sent')
      onSent?.(created?.createdAt ?? new Date().toISOString())
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not send it. Please try again.')
      refreshIfWorkflowOff(qc, err)
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (destination.trim().length < 2) return setError('Please say where you are going.')
    const expectedReturnAt = back ? expectedReturnIso(back, new Date()) : null
    if (back && !expectedReturnAt) return setError('Pick the time you will be back.')
    if (reason.trim().length < 5) return setError('Please give a reason (at least 5 letters).')
    apply.mutate({
      destination: destination.trim(),
      reason: reason.trim(),
      passType,
      ...(expectedReturnAt ? { expectedReturnAt } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Outpass request sent' : 'Ask for an outpass'}</DialogTitle>
          {!sent && <DialogDescription>{pipeline ?? 'Your request goes for approval.'}</DialogDescription>}
        </DialogHeader>
        {sent ? (
          <SentState title="Your outpass request was sent." detail={sent} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {offNote && <OffNotice text={offNote} />}
            <div className="flex flex-col gap-2">
              <StepLabel n={1} id="op-type">What kind of pass?</StepLabel>
              <ChoiceTiles name="op-type" labelledBy="op-type" value={passType} columns={1}
                onChange={(v) => { setPassType(v); setError(null) }}
                choices={PASS_TYPES.map((t) => ({ value: t.value, label: t.label, hint: t.hint, icon: TYPE_ICON[t.value] }))} />
            </div>
            <div className="grid grid-cols-1 gap-3 max-md:grid-cols-1! min-[420px]:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="op-destination" className={PHONE_FIELD_LABEL}>
                  <span className="max-md:hidden">2 · </span>Where are you going?
                </Label>
                <Input id="op-destination" value={destination} maxLength={120} placeholder="For example: Bank, Tiruppur"
                  onChange={(e) => { setDestination(e.target.value); setError(null) }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <TimePickerField label={<><span className="max-md:hidden">3 · </span>Back by</>} value={back} onChange={(v) => { setBack(v); setError(null) }} />
              </div>
            </div>
            <TextareaField id="op-reason" label={<><span className="max-md:hidden">4 · </span>Reason</>} rows={3} minLength={5} maxLength={300} value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null) }} />
            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={apply.isPending || !!offNote}>
                {apply.isPending ? 'Sending…' : 'Send outpass request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

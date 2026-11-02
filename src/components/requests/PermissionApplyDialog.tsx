import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeftRight, LogIn, LogOut, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TextareaField } from '@/components/employee/TextareaField'
import { TimePickerField } from '@/components/employee/TimePickerField'
import { permissionApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff } from '@/hooks/useApprovalSummary'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import { permissionsUsedIn } from '@/lib/my-requests'
import { PERMISSION_TYPES, permissionTypeOption } from '@/lib/permissions'
import { checkRequestDate, getRequestWindow, windowHint } from '@/lib/request-window'
import type { PermissionRequest, PermissionTypeKey } from '@/types'
import { ChoiceTiles, FormError, FormNote, OffNotice, SentState, StepLabel } from './FormBits'
import { PHONE_BUTTON_ROW, PHONE_NO_CANCEL, PHONE_SUBMIT, PHONE_FIELD_LABEL } from './phone'
import { cn } from '@/lib/utils'

const TYPE_ICON: Record<PermissionTypeKey, LucideIcon> = { morning_late_in: LogIn, evening_early_out: LogOut, middle_permission: ArrowLeftRight }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * Ask for a one-hour permission: the kind (late in / early out / middle hour), the day and time, a reason. Going past
 * the monthly limit never blocks (the server accepts it), it only warns: a permission past the limit is Overdue /
 * Excess - it does not protect the day and counts toward late deductions.
 */
export function PermissionApplyDialog({
  open,
  onOpenChange,
  rows,
  monthlyLimit,
  pipeline,
  offNote,
  onSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: readonly PermissionRequest[]
  monthlyLimit: number
  pipeline: string | null
  offNote: string | null
  /** After a successful send, with the day it is for (YYYY-MM-DD): the page opens its month. */
  onSent?: (day: string) => void
}) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [type, setType] = React.useState<PermissionTypeKey | ''>('')
  const [date, setDate] = React.useState('')
  const [time, setTime] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState<{ text: string; pastLimit: boolean } | null>(null)

  React.useEffect(() => {
    if (!open) return
    const w = getRequestWindow(new Date())
    setType('')
    setDate(w.today >= w.min ? w.today : w.min)
    setTime('')
    setReason('')
    setError(null)
    setSent(null)
  }, [open])

  const w = getRequestWindow(new Date())
  const selected = permissionTypeOption(type || null)
  const picked = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : w.today
  const pickedYear = Number(picked.slice(0, 4))
  const pickedMonth0 = Number(picked.slice(5, 7)) - 1
  const used = permissionsUsedIn(rows, pickedYear, pickedMonth0)
  const overLimit = used >= monthlyLimit

  const apply = useMutation({
    mutationFn: permissionApi.apply,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['permissions'] })
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
      const pastLimit = created?.monthlyUsed != null && created.monthlyUsed > (created.monthlyLimit ?? monthlyLimit)
      setSent({ text: pipeline ?? 'It has gone for approval.', pastLimit })
      toast.success('Permission request sent')
      onSent?.(created?.date ?? date)
    },
    onError: (err) => {
      // A 409 is a request of the same type for the same day: the server's own message says which.
      setError(err instanceof ApiError ? err.message : 'Could not send it. Please try again.')
      refreshIfWorkflowOff(qc, err)
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selected) return setError('Choose the kind of permission.')
    const dateProblem = !date ? 'Pick the day.' : checkRequestDate(date, new Date())
    if (dateProblem) return setError(dateProblem)
    if (!time) return setError(`Pick the ${selected.timeLabel.toLowerCase()}.`)
    if (reason.trim().length < 5) return setError('Please give a reason (at least 5 letters).')
    if (reason.length > 200) return setError('The reason is too long (200 letters at most).')
    apply.mutate({ employeeId: user!.employeeId, date, permissionTime: time, reason: reason.trim(), type: selected.wire })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{sent ? 'Permission request sent' : 'Ask for permission'}</DialogTitle>
          {!sent && <DialogDescription>Every permission is one hour (60 minutes). {pipeline ?? ''}</DialogDescription>}
        </DialogHeader>
        {sent ? (
          <SentState
            title="Your permission request was sent."
            detail={
              sent.pastLimit
                ? `${sent.text} You are past your monthly limit, so if it is approved it will be Overdue / Excess and will not protect that day.`
                : sent.text
            }
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-5">
            {offNote && <OffNotice text={offNote} />}
            <div className="flex flex-col gap-2">
              <StepLabel n={1} id="perm-type">What kind of permission?</StepLabel>
              <ChoiceTiles
                name="perm-type"
                labelledBy="perm-type"
                value={type}
                columns={1}
                invalid={error === 'Choose the kind of permission.'}
                onChange={(v) => {
                  setType(v)
                  setError(null)
                }}
                choices={PERMISSION_TYPES.map((t) => ({ value: t.key, label: t.label, hint: `${t.hint}. ${t.effect}`, icon: TYPE_ICON[t.key] }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <StepLabel n={2}>When?</StepLabel>
              <div className="grid grid-cols-1 gap-3 max-md:grid-cols-1! min-[420px]:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="perm-date" className={PHONE_FIELD_LABEL}>Date</Label>
                  <Input id="perm-date" type="date" min={w.min} max={w.max} value={date} aria-describedby="perm-date-hint"
                    onChange={(e) => { setDate(e.target.value); setError(null) }} />
                  <p id="perm-date-hint" className="text-xs text-muted-foreground">{windowHint(w)}</p>
                </div>
                <TimePickerField label={selected?.timeLabel ?? 'Time'} value={time} onChange={(v) => { setTime(v); setError(null) }} />
              </div>
            </div>
            <TextareaField id="perm-reason" label="Reason" rows={3} minLength={5} maxLength={200} value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null) }} />
            {overLimit && (
              <FormNote tone="waiting" icon={AlertTriangle}>
                You already have {used} of {monthlyLimit} permissions for {MONTHS[pickedMonth0]}. You can still ask, but a
                permission past the limit is Overdue / Excess: it does not protect the day and counts toward late deductions.
              </FormNote>
            )}
            <FormError>{error}</FormError>
            <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', PHONE_BUTTON_ROW)}>
              <Button type="button" variant="ghost" className={cn('min-h-11 sm:min-h-9', PHONE_NO_CANCEL)} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className={cn('min-h-11 sm:min-h-9', PHONE_SUBMIT)} disabled={apply.isPending || !!offNote}>
                {apply.isPending ? 'Sending…' : 'Send permission request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

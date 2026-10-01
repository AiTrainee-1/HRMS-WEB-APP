import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Fingerprint } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequestTabs } from '@/components/employee/RequestTabs'
import { TextareaField } from '@/components/employee/TextareaField'
import { TimePickerField } from '@/components/employee/TimePickerField'
import { MonthYearPicker } from '@/components/employee/MonthYearPicker'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { WorkflowOffNotice } from '@/components/employee/WorkflowOffNotice'
import { EmptyState } from '@/components/employee/EmptyState'
import { missingPunchApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { ApiError } from '@/api/client'
import { hasTrail, pipelineSentence, waitingText } from '@/lib/approval'
import { checkRequestDate, getRequestWindow, windowHint } from '@/lib/request-window'
import type { MissingPunchRequest, MissingPunchSlot } from '@/types'
import { format, parseISO } from 'date-fns'

// What the two pending statuses say: right for the order they were named after, and the fallback for a request that
// carries no `approval` block (an older backend). Otherwise the chip says who the request is waiting for now.
const STAGE_LABEL: Record<string, string> = {
  pending_hod: 'Awaiting Department Head',
  pending_hr: 'Awaiting HR',
  approved: 'Approved',
  rejected: 'Rejected',
}

const STAGE_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = {
  pending_hod: 'warning',
  pending_hr: 'secondary',
  approved: 'success',
  rejected: 'destructive',
}

// Which of the day's 4 punches this request represents — purely descriptive
// (maps onto punchType server-side: morning_in/lunch_in -> IN, lunch_out/
// evening_out -> OUT). Never the source of truth for real P1-P4 identity,
// which the attendance engine derives from punch time, not a stored label.
const PUNCH_SLOTS: MissingPunchSlot[] = ['morning_in', 'lunch_out', 'lunch_in', 'evening_out']
const PUNCH_SLOT_LABEL: Record<MissingPunchSlot, string> = {
  morning_in: 'Morning Check-In',
  lunch_out: 'Lunch Check-Out',
  lunch_in: 'Lunch Check-In',
  evening_out: 'Evening Check-Out',
}

export default function MissingPunch() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const now = new Date()
  const [month, setMonth] = React.useState(now.getMonth() + 1)
  const [year, setYear] = React.useState(now.getFullYear())
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<{ date: string; punchTime: string; punchSlot: MissingPunchSlot; reason: string }>({
    date: '', punchTime: '', punchSlot: 'morning_in', reason: '',
  })
  const [formError, setFormError] = React.useState<string | null>(null)
  // The pipeline HR configured for missing punches, and the note when HR has switched them off.
  const { workflow, offNote } = useApprovalWorkflow('missing_punch')
  const pipeline = pipelineSentence(workflow)

  const listQuery = useQuery({
    queryKey: ['missing-punch', user?.employeeId, month, year],
    queryFn: () => missingPunchApi.list(user!.employeeId, undefined, month, year),
    enabled: !!user,
  })

  const applyMutation = useMutation({
    mutationFn: missingPunchApi.apply,
    onSuccess: (created) => {
      // The new request's own pipeline is the freshest word on where it goes (the summary can be a minute old).
      toast.success('Missing Punch request submitted', {
        description: pipelineSentence(created.approval ?? workflow) ?? undefined,
      })
      qc.invalidateQueries({ queryKey: ['missing-punch', user?.employeeId] })
      setDialogOpen(false)
      setForm({ date: '', punchTime: '', punchSlot: 'morning_in', reason: '' })
    },
    onError: (err) => {
      // The server's own sentence (a 400 request_window_closed, a duplicate...) belongs in the dialog too, not only a toast.
      const message = err instanceof ApiError ? err.message : 'Could not submit request'
      setFormError(message)
      toast.error(message)
      refreshIfWorkflowOff(qc, err)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.date) return setFormError('Date is required.')
    // 'Now' is read here, when the form is submitted, never cached: the dialog can sit open across midnight.
    // A punch cannot be missed tomorrow, so no future dates ('Date cannot be in the future.').
    const outside = checkRequestDate(form.date, new Date(), { noFuture: true })
    if (outside) return setFormError(outside)
    if (!form.punchTime) return setFormError('Time is required.')
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 200) return setFormError('Reason is too long (max 200 characters).')
    applyMutation.mutate({ employeeId: user!.employeeId, ...form })
  }

  const all = listQuery.data ?? []
  const live = all.filter((r) => r.status === 'pending_hod' || r.status === 'pending_hr')
  const confirmed = all.filter((r) => r.status === 'approved' || r.status === 'rejected')
  const approvedCount = all.filter((r) => r.status === 'approved').length
  const rejectedCount = all.filter((r) => r.status === 'rejected').length
  // A persistent problem in the dialog beats a toast that fades: a validation error, else "switched off".
  const dialogError = formError ?? offNote
  // The dates an employee may request, from the clock as of this render (the server enforces the same window).
  // A missing punch also cannot be after today.
  const requestWindow = getRequestWindow(now)
  const maxDate = requestWindow.today < requestWindow.max ? requestWindow.today : requestWindow.max
  // 'Any day in October 2026, up to today' normally; on the grace days the range stops at today, not at the end of the
  // month: '1 September 2026 to today'.
  const dateHint = requestWindow.graceOpen
    ? `${windowHint(requestWindow).split(' to ')[0]} to today`
    : `${windowHint(requestWindow)}, up to today`

  function renderItem(item: MissingPunchRequest) {
    // With the request's own pipeline the trail says who decided which step; the two lines below are the older
    // backend's fixed "Department Head, then HR" reading of the same stamps.
    const trailed = hasTrail(item.approval)
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
            <Badge variant={STAGE_VARIANT[item.status] ?? 'secondary'}>
              {waitingText(item.approval) ?? STAGE_LABEL[item.status] ?? item.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {item.punchSlot ? PUNCH_SLOT_LABEL[item.punchSlot] : (item.punchType === 'IN' ? 'Check-In' : 'Check-Out')} · {item.punchTime}
          </p>
          <p className="text-sm">{item.reason}</p>
          <ApprovalTrail approval={item.approval} className="mt-1" />
          {!trailed && item.hodReviewedBy && (
            <p className="text-xs text-muted-foreground">
              Department Head: {item.status === 'rejected' && !item.hrReviewedBy ? 'rejected' : 'approved'} by {item.hodReviewedBy}
            </p>
          )}
          {!trailed && item.hrReviewedBy && (
            <p className="text-xs text-muted-foreground">
              HR: {item.status === 'rejected' ? 'rejected' : 'approved'} by {item.hrReviewedBy}
            </p>
          )}
          {item.status === 'approved' && (
            <p className="text-xs text-success">Added to your attendance.</p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Missing Punch"
        subtitle="Forgot to punch in or out? Report it here for approval"
        icon={<Fingerprint />}
        actions={
          <div className="flex items-center gap-2">
            <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (open) setFormError(null)
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={!!offNote}>
                <Plus /> Report Missing Punch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report a Missing Punch</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Which Punch Was Missed?</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PUNCH_SLOTS.map((slot) => (
                      <Button
                        key={slot}
                        type="button"
                        variant={form.punchSlot === slot ? 'gradient' : 'outline'}
                        onClick={() => setForm((f) => ({ ...f, punchSlot: slot }))}
                      >
                        {PUNCH_SLOT_LABEL[slot]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      min={requestWindow.min}
                      max={maxDate}
                      aria-describedby="date-hint"
                      value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    />
                    <p id="date-hint" className="text-xs text-muted-foreground">{dateHint}</p>
                  </div>
                  <TimePickerField label="Time" value={form.punchTime} onChange={(v) => setForm((f) => ({ ...f, punchTime: v }))} />
                </div>
                <TextareaField
                  id="reason"
                  label="Reason"
                  rows={3}
                  minLength={5}
                  maxLength={200}
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
                {dialogError && <p className="text-sm text-destructive">{dialogError}</p>}
                <DialogFooter>
                  <Button type="submit" variant="gradient" disabled={applyMutation.isPending || !!offNote}>
                    {applyMutation.isPending ? 'Submitting…' : 'Submit'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {offNote && <WorkflowOffNotice text={offNote} />}

      <Card>
        <CardContent className="flex items-start gap-2 py-3 text-sm text-muted-foreground">
          <p>
            Submit the date, time and reason for a punch you missed. {pipeline ?? 'It goes for approval.'} Once
            approved, the punch is added to your attendance automatically.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Total</p>
            <p className="mt-1 text-xl font-bold text-primary">{all.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Pending</p>
            <p className="mt-1 text-xl font-bold text-warning">{live.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Approved</p>
            <p className="mt-1 text-xl font-bold text-success">{approvedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Rejected</p>
            <p className="mt-1 text-xl font-bold text-destructive">{rejectedCount}</p>
          </CardContent>
        </Card>
      </div>

      {listQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <RequestTabs
          liveItems={live}
          confirmedItems={confirmed}
          renderItem={renderItem}
          emptyLive={<EmptyState icon={Fingerprint} title="No pending Missing Punch requests" />}
          emptyConfirmed={<EmptyState icon={Fingerprint} title="No confirmed Missing Punch requests yet" />}
        />
      )}
    </div>
  )
}

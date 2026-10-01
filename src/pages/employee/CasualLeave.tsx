import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, CalendarClock, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequestTabs } from '@/components/employee/RequestTabs'
import { TextareaField } from '@/components/employee/TextareaField'
import { StatusBadge } from '@/components/employee/StatusBadge'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { WorkflowOffNotice } from '@/components/employee/WorkflowOffNotice'
import { EmptyState } from '@/components/employee/EmptyState'
import { casualLeaveApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { ApiError } from '@/api/client'
import { pipelineSentence } from '@/lib/approval'
import { isCasualLeaveEligible } from '@/lib/casual-leave'
import { checkRequestDate, getRequestWindow, windowHint } from '@/lib/request-window'
import type { CasualLeaveRequest } from '@/types'
import { format, parseISO } from 'date-fns'

export default function CasualLeave() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ date: '', reason: '' })
  const [formError, setFormError] = React.useState<string | null>(null)
  // The pipeline HR configured for casual leave, and the note when HR has switched it off.
  const { workflow, offNote } = useApprovalWorkflow('casual_leave')
  const pipeline = pipelineSentence(workflow)

  const eligibilityQuery = useQuery({
    queryKey: ['cl-eligibility', user?.employeeId],
    queryFn: () => casualLeaveApi.eligibility(),
    enabled: !!user,
  })

  const listQuery = useQuery({
    queryKey: ['casual-leaves', user?.employeeId],
    queryFn: () => casualLeaveApi.list(user!.employeeId),
    enabled: !!user,
  })

  const applyMutation = useMutation({
    mutationFn: casualLeaveApi.apply,
    onSuccess: () => {
      toast.success('Casual leave request submitted')
      qc.invalidateQueries({ queryKey: ['casual-leaves', user?.employeeId] })
      // The per-month verdicts (and the yearly balance) change with this request: the prefix also refreshes the
      // Attendance and Dashboard copies of the same query.
      qc.invalidateQueries({ queryKey: ['cl-eligibility'] })
      setDialogOpen(false)
      setForm({ date: '', reason: '' })
    },
    onError: (err) => {
      // The server's own sentence (a 400 request_window_closed, a month not eligible...) belongs in the dialog too, not only a toast.
      const message = err instanceof ApiError ? err.message : 'Could not submit casual leave request'
      setFormError(message)
      toast.error(message)
      refreshIfWorkflowOff(qc, err)
    },
  })

  // Per-month verdicts (the previous month while the grace days are open, then the current month). An older backend
  // sends none: then only the overall `eligible` flag below decides.
  const months = eligibilityQuery.data?.months
  const pickedMonth = months?.find((m) => m.month === form.date.slice(0, 7))
  const monthBlock = pickedMonth && !pickedMonth.eligible
    ? (pickedMonth.reason ?? `You are not eligible for casual leave in ${pickedMonth.label}.`)
    : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.date) return setFormError('Date is required.')
    // 'Now' is read here, when the form is submitted, never cached: the dialog can sit open across midnight.
    const outside = checkRequestDate(form.date, new Date())
    if (outside) return setFormError(outside)
    // The picked month is not eligible: its reason is already shown in the dialog (dialogError), so just stop here.
    if (monthBlock) return
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 200) return setFormError('Reason is too long (max 200 characters).')
    applyMutation.mutate({ employeeId: user!.employeeId, ...form })
  }

  const all = listQuery.data ?? []
  const live = all.filter((r) => r.status === 'pending')
  const confirmed = all.filter((r) => r.status !== 'pending')
  // With per-month verdicts the Apply button stays on while any open month is eligible; without them (an older
  // backend) the overall flag decides, as it always did.
  const ineligible = eligibilityQuery.data && !isCasualLeaveEligible(eligibilityQuery.data)
  // A persistent problem in the dialog beats a toast that fades: the picked month's reason, else a validation / server
  // error, else "switched off".
  const dialogError = monthBlock ?? formError ?? offNote
  // The dates an employee may request, from the clock as of this render (the server enforces the same window).
  const requestWindow = getRequestWindow(new Date())

  function renderItem(item: CasualLeaveRequest) {
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
            <StatusBadge status={item.status} approval={item.approval} />
          </div>
          <p className="text-sm">{item.reason}</p>
          <ApprovalTrail approval={item.approval} className="mt-1" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Casual Leave"
        subtitle="Eligibility-based short leave, one per calendar month"
        icon={<CalendarClock />}
        actions={
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (open) setFormError(null)
            }}
          >
            <DialogTrigger asChild>
              <Button className="bg-white dark:bg-card/95 text-brand-blue hover:bg-white/90 dark:hover:bg-white/10 shadow-clay" disabled={!!ineligible || !!offNote}>
                <Plus /> Apply Casual Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Casual Leave</DialogTitle>
              {pipeline && <DialogDescription>{pipeline}</DialogDescription>}
            </DialogHeader>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cl-date">Date</Label>
                <Input
                  id="cl-date"
                  type="date"
                  min={requestWindow.min}
                  max={requestWindow.max}
                  aria-describedby="cl-date-hint"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
                <p id="cl-date-hint" className="text-xs text-muted-foreground">{windowHint(requestWindow)}</p>
              </div>
              <TextareaField
                id="cl-reason"
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
        }
      />

      {offNote && <WorkflowOffNotice text={offNote} />}

      {ineligible && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="flex items-center gap-2 py-1 text-sm">
            <Info className="size-4 shrink-0" />
            {eligibilityQuery.data?.reason ?? months?.find((m) => m.reason)?.reason ?? 'You are not currently eligible for casual leave.'}
          </CardContent>
        </Card>
      )}

      <Card className="bg-accent/40">
        <CardContent className="py-1 text-sm text-muted-foreground">
          Approved casual leave days count as a paid present day on your attendance calendar; rejected requests are marked as unpaid leave.
        </CardContent>
      </Card>

      {listQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <RequestTabs
          liveItems={live}
          confirmedItems={confirmed}
          renderItem={renderItem}
          emptyLive={<EmptyState icon={CalendarClock} title="No pending casual leave requests" />}
          emptyConfirmed={<EmptyState icon={CalendarClock} title="No confirmed casual leave requests yet" />}
        />
      )}
    </div>
  )
}

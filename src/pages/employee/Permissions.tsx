import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, Plus, Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequestTabs } from '@/components/employee/RequestTabs'
import { TextareaField } from '@/components/employee/TextareaField'
import { TimePickerField } from '@/components/employee/TimePickerField'
import { PermissionOutcomeBadge } from '@/components/employee/StatusBadge'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { WorkflowOffNotice } from '@/components/employee/WorkflowOffNotice'
import { EmptyState } from '@/components/employee/EmptyState'
import { LateDeductionCard } from '@/components/employee/LateDeductionCard'
import { permissionApi, attendanceApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { ApiError } from '@/api/client'
import { pipelineSentence } from '@/lib/approval'
import { shiftPolicyOf } from '@/lib/attendance-flags'
import { checkRequestDate, getRequestWindow, windowHint } from '@/lib/request-window'
import { toDeductionPreview } from '@/lib/deductions'
import {
  PERMISSION_TYPES,
  permissionDurationLabel,
  permissionOutcome,
  permissionTypeKey,
  permissionTypeLabel,
  permissionTypeOption,
} from '@/lib/permissions'
import { cn } from '@/lib/utils'
import type { DeductionPreview, PermissionRequest, PermissionTypeKey } from '@/types'
import { format, isValid, parseISO } from 'date-fns'

interface PermissionForm {
  date: string
  permissionTime: string
  reason: string
  // Required: nothing is pre-selected so a wrong default can't slip through.
  type: PermissionTypeKey | ''
}

const EMPTY_FORM: PermissionForm = { date: '', permissionTime: '', reason: '', type: '' }

const NO_DEDUCTIONS: DeductionPreview = {
  permissionsUsed: 0,
  permissionOverageCount: 0,
  billableLateCount: 0,
  shiftDeductions: 0,
  salaryDeductionAmount: 0,
}

// The monthly limit counts pending + approved requests by the permission's own
// calendar month (rejected ones free the slot back up).
function usedInMonth(list: PermissionRequest[], year: number, month0: number) {
  return list.filter((r) => {
    const d = parseISO(r.date)
    return (
      d.getMonth() === month0 &&
      d.getFullYear() === year &&
      (r.status === 'pending' || r.status === 'approved')
    )
  }).length
}

export default function Permissions() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const now = new Date()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<PermissionForm>(EMPTY_FORM)
  const [formError, setFormError] = React.useState<string | null>(null)
  // The pipeline HR configured for permissions, and the note when HR has switched them off.
  const { workflow, offNote } = useApprovalWorkflow('permission')
  const pipeline = pipelineSentence(workflow)

  const listQuery = useQuery({
    queryKey: ['permissions', user?.employeeId],
    queryFn: () => permissionApi.list(user!.employeeId),
    enabled: !!user,
  })

  const statsQuery = useQuery({
    queryKey: ['shift-stats', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => attendanceApi.shiftStats(now.getMonth() + 1, now.getFullYear()),
  })

  const all = listQuery.data ?? []
  // Company rules from the shift stats (null on an older backend).
  const policy = statsQuery.data ? shiftPolicyOf(statsQuery.data) : null
  // No summary row yet still shows the card (all zeros), as this page always has.
  const deductions = statsQuery.data ? (toDeductionPreview(statsQuery.data) ?? { ...NO_DEDUCTIONS, policy }) : null

  // HR-configured cap on Allowed permissions per calendar month (default 3): the
  // stats policy first, then the cap every list item carries, then the summary's copy.
  const monthlyLimit =
    policy?.permissionMonthlyCap ?? all[0]?.monthlyLimit ?? statsQuery.data?.summary?.permissionMonthlyCap ?? 3
  // The backend only ever sends monthlyUsed on POST (create) responses — GET
  // list items always have it null — so count the month's requests ourselves
  // rather than trusting a list item.
  const monthlyUsed = usedInMonth(all, now.getFullYear(), now.getMonth())
  const excessThisMonth = all.filter((r) => {
    const d = parseISO(r.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && r.capStatus === 'excess'
  }).length
  // Reaching the limit never blocks a request (the backend accepts more): the
  // extra ones just become Overdue / Excess. So this only drives a warning.
  const capReached = monthlyUsed >= monthlyLimit

  // The dialog warns about the month of the date being requested, not just this one.
  const picked = form.date ? parseISO(form.date) : null
  const targetMonth = picked && isValid(picked) ? picked : now
  const targetUsed = usedInMonth(all, targetMonth.getFullYear(), targetMonth.getMonth())
  const targetOverLimit = targetUsed >= monthlyLimit
  const selectedType = permissionTypeOption(form.type || null)

  const applyMutation = useMutation({
    mutationFn: permissionApi.apply,
    onSuccess: (created) => {
      const pastLimit = created.monthlyUsed != null && created.monthlyUsed > (created.monthlyLimit ?? monthlyLimit)
      toast.success('Permission request submitted', {
        description: pastLimit
          ? 'You are past your monthly limit, so if approved it will be Overdue / Excess and will not protect that day.'
          : undefined,
      })
      qc.invalidateQueries({ queryKey: ['permissions', user?.employeeId] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: (err) => {
      // A 409 is a duplicate request for the same day and type: the server's own message says which.
      const message = err instanceof ApiError ? err.message : 'Could not submit permission request'
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
    const outside = checkRequestDate(form.date, new Date())
    if (outside) return setFormError(outside)
    if (!selectedType) return setFormError('Select a permission type.')
    if (!form.permissionTime) return setFormError(`${selectedType.timeLabel} is required.`)
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 200) return setFormError('Reason is too long (max 200 characters).')
    applyMutation.mutate({
      employeeId: user!.employeeId,
      date: form.date,
      permissionTime: form.permissionTime,
      reason: form.reason,
      type: selectedType.wire,
    })
  }

  const live = all.filter((r) => r.status === 'pending')
  const confirmed = all.filter((r) => r.status !== 'pending')
  // A persistent problem in the dialog beats a toast that fades: the server's / a validation error, else "switched off".
  const dialogError = formError ?? offNote
  // The dates an employee may request, from the clock as of this render (the server enforces the same window).
  const requestWindow = getRequestWindow(now)

  function renderItem(item: PermissionRequest) {
    const outcome = permissionOutcome(item)
    const effect = permissionTypeOption(permissionTypeKey(item))?.effect
    const duration = permissionDurationLabel(item.durationMinutes)
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
            <PermissionOutcomeBadge permission={item} />
          </div>
          <p className="text-sm font-medium">{permissionTypeLabel(item)}</p>
          <p className="text-sm text-muted-foreground">{[item.permissionTime, duration].filter(Boolean).join(' · ')}</p>
          <p className="text-sm">{item.reason}</p>
          <ApprovalTrail approval={item.approval} className="mt-1" />
          {outcome.kind === 'allowed' && effect && <p className="text-xs text-success">{effect}</p>}
          {outcome.kind === 'excess' && (
            <p className="text-xs text-orange-700 dark:text-orange-400">
              Beyond your monthly limit of {item.monthlyLimit ?? monthlyLimit}: it does not protect this day and
              counts toward late deductions.
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Permission"
        subtitle="One-hour permission requests and your monthly allowance"
        icon={<Timer />}
        actions={
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open)
              if (open) setFormError(null)
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={!!offNote}>
                <Plus /> Apply Permission
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Permission</DialogTitle>
              {pipeline && <DialogDescription>{pipeline}</DialogDescription>}
            </DialogHeader>
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label id="permission-type-label">Permission Type</Label>
                <div role="radiogroup" aria-labelledby="permission-type-label" className="flex flex-col gap-2">
                  {PERMISSION_TYPES.map((t) => {
                    const selected = form.type === t.key
                    return (
                      <button
                        key={t.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setForm((f) => ({ ...f, type: t.key }))}
                        className={cn(
                          'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                          selected ? 'border-primary bg-primary/15' : 'border-input hover:border-foreground/25',
                        )}
                      >
                        <span className="text-[13.5px] leading-tight font-semibold">{t.label}</span>
                        <span className="text-xs text-muted-foreground">{t.hint}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    min={requestWindow.min}
                    max={requestWindow.max}
                    aria-describedby="date-hint"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                  <p id="date-hint" className="text-xs text-muted-foreground">{windowHint(requestWindow)}</p>
                </div>
                <TimePickerField
                  label={selectedType?.timeLabel ?? 'Time'}
                  value={form.permissionTime}
                  onChange={(v) => setForm((f) => ({ ...f, permissionTime: v }))}
                />
              </div>
              <p className="text-sm">
                Duration <span className="font-medium">1 hour (60 min)</span>
                <span className="text-muted-foreground"> · fixed for every permission</span>
              </p>
              <TextareaField
                id="reason"
                label="Reason"
                rows={3}
                minLength={5}
                maxLength={200}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
              {targetOverLimit && (
                <p className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    You already have {targetUsed} of {monthlyLimit} permissions for {format(targetMonth, 'MMMM')}. You can
                    still apply, but a permission past the limit is Overdue / Excess: it does not protect the day and
                    counts toward late deductions.
                  </span>
                </p>
              )}
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

      <Card>
        <CardContent className="flex flex-col gap-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Permissions this month</span>
            <span className="text-sm text-muted-foreground">
              Used {monthlyUsed} of {monthlyLimit}
            </span>
          </div>
          <Progress value={monthlyLimit > 0 ? Math.min(100, (monthlyUsed / monthlyLimit) * 100) : 100} />
          {capReached && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Monthly limit reached. You can still apply, but further permissions this month will be Overdue / Excess.
              </span>
            </p>
          )}
          {excessThisMonth > 0 && (
            <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
              {excessThisMonth} Overdue / Excess this month
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Each permission is 1 hour (60 min). Only your first {monthlyLimit} approved permissions each month are
            Allowed. Any beyond that are Overdue / Excess: they do not protect the day and count toward late
            deductions.
          </p>
        </CardContent>
      </Card>

      {deductions && (
        <LateDeductionCard
          deductions={deductions}
          monthlyLimit={monthlyLimit}
          lateCount={statsQuery.data?.totalLateCount}
        />
      )}

      {listQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <RequestTabs
          liveItems={live}
          confirmedItems={confirmed}
          renderItem={renderItem}
          emptyLive={<EmptyState icon={Timer} title="No pending permission requests" />}
          emptyConfirmed={<EmptyState icon={Timer} title="No confirmed permission requests yet" />}
        />
      )}
    </div>
  )
}

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Send, Sun, Sunset } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequestTabs } from '@/components/employee/RequestTabs'
import { TextareaField } from '@/components/employee/TextareaField'
import { StatusBadge } from '@/components/employee/StatusBadge'
import { EmptyState } from '@/components/employee/EmptyState'
import { formatDateRange } from '@/components/employee/ApprovalCard'
import { leaveApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import type { HalfDaySlot, LeaveRequest, LeaveType } from '@/types'

// Backend has no leave types configured — use these until an admin sets some up.
// Mirrors the mobile app's FALLBACK_LEAVE_TYPES (src/hooks/useLeave.ts) so both
// clients degrade the same way.
const FALLBACK_LEAVE_TYPES: LeaveType[] = [
  { id: '1', name: 'Annual Leave' },
  { id: '2', name: 'Sick Leave' },
  { id: '3', name: 'Casual Leave' },
  { id: '4', name: 'Emergency Leave' },
  { id: '5', name: 'Maternity Leave' },
  { id: '6', name: 'Paternity Leave' },
]

const HALF_DAY_LABEL: Record<HalfDaySlot, string> = {
  morning: 'Morning (first half)',
  afternoon: 'Afternoon (second half)',
}

const EMPTY_FORM = {
  type: '',
  startDate: '',
  endDate: '',
  reason: '',
  isHalfDay: false,
  halfDaySlot: 'morning' as HalfDaySlot,
}

export default function Leave() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [formError, setFormError] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['leave-requests', user?.employeeId],
    queryFn: () => leaveApi.list(user!.employeeId),
    enabled: !!user,
  })

  const typesQuery = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const data = await leaveApi.types()
      return data.length > 0 ? data : FALLBACK_LEAVE_TYPES
    },
  })

  const applyMutation = useMutation({
    mutationFn: leaveApi.apply,
    onSuccess: () => {
      toast.success('Leave request submitted')
      qc.invalidateQueries({ queryKey: ['leave-requests', user?.employeeId] })
      setDialogOpen(false)
      setForm(EMPTY_FORM)
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit leave request'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.type) return setFormError('Leave type is required.')
    if (form.isHalfDay) {
      if (!form.startDate) return setFormError('Date is required.')
    } else {
      if (!form.startDate || !form.endDate) return setFormError('Start and end date are required.')
      if (form.endDate < form.startDate) return setFormError('End date must be on or after start date.')
    }
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 300) return setFormError('Reason is too long (max 300 characters).')
    // The backend rejects a half-day spanning more than one day, so send
    // the single date as both ends.
    applyMutation.mutate({
      employeeId: user!.employeeId,
      type: form.type,
      reason: form.reason,
      startDate: form.startDate,
      endDate: form.isHalfDay ? form.startDate : form.endDate,
      ...(form.isHalfDay ? { isHalfDay: true, halfDaySlot: form.halfDaySlot } : {}),
    })
  }

  const all = listQuery.data ?? []
  const live = all.filter((r) => r.status === 'pending')
  const confirmed = all.filter((r) => r.status !== 'pending')

  const totalDaysTaken = all.filter((r) => r.status === 'approved').reduce((sum, r) => sum + r.totalDays, 0)

  function renderItem(item: LeaveRequest) {
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{item.type}</span>
              <StatusBadge status={item.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDateRange(item.startDate, item.endDate)} ·{' '}
              {item.isHalfDay
                ? `Half day${item.halfDaySlot ? `, ${HALF_DAY_LABEL[item.halfDaySlot].toLowerCase()}` : ''}`
                : `${item.totalDays} day(s)`}
            </p>
            <p className="text-sm mt-1">{item.reason}</p>
            {item.hrComment && <p className="text-xs text-muted-foreground mt-1">HR: {item.hrComment}</p>}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Leave"
        subtitle="Apply, track, and review your leave requests"
        icon={<Send />}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus /> Apply Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Leave Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {(typesQuery.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.name}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Duration</Label>
                <div role="radiogroup" aria-label="Duration" className="grid grid-cols-2 gap-2">
                  {[
                    { half: false, label: 'Full day(s)' },
                    { half: true, label: 'Half day' },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      role="radio"
                      aria-checked={form.isHalfDay === o.half}
                      onClick={() => setForm((f) => ({ ...f, isHalfDay: o.half }))}
                      className={cn(
                        'font-label h-10 rounded-md border text-[13.5px] font-semibold transition-colors',
                        form.isHalfDay === o.half
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-input text-muted-foreground hover:border-foreground/25 hover:text-foreground',
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {form.isHalfDay ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="startDate">Date</Label>
                    <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Which half?</Label>
                    <div role="radiogroup" aria-label="Which half" className="grid grid-cols-2 gap-2">
                      {(['morning', 'afternoon'] as const).map((slot) => {
                        const Icon = slot === 'morning' ? Sun : Sunset
                        const selected = form.halfDaySlot === slot
                        return (
                          <button
                            key={slot}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setForm((f) => ({ ...f, halfDaySlot: slot }))}
                            className={cn(
                              'flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors',
                              selected ? 'border-primary bg-primary/15' : 'border-input hover:border-foreground/25',
                            )}
                          >
                            <Icon className={cn('size-4 shrink-0', selected ? 'text-brand-gold' : 'text-muted-foreground')} />
                            <span className="text-[13px] leading-tight font-medium">{HALF_DAY_LABEL[slot]}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input id="endDate" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
              )}
              <TextareaField
                id="reason"
                label="Reason"
                rows={3}
                minLength={5}
                maxLength={300}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <DialogFooter>
                <Button type="submit" variant="gradient" disabled={applyMutation.isPending}>
                  {applyMutation.isPending ? 'Submitting…' : 'Submit'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Total Taken</p>
            <p className="mt-1 text-xl font-bold">{totalDaysTaken}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Submitted</p>
            <p className="mt-1 text-xl font-bold">{all.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Approved</p>
            <p className="mt-1 text-xl font-bold text-success">{all.filter((r) => r.status === 'approved').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-1">
            <p className="text-muted-foreground text-xs">Rejected</p>
            <p className="mt-1 text-xl font-bold text-destructive">{all.filter((r) => r.status === 'rejected').length}</p>
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
          emptyLive={<EmptyState icon={Send} title="No pending leave requests" description="Requests you submit will show up here while awaiting a decision." />}
          emptyConfirmed={<EmptyState icon={Send} title="No confirmed leave requests yet" />}
        />
      )}
    </div>
  )
}

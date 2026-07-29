import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, CalendarClock, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequestTabs } from '@/components/employee/RequestTabs'
import { TextareaField } from '@/components/employee/TextareaField'
import { StatusBadge } from '@/components/employee/StatusBadge'
import { EmptyState } from '@/components/employee/EmptyState'
import { casualLeaveApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import type { CasualLeaveRequest } from '@/types'
import { format, parseISO } from 'date-fns'

export default function CasualLeave() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ date: '', reason: '' })
  const [formError, setFormError] = React.useState<string | null>(null)

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
      setDialogOpen(false)
      setForm({ date: '', reason: '' })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit casual leave request'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.date) return setFormError('Date is required.')
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 200) return setFormError('Reason is too long (max 200 characters).')
    applyMutation.mutate({ employeeId: user!.employeeId, ...form })
  }

  const all = listQuery.data ?? []
  const live = all.filter((r) => r.status === 'pending')
  const confirmed = all.filter((r) => r.status !== 'pending')
  const ineligible = eligibilityQuery.data && !eligibilityQuery.data.eligible

  function renderItem(item: CasualLeaveRequest) {
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm">{item.reason}</p>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-brand-blue hover:bg-white/90 shadow-clay" disabled={!!ineligible}>
                <Plus /> Apply Casual Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Casual Leave</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cl-date">Date</Label>
                <Input id="cl-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
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

      {ineligible && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="flex items-center gap-2 py-1 text-sm">
            <Info className="size-4 shrink-0" />
            {eligibilityQuery.data?.reason ?? 'You are not currently eligible for casual leave.'}
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

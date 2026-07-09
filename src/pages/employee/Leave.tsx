import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Send } from 'lucide-react'
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
import type { LeaveRequest } from '@/types'

export default function Leave() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ type: '', startDate: '', endDate: '', reason: '' })
  const [formError, setFormError] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['leave-requests', user?.employeeId],
    queryFn: () => leaveApi.list(user!.employeeId),
    enabled: !!user,
  })

  const typesQuery = useQuery({ queryKey: ['leave-types'], queryFn: leaveApi.types })

  const applyMutation = useMutation({
    mutationFn: leaveApi.apply,
    onSuccess: () => {
      toast.success('Leave request submitted')
      qc.invalidateQueries({ queryKey: ['leave-requests', user?.employeeId] })
      setDialogOpen(false)
      setForm({ type: '', startDate: '', endDate: '', reason: '' })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit leave request'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.type) return setFormError('Leave type is required.')
    if (!form.startDate || !form.endDate) return setFormError('Start and end date are required.')
    if (form.endDate < form.startDate) return setFormError('End date must be on or after start date.')
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 300) return setFormError('Reason is too long (max 300 characters).')
    applyMutation.mutate({ employeeId: user!.employeeId, ...form })
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
            <p className="text-sm text-muted-foreground">{formatDateRange(item.startDate, item.endDate)} · {item.totalDays} day(s)</p>
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
              <Button className="bg-white text-brand-blue hover:bg-white/90 shadow-clay">
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

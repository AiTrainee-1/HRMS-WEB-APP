import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Timer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequestTabs } from '@/components/employee/RequestTabs'
import { TextareaField } from '@/components/employee/TextareaField'
import { TimePickerField } from '@/components/employee/TimePickerField'
import { StatusBadge } from '@/components/employee/StatusBadge'
import { EmptyState } from '@/components/employee/EmptyState'
import { permissionApi, attendanceApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import type { PermissionRequest } from '@/types'
import { format, parseISO } from 'date-fns'

export default function Permissions() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const now = new Date()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ date: '', permissionTime: '', reason: '' })
  const [formError, setFormError] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['permissions', user?.employeeId],
    queryFn: () => permissionApi.list(user!.employeeId),
    enabled: !!user,
  })

  const statsQuery = useQuery({
    queryKey: ['shift-stats', now.getMonth() + 1, now.getFullYear()],
    queryFn: () => attendanceApi.shiftStats(now.getMonth() + 1, now.getFullYear()),
  })

  // The backend only ever sends monthlyUsed on POST (create) responses — GET
  // list items always have it null — so count the current calendar month's
  // pending+approved requests ourselves rather than trusting a list item.
  const monthlyLimit = 3
  const monthlyUsed = (listQuery.data ?? []).filter((r) => {
    const d = parseISO(r.date)
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear() &&
      (r.status === 'pending' || r.status === 'approved')
    )
  }).length
  const capReached = monthlyUsed >= monthlyLimit

  const applyMutation = useMutation({
    mutationFn: permissionApi.apply,
    onSuccess: () => {
      toast.success('Permission request submitted')
      qc.invalidateQueries({ queryKey: ['permissions', user?.employeeId] })
      setDialogOpen(false)
      setForm({ date: '', permissionTime: '', reason: '' })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit permission request'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.date) return setFormError('Date is required.')
    if (form.date < format(now, 'yyyy-MM-dd')) return setFormError('Date cannot be in the past.')
    if (!form.permissionTime) return setFormError('Time is required.')
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 200) return setFormError('Reason is too long (max 200 characters).')
    applyMutation.mutate({ employeeId: user!.employeeId, ...form })
  }

  const all = listQuery.data ?? []
  const live = all.filter((r) => r.status === 'pending')
  const confirmed = all.filter((r) => r.status !== 'pending')

  function renderItem(item: PermissionRequest) {
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-sm text-muted-foreground">{item.permissionTime}</p>
          <p className="text-sm">{item.reason}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Permission"
        subtitle="Hour-permission requests and monthly usage"
        icon={<Timer />}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-brand-blue hover:bg-white/90 shadow-clay" disabled={capReached}>
                <Plus /> Apply Permission
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply for Permission</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
                <TimePickerField label="Time" value={form.permissionTime} onChange={(v) => setForm((f) => ({ ...f, permissionTime: v }))} />
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

      <Card>
        <CardContent className="flex flex-col gap-2 py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Permissions used this month</span>
            <span className="text-sm text-muted-foreground">
              {monthlyUsed}/{monthlyLimit}
            </span>
          </div>
          <Progress value={(monthlyUsed / monthlyLimit) * 100} />
          {capReached && <p className="text-xs text-warning-foreground">Monthly limit reached</p>}
        </CardContent>
      </Card>

      {statsQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lateness & Deductions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-muted-foreground text-xs">Late Count</p>
              <p className="text-xl font-bold">{statsQuery.data.totalLateCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Shift Deductions</p>
              <p className="text-xl font-bold">{statsQuery.data.summary?.shiftDeductions ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Salary Deduction</p>
              <p className="text-xl font-bold">₹{statsQuery.data.summary?.salaryDeductionAmount ?? 0}</p>
            </div>
          </CardContent>
        </Card>
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

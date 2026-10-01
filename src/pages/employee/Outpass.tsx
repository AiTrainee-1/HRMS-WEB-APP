import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, DoorOpen, IdCard, Coffee } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { RequestTabs } from '@/components/employee/RequestTabs'
import { TextareaField } from '@/components/employee/TextareaField'
import { StatusBadge } from '@/components/employee/StatusBadge'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { WorkflowOffNotice } from '@/components/employee/WorkflowOffNotice'
import { EmptyState } from '@/components/employee/EmptyState'
import { OutpassFlipCard } from '@/components/employee/OutpassFlipCard'
import { TeaBreakPanel } from '@/components/employee/TeaBreakPanel'
import { outpassApi, employeeApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { ApiError } from '@/api/client'
import { pipelineSentence } from '@/lib/approval'
import type { OutpassRequest } from '@/types'

export default function Outpass() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [section, setSection] = React.useState<'outpass' | 'teaBreak'>('outpass')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({ destination: '', reason: '' })
  const [formError, setFormError] = React.useState<string | null>(null)
  const [previewItem, setPreviewItem] = React.useState<OutpassRequest | null>(null)
  // The pipeline HR configured for outpasses, and the note when HR has switched them off.
  const { workflow, offNote } = useApprovalWorkflow('outpass')
  const pipeline = pipelineSentence(workflow)

  const listQuery = useQuery({
    queryKey: ['outpass-requests', user?.employeeId],
    queryFn: outpassApi.list,
    enabled: !!user,
  })

  const employeeQuery = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
  })

  const applyMutation = useMutation({
    mutationFn: outpassApi.apply,
    onSuccess: () => {
      toast.success('Outpass request submitted')
      qc.invalidateQueries({ queryKey: ['outpass-requests', user?.employeeId] })
      setDialogOpen(false)
      setForm({ destination: '', reason: '' })
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not submit outpass request')
      refreshIfWorkflowOff(qc, err)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (form.destination.trim().length < 2) return setFormError('Please enter where you are going.')
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    applyMutation.mutate(form)
  }

  const all = listQuery.data ?? []
  const live = all.filter((r) => r.status === 'pending')
  const confirmed = all.filter((r) => r.status !== 'pending')
  // A persistent problem in the dialog beats a toast that fades: a validation error, else "switched off".
  const dialogError = formError ?? offNote
  // The most recent still-relevant approved request -source can be "manual"
  // or "on_duty" (an On-Duty request that just got its final approval,
  // see geo_attendance_views.py::_create_outpass_from_on_duty); either way it
  // shows here the same way, since both produce the same OutpassRequest shape.
  // Once exited but not yet returned, the card stays pinned here regardless
  // of the original approval window (expiresAt only bounds the EXIT leg) -
  // the employee may be out well past that 60-minute mark and still needs
  // "Generate Return QR" to be easy to find.
  const activePass = [...all]
    .filter((r) => {
      if (r.status !== 'approved') return false
      if (r.exitedAt && !r.enteredAt) return true
      return !!r.expiresAt && new Date(r.expiresAt).getTime() > Date.now()
    })
    .sort((a, b) => new Date(b.approvedAt ?? 0).getTime() - new Date(a.approvedAt ?? 0).getTime())[0]

  function renderItem(item: OutpassRequest) {
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{item.destination}</span>
            <StatusBadge status={item.status} approval={item.approval} />
            {item.source === 'on_duty' && (
              <span className="text-xs text-muted-foreground">(from On-Duty)</span>
            )}
          </div>
          <p className="text-sm">{item.reason}</p>
          {/* One step: the line below already names who approved. More: show each step. */}
          <ApprovalTrail approval={item.approval} multiStepOnly />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {format(parseISO(item.createdAt), 'MMM d, yyyy · h:mm a')}
              {item.approverRole && item.status === 'approved' && (
                <> · Approved by {item.approverRole === 'dept_head' ? 'HOD' : item.approverRole === 'hr' ? 'HR' : 'On-Duty approval'}</>
              )}
            </p>
            <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => setPreviewItem(item)}>
              <IdCard className="size-3.5" /> Preview
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={section === 'outpass' ? 'Outpass' : 'Tea Break'}
        subtitle={
          section === 'outpass'
            ? `Request permission to step out${pipeline ? `. ${pipeline}` : ''}`
            : 'Scan your permanent QR at the gate to record Out/In timings -no approval needed'
        }
        icon={section === 'outpass' ? <DoorOpen /> : <Coffee />}
        actions={
          section === 'outpass' ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!!offNote}>
                  <Plus /> Request Outpass
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request an Outpass</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="op-destination">Where are you going?</Label>
                    <Input
                      id="op-destination"
                      value={form.destination}
                      onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                    />
                  </div>
                  <TextareaField
                    id="op-reason"
                    label="Reason"
                    rows={3}
                    minLength={5}
                    maxLength={300}
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
          ) : undefined
        }
      />

      {/* "A new header tab under the Outpass section" -Outpass and Tea Break
          are two independent bodies sharing this one page, exactly like the
          HR portal's Outpass/Visitors/Tea Break sidebar group shares one
          page component. */}
      <Tabs value={section} onValueChange={(v) => setSection(v as 'outpass' | 'teaBreak')} className="w-full">
        <TabsList>
          <TabsTrigger value="outpass">Outpass</TabsTrigger>
          <TabsTrigger value="teaBreak">Tea Break</TabsTrigger>
        </TabsList>

        <TabsContent value="outpass" className="mt-4 flex flex-col gap-4">
          {offNote && <WorkflowOffNotice text={offNote} />}

          {activePass && <OutpassFlipCard request={activePass} employee={employeeQuery.data} />}

          {listQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <RequestTabs
              liveItems={live}
              confirmedItems={confirmed}
              renderItem={renderItem}
              emptyLive={<EmptyState icon={DoorOpen} title="No pending outpass requests" />}
              emptyConfirmed={<EmptyState icon={DoorOpen} title="No confirmed outpass requests yet" />}
            />
          )}
        </TabsContent>

        <TabsContent value="teaBreak" className="mt-4">
          <TeaBreakPanel />
        </TabsContent>
      </Tabs>

      {/* Outpass card preview -any request, any status, opened from its row */}
      <Dialog open={!!previewItem} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Outpass Card</DialogTitle>
          </DialogHeader>
          {previewItem && <OutpassFlipCard request={previewItem} employee={employeeQuery.data} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

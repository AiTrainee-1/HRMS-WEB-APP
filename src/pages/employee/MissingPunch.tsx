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
import { EmptyState } from '@/components/employee/EmptyState'
import { missingPunchApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import type { MissingPunchRequest, MissingPunchSlot } from '@/types'
import { format, parseISO } from 'date-fns'

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
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<{ date: string; punchTime: string; punchSlot: MissingPunchSlot; reason: string }>({
    date: '', punchTime: '', punchSlot: 'morning_in', reason: '',
  })
  const [formError, setFormError] = React.useState<string | null>(null)

  const listQuery = useQuery({
    queryKey: ['missing-punch', user?.employeeId],
    queryFn: () => missingPunchApi.list(user!.employeeId),
    enabled: !!user,
  })

  const applyMutation = useMutation({
    mutationFn: missingPunchApi.apply,
    onSuccess: () => {
      toast.success('Missing Punch request submitted', {
        description: 'Your Department Head will review it first, then HR gives the final approval.',
      })
      qc.invalidateQueries({ queryKey: ['missing-punch', user?.employeeId] })
      setDialogOpen(false)
      setForm({ date: '', punchTime: '', punchSlot: 'morning_in', reason: '' })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit request'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.date) return setFormError('Date is required.')
    if (form.date > format(now, 'yyyy-MM-dd')) return setFormError('Date cannot be in the future.')
    if (!form.punchTime) return setFormError('Time is required.')
    if (form.reason.trim().length < 5) return setFormError('Reason must be at least 5 characters.')
    if (form.reason.length > 200) return setFormError('Reason is too long (max 200 characters).')
    applyMutation.mutate({ employeeId: user!.employeeId, ...form })
  }

  const all = listQuery.data ?? []
  const live = all.filter((r) => r.status === 'pending_hod' || r.status === 'pending_hr')
  const confirmed = all.filter((r) => r.status === 'approved' || r.status === 'rejected')

  function renderItem(item: MissingPunchRequest) {
    return (
      <Card key={item.id}>
        <CardContent className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{format(parseISO(item.date), 'MMM d, yyyy')}</span>
            <Badge variant={STAGE_VARIANT[item.status] ?? 'secondary'}>{STAGE_LABEL[item.status] ?? item.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {item.punchSlot ? PUNCH_SLOT_LABEL[item.punchSlot] : (item.punchType === 'IN' ? 'Check-In' : 'Check-Out')} · {item.punchTime}
          </p>
          <p className="text-sm">{item.reason}</p>
          {item.hodReviewedBy && (
            <p className="text-xs text-muted-foreground">
              Department Head: {item.status === 'rejected' && !item.hrReviewedBy ? 'rejected' : 'approved'} by {item.hodReviewedBy}
            </p>
          )}
          {item.hrReviewedBy && (
            <p className="text-xs text-muted-foreground">
              HR: {item.status === 'rejected' ? 'rejected' : 'approved'} by {item.hrReviewedBy}
            </p>
          )}
          {item.status === 'approved' && (
            <p className="text-xs text-success-foreground">Added to your attendance.</p>
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-brand-blue hover:bg-white/90 shadow-clay">
                <Plus /> Report Missing Punch
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report a Missing Punch</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    <Input id="date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
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
        <CardContent className="flex items-start gap-2 py-3 text-sm text-muted-foreground">
          <p>
            Submit the date, time and reason for a punch you missed. Your <strong>Department Head</strong> reviews it
            first, then <strong>HR</strong> gives the final approval. Once approved, the punch is added to your
            attendance automatically.
          </p>
        </CardContent>
      </Card>

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

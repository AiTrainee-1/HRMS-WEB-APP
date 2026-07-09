import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, Circle, XCircle, AlertTriangle, FileSignature } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/employee/StatusBadge'
import { TextareaField } from '@/components/employee/TextareaField'
import { resignationApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { format, parseISO } from 'date-fns'

const SURVEY_QUESTIONS = [
  { key: 'surveyQ1Answer', label: 'What is your primary reason for leaving?' },
  { key: 'surveyQ2Answer', label: 'Would you recommend UKTextiles as a place to work?' },
  { key: 'surveyQ3Answer', label: 'Is there anything we could have done differently to retain you?' },
] as const

export default function Resignation() {
  const qc = useQueryClient()
  const [reason, setReason] = React.useState('')
  const [lastWorkingDay, setLastWorkingDay] = React.useState('')
  const [survey, setSurvey] = React.useState({ surveyQ1Answer: '', surveyQ2Answer: '', surveyQ3Answer: '' })
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['my-resignation'], queryFn: resignationApi.get })

  const submitMutation = useMutation({
    mutationFn: resignationApi.submit,
    onSuccess: () => {
      toast.success('Resignation submitted')
      qc.invalidateQueries({ queryKey: ['my-resignation'] })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit resignation'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!acknowledged) return setError('Please acknowledge the consequences of resigning before submitting.')
    if (reason.trim().length < 10) return setError('Please provide a reason of at least 10 characters.')
    if (!lastWorkingDay || lastWorkingDay < format(new Date(), 'yyyy-MM-dd')) return setError('Last working day must be today or later.')
    submitMutation.mutate({
      reason,
      lastWorkingDate: lastWorkingDay,
      surveyQ1Answer: survey.surveyQ1Answer.trim() || undefined,
      surveyQ2Answer: survey.surveyQ2Answer.trim() || undefined,
      surveyQ3Answer: survey.surveyQ3Answer.trim() || undefined,
    })
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />

  // The backend returns flat dept-head/HR stage fields, not a timeline array —
  // build the 3-stage timeline client-side from those.
  const timeline = data
    ? [
        {
          stage: 'Department Head Review',
          actor: data.deptHeadName ?? undefined,
          status: (data.deptHeadStatus as 'pending' | 'approved' | 'rejected' | undefined) ?? 'waiting',
          actedAt: data.deptHeadApprovedAt ?? undefined,
          comment: data.deptHeadComment ?? undefined,
        },
        {
          stage: 'HR Review',
          actor: data.approvedBy ?? data.rejectedBy ?? undefined,
          status:
            data.status === 'approved' ? 'approved' : data.status === 'rejected' && data.rejectedBy === 'hr' ? 'rejected' : 'waiting',
          actedAt: data.approvedAt ?? undefined,
          comment: data.hrComment ?? undefined,
        },
      ]
    : []

  const answeredSurvey = data
    ? SURVEY_QUESTIONS.filter((q) => !!data[q.key])
    : []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Resignation" subtitle="Submit and track your resignation request" icon={<FileSignature />} />

      {!data ? (
        <>
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex gap-3 py-2">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-semibold">Before you submit</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">
                  <li>This action starts a formal, two-stage review — first your Department Head, then HR.</li>
                  <li>You'll be able to track the status here, but you cannot withdraw the request yourself once submitted.</li>
                  <li>Your account is deactivated automatically once HR gives final approval.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submit Resignation</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lwd">Last Working Day</Label>
                  <Input id="lwd" type="date" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
                </div>
                <TextareaField
                  id="reason"
                  label="Reason"
                  rows={4}
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />

                <Separator />

                <div>
                  <p className="text-sm font-medium">Exit Survey <span className="font-normal text-muted-foreground">(optional)</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">Your feedback helps us improve — none of these are required.</p>
                </div>
                {SURVEY_QUESTIONS.map((q) => (
                  <TextareaField
                    key={q.key}
                    id={q.key}
                    label={q.label}
                    rows={2}
                    maxLength={400}
                    value={survey[q.key]}
                    onChange={(e) => setSurvey((s) => ({ ...s, [q.key]: e.target.value }))}
                  />
                ))}

                <Separator />

                <label className="flex items-start gap-2.5 text-sm">
                  <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" />
                  <span>I understand this starts a formal resignation review and cannot be withdrawn by me once submitted.</span>
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" variant="destructive" disabled={submitMutation.isPending || !acknowledged}>
                  {submitMutation.isPending ? 'Submitting…' : 'Submit Resignation'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Resignation Status</CardTitle>
              <StatusBadge status={data.status} />
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                <span className="text-muted-foreground">Last Working Day: </span>
                {data.lastWorkingDate ? format(parseISO(data.lastWorkingDate), 'MMM d, yyyy') : '—'}
              </p>
              <p className="mt-2 text-sm">{data.reason}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Approval Timeline</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {timeline.map((stage, i) => {
                const Icon = stage.status === 'approved' ? CheckCircle2 : stage.status === 'rejected' ? XCircle : Circle
                const color = stage.status === 'approved' ? 'text-success' : stage.status === 'rejected' ? 'text-destructive' : 'text-muted-foreground'
                return (
                  <div key={i} className="flex gap-3">
                    <Icon className={`size-5 shrink-0 ${color}`} />
                    <div>
                      <p className="text-sm font-medium">{stage.stage}</p>
                      {stage.actor && <p className="text-xs text-muted-foreground">{stage.actor}</p>}
                      {stage.actedAt && <p className="text-xs text-muted-foreground">{format(parseISO(stage.actedAt), 'MMM d, yyyy')}</p>}
                      {stage.comment && <p className="text-xs mt-1">{stage.comment}</p>}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {answeredSurvey.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Exit Survey Answers</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {answeredSurvey.map((q) => (
                  <div key={q.key}>
                    <p className="text-xs font-medium text-muted-foreground">{q.label}</p>
                    <p className="text-sm mt-0.5">{data[q.key]}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

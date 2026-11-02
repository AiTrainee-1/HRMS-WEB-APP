import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  AlertTriangle, BadgeCheck, CalendarClock, CheckCircle2, Circle, FileSignature, Info, MessageSquareText, Route, UserRoundCheck, Wallet,
  XCircle, type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ApprovalState, ErrorState, GlassCard, PageHero, PageShell, SectionHeader, SkeletonList, Stepper, StatusPill, Timeline,
  deciderFromFields, relativeTime,
} from '@/components/kit'
import { TextareaField } from '@/components/employee/TextareaField'
import { resignationApi } from '@/api/resources'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { MY_PENDING_KEY } from '@/hooks/useMyPendingRequests'
import { ApiError } from '@/api/client'
import { pipelineSentence, stepsAreReliable } from '@/lib/approval'
import { calendarDaysUntil } from '@/lib/home-attention'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

const SURVEY_QUESTIONS = [
  { key: 'surveyQ1Answer', label: 'What is your primary reason for leaving?' },
  { key: 'surveyQ2Answer', label: 'Would you recommend UKTextiles as a place to work?' },
  { key: 'surveyQ3Answer', label: 'Is there anything we could have done differently to retain you?' },
] as const

interface TimelineStage {
  stage: string
  actor?: string
  status: 'pending' | 'approved' | 'rejected' | 'waiting'
  actedAt?: string
  comment?: string
}

export default function Resignation() {
  const qc = useQueryClient()
  const [reason, setReason] = React.useState('')
  const [lastWorkingDay, setLastWorkingDay] = React.useState('')
  const [survey, setSurvey] = React.useState({ surveyQ1Answer: '', surveyQ2Answer: '', surveyQ3Answer: '' })
  const [acknowledged, setAcknowledged] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // The pipeline HR configured for resignations, and the note when HR has switched them off.
  const { workflow, offNote } = useApprovalWorkflow('resignation')
  const pipeline = pipelineSentence(workflow, 'resignation')

  const q = useQuery({ queryKey: ['my-resignation'], queryFn: resignationApi.get })
  const { data } = q

  const submitMutation = useMutation({
    mutationFn: resignationApi.submit,
    onSuccess: () => {
      toast.success('Resignation submitted')
      qc.invalidateQueries({ queryKey: ['my-resignation'] })
      qc.invalidateQueries({ queryKey: MY_PENDING_KEY })
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Could not submit resignation')
      refreshIfWorkflowOff(qc, err)
    },
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

  const hero = <PageHero icon={<FileSignature />} title="Resignation" subtitle="Send your resignation and follow every step of its review." />

  if (q.isPending) {
    return (
      <PageShell width="narrow">
        {hero}
        <SkeletonList variant="cards" count={2} />
      </PageShell>
    )
  }
  if (q.isError) {
    return (
      <PageShell width="narrow">
        {hero}
        <ErrorState error={q.error} what="your resignation" onRetry={() => q.refetch()} retrying={q.isFetching} />
      </PageShell>
    )
  }

  if (!data) {
    const done = [!!lastWorkingDay, reason.trim().length >= 10, acknowledged].filter(Boolean).length
    // Phones: the app's three-step bar (read -> fill in -> confirm), lit as the person goes.
    const steps = [true, !!lastWorkingDay && reason.trim().length >= 10, acknowledged]
    const warnings: { icon: LucideIcon; text: string }[] = [
      { icon: UserRoundCheck, text: `This starts a formal review.${pipeline ? ` ${pipeline}` : ''}` },
      { icon: BadgeCheck, text: 'Your account is switched off automatically once your resignation gets its final approval.' },
      { icon: XCircle, text: 'You can follow it here, but you cannot withdraw it yourself once it is sent.' },
      { icon: Wallet, text: 'Your final settlement and dues are processed after your last working day.' },
    ]
    // Phones: each field sits in its own white card with the app's round badge; its own label is kept for screen readers.
    const fieldCard =
      'max-md:flex max-md:flex-col max-md:gap-2.5 max-md:rounded-xl max-md:border max-md:border-border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)] max-md:[&_label]:sr-only'
    const badgeRow = (mark: string, title: string) => (
      <div aria-hidden="true" className="hidden max-md:flex max-md:items-start max-md:gap-2.5">
        <span className="max-md:mt-px max-md:grid max-md:size-7 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-primary max-md:text-[12px] max-md:font-black max-md:text-primary-foreground">
          {mark}
        </span>
        <span className="max-md:flex-1 max-md:text-[14px] max-md:leading-5 max-md:font-semibold max-md:text-foreground">{title}</span>
      </div>
    )
    return (
      // Phones (< 768px): the mobile app's resignation flow on one page (app/resignation/warning.tsx -> survey.tsx ->
      // confirm.tsx): the red "Before You Continue" header with the step bar, the warning cards, the note that nothing is
      // sent yet, then each question in its own card and the red Submit pill.
      <PageShell width="narrow" className="max-md:gap-3">
        <>
          <PageHero className="max-md:hidden" icon={<FileSignature />} title="Resignation" subtitle="Send your resignation and follow every step of its review." />
          <div className="hidden max-md:relative max-md:-mx-4 max-md:-mt-2 max-md:flex max-md:flex-col max-md:items-center max-md:gap-3.5 max-md:overflow-hidden max-md:bg-[linear-gradient(160deg,#B91C1C,#BE123C)] max-md:px-7 max-md:pt-8 max-md:pb-8 max-md:text-white">
            <span aria-hidden="true" className="max-md:pointer-events-none max-md:absolute max-md:-top-10 max-md:-right-10 max-md:size-[140px] max-md:rounded-full max-md:bg-white/7" />
            <span aria-hidden="true" className="max-md:grid max-md:size-20 max-md:place-items-center max-md:rounded-full max-md:border-2 max-md:border-white/30 max-md:bg-white/18">
              <AlertTriangle className="max-md:size-11" />
            </span>
            <h1 className="max-md:text-center max-md:font-[family-name:var(--font-display)] max-md:text-[24px] max-md:leading-8 max-md:font-bold max-md:tracking-[0.3px]">Before You Continue</h1>
            <p className="max-md:px-2 max-md:text-center max-md:text-[14px] max-md:leading-5 max-md:text-white/85">
              Sending a resignation is a serious step. Please read the following carefully.
            </p>
            <p className="max-md:mt-1.5 max-md:self-start max-md:text-[10.5px] max-md:font-[800] max-md:tracking-[0.6px] max-md:text-white/85">
              3 STEPS · READ · FILL IN · SUBMIT
            </p>
            <div className="max-md:flex max-md:w-full max-md:items-center max-md:gap-3.5" role="img" aria-label={`${steps.filter(Boolean).length} of 3 steps done`}>
              {steps.map((on, i) => (
                <span key={i} className={cn('max-md:h-1 max-md:flex-1 max-md:rounded-full', on ? 'max-md:bg-white' : 'max-md:bg-white/30')} />
              ))}
            </div>
          </div>
          <ul className="hidden max-md:mt-3 max-md:flex max-md:flex-col max-md:gap-3">
            {warnings.map((w) => (
              <li
                key={w.text}
                className="max-md:flex max-md:items-start max-md:gap-3.5 max-md:rounded-xl max-md:border-l-[3px] max-md:border-l-destructive max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]"
              >
                <span aria-hidden="true" className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-rejected-bg max-md:text-rejected">
                  <w.icon className="max-md:size-[22px]" />
                </span>
                <span className="max-md:flex-1 max-md:text-[14px] max-md:leading-5 max-md:text-secondary-foreground">{w.text}</span>
              </li>
            ))}
            <li className="max-md:flex max-md:items-start max-md:gap-2 max-md:rounded-xl max-md:bg-waiting-bg max-md:p-3.5 max-md:text-[12px] max-md:leading-[18px] max-md:font-semibold max-md:text-waiting">
              <Info className="max-md:mt-px max-md:size-[15px] max-md:shrink-0" aria-hidden="true" />
              Nothing is sent until you press Submit resignation at the bottom of this page.
            </li>
          </ul>
        </>

        {offNote && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-waiting-border bg-waiting-bg p-4 text-sm text-waiting">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {offNote}
          </div>
        )}

        <div className="flex gap-3 rounded-xl border border-rejected-border bg-rejected-bg/60 p-4 max-md:hidden">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rejected" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">Before you submit</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-foreground/80">
              <li>This starts a formal review.{pipeline && ` ${pipeline}`}</li>
              <li>You can follow it here, but you cannot withdraw it yourself once it is sent.</li>
              <li>Your account is switched off automatically after the final approval.</li>
            </ul>
          </div>
        </div>

        <GlassCard variant="raised" padding="lg" className="max-md:border-0! max-md:bg-transparent! max-md:bg-none! max-md:p-0! max-md:shadow-none!">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-md:gap-3">
            <SectionHeader
              className="max-md:hidden"
              as="h2"
              icon={FileSignature}
              title="Send your resignation"
              action={<StatusPill tone={done === 3 ? 'approved' : 'info'} icon={false} size="sm">{done} of 3 done</StatusPill>}
            />
            <div className={cn('flex flex-col gap-1.5', fieldCard)}>
              {badgeRow('D', 'Your last working day')}
              <Label htmlFor="lwd">Last working day</Label>
              <Input
                id="lwd"
                type="date"
                min={format(new Date(), 'yyyy-MM-dd')}
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
                className="sm:max-w-60"
              />
            </div>
            <div className={fieldCard}>
              {badgeRow('R', 'Your main reason for leaving')}
              <TextareaField id="reason" label="Reason" rows={4} minLength={10} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div className="border-t hairline pt-5 max-md:mt-1 max-md:border-0 max-md:px-1 max-md:pt-0">
              <p className="text-sm font-semibold">
                Exit survey <span className="font-normal text-muted-foreground">(optional)</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Your answers help us improve. None of these are required.</p>
            </div>
            {SURVEY_QUESTIONS.map((sq, i) => (
              <div key={sq.key} className={fieldCard}>
                {badgeRow(String(i + 1), sq.label)}
                <TextareaField
                  id={sq.key}
                  label={sq.label}
                  rows={2}
                  maxLength={400}
                  value={survey[sq.key]}
                  onChange={(e) => setSurvey((s) => ({ ...s, [sq.key]: e.target.value }))}
                />
              </div>
            ))}

            <label
              htmlFor="ack"
              className="flex items-start gap-3 rounded-lg border hairline bg-foreground/[0.03] p-3 text-sm max-md:rounded-xl max-md:border-rejected-border! max-md:bg-rejected-bg max-md:p-3.5 max-md:text-[13px] max-md:leading-[18px] max-md:font-semibold max-md:text-rejected"
            >
              <Checkbox id="ack" checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" />
              <span>I understand this starts a formal resignation review and cannot be withdrawn by me once submitted.</span>
            </label>

            {error && (
              <p className="text-sm font-medium text-rejected" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="destructive" size="lg" disabled={submitMutation.isPending || !acknowledged || !!offNote} className="min-h-11 max-md:mt-1 max-md:min-h-[52px] max-md:text-[15px] max-md:font-[800]">
              {submitMutation.isPending ? 'Submitting…' : 'Submit resignation'}
            </Button>
          </form>
        </GlassCard>
      </PageShell>
    )
  }

  // An older backend (or a request decided before the backend kept a trail) returns only flat dept-head / HR fields:
  // the two fixed stages are built from those, as before.
  const reliable = stepsAreReliable(data.approval)
  const fallback: TimelineStage[] = [
    {
      stage: 'Department Head review',
      actor: data.deptHeadName ?? undefined,
      status: (data.deptHeadStatus as 'pending' | 'approved' | 'rejected' | undefined) ?? 'waiting',
      actedAt: data.deptHeadApprovedAt ?? undefined,
      comment: data.deptHeadComment ?? undefined,
    },
    {
      stage: 'HR review',
      actor: data.approvedBy ?? data.rejectedBy ?? undefined,
      status: data.status === 'approved' ? 'approved' : data.status === 'rejected' && data.rejectedBy === 'hr' ? 'rejected' : 'waiting',
      actedAt: data.approvedAt ?? undefined,
      comment: data.hrComment ?? undefined,
    },
  ]
  const answeredSurvey = SURVEY_QUESTIONS.filter((sq) => !!data[sq.key])
  const daysLeft = calendarDaysUntil(data.lastWorkingDate, new Date())

  return (
    <PageShell width="narrow">
      {hero}

      <GlassCard variant="stitched" tone={data.status === 'rejected' ? 'rose' : data.status === 'approved' ? 'emerald' : 'amber'} padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-caps text-muted-foreground">Your resignation</p>
            <h2 className="font-display mt-1 text-2xl font-semibold">
              {data.status === 'approved' ? 'Approved' : data.status === 'rejected' ? 'Not approved' : 'Under review'}
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Sent {relativeTime(data.createdAt)}</p>
          </div>
          <ApprovalState
            approval={data.approval}
            status={data.status}
            pendingLabel="Waiting for a decision"
            fallback={deciderFromFields({ status: data.status, name: data.approvedBy ?? data.rejectedBy, at: data.approvedAt })}
          />
        </div>
        <div className="flex items-center gap-3 rounded-lg border hairline bg-foreground/[0.03] p-3">
          <CalendarClock className="size-5 shrink-0 text-info" aria-hidden="true" />
          <p className="text-sm">
            <span className="text-muted-foreground">Last working day: </span>
            <span className="font-semibold">{data.lastWorkingDate ? format(parseISO(data.lastWorkingDate), 'EEEE, d MMM yyyy') : 'Not given'}</span>
            {daysLeft != null && data.status !== 'rejected' && (
              <span className="text-muted-foreground"> · {daysLeft === 0 ? 'today or passed' : `in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}</span>
            )}
          </p>
        </div>
        <div>
          <p className="label-caps text-muted-foreground">Your reason</p>
          <p className="mt-1 text-sm whitespace-pre-line">{data.reason}</p>
        </div>
      </GlassCard>

      <GlassCard padding="lg" className="flex flex-col gap-4">
        <SectionHeader as="h2" icon={Route} title="Review steps" description="Who looks at it, in order, and what they decided." />
        {reliable ? (
          <Stepper approval={data.approval} sentAt={data.createdAt} orientation="vertical" />
        ) : (
          <Timeline
            ariaLabel="Review steps"
            items={fallback.map((s, i) => ({
              key: String(i),
              title: s.stage,
              time: s.actedAt ? format(parseISO(s.actedAt), 'd MMM yyyy') : undefined,
              description: [s.actor, s.status === 'waiting' || s.status === 'pending' ? 'Waiting for a decision' : s.status === 'approved' ? 'Approved' : 'Rejected', s.comment]
                .filter(Boolean)
                .join(' · '),
              icon: s.status === 'approved' ? CheckCircle2 : s.status === 'rejected' ? XCircle : Circle,
              tone: s.status === 'approved' ? 'emerald' : s.status === 'rejected' ? 'rose' : 'amber',
              current: s.status === 'waiting' || s.status === 'pending',
            }))}
          />
        )}
      </GlassCard>

      {answeredSurvey.length > 0 && (
        <GlassCard padding="lg" className="flex flex-col gap-4">
          <SectionHeader as="h2" icon={MessageSquareText} title="Your exit survey answers" />
          <dl className="flex flex-col gap-3">
            {answeredSurvey.map((sq) => (
              <div key={sq.key}>
                <dt className="text-xs font-semibold text-muted-foreground">{sq.label}</dt>
                <dd className="mt-0.5 text-sm">{data[sq.key]}</dd>
              </div>
            ))}
          </dl>
        </GlassCard>
      )}
    </PageShell>
  )
}

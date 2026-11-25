// On-Duty, redesigned (owner 2026-11-24). One simple page, mirroring the mobile app's components/onduty/OnDutyToday.tsx:
//
//   No On-Duty open:  the "Apply On-Duty" form (where are you going?) and, under it, the previous On-Duty requests.
//   One open:         its progress - where, since when, approval, the gate pass (its QR only after approval), the four
//                     named punches (Morning Punch, Lunch Out, Lunch In, Night Punch) each recordable on its own in any
//                     order, after the fourth the choice Complete Duty / Continue Duty (overtime) and then OT punches -
//                     and "End On-Duty" / "Complete Duty", which shows the whole day before it is closed.
//
// A new On-Duty can only be asked for once the open one is closed: the form is not offered while one is open, and the
// server refuses a second one anyway (409, backend geo_attendance_views.on_duty_session_request), whose sentence is shown.
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format, isValid, parseISO } from 'date-fns'
import { BadgeCheck, Briefcase, Camera, ClockPlus, Flag, Loader2, MapPin, Plus, RotateCcw, Send, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState, GlassCard, SkeletonList, StatusPill, Stepper } from '@/components/kit'
import { CameraCaptureDialog } from '@/components/employee/CameraCaptureDialog'
import { GatePassCard } from '@/components/employee/GatePassCard'
import { EndOnDutyDialog } from './EndOnDutyDialog'
import { PunchTiles } from './PunchTiles'
import { RecentOnDuty } from './RecentOnDuty'
import { employeeApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { useEndOnDuty, useOnDutyStatus, useRecordOnDutyPunch, useRecordOtPunch, useRequestOnDuty } from '@/hooks/useGeoAttendance'
import { useOnDutyRecords } from '@/hooks/useOnDutyRecords'
import { useNowTick } from '@/hooks/useOutpassRequests'
import { pipelineSentence, waitingText } from '@/lib/approval'
import { personFromEmployee } from '@/lib/gate-pass'
import { otRows, otSummary, overtimeStage } from '@/lib/onduty-overtime'
import { completePhotos, ON_DUTY_WEB_TRACKING_NOTE, punchErrorMessage, requiredPhotoCount } from '@/lib/onduty-photos'
import { buildPunchTiles, durationText, isOpenSession, type PunchTile } from '@/lib/onduty-punches'
import { cn } from '@/lib/utils'
import { isQueued } from '@/offline/submit'
import { useQueuedOps } from '@/offline/useOfflineStatus'
import { queuedOtCount, queuedPunchNumbers, withQueuedPunches } from '@/lib/onduty-queued'
import { Link } from 'wouter'
import { getCurrentFix, useLocationPrompt, type Fix } from '@/hooks/useLocationPrompt'
import { LocationOffPopup } from '@/components/system/LocationOffPopup'

const ON_DUTY_KINDS = ['onDuty.request', 'onDuty.punch', 'onDuty.otPunch', 'onDuty.end'] as const

// The position, and the "location is off / blocked" popup when there is none (owner 2026-11-25, hooks/useLocationPrompt).
const getPosition = getCurrentFix

const errMsg = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message || fallback : fallback)

const clockOf = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? format(d, 'h:mm a') : null
}

/** What is being captured: one of the four punches, or an overtime punch. */
type Target = { kind: 'punch'; tile: PunchTile } | { kind: 'ot'; sequence: number }

/** The photos taken, waiting for "Record punch". */
type Pending = { target: Target; photos: Blob[]; previews: string[]; fix: Fix }

// "Continue Duty" is remembered for the session in this tab, so a reload keeps the OT section open.
const continuedKey = (id: number) => `uktex-od-continued-${id}`
function readContinued(id: number | null): boolean {
  if (id == null) return false
  try {
    return sessionStorage.getItem(continuedKey(id)) === '1'
  } catch {
    return false
  }
}
function writeContinued(id: number) {
  try {
    sessionStorage.setItem(continuedKey(id), '1')
  } catch {
    // Storage blocked: the choice simply is not remembered over a reload.
  }
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">
        {n}
      </span>
      <span className="text-[13.5px] leading-5 text-foreground/85">{text}</span>
    </li>
  )
}

export function OnDutyToday({ onSeeRecords }: { onSeeRecords: () => void }) {
  const qc = useQueryClient()
  const { user } = useAuth()
  const now = useNowTick(30_000)
  const { data, isLoading, isError, error, refetch, isRefetching } = useOnDutyStatus()
  const requestMutation = useRequestOnDuty()
  const punchMutation = useRecordOnDutyPunch()
  const otMutation = useRecordOtPunch()
  const endMutation = useEndOnDuty()
  // The pipeline HR configured for On-Duty, and the note when HR has switched On-Duty requests off.
  const { workflow, offNote } = useApprovalWorkflow('on_duty')
  const employee = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
  })
  // The records list (first page, shared with "Previous On-Duty"): the distance of today's route when the mobile app
  // recorded one.
  const records = useOnDutyRecords(true, { poll: false })

  const session = data?.session ?? null
  const open = isOpenSession(session)
  const sessionId = open ? session!.id : null
  // Saved on this device while offline (owner 2026-11-24), not yet sent: shown as taken, so nothing is recorded twice.
  const queuedOps = useQueuedOps(ON_DUTY_KINDS)
  const tiles = withQueuedPunches(
    buildPunchTiles({
      slots: data?.punchSlots,
      verifications: open ? data?.punchVerifications : [],
      canPunch: open,
    }),
    queuedPunchNumbers(queuedOps, sessionId),
  )
  const queuedOt = queuedOtCount(queuedOps, sessionId)
  const waitingOps = queuedOps.filter((op) => op.status === 'pending')
  const requestQueued = waitingOps.some((op) => op.kind === 'onDuty.request')
  const doneCount = tiles.filter((t) => t.state !== 'open').length

  // ── overtime: after the four, Complete Duty or Continue Duty (then OT punches) ──
  const [continued, setContinued] = React.useState(() => readContinued(sessionId))
  React.useEffect(() => setContinued(readContinued(sessionId)), [sessionId])
  const [choiceOpen, setChoiceOpen] = React.useState(false)
  const otList = otRows(open ? data?.otPunches : [])
  const stage = overtimeStage({ allFourIn: doneCount === 4, open, continued, otCount: otList.length + queuedOt })
  const otText = otSummary(open ? data?.otMinutes : 0)
  const continueDuty = () => {
    setChoiceOpen(false)
    setContinued(true)
    if (sessionId != null) writeContinued(sessionId)
    toast.info('OT punches are on. Use "OT Punch" whenever you need to record one.')
  }

  // ── request ──
  const [destination, setDestination] = React.useState('')
  const [requestError, setRequestError] = React.useState<string | null>(null)
  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = destination.trim()
    if (value.length < 3) {
      setRequestError('Write where you are going (at least 3 letters).')
      return
    }
    setRequestError(null)
    try {
      const r = await requestMutation.mutateAsync(value)
      setDestination('')
      if (isQueued(r)) {
        toast.info('On-Duty request saved on this device', { description: 'It will be sent automatically when you are back online.' })
        return
      }
      const where = pipelineSentence(r.session?.approval ?? workflow, 'session')
      toast.success('On-Duty started. Your gate pass is ready.', {
        description: `Record your punches as you go. The QR on the gate pass appears once it is approved.${where ? ` ${where}` : ''}`,
      })
    } catch (err) {
      // 409: one is already open - the server's own sentence ("You already have an On-Duty session in progress").
      const message = errMsg(err, 'Could not submit the request.')
      setRequestError(message)
      toast.error(message)
      refreshIfWorkflowOff(qc, err)
      refetch()
    }
  }

  // ── capture one punch: location first (fails fast if blocked), then the selfie(s), then confirm ──
  const [target, setTarget] = React.useState<Target | null>(null)
  const [cameraOpen, setCameraOpen] = React.useState(false)
  const [locating, setLocating] = React.useState(false)
  const [pending, setPending] = React.useState<Pending | null>(null)
  // How many photos the punch being taken needs: read from the status when the punch begins and then kept, so a status
  // refresh (HR changing the policy) cannot change the camera under the employee's hands.
  const [photoCount, setPhotoCount] = React.useState(1)
  const fixRef = React.useRef<Fix | null>(null)
  const locationPrompt = useLocationPrompt()
  const requiredPhotos = requiredPhotoCount(data)

  const dropPending = () => setPending(null)
  // The previews' object URLs go with the photos they show (replaced, cancelled, sent, or the page left).
  React.useEffect(() => () => pending?.previews.forEach((u) => URL.revokeObjectURL(u)), [pending])

  const beginCapture = async (t: Target) => {
    setTarget(t)
    setLocating(true)
    try {
      fixRef.current = await getPosition()
      setPhotoCount(requiredPhotoCount(data))
      setCameraOpen(true)
    } catch (err) {
      // location off / blocked: the popup explains how to turn it on, with Try again; anything else is a toast
      if (!locationPrompt.offer(err, () => void beginCapture(t))) toast.error(errMsg(err, 'Could not get your location'))
      setTarget(null)
    } finally {
      setLocating(false)
    }
  }

  // `photos` are in order: the first goes as `photo`, the second (when HR's policy asks for two) as `photo2`. A punch
  // never goes out with fewer photos than the policy it was begun under asked for.
  const onPhotos = (photos: Blob[]) => {
    setCameraOpen(false)
    const all = completePhotos(photos, photoCount)
    if (!fixRef.current || !target || !all) {
      setTarget(null)
      return
    }
    setPending({ target, photos: all, previews: all.map((b) => URL.createObjectURL(b)), fix: fixRef.current })
  }

  const retake = () => {
    dropPending()
    setCameraOpen(true)
  }

  const cancelCapture = () => {
    dropPending()
    setTarget(null)
    fixRef.current = null
  }

  const confirmPunch = async () => {
    if (!pending) return
    const all = pending.photos
    const t = pending.target
    try {
      if (t.kind === 'ot') {
        const r = await otMutation.mutateAsync({ ...pending.fix, photo: all[0], photo2: all[1], sessionId, sequence: t.sequence })
        if (isQueued(r)) toast.info(`OT punch ${t.sequence} saved on this device`, { description: 'It will be sent automatically when you are back online.' })
        else toast.success(`OT punch ${r.otPunch?.sequence ?? t.sequence} recorded.`)
      } else {
        const wasLastOpen = tiles.filter((x) => x.state === 'open').length === 1
        const r = await punchMutation.mutateAsync({ ...pending.fix, photo: all[0], photo2: all[1], punchNumber: t.tile.punchNumber, sessionId, name: t.tile.name })
        if (isQueued(r)) {
          toast.info(`${t.tile.name} saved on this device`, { description: 'It will be sent automatically when you are back online.' })
          if (wasLastOpen) setChoiceOpen(true)
        } else if (r.sessionEnded) toast.success('All 4 punches are in. Your On-Duty has ended.')
        else toast.success(`${t.tile.name} recorded.`, { description: 'It counts once it is approved.' })
        // The 4th punch: ask Complete Duty or Continue Duty (overtime). An older server already closed the session.
        if (!isQueued(r) && !r.sessionEnded && (r.allPunchesIn ?? wasLastOpen)) setChoiceOpen(true)
      }
      cancelCapture()
    } catch (err) {
      // PHOTO2_REQUIRED (HR switched the policy to two photos after this page loaded) gets its own sentence; the refetch
      // then makes the next punch ask for both. 409 regular_punches_missing (OT before the four) is the server's sentence.
      toast.error(punchErrorMessage(err, 'Could not submit the punch'))
      cancelCapture()
      refetch()
    }
  }

  // ── end ──
  const [endOpen, setEndOpen] = React.useState(false)
  const confirmEnd = async () => {
    try {
      const r = await endMutation.mutateAsync(sessionId)
      setEndOpen(false)
      if (isQueued(r)) {
        toast.info('End of On-Duty saved on this device', { description: 'It will be sent automatically when you are back online.' })
        return
      }
      toast.success(r.alreadyEnded ? 'This On-Duty had already ended.' : 'On-Duty ended. You can apply for a new one any time.')
    } catch (err) {
      toast.error(errMsg(err, 'Could not end the On-Duty.'))
    }
  }

  if (isLoading) return <SkeletonList variant="cards" count={2} label="Loading your On-Duty" />
  if (isError && !data) return <ErrorState what="your On-Duty for today" error={error} onRetry={() => refetch()} retrying={isRefetching} />

  const startedAt = open ? (session!.createdAt ?? session!.startedAt) : null
  const approvalText = open
    ? session!.isProvisional || session!.approvalStatus !== 'active'
      ? (waitingText(session!.approval) ?? 'Waiting for approval')
      : 'Approved'
    : null
  const approved = open && !session!.isProvisional && session!.approvalStatus === 'active'
  const gatePass = open ? (data?.gatePass ?? null) : null
  const anyBusy = locating || cameraOpen || !!pending || punchMutation.isPending || otMutation.isPending || endMutation.isPending
  const distanceM = sessionId != null ? (records.data?.pages[0]?.items.find((r) => r.id === sessionId)?.journey?.distanceM ?? null) : null
  const pipeline = pipelineSentence(workflow, 'session')
  const busyNumber = target?.kind === 'punch' && (locating || punchMutation.isPending) ? target.tile.punchNumber : null
  const pendingTitle = pending ? (pending.target.kind === 'ot' ? `OT Punch ${pending.target.sequence}` : pending.target.tile.name) : ''
  const cameraTitle = target ? `${photoCount > 1 ? 'Selfies' : 'Selfie'} for ${target.kind === 'ot' ? `OT punch ${target.sequence}` : target.tile.name}` : undefined

  return (
    <div className="flex flex-col gap-5 max-md:gap-4">
      {waitingOps.length > 0 && (
        <Link
          href="/employee/sync"
          role="status"
          className="flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-[13px] text-sky-900 dark:text-sky-200"
        >
          <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Saved on this device, waiting to sync:</span> {waitingOps.map((op) => op.label).join(' · ')}.
            <span className="block text-[12px] opacity-80">They are sent automatically when you are back online. Open to see them.</span>
          </span>
        </Link>
      )}
      {open ? (
        <>
          {/* where / since when / approval / progress */}
          <section aria-label="On-Duty in progress" className="bg-brand-gradient flex flex-col gap-2 rounded-2xl p-5 text-white shadow-clay max-md:rounded-3xl max-md:p-[18px]">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2 shrink-0" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#4ADE80] opacity-60 motion-reduce:hidden" />
                <span className="relative size-2 rounded-full bg-[#4ADE80]" />
              </span>
              <span className="flex-1 text-[11px] font-extrabold tracking-[0.09em] text-white/80">ON-DUTY IN PROGRESS</span>
              <span className={cn('rounded-full px-3 py-1 text-[12px] font-bold', approved ? 'bg-white/20' : 'bg-[#FDE68A] text-[#92400E]')}>
                {approved ? 'Approved' : 'Waiting for approval'}
              </span>
            </div>
            <h2 className="font-display mt-1 text-[24px] leading-tight font-bold break-words max-md:text-[20px]">{session!.destination}</h2>
            <p className="text-[13px] text-white/90 tabular-nums">
              {startedAt ? `Started ${clockOf(startedAt) ?? 'today'} · ${durationText(now - Date.parse(startedAt))}` : 'Started today'}
              {session!.branchName ? ` · ${session!.branchName}` : ''}
            </p>
            <div
              role="progressbar"
              aria-label={`${doneCount} of 4 punches recorded`}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={doneCount}
              className="mt-2 flex gap-1.5"
            >
              {[1, 2, 3, 4].map((n) => (
                <span key={n} aria-hidden="true" className={cn('h-1.5 flex-1 rounded-full', n <= doneCount ? 'bg-white' : 'bg-white/25')} />
              ))}
            </div>
            <p className="text-[12.5px] text-white/85 tabular-nums">
              {doneCount} of 4 punches · {4 - doneCount} left
              {otList.length > 0 ? ` · ${otList.length} OT` : ''}
            </p>
          </section>

          {session!.isProvisional && (
            <p className="rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting">
              This does not hold you up: keep punching as normal. Punches count once the On-Duty is approved.
              {pipelineSentence(session!.approval ?? workflow, 'session') ? ` ${pipelineSentence(session!.approval ?? workflow, 'session')}` : ''}
            </p>
          )}

          <div className="grid gap-5 max-md:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-start">
            <div className="flex min-w-0 flex-col gap-5 max-md:gap-4">
              <GlassCard padding="lg" className="max-md:p-4!">
                <PunchTiles tiles={tiles} onSelect={(t) => beginCapture({ kind: 'punch', tile: t })} disabled={anyBusy} busyNumber={busyNumber} photos={requiredPhotos} />
              </GlassCard>

              {stage === 'choose' && (
                <GlassCard variant="stitched" tone="emerald" padding="lg" className="flex flex-col gap-3 max-md:p-4!">
                  <p className="flex items-center gap-2 font-display text-[17px] font-semibold">
                    <BadgeCheck className="size-5 text-approved" aria-hidden="true" /> All 4 punches are in
                  </p>
                  <p className="text-[13px] text-muted-foreground">Are you done for the day, or still working on-duty (overtime)?</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => setEndOpen(true)} className="sm:flex-1">
                      <Flag aria-hidden="true" /> Complete Duty
                    </Button>
                    <Button variant="outline" onClick={continueDuty} className="sm:flex-1">
                      <ClockPlus aria-hidden="true" /> Continue Duty (overtime)
                    </Button>
                  </div>
                </GlassCard>
              )}

              {stage === 'overtime' && (
                <GlassCard padding="lg" className="flex flex-col gap-3 max-md:p-4!">
                  <div className="flex items-center gap-2">
                    <ClockPlus className="size-5 text-waiting" aria-hidden="true" />
                    <h3 className="font-display flex-1 text-[17px] font-semibold">Overtime (OT) punches</h3>
                    <StatusPill tone="waiting" size="sm" dot={false}>
                      {otList.length}
                    </StatusPill>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground">
                    Record a punch for the extra work after your Night Punch. Each needs {requiredPhotos === 2 ? 'two selfies' : 'a selfie'} and your location.
                    OT punches do not change your attendance; they count for your overtime once the On-Duty is approved.
                  </p>
                  {otText && <p className="text-[13.5px] font-semibold text-waiting">OT so far: {otText}</p>}
                  {otList.length > 0 && (
                    <ul className="divide-y divide-[var(--glass-border)] rounded-lg border hairline">
                      {otList.map((row) => (
                        <li key={row.key} className="flex items-center gap-3 px-3 py-2">
                          <span className="rounded-md bg-waiting-bg px-2 py-0.5 text-[12px] font-bold text-waiting">OT {row.number}</span>
                          <span className="font-label w-20 text-[14px] font-semibold tabular-nums">{row.time ?? '—'}</span>
                          <StatusPill tone={row.state === 'approved' ? 'approved' : 'waiting'} size="sm" dot={false} className="ml-auto">
                            {row.label}
                          </StatusPill>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button onClick={() => beginCapture({ kind: 'ot', sequence: otList.length + queuedOt + 1 })} disabled={anyBusy} className="self-start max-md:w-full">
                    {target?.kind === 'ot' && (locating || otMutation.isPending) ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} OT Punch
                  </Button>
                </GlassCard>
              )}

              {session!.approval && (
                <GlassCard padding="lg" className="flex flex-col gap-3 max-md:p-4!">
                  <h3 className="font-display text-[17px] font-semibold">Approval</h3>
                  <div className="scrollbar-none overflow-x-auto">
                    <Stepper approval={session!.approval} sentAt={session!.createdAt} />
                  </div>
                </GlassCard>
              )}

              <div className="flex flex-col items-stretch gap-2 sm:items-end">
                <Button variant={stage === 'none' ? 'outline' : 'default'} onClick={() => setEndOpen(true)} disabled={anyBusy} className="max-md:w-full">
                  <Flag aria-hidden="true" /> {stage === 'none' ? 'End On-Duty' : 'Complete Duty'}
                </Button>
                <p className="text-[12px] text-muted-foreground sm:text-right">
                  End this On-Duty before you apply for a new one. If you do not, it ends by itself at the end of the day.
                </p>
              </div>
            </div>

            {gatePass ? (
              // Narrow screens: the pass comes first, under the hero (as in the mobile app).
              <section aria-labelledby="od-pass-title" className="flex min-w-0 flex-col gap-2 max-lg:order-first">
                <h3 id="od-pass-title" className="font-display text-[17px] font-semibold">
                  Your gate pass
                </h3>
                <GatePassCard
                  pass={gatePass}
                  compact
                  person={gatePass.employee ? null : personFromEmployee(employee.data)}
                  onRefresh={() => refetch()}
                  refreshing={isRefetching}
                />
              </section>
            ) : null}
          </div>
        </>
      ) : (
        <>
          {/* the request form: only when nothing is open */}
          <GlassCard variant="raised" padding="lg" asChild>
            <form onSubmit={submitRequest} className="flex flex-col gap-4 max-md:p-4!">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Briefcase className="size-5" />
                </span>
                <div>
                  <h2 className="font-display text-[22px] font-semibold max-md:text-[17px]">Apply On-Duty</h2>
                  <p className="text-[13px] text-muted-foreground">Official work outside the office today</p>
                </div>
              </div>
              <ol className="flex flex-col gap-2">
                <Step n={1} text="Write where you are going and submit." />
                <Step n={2} text="Your gate pass appears at once. Its QR comes as soon as the On-Duty is approved: show it at the gate." />
                <Step n={3} text="Record your four punches (Morning, Lunch Out, Lunch In, Night) in any order." />
                <Step n={4} text="End On-Duty when your work is done." />
              </ol>
              <p className="text-[12.5px] text-muted-foreground">
                Each punch needs {requiredPhotos === 2 ? 'two selfies' : 'a selfie'} and your location.{pipeline && !offNote ? ` ${pipeline}` : ''}
              </p>
              <p className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {ON_DUTY_WEB_TRACKING_NOTE}
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor="od-destination">Where are you going?</Label>
                <Textarea
                  id="od-destination"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value)
                    if (requestError) setRequestError(null)
                  }}
                  placeholder="e.g. ABC Textiles, Tiruppur — machine inspection"
                  maxLength={300}
                  rows={2}
                  aria-invalid={!!requestError}
                  aria-describedby={requestError ? 'od-request-error' : undefined}
                />
              </div>
              {requestError && (
                <p id="od-request-error" role="alert" className="rounded-lg border border-rejected-border bg-rejected-bg px-3 py-2 text-[13px] text-rejected">
                  {requestError}
                </p>
              )}
              {offNote && (
                <p role="status" className="rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting">
                  {offNote}
                </p>
              )}
              <Button type="submit" size="lg" disabled={!destination.trim() || requestMutation.isPending || !!offNote || requestQueued} className="self-start max-md:w-full max-md:self-stretch">
                {requestMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />} Start On-Duty
              </Button>
              {session?.approvalStatus === 'rejected' && (session.hodReviewComment || session.hrReviewComment) && (
                <p className="text-[13px] text-rejected">
                  Today's On-Duty to {session.destination} was rejected: {session.hrReviewComment || session.hodReviewComment}
                </p>
              )}
            </form>
          </GlassCard>

          <RecentOnDuty onSeeAll={onSeeRecords} />
        </>
      )}

      <LocationOffPopup prompt={locationPrompt.prompt} reason="on_duty" onClose={locationPrompt.close} />

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => {
          setCameraOpen(false)
          cancelCapture()
        }}
        onCapture={onPhotos}
        total={photoCount}
        title={cameraTitle}
      />

      {/* Confirm: the photo(s), where and when, then "Record punch". */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && !punchMutation.isPending && !otMutation.isPending && cancelCapture()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record {pendingTitle}?</DialogTitle>
            <DialogDescription>Check your {pending && pending.photos.length > 1 ? 'photos' : 'selfie'} and location, then confirm.</DialogDescription>
          </DialogHeader>
          {pending && (
            <>
              <div className={cn('grid gap-2', pending.previews.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {pending.previews.map((src, i) => (
                  <img key={src} src={src} alt={pending.previews.length > 1 ? `Photo ${i + 1}` : 'Your selfie'} className="aspect-[4/3] w-full rounded-lg bg-muted object-cover" />
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-2 text-[13px]">
                <div className="rounded-lg bg-foreground/[0.04] px-3 py-2">
                  <dt className="label-caps text-muted-foreground">Time</dt>
                  <dd className="font-semibold tabular-nums">{format(new Date(), 'h:mm a')}</dd>
                </div>
                <div className="rounded-lg bg-foreground/[0.04] px-3 py-2">
                  <dt className="label-caps text-muted-foreground">Location</dt>
                  <dd className="flex items-center gap-1 font-semibold">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {pending.fix.accuracy != null ? `Within ${Math.round(pending.fix.accuracy)} m` : 'Found'}
                  </dd>
                </div>
              </dl>
              {pending.target.kind === 'punch' && pending.target.tile.expected && (
                <p className="text-[12.5px] text-muted-foreground">
                  {pending.target.tile.name} is expected at {pending.target.tile.expected}
                  {pending.target.tile.kind === 'IN' ? ' (check-in)' : ' (check-out)'}.
                </p>
              )}
            </>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={retake} disabled={punchMutation.isPending || otMutation.isPending}>
              <RotateCcw aria-hidden="true" /> Retake
            </Button>
            <Button onClick={confirmPunch} disabled={punchMutation.isPending || otMutation.isPending}>
              {punchMutation.isPending || otMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />} Record punch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* After the 4th punch: Complete Duty, or Continue Duty with OT punches. */}
      <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center sm:text-center">
            <BadgeCheck className="size-10 text-approved" aria-hidden="true" />
            <DialogTitle>All 4 punches are in</DialogTitle>
            <DialogDescription>
              Are you done for the day? Choose Continue Duty if you are still working on-duty: you can then record OT punches for the overtime.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                setChoiceOpen(false)
                setEndOpen(true)
              }}
            >
              <Flag aria-hidden="true" /> Complete Duty
            </Button>
            <Button variant="outline" onClick={continueDuty}>
              <ClockPlus aria-hidden="true" /> Continue Duty (overtime)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {open && (
        <EndOnDutyDialog
          open={endOpen}
          onOpenChange={setEndOpen}
          onConfirm={confirmEnd}
          ending={endMutation.isPending}
          destination={session!.destination}
          startedAt={startedAt}
          approvalText={approvalText}
          tiles={tiles}
          distanceM={distanceM}
          now={now}
          otCount={otList.length}
          otText={otText}
        />
      )}
    </div>
  )
}

import * as React from 'react'
import { Link } from 'wouter'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import {
  Briefcase, Building2, Camera, CheckCircle2, Crosshair, Flag, Loader2, LocateFixed, MapPin,
  Navigation, Play, Radar, ShieldAlert, XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApprovalTrail } from '@/components/employee/ApprovalTrail'
import { CameraCaptureDialog } from '@/components/employee/CameraCaptureDialog'
import { SlideToConfirmPunch } from '@/components/employee/SlideToConfirmPunch'
import {
  useCompleteOnDuty, useGeoPunch, useGeoPunchPrecheck, useGeoPunchStatus, useOnDutyPunch,
  useOnDutyStatus, useStartOnDuty,
} from '@/hooks/useGeoAttendance'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { ApiError } from '@/api/client'
import { pipelineSentence, waitingText } from '@/lib/approval'
import { cn } from '@/lib/utils'
import type { GeoPunchPrecheckResult, OnDutySession, PunchSlot } from '@/types'

type Fix = { latitude: number; longitude: number; accuracy?: number; isMocked: boolean }

function getPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported on this device or browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isMocked: !!(pos as unknown as { mocked?: boolean }).mocked,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location access is blocked. Allow it in your browser's site settings, then try again."
              : 'Could not get your location. Move to an open area and try again.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}

const errMsg = (err: unknown, fallback: string) => (err instanceof ApiError || err instanceof Error ? err.message : fallback)

/** A session the employee is still working under (the backend's "punchable"). */
function isLive(s: OnDutySession | null | undefined): boolean {
  return !!s && !s.employeeEndedAt && ['pending_hod', 'pending_hr', 'active'].includes(s.approvalStatus)
}

// The labels a session's status alone can give: the older backend's fixed reading (HOD first, then HR). A session that
// carries its own `approval` block says who it is waiting for instead (see OnDuty below).
const approvalChip: Record<string, { label: string; cls: string }> = {
  pending_hod: { label: 'Awaiting HOD', cls: 'chip-warning' },
  pending_hr: { label: 'Awaiting HR', cls: 'chip-info' },
  active: { label: 'Approved', cls: 'chip-success' },
  completed: { label: 'Completed', cls: 'chip-muted' },
  rejected: { label: 'Rejected', cls: 'chip-danger' },
}

const slotChip: Record<string, { label: string; cls: string }> = {
  available: { label: 'Open', cls: 'chip-muted' },
  recorded: { label: 'Recorded', cls: 'chip-success' },
  approved: { label: 'Approved', cls: 'chip-success' },
  pending: { label: 'Pending HR', cls: 'chip-warning' },
}

function SlotTimeline({ slots, loading }: { slots: PunchSlot[] | undefined; loading?: boolean }) {
  if (loading) return <Skeleton className="h-56 w-full" />
  return (
    <ol className="relative flex flex-col gap-3">
      {(slots ?? []).map((s) => {
        const chip = slotChip[s.status] ?? { label: s.status, cls: 'chip-muted' }
        return (
          <li key={s.punchNumber} className="flex items-center gap-3 rounded-md bg-foreground/[0.04] p-3">
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-md font-label text-[13px] font-bold',
                s.available ? 'border border-dashed border-foreground/20 text-muted-foreground' : 'bg-success/15 text-success',
              )}
            >
              {s.available ? s.punchNumber : <CheckCircle2 className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Punch {s.punchNumber}</p>
              <p className="text-[12px] text-muted-foreground">{s.punchType === 'IN' ? 'Check-in' : 'Check-out'}</p>
            </div>
            <span className={cn('chip', chip.cls)}>{chip.label}</span>
          </li>
        )
      })}
      {!slots?.length && <p className="text-sm text-muted-foreground">No punch slots for today.</p>}
    </ol>
  )
}

// ─── Office Geo Punch ───────────────────────────────────────────────────────
function OfficePunch({ onDutyLive, onSwitch }: { onDutyLive: boolean; onSwitch: () => void }) {
  const precheck = useGeoPunchPrecheck()
  const punch = useGeoPunch()
  const status = useGeoPunchStatus()
  const [fix, setFix] = React.useState<Fix | null>(null)
  const [result, setResult] = React.useState<GeoPunchPrecheckResult | null>(null)
  const [locating, setLocating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<string | null>(null)

  const locate = async () => {
    setLocating(true)
    setError(null)
    setDone(null)
    try {
      const f = await getPosition()
      setFix(f)
      setResult(await precheck.mutateAsync({ latitude: f.latitude, longitude: f.longitude }))
    } catch (err) {
      setError(errMsg(err, 'Could not check your location.'))
    } finally {
      setLocating(false)
    }
  }

  const commit = async () => {
    if (!fix) return
    try {
      const r = await punch.mutateAsync(fix)
      if (r.status === 'rejected') {
        toast.error(r.message ?? 'You are outside the allowed company radius.')
        return
      }
      const msg =
        r.status === 'accepted'
          ? `${r.punchType === 'IN' ? 'Checked in' : 'Checked out'}${r.time ? ` at ${r.time}` : ''}`
          : 'This punch was already recorded.'
      toast.success(msg)
      setDone(msg)
      setResult(null)
      status.refetch()
    } catch (err) {
      toast.error(errMsg(err, 'Failed to record the punch'))
    }
  }

  if (onDutyLive) {
    return (
      <div className="glass-raised flex flex-col items-center gap-3 rounded-lg px-6 py-12 text-center">
        <ShieldAlert className="size-9 text-brand-gold" />
        <p className="font-display text-xl font-semibold">You're On-Duty today</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Office geo punch is locked while an On-Duty session is running. Record your punches from the On-Duty tab, or mark the session done first.
        </p>
        <Button onClick={onSwitch} className="mt-2">
          <Briefcase /> Go to On-Duty
        </Button>
      </div>
    )
  }

  const next = status.data?.nextPunchType

  return (
    <div className="glass-raised overflow-hidden rounded-lg">
      {/* Radar visual */}
      <div className="relative grid h-56 place-items-center overflow-hidden border-b hairline bg-[radial-gradient(circle_at_center,rgb(37_99_235/0.18),transparent_65%)]">
        {[1, 2, 3].map((r) => (
          <span
            key={r}
            className="absolute rounded-full border border-primary/25"
            style={{ width: `${r * 70}px`, height: `${r * 70}px` }}
          />
        ))}
        <span
          className={cn(
            'relative grid size-16 place-items-center rounded-full',
            result ? (result.insideRadius ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive') : 'bg-primary/20 text-brand-blue',
          )}
        >
          {locating ? <Loader2 className="size-7 animate-spin" /> : result ? (result.insideRadius ? <LocateFixed className="size-7" /> : <Crosshair className="size-7" />) : <Radar className="size-7" />}
        </span>
        <p className="label-caps absolute bottom-4 text-muted-foreground">
          {result ? `${result.distanceM} m from ${result.branchName} • allowed ${result.radiusM} m` : 'Geo-fence verification'}
        </p>
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        {done && (
          <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-success">
            <CheckCircle2 className="size-5 shrink-0" />
            <p className="text-sm font-semibold">{done}</p>
          </div>
        )}

        {!result ? (
          <>
            <div>
              <h3 className="font-display text-[22px] font-semibold">Office check-in</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                At your branch? We'll confirm you're inside the allowed radius, then you can punch instantly. No photos needed.
                {next && (
                  <>
                    {' '}Your next punch is a <span className="font-semibold text-foreground">{next === 'IN' ? 'check-in' : 'check-out'}</span>.
                  </>
                )}
              </p>
            </div>
            {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button size="lg" onClick={locate} disabled={locating} className="self-start">
              {locating ? <Loader2 className="animate-spin" /> : <Navigation />}
              {locating ? 'Checking location…' : 'Verify my location'}
            </Button>
          </>
        ) : (
          <>
            <div
              className={cn(
                'flex items-start gap-3 rounded-md border px-4 py-3',
                result.insideRadius ? 'border-success/30 bg-success/10 text-success' : 'border-destructive/30 bg-destructive/10 text-destructive',
              )}
            >
              {result.insideRadius ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <XCircle className="mt-0.5 size-5 shrink-0" />}
              <p className="text-sm font-medium">{result.message}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Branch', result.branchName],
                ['Distance', `${result.distanceM} m`],
                ['Allowed', `${result.radiusM} m`],
                ['Punch', result.nextPunchNumber ? `#${result.nextPunchNumber} ${result.nextPunchType === 'IN' ? 'In' : 'Out'}` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md bg-foreground/[0.04] px-3 py-2.5">
                  <dt className="label-caps text-muted-foreground">{k}</dt>
                  <dd className="mt-1 truncate text-[14px] font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {result.insideRadius ? (
              <SlideToConfirmPunch
                label={`Slide to ${result.nextPunchType === 'OUT' ? 'punch out' : 'punch in'}`}
                subLabel={punch.isPending ? 'Recording your punch…' : `${result.distanceM} m from ${result.branchName}`}
                onCommit={commit}
                pending={punch.isPending}
              />
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={locate} disabled={locating} className="flex-1">
                  {locating ? <Loader2 className="animate-spin" /> : <MapPin />} Re-check location
                </Button>
                <Button onClick={onSwitch} className="flex-1">
                  <Briefcase /> Working off-site? Start On-Duty
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── On-Duty session ────────────────────────────────────────────────────────
function OnDuty() {
  const { data, isLoading, refetch } = useOnDutyStatus()
  const start = useStartOnDuty()
  const punch = useOnDutyPunch()
  const complete = useCompleteOnDuty()
  const qc = useQueryClient()
  // The pipeline HR configured for On-Duty, and the note when HR has switched On-Duty requests off.
  const { workflow, offNote } = useApprovalWorkflow('on_duty')
  const [destination, setDestination] = React.useState('')
  const [pendingSlot, setPendingSlot] = React.useState<number | null>(null)
  const [cameraOpen, setCameraOpen] = React.useState(false)
  const fixRef = React.useRef<Fix | null>(null)
  const [locating, setLocating] = React.useState<number | null>(null)

  const session = data?.session ?? null
  const live = isLive(session)
  const liveSession = live ? session! : null

  const startSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return
    try {
      const r = await start.mutateAsync(destination.trim())
      // The server's own message always names HR; with the session's pipeline on hand say where it really goes.
      const where = pipelineSentence(r.session.approval, 'session')
      toast.success('On-Duty session started', { description: where ? `You can begin punching. ${where}` : r.message })
      setDestination('')
    } catch (err) {
      toast.error(errMsg(err, 'Could not start the session'))
      refreshIfWorkflowOff(qc, err)
    }
  }

  // Location first (fails fast if blocked), then the selfie, then submit.
  const beginPunch = async (slot: number) => {
    setLocating(slot)
    try {
      fixRef.current = await getPosition()
      setPendingSlot(slot)
      setCameraOpen(true)
    } catch (err) {
      toast.error(errMsg(err, 'Could not get your location'))
    } finally {
      setLocating(null)
    }
  }

  const submitPunch = async (photo: Blob) => {
    setCameraOpen(false)
    if (!fixRef.current || pendingSlot == null) return
    try {
      const r = await punch.mutateAsync({ ...fixRef.current, photo, punchNumber: pendingSlot })
      toast.success(`Punch ${r.punchNumber} (${r.punchType}) submitted`, {
        description: r.sessionEnded ? 'All 4 punches are in, so your session has ended for today.' : 'It counts once HR approves it.',
      })
    } catch (err) {
      toast.error(errMsg(err, 'Could not submit the punch'))
    } finally {
      setPendingSlot(null)
      fixRef.current = null
      refetch()
    }
  }

  const endSession = async () => {
    try {
      await complete.mutateAsync()
      toast.success('On-Duty session marked done')
    } catch (err) {
      toast.error(errMsg(err, 'Could not end the session'))
    }
  }

  if (isLoading) return <Skeleton className="h-72 w-full rounded-lg" />

  const slots = data?.punchSlots ?? []
  const baseChip = session ? approvalChip[session.approvalStatus] ?? { label: session.approvalStatus, cls: 'chip-muted' } : null
  // While the session waits on the pipeline, say who it waits for (the status alone only knows the old fixed order).
  const chip = baseChip && { ...baseChip, label: waitingText(session?.approval) ?? baseChip.label }
  const pipeline = pipelineSentence(session?.approval ?? workflow, 'session')

  return (
    <div className="flex flex-col gap-5">
      {liveSession ? (
        <div className="glass-raised rounded-lg p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label-caps flex items-center gap-2 text-brand-emerald">
                <span className="pip pip-live" /> On-Duty session live
              </p>
              <h3 className="font-display mt-2 text-[24px] font-semibold">{liveSession.destination}</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Started {liveSession.createdAt ? formatDistanceToNowStrict(parseISO(liveSession.createdAt), { addSuffix: true }) : 'today'}
                {liveSession.branchName ? ` • ${liveSession.branchName}` : ''}
              </p>
            </div>
            {chip && <span className={cn('chip', chip.cls)}><span className="pip" /> {chip.label}</span>}
          </div>
          {liveSession.isProvisional && (
            <p className="mt-4 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[13px] text-brand-gold">
              You can punch right away. Punches count once the session is approved.{pipeline && ` ${pipeline}`}
            </p>
          )}
          <ApprovalTrail approval={liveSession.approval} className="mt-3" />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {slots.map((s) => {
              const c = slotChip[s.status] ?? { label: s.status, cls: 'chip-muted' }
              return (
                <div key={s.punchNumber} className="flex items-center gap-3 rounded-md border hairline bg-foreground/[0.03] p-4">
                  <div className="min-w-0 flex-1">
                    <p className="label-caps text-muted-foreground">Punch {s.punchNumber}</p>
                    <p className="mt-1 text-[16px] font-semibold">{s.punchType === 'IN' ? 'Check-in' : 'Check-out'}</p>
                  </div>
                  {s.available ? (
                    <Button size="sm" onClick={() => beginPunch(s.punchNumber)} disabled={locating != null || punch.isPending}>
                      {locating === s.punchNumber || (punch.isPending && pendingSlot === s.punchNumber) ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Camera />
                      )}
                      Punch
                    </Button>
                  ) : (
                    <span className={cn('chip', c.cls)}>{c.label}</span>
                  )}
                </div>
              )
            })}
          </div>

          {(data?.punchVerifications.length ?? 0) > 0 && (
            <div className="mt-5">
              <p className="label-caps mb-2 text-muted-foreground">Submitted from the field</p>
              <ul className="divide-y divide-[var(--glass-border)] rounded-md border hairline">
                {data!.punchVerifications.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
                    <span className="font-label w-16 font-semibold tabular-nums">{v.punchTime.slice(0, 5)}</span>
                    <span className="flex-1">
                      Punch {v.punchNumber} • {v.punchType === 'IN' ? 'In' : 'Out'}
                      {v.accuracyM != null && <span className="text-muted-foreground"> • ±{Math.round(v.accuracyM)} m</span>}
                    </span>
                    <span className={cn('chip', v.status === 'approved' ? 'chip-success' : v.status === 'rejected' ? 'chip-danger' : 'chip-warning')}>
                      {v.status === 'pending' ? 'Pending HR' : v.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex justify-end border-t hairline pt-4">
            <Button variant="outline" onClick={endSession} disabled={complete.isPending}>
              {complete.isPending ? <Loader2 className="animate-spin" /> : <Flag />} Mark day done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={startSession} className="glass-raised flex flex-col gap-4 rounded-lg p-5 sm:p-6">
          <div>
            <h3 className="font-display text-[22px] font-semibold">Start an On-Duty session</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Working off-site today, like a client visit, supplier mill or field travel? Start a session and punch from wherever you are. Each punch
              needs a selfie and your location.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="od-destination">Destination</Label>
            <Input
              id="od-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. ABC Spinning Mills, Tirupur"
              maxLength={200}
            />
          </div>
          {offNote && (
            <p role="status" className="rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[13px] text-brand-gold">
              {offNote}
            </p>
          )}
          <Button type="submit" size="lg" disabled={!destination.trim() || start.isPending || !!offNote} className="self-start">
            {start.isPending ? <Loader2 className="animate-spin" /> : <Play />} Start session
          </Button>
          {session && chip && (
            <div className="flex items-center gap-3 rounded-md bg-foreground/[0.04] px-4 py-3 text-[13.5px]">
              <span className="text-muted-foreground">Today's last session:</span>
              <span className="font-semibold">{session.destination}</span>
              <span className={cn('chip ml-auto', chip.cls)}>{chip.label}</span>
            </div>
          )}
          {session?.approvalStatus === 'rejected' && (session.hodReviewComment || session.hrReviewComment) && (
            <p className="text-[13px] text-destructive">Reason: {session.hrReviewComment || session.hodReviewComment}</p>
          )}
        </form>
      )}

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => {
          setCameraOpen(false)
          setPendingSlot(null)
        }}
        onCapture={submitPunch}
        title={pendingSlot ? `Selfie for punch ${pendingSlot}` : undefined}
      />
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function AttendanceRequest() {
  const geo = useGeoPunchStatus()
  const onDutyLive = isLive(geo.data?.onDutySession)
  const [tab, setTab] = React.useState<'office' | 'onduty'>('office')

  // Land on the On-Duty tab when a session is already running.
  const initialised = React.useRef(false)
  React.useEffect(() => {
    if (!initialised.current && geo.data) {
      initialised.current = true
      if (isLive(geo.data.onDutySession)) setTab('onduty')
    }
  }, [geo.data])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="HR & Workflows • Security & geo-fence"
        title="Geo Punch & On-Duty"
        subtitle="Punch from inside your branch's geo-fence, or run an On-Duty session when you're working off-site."
        icon={<MapPin />}
        actions={
          <Button variant="outline" asChild>
            <Link href="/employee/attendance">
              <Building2 /> Attendance calendar
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'office' | 'onduty')} className="flex min-w-0 flex-col gap-4">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="office">
              <Building2 /> Office geo punch
            </TabsTrigger>
            <TabsTrigger value="onduty">
              <Briefcase /> On-Duty {onDutyLive && <span className="pip pip-live text-success" />}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="office">
            <OfficePunch onDutyLive={onDutyLive} onSwitch={() => setTab('onduty')} />
          </TabsContent>
          <TabsContent value="onduty">
            <OnDuty />
          </TabsContent>
        </Tabs>

        <aside className="flex flex-col gap-6">
          <section className="glass-raised rounded-lg p-5">
            <h3 className="font-display text-[19px] font-semibold">Today's punch slots</h3>
            <p className="mt-1 mb-4 text-[12.5px] text-muted-foreground">Up to 4 punches a day: in, out, in, out.</p>
            <SlotTimeline slots={geo.data?.punchSlots} loading={geo.isLoading} />
          </section>
          <section className="glass-raised rounded-lg p-5">
            <h3 className="font-display text-[19px] font-semibold">Recorded today</h3>
            {geo.isLoading ? (
              <Skeleton className="mt-4 h-20 w-full" />
            ) : (geo.data?.punches.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No punches recorded yet today.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {geo.data!.punches.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 text-[13.5px]">
                    <span className={cn('pip', p.punchType === 'IN' ? 'text-success' : 'text-brand-blue')} />
                    <span className="font-label w-14 font-semibold tabular-nums">{p.punchTime.slice(0, 5)}</span>
                    <span className="flex-1 text-muted-foreground">{p.sourceLabel}</span>
                    <span className="label-caps">{p.punchType}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

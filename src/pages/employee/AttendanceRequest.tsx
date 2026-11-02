import * as React from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'
import {
  Briefcase, Building2, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Crosshair, Flag, Loader2,
  LocateFixed, LogIn, LogOut, MapPin, MapPinned, Navigation, Play, Radar, ShieldAlert, Smartphone, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ApprovalState, GlassCard, PageHero, PageShell, SectionHeader, SegmentedControl, SkeletonList, StatusPill, Stepper,
  SuccessCheck, Timeline, fadeIn, listItem, type StatusTone,
} from '@/components/kit'
import { CameraCaptureDialog } from '@/components/employee/CameraCaptureDialog'
import { MonthYearPicker } from '@/components/employee/MonthYearPicker'
import { SlideToConfirmPunch } from '@/components/employee/SlideToConfirmPunch'
import { OnDutyRecords } from '@/components/onduty/OnDutyRecords'
import { monthPickerProps } from '@/components/requests/month-picker'
import {
  useCompleteOnDuty, useGeoPunch, useGeoPunchPrecheck, useGeoPunchStatus, useOnDutyPunch,
  useOnDutyStatus, useStartOnDuty,
} from '@/hooks/useGeoAttendance'
import { refreshIfWorkflowOff, useApprovalWorkflow } from '@/hooks/useApprovalSummary'
import { ON_DUTY_RECORDS_KEY } from '@/hooks/useOnDutyRecords'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { ApiError } from '@/api/client'
import { pipelineSentence, waitingText } from '@/lib/approval'
import { readFocusParams } from '@/lib/focus-item'
import { monthOf } from '@/lib/month-switch'
import { completePhotos, ON_DUTY_WEB_TRACKING_NOTE, punchErrorMessage, requiredPhotoCount } from '@/lib/onduty-photos'
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

// What a session's status alone can say (an older backend's fixed reading). A session that carries its own `approval`
// block says who it is waiting for instead (see OnDuty below).
const SESSION_STATE: Record<string, { label: string; tone: StatusTone }> = {
  pending_hod: { label: 'Waiting for Department Head', tone: 'waiting' },
  pending_hr: { label: 'Waiting for HR', tone: 'waiting' },
  active: { label: 'Approved', tone: 'approved' },
  completed: { label: 'Completed', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'rejected' },
}

const SLOT_STATE: Record<string, { label: string; tone: StatusTone }> = {
  available: { label: 'Open', tone: 'neutral' },
  recorded: { label: 'Recorded', tone: 'approved' },
  approved: { label: 'Approved', tone: 'approved' },
  pending: { label: 'Waiting for HR', tone: 'waiting' },
}

const PUNCH_STATE: Record<string, { label: string; tone: StatusTone }> = {
  approved: { label: 'Approved', tone: 'approved' },
  rejected: { label: 'Rejected', tone: 'rejected' },
  pending: { label: 'Waiting for HR', tone: 'waiting' },
}

/** The day's four punch slots: in, out, in, out. */
function SlotList({ slots, loading }: { slots: PunchSlot[] | undefined; loading?: boolean }) {
  if (loading) return <SkeletonList variant="rows" count={4} label="Loading today's punch slots" />
  if (!slots?.length) return <p className="text-sm text-muted-foreground">No punch slots for today.</p>
  return (
    <ol className="flex flex-col gap-2">
      {slots.map((s, i) => {
        const st = SLOT_STATE[s.status] ?? { label: s.status, tone: 'neutral' as StatusTone }
        return (
          <motion.li key={s.punchNumber} {...listItem(i)} className="flex items-center gap-3 rounded-lg bg-foreground/[0.04] p-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg font-label text-[13px] font-bold',
                s.available ? 'border border-dashed border-foreground/20 text-muted-foreground' : 'border border-approved-border bg-approved-bg text-approved',
              )}
            >
              {s.available ? s.punchNumber : <CheckCircle2 className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">Punch {s.punchNumber}</p>
              <p className="text-[12px] text-muted-foreground">{s.punchType === 'IN' ? 'Check-in' : 'Check-out'}</p>
            </div>
            <StatusPill tone={st.tone} size="sm" dot={false}>
              {st.label}
            </StatusPill>
          </motion.li>
        )
      })}
    </ol>
  )
}

// ─── Phones (< 768px): the mobile app's pieces ──────────────────────────────
// Everything below renders only on phones (hidden max-md:*), fed by the same state and hooks as the desktop view.

type PhoneStep = 'permission' | 'locate' | 'review' | 'done'
const PHONE_STEPS: PhoneStep[] = ['permission', 'locate', 'review']
const PHONE_STEP_LABELS = ['Permission', 'Location', 'Review']

/** The app's step dots: green tick when done, the current one filled sapphire, the rest grey. */
function PhoneStepDots({ current }: { current: number }) {
  return (
    <ol className="max-md:flex max-md:items-center" aria-label={`Step ${current + 1} of ${PHONE_STEP_LABELS.length}: ${PHONE_STEP_LABELS[current]}`}>
      {PHONE_STEP_LABELS.map((label, i) => (
        <li key={label} className="max-md:flex max-md:items-center">
          <span
            aria-hidden="true"
            className={cn(
              'max-md:grid max-md:size-[22px] max-md:place-items-center max-md:rounded-full max-md:text-[10px] max-md:font-[800]',
              i < current
                ? 'max-md:bg-success max-md:text-success-foreground'
                : i === current
                  ? 'max-md:bg-primary max-md:text-primary-foreground'
                  : 'max-md:bg-secondary max-md:text-muted-foreground',
            )}
          >
            {i < current ? <Check className="max-md:size-3" /> : i + 1}
          </span>
          {i < PHONE_STEP_LABELS.length - 1 && (
            <span aria-hidden="true" className={cn('max-md:mx-0.5 max-md:h-0.5 max-md:w-4 max-md:rounded-full', i < current ? 'max-md:bg-success' : 'max-md:bg-input')} />
          )}
        </li>
      ))}
    </ol>
  )
}

/** One step of the app's geo-punch flow: a centred card with a round tinted icon, a short title, a line and the action. */
function PhoneGateCard({
  icon: Icon,
  tone = 'sapphire',
  title,
  body,
  children,
}: {
  icon: typeof MapPin
  tone?: 'sapphire' | 'amber'
  title: string
  body: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="max-md:flex max-md:flex-col max-md:items-center max-md:rounded-xl max-md:border max-md:bg-card max-md:p-4 max-md:text-center max-md:shadow-[var(--m-shadow-low)]">
      <span
        aria-hidden="true"
        className={cn(
          'max-md:mb-2 max-md:grid max-md:size-14 max-md:place-items-center max-md:rounded-full',
          tone === 'amber' ? 'max-md:bg-waiting-bg max-md:text-waiting' : 'max-md:bg-info-bg max-md:text-primary',
        )}
      >
        <Icon className="max-md:size-7" />
      </span>
      <h2 className="font-display max-md:mb-1 max-md:text-[14px] max-md:font-semibold">{title}</h2>
      <p className="max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">{body}</p>
      {children}
    </div>
  )
}

/** The app's On-Duty hero: a sapphire gradient card with the step pill, where you are going and a seven-part bar. */
function PhoneOnDutyHero({
  title,
  subtitle,
  headline,
  segments,
}: {
  title: string
  subtitle: string
  headline: string
  segments: ('done' | 'current' | 'todo')[]
}) {
  const done = segments.filter((s) => s === 'done').length
  return (
    <div className="bg-brand-gradient hidden max-md:flex max-md:flex-col max-md:gap-2 max-md:rounded-3xl max-md:p-[18px] max-md:text-white">
      <div className="max-md:flex max-md:items-center max-md:justify-between max-md:gap-2">
        <span className="max-md:text-[11px] max-md:font-[800] max-md:tracking-[0.09em] max-md:text-white/80">ON-DUTY</span>
        <span className="max-md:rounded-full max-md:bg-white/20 max-md:px-[11px] max-md:py-1 max-md:text-[12px] max-md:font-[800]">{headline}</span>
      </div>
      <p className="font-display max-md:line-clamp-3 max-md:text-[19px] max-md:leading-[25px] max-md:font-bold max-md:break-words">{title}</p>
      {subtitle && <p className="max-md:text-[12.5px] max-md:text-white/85 max-md:tabular-nums">{subtitle}</p>}
      <div
        role="progressbar"
        aria-label={`${headline}: ${done} of ${segments.length} steps done`}
        aria-valuemin={0}
        aria-valuemax={segments.length}
        aria-valuenow={done}
        className="max-md:mt-1 max-md:flex max-md:gap-1"
      >
        {segments.map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn('max-md:h-1.5 max-md:flex-1 max-md:rounded-full', s === 'done' ? 'max-md:bg-white' : s === 'current' ? 'max-md:bg-white/65' : 'max-md:bg-white/25')}
          />
        ))}
      </div>
    </div>
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
  // Phones: the app's stepper. Allow location -> capture it -> review; the last two follow `result` / `done` below.
  const [phoneStart, setPhoneStart] = React.useState<'permission' | 'locate'>('permission')

  const allowLocation = async () => {
    setLocating(true)
    setError(null)
    try {
      // Already allowed: straight on. Otherwise asking for a position is what makes the browser ask the person.
      const state = await navigator.permissions
        ?.query({ name: 'geolocation' as PermissionName })
        .then((p) => p.state)
        .catch(() => null)
      if (state !== 'granted') await getPosition()
      setPhoneStart('locate')
    } catch (err) {
      setError(errMsg(err, 'Could not get your location.'))
    } finally {
      setLocating(false)
    }
  }

  const startOver = () => {
    setFix(null)
    setResult(null)
    setError(null)
    setDone(null)
    setPhoneStart('permission')
  }

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
      <GlassCard
        variant="stitched"
        tone="amber"
        padding="lg"
        className="flex flex-col items-center gap-3 py-12 text-center max-md:gap-1.5 max-md:border-l-[1px]! max-md:border-l-[var(--glass-border)]! max-md:p-4!"
      >
        <span className="grid size-14 place-items-center rounded-full border border-waiting-border bg-waiting-bg text-waiting max-md:mb-1 max-md:border-0" aria-hidden="true">
          <ShieldAlert className="size-7" />
        </span>
        <h2 className="font-display text-xl font-semibold max-md:text-[14px]">You're On-Duty today</h2>
        <p className="max-w-sm text-sm text-muted-foreground max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">
          Office geo punch is locked while an On-Duty session is running. Record your punches from On-Duty, or mark the day done first.
        </p>
        <Button onClick={onSwitch} className="mt-2 max-md:mt-3 max-md:w-full">
          <Briefcase aria-hidden="true" /> Go to On-Duty
        </Button>
      </GlassCard>
    )
  }

  const next = status.data?.nextPunchType
  const tone = result ? (result.insideRadius ? 'text-approved' : 'text-rejected') : 'text-info'
  const phoneStep: PhoneStep = done ? 'done' : result ? 'review' : phoneStart
  const nextNumber = status.data?.nextPunchNumber

  const phoneError = error && (
    <p role="alert" className="max-md:w-full max-md:rounded-lg max-md:bg-rejected-bg max-md:px-3 max-md:py-2 max-md:text-left max-md:text-[12.5px] max-md:text-rejected">
      {error}
    </p>
  )

  return (
    <>
      {/* Phones: the mobile app's geo-punch stepper (allow location -> capture -> review), same state as the desktop card. */}
      <section aria-label="Office geo punch" className="hidden max-md:flex max-md:flex-col max-md:gap-4">
        <div className="max-md:flex max-md:items-center max-md:justify-between max-md:gap-3">
          <p className="max-md:text-[13px] max-md:text-secondary-foreground">
            Next:{' '}
            <span className="max-md:font-semibold max-md:text-foreground">
              {nextNumber ? `Punch ${nextNumber} · ` : ''}
              {next === 'OUT' ? 'Check-Out' : 'Check-In'}
            </span>
          </p>
          {phoneStep !== 'permission' && (
            <button
              type="button"
              onClick={startOver}
              className="focus-ring max-md:-mr-1 max-md:flex max-md:min-h-11 max-md:items-center max-md:rounded-full max-md:px-1 max-md:text-[12px] max-md:font-semibold max-md:text-muted-foreground"
            >
              <ChevronLeft className="max-md:size-4" aria-hidden="true" /> Start Over
            </button>
          )}
        </div>
        <PhoneStepDots current={PHONE_STEPS.indexOf(phoneStep === 'done' ? 'review' : phoneStep)} />

        {phoneStep === 'permission' && (
          <PhoneGateCard icon={Crosshair} title="Allow location access" body="We need your current location to check that you are inside your branch's allowed area.">
            {error && <div className="max-md:mt-3 max-md:w-full">{phoneError}</div>}
            <Button size="lg" onClick={allowLocation} disabled={locating} className="max-md:mt-4 max-md:w-full">
              {locating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
              {locating ? 'Asking for location…' : 'Allow Location Access'}
            </Button>
          </PhoneGateCard>
        )}

        {phoneStep === 'locate' && (
          <PhoneGateCard icon={MapPinned} title="Capture your current location" body="We check whether you are inside the allowed company area before you punch.">
            {error && <div className="max-md:mt-3 max-md:w-full">{phoneError}</div>}
            <Button size="lg" onClick={locate} disabled={locating} className="max-md:mt-4 max-md:w-full">
              {locating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Navigation aria-hidden="true" />}
              {locating ? 'Checking location…' : 'Capture Location'}
            </Button>
          </PhoneGateCard>
        )}

        {phoneStep === 'review' && result && (
          <div className="max-md:flex max-md:flex-col max-md:gap-3 max-md:rounded-xl max-md:border max-md:bg-card max-md:p-4 max-md:shadow-[var(--m-shadow-low)]">
            <p
              role="status"
              className={cn(
                'max-md:flex max-md:items-center max-md:gap-2 max-md:rounded-lg max-md:p-3 max-md:text-[12.5px] max-md:font-bold',
                result.insideRadius ? 'max-md:bg-approved-bg max-md:text-approved' : 'max-md:bg-rejected-bg max-md:text-rejected',
              )}
            >
              {result.insideRadius ? <CheckCircle2 className="max-md:size-[18px] max-md:shrink-0" aria-hidden="true" /> : <XCircle className="max-md:size-[18px] max-md:shrink-0" aria-hidden="true" />}
              {result.message}
            </p>
            <dl className="max-md:grid max-md:grid-cols-2 max-md:gap-2">
              {[
                ['Branch', result.branchName],
                ['Distance', `${result.distanceM}m (allowed ${result.radiusM}m)`],
                ['Punch', result.nextPunchNumber ? `#${result.nextPunchNumber} · ${result.nextPunchType === 'OUT' ? 'Check-Out' : 'Check-In'}` : '—'],
                ['Time', new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })],
              ].map(([k, v]) => (
                <div key={k} className="max-md:min-w-0 max-md:rounded-lg max-md:bg-muted max-md:p-2">
                  <dt className="max-md:text-[10px] max-md:font-bold max-md:tracking-[0.04em] max-md:text-muted-foreground max-md:uppercase">{k}</dt>
                  <dd className="max-md:mt-0.5 max-md:text-[13px] max-md:font-bold max-md:break-words">{v}</dd>
                </div>
              ))}
            </dl>
            {phoneError}
            {result.insideRadius ? (
              <Button size="lg" onClick={commit} disabled={punch.isPending} className="max-md:w-full">
                {punch.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />}
                {punch.isPending ? 'Recording your punch…' : result.nextPunchType === 'OUT' ? 'Punch Out' : 'Punch In'}
              </Button>
            ) : (
              <>
                <p className="max-md:flex max-md:gap-2 max-md:rounded-lg max-md:bg-waiting-bg max-md:p-3 max-md:text-[11.5px] max-md:leading-4 max-md:text-secondary-foreground">
                  <ShieldAlert className="max-md:mt-px max-md:size-4 max-md:shrink-0 max-md:text-waiting" aria-hidden="true" />
                  Company attendance policy needs you to be inside the branch area. If you are travelling for official work, start an On-Duty session instead.
                </p>
                <Button size="lg" onClick={onSwitch} className="max-md:w-full">
                  <Briefcase aria-hidden="true" /> Switch to On-Duty (OD) Punch
                </Button>
                <Button size="lg" variant="outline" onClick={locate} disabled={locating} className="max-md:w-full">
                  {locating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Crosshair aria-hidden="true" />} Recalibrate GPS & Try Again
                </Button>
              </>
            )}
          </div>
        )}

        {phoneStep === 'done' && (
          <div
            role="status"
            className="max-md:flex max-md:flex-col max-md:items-center max-md:gap-2 max-md:rounded-xl max-md:border max-md:bg-card max-md:px-4 max-md:py-6 max-md:text-center max-md:shadow-[var(--m-shadow-low)]"
          >
            <CheckCircle2 className="max-md:size-10 max-md:text-approved" aria-hidden="true" />
            <p className="max-md:text-[15px] max-md:font-[800]">Punch recorded</p>
            <p className="max-md:text-[12.5px] max-md:text-secondary-foreground">{done}</p>
            <div className="max-md:mt-3 max-md:flex max-md:w-full max-md:gap-2.5">
              <Button variant="outline" asChild className="max-md:flex-1">
                <Link href="/employee/attendance">Back to Attendance</Link>
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  // Location is already allowed: straight to capturing it again.
                  startOver()
                  setPhoneStart('locate')
                }}
                className="max-md:flex-1"
              >
                Punch again
              </Button>
            </div>
          </div>
        )}

        {phoneStep === 'permission' && (
          <button
            type="button"
            onClick={onSwitch}
            className="focus-ring max-md:flex max-md:min-h-11 max-md:items-center max-md:gap-2 max-md:rounded-lg max-md:bg-waiting-bg max-md:p-3 max-md:text-left max-md:text-[12px] max-md:font-semibold max-md:text-waiting max-md:active:opacity-85"
          >
            <Briefcase className="max-md:size-4 max-md:shrink-0" aria-hidden="true" />
            <span className="max-md:flex-1">Working off-site instead? Start an On-Duty session</span>
            <ChevronRight className="max-md:size-4 max-md:shrink-0" aria-hidden="true" />
          </button>
        )}
      </section>

      <GlassCard variant="raised" padding="none" className="overflow-hidden max-md:hidden">
        {/* The geo-fence radar: rings ripple out while it looks for you, then settle green (inside) or rose (outside). */}
        <div
          className={cn(
            'relative grid h-56 place-items-center overflow-hidden border-b hairline',
            result
              ? result.insideRadius
                ? 'bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--success)_22%,transparent),transparent_65%)]'
                : 'bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--destructive)_20%,transparent),transparent_65%)]'
              : 'bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_65%)]',
          )}
          aria-hidden="true"
        >
          {[1, 2, 3].map((r) => (
            <motion.span
              key={r}
              className={cn('absolute rounded-full border', result ? (result.insideRadius ? 'border-success/30' : 'border-destructive/30') : 'border-primary/25')}
              style={{ width: `${r * 70}px`, height: `${r * 70}px` }}
              animate={locating ? { scale: [1, 1.12, 1], opacity: [0.9, 0.4, 0.9] } : { scale: 1, opacity: 1 }}
              transition={locating ? { duration: 1.4, repeat: Infinity, delay: r * 0.18 } : { duration: 0.3 }}
            />
          ))}
          <motion.span
            key={result ? String(result.insideRadius) : 'idle'}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className={cn('relative grid size-16 place-items-center rounded-full border bg-card/80 shadow-clay', tone)}
          >
            {locating ? <Loader2 className="size-7 animate-spin" /> : result ? (result.insideRadius ? <LocateFixed className="size-7" /> : <Crosshair className="size-7" />) : <Radar className="size-7" />}
          </motion.span>
          <p className="label-caps absolute bottom-4 px-4 text-center text-muted-foreground">
            {result ? `${result.distanceM} m from ${result.branchName} • allowed ${result.radiusM} m` : 'Geo-fence check'}
          </p>
        </div>

        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <AnimatePresence>
            {done && (
              <motion.div variants={fadeIn} initial="hidden" animate="show" exit="exit" role="status" className="flex items-center gap-3 rounded-lg border border-approved-border bg-approved-bg px-4 py-3 text-approved">
                <SuccessCheck size={32} label="Punch recorded" />
                <p className="text-sm font-semibold">{done}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!result ? (
            <>
              <div>
                <h2 className="font-display text-[22px] font-semibold">Office check-in</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  At your branch? We check that you are inside the allowed area, then you can punch straight away. No photos needed.
                  {next && (
                    <>
                      {' '}Your next punch is a <span className="font-semibold text-foreground">{next === 'IN' ? 'check-in' : 'check-out'}</span>.
                    </>
                  )}
                </p>
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-rejected-border bg-rejected-bg px-3 py-2 text-sm text-rejected">
                  {error}
                </p>
              )}
              <Button size="lg" onClick={locate} disabled={locating} className="self-start">
                {locating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Navigation aria-hidden="true" />}
                {locating ? 'Checking location…' : 'Check my location'}
              </Button>
            </>
          ) : (
            <>
              <div
                role="status"
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-4 py-3',
                  result.insideRadius ? 'border-approved-border bg-approved-bg text-approved' : 'border-rejected-border bg-rejected-bg text-rejected',
                )}
              >
                {result.insideRadius ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
                <p className="text-sm font-medium">{result.message}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Branch', result.branchName],
                  ['Distance', `${result.distanceM} m`],
                  ['Allowed', `${result.radiusM} m`],
                  ['Punch', result.nextPunchNumber ? `#${result.nextPunchNumber} ${result.nextPunchType === 'IN' ? 'In' : 'Out'}` : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-foreground/[0.04] px-3 py-2.5">
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
                    {locating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MapPin aria-hidden="true" />} Check again
                  </Button>
                  <Button onClick={onSwitch} className="flex-1">
                    <Briefcase aria-hidden="true" /> Working off-site? Start On-Duty
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </GlassCard>
    </>
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
  // How many photos the punch being taken needs: read from the status when the punch begins and then kept, so a
  // status refresh (HR changing the policy) cannot change the camera under the employee's hands.
  const [photoCount, setPhotoCount] = React.useState(1)
  const fixRef = React.useRef<Fix | null>(null)
  const [locating, setLocating] = React.useState<number | null>(null)

  const session = data?.session ?? null
  const live = isLive(session)
  const liveSession = live ? session! : null
  // View Records reads the same sessions: keep it in step with what happens here.
  const refreshRecords = () => qc.invalidateQueries({ queryKey: ON_DUTY_RECORDS_KEY })

  const startSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destination.trim()) return
    try {
      const r = await start.mutateAsync(destination.trim())
      // The server's own message always names HR; with the session's pipeline on hand say where it really goes.
      const where = pipelineSentence(r.session.approval, 'session')
      toast.success('On-Duty session started', { description: where ? `You can begin punching. ${where}` : r.message })
      setDestination('')
      refreshRecords()
    } catch (err) {
      toast.error(errMsg(err, 'Could not start the session'))
      refreshIfWorkflowOff(qc, err)
    }
  }

  // Location first (fails fast if blocked), then the selfie(s), then submit.
  const beginPunch = async (slot: number) => {
    setLocating(slot)
    try {
      fixRef.current = await getPosition()
      setPhotoCount(requiredPhotoCount(data))
      setPendingSlot(slot)
      setCameraOpen(true)
    } catch (err) {
      toast.error(errMsg(err, 'Could not get your location'))
    } finally {
      setLocating(null)
    }
  }

  // `photos` are in order: the first goes as `photo`, the second (when HR's policy asks for two) as `photo2`. A punch
  // never goes out with fewer photos than the policy it was begun under asked for.
  const submitPunch = async (photos: Blob[]) => {
    setCameraOpen(false)
    const all = completePhotos(photos, photoCount)
    if (!fixRef.current || pendingSlot == null || !all) return
    try {
      const r = await punch.mutateAsync({ ...fixRef.current, photo: all[0], photo2: all[1], punchNumber: pendingSlot })
      toast.success(`Punch ${r.punchNumber} (${r.punchType}) submitted`, {
        description: r.sessionEnded ? 'All 4 punches are in, so your session has ended for today.' : 'It counts once HR approves it.',
      })
    } catch (err) {
      // PHOTO2_REQUIRED (HR switched the policy to two photos after this page loaded) gets its own sentence; the
      // refetch below then makes the next punch ask for both.
      toast.error(punchErrorMessage(err, 'Could not submit the punch'))
    } finally {
      setPendingSlot(null)
      fixRef.current = null
      refetch()
      refreshRecords()
    }
  }

  const endSession = async () => {
    try {
      await complete.mutateAsync()
      toast.success('On-Duty session marked done')
      refreshRecords()
    } catch (err) {
      toast.error(errMsg(err, 'Could not end the session'))
    }
  }

  if (isLoading) return <SkeletonList variant="cards" count={2} label="Loading your On-Duty session" />

  const slots = data?.punchSlots ?? []
  const requiredPhotos = requiredPhotoCount(data)
  const base = session ? SESSION_STATE[session.approvalStatus] ?? { label: session.approvalStatus, tone: 'neutral' as StatusTone } : null
  // While the session waits on the pipeline, say who it waits for (the status alone only knows the old fixed order).
  const state = base && { ...base, label: waitingText(session?.approval) ?? base.label }
  const pipeline = pipelineSentence(session?.approval ?? workflow, 'session')

  // Phones: the app's hero - request, approval, four geo-punches, done as a seven-part bar.
  let hero: { title: string; subtitle: string; headline: string; segments: ('done' | 'current' | 'todo')[] }
  if (liveSession) {
    const approved = liveSession.approvalStatus === 'active'
    const slotList = slots.length ? slots : [1, 2, 3, 4].map((n) => ({ punchNumber: n, available: true }))
    let currentTaken = !approved
    const punchSegs = slotList.slice(0, 4).map((s) => {
      if (!s.available) return 'done' as const
      if (currentTaken) return 'todo' as const
      currentTaken = true
      return 'current' as const
    })
    const punched = punchSegs.filter((s) => s === 'done').length
    hero = {
      title: liveSession.destination,
      subtitle: [
        liveSession.createdAt ? `Started ${formatDistanceToNowStrict(parseISO(liveSession.createdAt), { addSuffix: true })}` : 'Started today',
        liveSession.branchName,
      ]
        .filter(Boolean)
        .join(' · '),
      headline: !approved && state ? state.label : punched >= 4 ? 'All 4 punches in' : `Geo-punch ${punched + 1} of 4`,
      segments: ['done', approved ? 'done' : 'current', ...punchSegs, 'todo'],
    }
  } else {
    hero = {
      title: 'Start your On-Duty',
      subtitle: session?.approvalStatus === 'completed' ? 'Today’s day is done. You can start another.' : 'Working away from your branch today?',
      headline: 'Step 1 of 7',
      segments: ['current', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo'],
    }
  }

  return (
    <div className="flex flex-col gap-5 max-md:gap-4">
      <PhoneOnDutyHero {...hero} />
      {liveSession ? (
        // Phones: the hero above carries the place and state, so the title block hides and the rest stacks 16px apart.
        <GlassCard variant="stitched" tone="emerald" padding="lg" className="max-md:flex max-md:flex-col max-md:gap-4 max-md:border-l-[1px]! max-md:border-l-[var(--glass-border)]! max-md:p-4! max-md:[&>*]:mt-0!">
          <div className="flex flex-wrap items-start justify-between gap-3 max-md:hidden">
            <div className="min-w-0">
              <StatusPill tone="live">On-Duty session live</StatusPill>
              <h2 className="font-display mt-2 text-[24px] font-semibold break-words">{liveSession.destination}</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Started {liveSession.createdAt ? formatDistanceToNowStrict(parseISO(liveSession.createdAt), { addSuffix: true }) : 'today'}
                {liveSession.branchName ? ` • ${liveSession.branchName}` : ''}
              </p>
            </div>
            {state && (
              <StatusPill tone={state.tone} size="sm">
                {state.label}
              </StatusPill>
            )}
          </div>
          {liveSession.isProvisional && (
            <p className="mt-4 rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting">
              You can punch right away. Punches count once the session is approved.{pipeline && ` ${pipeline}`}
            </p>
          )}
          {liveSession.approval && (
            <div className="scrollbar-none mt-4 overflow-x-auto">
              <Stepper approval={liveSession.approval} sentAt={liveSession.createdAt} />
            </div>
          )}

          {requiredPhotos === 2 && <p className="mt-4 text-[12.5px] text-muted-foreground">Each punch takes two selfies, one after the other.</p>}
          <ul className="mt-5 grid gap-3 max-md:gap-2.5 sm:grid-cols-2 sm:max-md:grid-cols-1">
            {slots.map((s, i) => {
              const c = SLOT_STATE[s.status] ?? { label: s.status, tone: 'neutral' as StatusTone }
              const busy = locating === s.punchNumber || (punch.isPending && pendingSlot === s.punchNumber)
              return (
                <motion.li
                  key={s.punchNumber}
                  {...listItem(i)}
                  className={cn('flex items-center gap-3 rounded-xl border p-4 max-md:p-3', s.available ? 'hairline bg-foreground/[0.03]' : 'border-approved-border bg-approved-bg/50')}
                >
                  <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-lg border', s.punchType === 'IN' ? 'border-approved-border bg-approved-bg text-approved' : 'border-waiting-border bg-waiting-bg text-waiting')}>
                    {s.punchType === 'IN' ? <LogIn className="size-4" /> : <LogOut className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="label-caps text-muted-foreground">Punch {s.punchNumber}</p>
                    <p className="mt-0.5 text-[16px] font-semibold">{s.punchType === 'IN' ? 'Check-in' : 'Check-out'}</p>
                  </div>
                  {s.available ? (
                    <Button size="sm" onClick={() => beginPunch(s.punchNumber)} disabled={locating != null || punch.isPending} className="min-h-11 sm:min-h-8">
                      {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
                      Punch
                    </Button>
                  ) : (
                    <StatusPill tone={c.tone} size="sm" dot={false}>
                      {c.label}
                    </StatusPill>
                  )}
                </motion.li>
              )
            })}
          </ul>

          {(data?.punchVerifications.length ?? 0) > 0 && (
            <div className="mt-5">
              <p className="label-caps mb-2 text-muted-foreground">Sent from the field</p>
              <ul className="divide-y divide-[var(--glass-border)] rounded-lg border hairline">
                {data!.punchVerifications.map((v) => {
                  const st = PUNCH_STATE[v.status] ?? { label: v.status, tone: 'neutral' as StatusTone }
                  return (
                    <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13.5px]">
                      <span className="font-label w-14 font-semibold tabular-nums">{v.punchTime.slice(0, 5)}</span>
                      <span className="min-w-0 flex-1">
                        Punch {v.punchNumber} • {v.punchType === 'IN' ? 'In' : 'Out'}
                        {v.accuracyM != null && <span className="text-muted-foreground"> • within {Math.round(v.accuracyM)} m</span>}
                      </span>
                      <StatusPill tone={st.tone} size="sm" dot={false}>
                        {st.label}
                      </StatusPill>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="mt-5 flex justify-end border-t hairline pt-4">
            <Button variant="outline" onClick={endSession} disabled={complete.isPending} className="max-md:w-full">
              {complete.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Flag aria-hidden="true" />} Mark day done
            </Button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard variant="raised" padding="lg" asChild>
          <form onSubmit={startSession} className="flex flex-col gap-4 max-md:p-4!">
            <div>
              <h2 className="font-display text-[22px] font-semibold max-md:text-[16px]">Start an On-Duty session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Working away from your branch today, like a client visit, a supplier mill or field travel? Start a session and punch from where you are.
                Each punch needs {requiredPhotos === 2 ? 'two selfies' : 'a selfie'} and your location.
              </p>
              <p className="mt-2 flex items-start gap-2 text-[12.5px] text-muted-foreground">
                <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {ON_DUTY_WEB_TRACKING_NOTE}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="od-destination">Where are you going?</Label>
              <Input
                id="od-destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. ABC Spinning Mills, Tirupur"
                maxLength={200}
              />
            </div>
            {offNote && (
              <p role="status" className="rounded-lg border border-waiting-border bg-waiting-bg px-3 py-2 text-[13px] text-waiting">
                {offNote}
              </p>
            )}
            {pipeline && !offNote && <p className="text-[12.5px] text-muted-foreground">{pipeline}</p>}
            <Button type="submit" size="lg" disabled={!destination.trim() || start.isPending || !!offNote} className="self-start max-md:w-full max-md:self-stretch">
              {start.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />} Start session
            </Button>
            {session && state && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-foreground/[0.04] px-4 py-3 text-[13.5px]">
                <span className="text-muted-foreground">Today's last session:</span>
                <span className="font-semibold">{session.destination}</span>
                <span className="ml-auto">
                  <ApprovalState approval={session.approval} />
                  {!session.approval && (
                    <StatusPill tone={state.tone} size="sm">
                      {state.label}
                    </StatusPill>
                  )}
                </span>
              </div>
            )}
            {session?.approvalStatus === 'rejected' && (session.hodReviewComment || session.hrReviewComment) && (
              <p className="text-[13px] text-rejected">Reason: {session.hrReviewComment || session.hodReviewComment}</p>
            )}
          </form>
        </GlassCard>
      )}

      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => {
          setCameraOpen(false)
          setPendingSlot(null)
        }}
        onCapture={submitPunch}
        total={photoCount}
        title={pendingSlot ? `${photoCount > 1 ? 'Selfies' : 'Selfie'} for punch ${pendingSlot}` : undefined}
      />
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────
type Mode = 'office' | 'onduty' | 'records'

const modeFromParams = (search: string): Mode | null => {
  const p = new URLSearchParams(search)
  const m = p.get('mode') ?? (p.get('view') === 'records' ? 'records' : null)
  return m === 'office' || m === 'onduty' || m === 'records' ? m : null
}

/**
 * Geo Punch / On-Duty: punch from inside the branch's geo-fence (Office), run an On-Duty session when working off-site
 * (On-Duty), or look back at every On-Duty request sent (View Records: the four views, the punches, who decided, the
 * route). `?mode=onduty` / `?mode=records` (or `?view=records`) opens a given one.
 */
export default function AttendanceRequest() {
  const geo = useGeoPunchStatus()
  const onDutyLive = isLive(geo.data?.onDutySession)
  const search = useSearch()
  const [location, navigate] = useLocation()
  const [mode, setModeState] = React.useState<Mode>(() => modeFromParams(search) ?? 'office')
  const setMode = (m: Mode) => {
    setModeState(m)
    navigate(m === 'office' ? location : `${location}?mode=${m}`, { replace: true })
  }

  // A link (a notification) may name the view to open.
  React.useEffect(() => {
    const m = modeFromParams(search)
    if (m) setModeState(m)
  }, [search])

  // View Records' month switcher (owner 2026-11-02): the On-Duty requests of one month. A link naming a day
  // (&date=YYYY-MM-DD) opens that day's month.
  const linkMonth = React.useMemo(() => monthOf(readFocusParams(search).date), [search])
  const [recordsMonth, setRecordsMonth] = useSelectedMonth(linkMonth)
  React.useEffect(() => {
    if (linkMonth) setRecordsMonth(linkMonth)
  }, [linkMonth, setRecordsMonth])

  // Land on On-Duty when a session is already running (unless a link asked for something else).
  const initialised = React.useRef(false)
  React.useEffect(() => {
    if (!initialised.current && geo.data) {
      initialised.current = true
      if (isLive(geo.data.onDutySession) && !modeFromParams(search)) setModeState('onduty')
    }
  }, [geo.data, search])

  const punches = geo.data?.punches ?? []

  return (
    <PageShell width="wide">
      <PageHero
        icon={<MapPin />}
        title="Geo Punch & On-Duty"
        subtitle="Punch from inside your branch's area, or start an On-Duty session when you work away from it."
        // Phones: the calendar link is the tab bar's Attendance tab, so it hides; its empty slot stays on the title row.
        className="max-md:[&>div.flex>div+div]:w-auto"
        actions={
          <Button variant="outline" asChild className="max-md:hidden">
            <Link href="/employee/attendance">
              <Building2 aria-hidden="true" /> Attendance calendar
            </Link>
          </Button>
        }
      >
        <SegmentedControl<Mode>
          ariaLabel="Choose"
          value={mode}
          onChange={setMode}
          // Phones: the three choices share the row (words only, so they fit a 360px screen).
          className="max-md:w-full max-md:[&_svg]:hidden max-md:[&>button]:flex-1 max-md:[&>button]:px-2 max-md:[&>button]:text-[12px]"
          options={[
            { value: 'office', label: 'Office punch', icon: Building2 },
            { value: 'onduty', label: onDutyLive ? 'On-Duty · live' : 'On-Duty', icon: Briefcase },
            { value: 'records', label: 'View Records', icon: ClipboardList },
          ]}
        />
      </PageHero>

      {mode === 'records' ? (
        <section aria-labelledby="od-records-title" className="flex flex-col gap-4">
          <SectionHeader
            id="od-records-title"
            icon={ClipboardList}
            title="My On-Duty records"
            description="The On-Duty requests of a month: the day, the place, your punches and who decided it."
            action={<MonthYearPicker {...monthPickerProps(recordsMonth, setRecordsMonth)} label="On-Duty records" className="max-md:hidden" />}
          />
          <OnDutyRecords onApply={() => setMode('onduty')} month={recordsMonth} onMonthChange={setRecordsMonth} />
        </section>
      ) : (
        <div className="grid gap-6 max-md:gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {mode === 'office' ? <OfficePunch onDutyLive={onDutyLive} onSwitch={() => setMode('onduty')} /> : <OnDuty />}
          </div>

          <aside className="flex flex-col gap-6 max-md:gap-3" aria-label="Today">
            <GlassCard>
              <SectionHeader as="h3" title="Today's punch slots" description="Up to 4 punches a day: in, out, in, out." className="mb-4" />
              <SlotList slots={geo.data?.punchSlots} loading={geo.isLoading} />
            </GlassCard>
            <GlassCard>
              <SectionHeader as="h3" title="Recorded today" count={geo.data ? punches.length : undefined} className="mb-4" />
              {geo.isLoading ? (
                <SkeletonList variant="rows" count={2} label="Loading today's punches" />
              ) : punches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No punches recorded yet today.</p>
              ) : (
                <Timeline
                  ariaLabel="Punches recorded today"
                  items={punches.map((p, i) => ({
                    key: `${i}-${p.punchTime}`,
                    title: p.punchType === 'IN' ? 'Checked in' : 'Checked out',
                    time: p.punchTime.slice(0, 5),
                    description: p.sourceLabel,
                    icon: p.punchType === 'IN' ? LogIn : LogOut,
                    tone: p.punchType === 'IN' ? 'emerald' : 'amber',
                    current: i === punches.length - 1,
                  }))}
                />
              )}
            </GlassCard>
          </aside>
        </div>
      )}
    </PageShell>
  )
}

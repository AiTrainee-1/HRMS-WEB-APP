import * as React from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Briefcase, Building2, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Crosshair, Loader2,
  LocateFixed, LogIn, LogOut, MapPin, MapPinned, Navigation, Radar, ShieldAlert, XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GlassCard, PageHero, PageShell, SectionHeader, SegmentedControl, SkeletonList, StatusPill,
  SuccessCheck, Timeline, fadeIn, listItem, type StatusTone,
} from '@/components/kit'
import { MonthYearPicker } from '@/components/employee/MonthYearPicker'
import { SlideToConfirmPunch } from '@/components/employee/SlideToConfirmPunch'
import { OnDutyRecords } from '@/components/onduty/OnDutyRecords'
import { OnDutyToday } from '@/components/onduty/OnDutyToday'
import { monthPickerProps } from '@/components/requests/month-picker'
import { useGeoPunch, useGeoPunchPrecheck, useGeoPunchStatus } from '@/hooks/useGeoAttendance'
import { useSelectedMonth } from '@/hooks/useSelectedMonth'
import { ApiError } from '@/api/client'
import { readFocusParams } from '@/lib/focus-item'
import { monthOf } from '@/lib/month-switch'
import { isOpenSession } from '@/lib/onduty-punches'
import { cn } from '@/lib/utils'
import type { GeoPunchPrecheckResult, PunchSlot } from '@/types'

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
const isLive = isOpenSession

const SLOT_STATE: Record<string, { label: string; tone: StatusTone }> = {
  available: { label: 'Open', tone: 'neutral' },
  recorded: { label: 'Recorded', tone: 'approved' },
  approved: { label: 'Approved', tone: 'approved' },
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

// ─── On-Duty ────────────────────────────────────────────────────────────────
// The On-Duty part (owner 2026-11-24 redesign: Apply On-Duty, the four named punches in any order, OT punches, the gate
// pass, End On-Duty) is its own component: components/onduty/OnDutyToday.tsx.

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
            {mode === 'office' ? <OfficePunch onDutyLive={onDutyLive} onSwitch={() => setMode('onduty')} /> : <OnDutyToday onSeeRecords={() => setMode('records')} />}
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

import * as React from 'react'
import { useLocation } from 'wouter'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  MapPin, Navigation, Camera, FileText, CheckCircle2, XCircle,
  Loader2, ChevronLeft, ChevronRight, Briefcase, Building2, Check,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CameraCaptureDialog } from '@/components/employee/CameraCaptureDialog'
import {
  useGeoPunchStatus, useGeoPunchPrecheck, useGeoPunch, useOnDutyRequest,
} from '@/hooks/useGeoAttendance'
import { ApiError } from '@/api/client'
import type { GeoPunchPrecheckResult } from '@/types'

type Mode = 'office' | 'onduty' | null
type OfficeStep = 'permission' | 'locate' | 'review' | 'done'
type OnDutyStep = 'permission' | 'locate' | 'photos' | 'reason' | 'review' | 'done'

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device/browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })
}

function StepDots({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div
            className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
              i < current ? 'bg-success text-white' : i === current ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 w-6 rounded ${i < current ? 'bg-success' : 'bg-muted'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function ModeSelect({ onSelect }: { onSelect: (m: Mode) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button onClick={() => onSelect('office')} className="text-left">
        <Card className="h-full transition-shadow hover:shadow-clay-lg">
          <CardContent className="flex flex-col gap-3 py-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Office Geo Punch</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                You're physically at the branch. Punch instantly — no photos needed. Only works inside the allowed company radius.
              </p>
            </div>
          </CardContent>
        </Card>
      </button>
      <button onClick={() => onSelect('onduty')} className="text-left">
        <Card className="h-full transition-shadow hover:shadow-clay-lg">
          <CardContent className="flex flex-col gap-3 py-5">
            <div className="flex size-11 items-center justify-center rounded-xl bg-warning/10 text-warning-foreground">
              <Briefcase className="size-5" />
            </div>
            <div>
              <p className="font-semibold">On-Duty (Off-Premises)</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Working off-site — field visit, client site, etc. Submit two photos and a reason; your Department Head and HR must both approve before it's recorded.
              </p>
            </div>
          </CardContent>
        </Card>
      </button>
    </div>
  )
}

export default function AttendanceRequest() {
  const [, navigate] = useLocation()
  const { data: status, refetch: refetchStatus } = useGeoPunchStatus()
  const precheckMutation = useGeoPunchPrecheck()
  const punchMutation = useGeoPunch()
  const onDutyMutation = useOnDutyRequest()

  const [mode, setMode] = React.useState<Mode>(null)
  const [officeStep, setOfficeStep] = React.useState<OfficeStep>('permission')
  const [onDutyStep, setOnDutyStep] = React.useState<OnDutyStep>('permission')

  const [permStatus, setPermStatus] = React.useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [locating, setLocating] = React.useState(false)
  const [location, setLocationState] = React.useState<{ latitude: number; longitude: number; accuracy?: number; isMocked: boolean } | null>(null)
  const [precheck, setPrecheck] = React.useState<GeoPunchPrecheckResult | null>(null)

  const [cameraOpen, setCameraOpen] = React.useState(false)
  const [photos, setPhotos] = React.useState<{ blob1: Blob; url1: string; blob2: Blob; url2: string } | null>(null)
  const [reason, setReason] = React.useState('')

  const nextNum = status?.nextPunchNumber ?? null
  const nextType = status?.nextPunchType ?? null

  React.useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then((p) => {
      setPermStatus(p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'unknown')
    }).catch(() => {})
  }, [])

  const requestPermission = async () => {
    setLocating(true)
    try {
      await getPosition()
      setPermStatus('granted')
      if (mode === 'office') setOfficeStep('locate')
      else setOnDutyStep('locate')
    } catch {
      setPermStatus('denied')
      toast.error('Location access was denied. Please allow it from your browser settings and try again.')
    } finally {
      setLocating(false)
    }
  }

  const captureLocation = async () => {
    setLocating(true)
    try {
      const pos = await getPosition()
      const loc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        isMocked: !!(pos as unknown as { mocked?: boolean }).mocked,
      }
      setLocationState(loc)
      if (mode === 'office') {
        const result = await precheckMutation.mutateAsync({ latitude: loc.latitude, longitude: loc.longitude })
        setPrecheck(result)
        setOfficeStep('review')
      } else {
        setOnDutyStep('photos')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get your location')
    } finally {
      setLocating(false)
    }
  }

  const submitOfficePunch = async () => {
    if (!location) return
    try {
      const result = await punchMutation.mutateAsync(location)
      if (result.status === 'rejected') {
        toast.error(result.message ?? 'You are outside the allowed company radius.')
        return
      }
      toast.success(
        result.status === 'accepted'
          ? `${result.punchType === 'IN' ? 'Checked in' : 'Checked out'} successfully`
          : 'This punch was already recorded.',
      )
      setOfficeStep('done')
      refetchStatus()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to punch')
    }
  }

  const handlePhotosCaptured = (blob1: Blob, blob2: Blob) => {
    setPhotos({ blob1, url1: URL.createObjectURL(blob1), blob2, url2: URL.createObjectURL(blob2) })
    setCameraOpen(false)
    setOnDutyStep('reason')
  }

  const submitOnDuty = async () => {
    if (!location || !photos || !reason.trim()) return
    try {
      await onDutyMutation.mutateAsync({ ...location, reason: reason.trim(), photo1: photos.blob1, photo2: photos.blob2 })
      toast.success('On-Duty request submitted', {
        description: 'Your Department Head will review it first, then HR gives the final approval.',
      })
      setOnDutyStep('done')
      refetchStatus()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to submit request')
    }
  }

  const reset = () => {
    setMode(null)
    setOfficeStep('permission')
    setOnDutyStep('permission')
    setLocationState(null)
    setPrecheck(null)
    setPhotos(null)
    setReason('')
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance Request"
        subtitle="Punch in from the office, or submit an On-Duty request when you're working off-site"
        icon={<MapPin />}
      />

      <AnimatePresence mode="wait">
        {mode === null ? (
          <motion.div key="select" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {nextNum == null ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
                  <CheckCircle2 className="size-8 text-success" />
                  <p className="font-semibold">All 4 punches recorded for today</p>
                  <p className="text-sm text-muted-foreground">Nothing left to punch — check back tomorrow.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Next: <span className="font-semibold text-foreground">Punch {nextNum} · {nextType === 'IN' ? 'Check-In' : 'Check-Out'}</span> — choose how you're punching:
                </p>
                <ModeSelect onSelect={setMode} />
              </>
            )}
          </motion.div>
        ) : mode === 'office' ? (
          <motion.div key="office" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <StepDots steps={['Permission', 'Location', 'Review']} current={['permission', 'locate', 'review', 'done'].indexOf(officeStep)} />
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-muted-foreground">
                <ChevronLeft className="size-3.5" /> Change Type
              </Button>
            </div>

            {officeStep === 'permission' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Navigation className="size-6" />
                  </div>
                  <p className="font-semibold">Allow location access</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    We need your current location to verify you're inside your branch's allowed radius before recording a punch.
                  </p>
                  <Button onClick={requestPermission} disabled={locating} className="mt-2 gap-2">
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
                    Allow Location Access
                  </Button>
                  {permStatus === 'denied' && (
                    <p className="text-xs text-destructive">
                      Location access was denied — enable it in your browser's site settings, then try again.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {officeStep === 'locate' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPin className="size-6" />
                  </div>
                  <p className="font-semibold">Capture your current location</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    We'll check whether you're inside the allowed company radius before you punch.
                  </p>
                  <Button onClick={captureLocation} disabled={locating} className="mt-2 gap-2">
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                    Capture Location
                  </Button>
                </CardContent>
              </Card>
            )}

            {officeStep === 'review' && precheck && (
              <Card>
                <CardContent className="flex flex-col gap-4 py-6">
                  <div
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                      precheck.insideRadius ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {precheck.insideRadius ? <CheckCircle2 className="size-5 shrink-0" /> : <XCircle className="size-5 shrink-0" />}
                    <p className="text-sm font-medium">{precheck.message}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Branch</p>
                      <p className="font-medium">{precheck.branchName}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Distance</p>
                      <p className="font-medium">{precheck.distanceM}m (allowed {precheck.radiusM}m)</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Punch</p>
                      <p className="font-medium">#{precheck.nextPunchNumber} · {precheck.nextPunchType === 'IN' ? 'Check-In' : 'Check-Out'}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="font-medium">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>

                  {precheck.insideRadius ? (
                    <Button variant="gradient" onClick={submitOfficePunch} disabled={punchMutation.isPending} className="gap-2">
                      {punchMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                      {precheck.nextPunchType === 'OUT' ? 'Punch Out' : 'Punch In'}
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-muted-foreground">
                        You're outside the allowed radius — move closer to your branch, or submit an On-Duty request if you're working off-site.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={captureLocation} className="flex-1 gap-2">
                          <MapPin className="size-3.5" /> Re-check Location
                        </Button>
                        <Button onClick={() => setMode('onduty')} className="flex-1 gap-2">
                          <Briefcase className="size-3.5" /> Submit On-Duty Instead
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {officeStep === 'done' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <CheckCircle2 className="size-10 text-success" />
                  <p className="font-semibold">Punch recorded</p>
                  <Button variant="outline" onClick={() => navigate('/employee/attendance')}>
                    Back to Attendance
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        ) : (
          <motion.div key="onduty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <StepDots
                steps={['Permission', 'Location', 'Photos', 'Reason', 'Review']}
                current={['permission', 'locate', 'photos', 'reason', 'review', 'done'].indexOf(onDutyStep)}
              />
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1 text-muted-foreground">
                <ChevronLeft className="size-3.5" /> Change Type
              </Button>
            </div>

            {onDutyStep === 'permission' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-warning/10 text-warning-foreground">
                    <Navigation className="size-6" />
                  </div>
                  <p className="font-semibold">Allow location access</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    We'll capture your current location as part of your On-Duty request for your Department Head and HR to review.
                  </p>
                  <Button onClick={requestPermission} disabled={locating} className="mt-2 gap-2">
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <Navigation className="size-4" />}
                    Allow Location Access
                  </Button>
                  {permStatus === 'denied' && (
                    <p className="text-xs text-destructive">
                      Location access was denied — enable it in your browser's site settings, then try again.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {onDutyStep === 'locate' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-warning/10 text-warning-foreground">
                    <MapPin className="size-6" />
                  </div>
                  <p className="font-semibold">Capture your current location</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    This records where you are while working off-site.
                  </p>
                  <Button onClick={captureLocation} disabled={locating} className="mt-2 gap-2">
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                    Capture Location
                  </Button>
                </CardContent>
              </Card>
            )}

            {onDutyStep === 'photos' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-warning/10 text-warning-foreground">
                    <Camera className="size-6" />
                  </div>
                  <p className="font-semibold">Upload two verification photos</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Take two photos to verify you're the one submitting this On-Duty request.
                  </p>
                  <Button onClick={() => setCameraOpen(true)} className="mt-2 gap-2">
                    <Camera className="size-4" /> Open Camera
                  </Button>
                </CardContent>
              </Card>
            )}

            {onDutyStep === 'reason' && (
              <Card>
                <CardContent className="flex flex-col gap-3 py-6">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="size-4 text-warning-foreground" /> Reason for on-duty work
                  </div>
                  <Textarea
                    placeholder="e.g. Client site visit for machine inspection at ABC Textiles"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    autoFocus
                  />
                  <Button
                    onClick={() => setOnDutyStep('review')}
                    disabled={!reason.trim()}
                    className="self-end gap-2"
                  >
                    Continue <ChevronRight className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {onDutyStep === 'review' && location && photos && (
              <Card>
                <CardContent className="flex flex-col gap-4 py-6">
                  <p className="text-sm font-semibold">Review your On-Duty request</p>

                  <div className="grid grid-cols-2 gap-2">
                    <img src={photos.url1} alt="Photo 1" className="aspect-square w-full rounded-lg border object-cover" />
                    <img src={photos.url2} alt="Photo 2" className="aspect-square w-full rounded-lg border object-cover" />
                  </div>

                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <p className="text-xs text-muted-foreground">Reason</p>
                    <p className="font-medium">{reason}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Punch</p>
                      <p className="font-medium">#{nextNum} · {nextType === 'IN' ? 'Check-In' : 'Check-Out'}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Time</p>
                      <p className="font-medium">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Your attendance won't be recorded until your Department Head, then HR, both approve this request.
                  </p>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setOnDutyStep('photos')} className="flex-1">
                      Retake Photos
                    </Button>
                    <Button
                      variant="gradient"
                      onClick={submitOnDuty}
                      disabled={onDutyMutation.isPending}
                      className="flex-1 gap-2"
                    >
                      {onDutyMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Submit Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {onDutyStep === 'done' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <CheckCircle2 className="size-10 text-success" />
                  <p className="font-semibold">Request submitted</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Awaiting Department Head approval, then HR's final sign-off.
                  </p>
                  <Button variant="outline" onClick={() => navigate('/employee/attendance')}>
                    Back to Attendance
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CameraCaptureDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={handlePhotosCaptured} />
    </div>
  )
}

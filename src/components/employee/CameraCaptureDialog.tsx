import * as React from 'react'
import { Camera, RotateCcw, Check, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  clearPhoto, completePhotos, emptyPhotoSlots, nextEmptySlot, photoLabel, punchSubmitState, putPhoto,
} from '@/lib/onduty-photos'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture photo'))), 'image/jpeg', 0.85)
  })
}

/** A photo taken, and the object URL its preview shows. */
type Shot = { blob: Blob; url: string }

const forget = (shot: Shot | null | undefined) => {
  if (shot) URL.revokeObjectURL(shot.url)
}

/**
 * Selfie capture for an On-Duty punch: the backend's /on-duty-sessions/punch takes one verification photo per punch,
 * or two when HR's policy says so (`total`, from the status payload's requiredPhotos). Opens the front camera via
 * getUserMedia and hands the JPEGs back as Blobs, in order.
 *  - One photo (`total` 1, the default): capture, preview, Retake or "Use photo".
 *  - Two photos: a list of "Photo 1 of 2" / "Photo 2 of 2", each with its preview and Retake, the camera shooting
 *    the first empty one, and a "Submit punch" button that stays disabled until every photo is there.
 */
export function CameraCaptureDialog({
  open,
  onClose,
  onCapture,
  title = 'Verification selfie',
  total = 1,
}: {
  open: boolean
  onClose: () => void
  onCapture: (photos: Blob[]) => void
  title?: string
  /** How many photos the punch takes (1 or 2). Keep it fixed while the dialog is open. */
  total?: number
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const videoElRef = React.useRef<HTMLVideoElement | null>(null)
  const capturingRef = React.useRef(false)
  const [error, setError] = React.useState<string | null>(null)
  const [slots, setSlots] = React.useState<Array<Shot | null>>(() => emptyPhotoSlots(total))
  const slotsRef = React.useRef(slots)
  React.useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  // A callback ref, so the stream re-attaches whenever the <video> remounts
  // (e.g. after "Retake") rather than only on the first mount.
  const videoRef = React.useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el
    if (el && streamRef.current) el.srcObject = streamRef.current
  }, [])

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const startCamera = React.useCallback(() => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot open the camera. Try Chrome or Safari on your phone.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoElRef.current) videoElRef.current.srcObject = stream
      })
      .catch(() => setError('Camera access was denied. Please allow camera permission and try again.'))
  }, [])

  React.useEffect(() => {
    if (!open) {
      stopStream()
      setError(null)
      return
    }
    startCamera()
    return stopStream
  }, [open, startCamera])

  // The photos start over whenever the dialog opens or closes or the photo count changes, and their previews are released.
  React.useEffect(() => {
    setSlots((prev) => {
      prev.forEach(forget)
      return emptyPhotoSlots(total)
    })
  }, [open, total])
  React.useEffect(() => () => slotsRef.current.forEach(forget), [])

  // Takes the next photo: into the first empty slot.
  const capture = async () => {
    const video = videoElRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth || capturingRef.current) return
    capturingRef.current = true
    try {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d')?.drawImage(video, 0, 0)
      const blob = await canvasToBlob(canvas)
      const shot: Shot = { blob, url: URL.createObjectURL(blob) }
      setSlots((prev) => {
        const next = nextEmptySlot(prev)
        if (next == null) {
          forget(shot)
          return prev
        }
        return putPhoto(prev, next, shot)
      })
    } catch {
      setError('Could not take the photo. Please try again.')
    } finally {
      capturingRef.current = false
    }
  }

  const retake = (index: number) => {
    setSlots((prev) => {
      forget(prev[index])
      return clearPhoto(prev, index)
    })
  }

  const multi = total > 1
  const next = nextEmptySlot(slots)
  const submit = punchSubmitState(slots, total)
  const submitAll = () => {
    const all = completePhotos(slots, total)
    if (all) onCapture(all.map((s) => s.blob))
  }

  const shot = slots[0]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-brand-blue" /> {title}
          </DialogTitle>
          <DialogDescription>
            {multi
              ? "HR uses these photos to confirm it's you punching from the field. Take both, check them, then submit the punch."
              : "HR uses this photo to confirm it's you punching from the field."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-center text-sm text-destructive">{error}</p>
            <p className="text-center text-xs text-muted-foreground">
              If you already denied access, enable it in your browser's site settings for this page, then try again.
            </p>
            <Button variant="outline" size="sm" onClick={startCamera}>
              <RotateCcw /> Try again
            </Button>
          </div>
        ) : multi ? (
          <div className="space-y-3">
            <ul className="space-y-2">
              {slots.map((s, i) => (
                <li
                  key={i}
                  className={cn('flex items-center gap-3 rounded-md border p-2', i === next ? 'border-primary/50' : 'hairline')}
                >
                  {s ? (
                    <img src={s.url} alt={`${photoLabel(i, total)} preview`} className="size-14 shrink-0 rounded-md border object-cover" />
                  ) : (
                    <span className="grid size-14 shrink-0 place-items-center rounded-md border border-dashed border-foreground/20 text-muted-foreground">
                      <Camera className="size-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold">{photoLabel(i, total)}</p>
                    <p className="text-[12px] text-muted-foreground">{s ? 'Taken' : i === next ? 'Taking this one now' : 'Not taken yet'}</p>
                  </div>
                  {s && (
                    <Button variant="outline" size="sm" onClick={() => retake(i)} aria-label={`Retake ${photoLabel(i, total).toLowerCase()}`}>
                      <RotateCcw /> Retake
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {next != null && (
              <>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
                  <div className="pointer-events-none absolute inset-y-3 left-1/2 aspect-square -translate-x-1/2 rounded-full border-2 border-dashed border-white/40" />
                  <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                    {photoLabel(next, total)}
                  </span>
                </div>
                <Button className="w-full" onClick={capture}>
                  <Camera /> Capture {photoLabel(next, total).toLowerCase()}
                </Button>
              </>
            )}
            <Button className="w-full" variant={next == null ? 'default' : 'outline'} disabled={!submit.enabled} onClick={submitAll}>
              <Check /> Submit punch
            </Button>
            {submit.hint && <p className="text-center text-xs text-muted-foreground">{submit.hint}</p>}
          </div>
        ) : !shot ? (
          <div className="space-y-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
              <div className="pointer-events-none absolute inset-8 rounded-full border-2 border-dashed border-white/40" />
            </div>
            <Button className="w-full" onClick={capture}>
              <Camera /> Capture selfie
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <img src={shot.url} alt="Your selfie" className="aspect-square w-full rounded-md border object-cover" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => retake(0)}>
                <RotateCcw /> Retake
              </Button>
              <Button className="flex-1" onClick={() => onCapture([shot.blob])}>
                <Check /> Use photo
              </Button>
            </div>
          </div>
        )}

        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
          <X /> Cancel
        </Button>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}

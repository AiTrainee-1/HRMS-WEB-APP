import * as React from 'react'
import { Camera, RotateCcw, Check, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture photo'))), 'image/jpeg', 0.85)
  })
}

/**
 * Selfie capture for an On-Duty punch: the backend's /on-duty-sessions/punch
 * takes exactly one verification photo per punch. Opens the front camera via
 * getUserMedia, lets the employee retake, then hands the JPEG back as a Blob.
 */
export function CameraCaptureDialog({
  open,
  onClose,
  onCapture,
  title = 'Verification selfie',
}: {
  open: boolean
  onClose: () => void
  onCapture: (photo: Blob) => void
  title?: string
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const videoElRef = React.useRef<HTMLVideoElement | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [shot, setShot] = React.useState<{ blob: Blob; url: string } | null>(null)

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
      setShot((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return null
      })
      setError(null)
      return
    }
    startCamera()
    return stopStream
  }, [open, startCamera])

  const capture = async () => {
    const video = videoElRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const blob = await canvasToBlob(canvas)
    setShot({ blob, url: URL.createObjectURL(blob) })
  }

  const retake = () => {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-brand-blue" /> {title}
          </DialogTitle>
          <DialogDescription>HR uses this photo to confirm it's you punching from the field.</DialogDescription>
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
              <Button variant="outline" className="flex-1" onClick={retake}>
                <RotateCcw /> Retake
              </Button>
              <Button className="flex-1" onClick={() => onCapture(shot.blob)}>
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

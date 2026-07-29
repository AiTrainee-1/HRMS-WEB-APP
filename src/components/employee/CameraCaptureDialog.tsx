import * as React from 'react'
import { Camera, RotateCcw, Check, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to capture photo'))), 'image/jpeg', 0.85)
  })
}

/**
 * Two-shot verification capture for out-of-geofence punch requests. Opens
 * the device camera via getUserMedia, lets the employee take two photos one
 * after another (retake either before confirming), then hands both back as
 * Blobs — the caller submits them with the punch request.
 */
export function CameraCaptureDialog({
  open,
  onClose,
  onCapture,
}: {
  open: boolean
  onClose: () => void
  onCapture: (photo1: Blob, photo2: Blob) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [shots, setShots] = React.useState<{ blob: Blob; url: string }[]>([])

  const startCamera = React.useCallback(() => {
    setError(null)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError('Camera access was denied. Please allow camera permission and try again.'))
  }, [])

  React.useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setShots((prev) => {
        prev.forEach((s) => URL.revokeObjectURL(s.url))
        return []
      })
      setError(null)
      return
    }
    startCamera()
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open, startCamera])

  const capture = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob = await canvasToBlob(canvas)
    const url = URL.createObjectURL(blob)
    setShots((prev) => [...prev, { blob, url }].slice(0, 2))
  }

  const retake = () => {
    setShots((prev) => {
      prev.forEach((s) => URL.revokeObjectURL(s.url))
      return []
    })
  }

  const confirm = () => {
    if (shots.length !== 2) return
    onCapture(shots[0].blob, shots[1].blob)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-4" /> Verification Photos ({shots.length}/2)
          </DialogTitle>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-destructive text-center">{error}</p>
            <p className="text-xs text-muted-foreground text-center">
              If you already denied access, enable it in your browser's site settings for this page, then try again.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startCamera}>
              <RotateCcw className="size-3.5" /> Try Again
            </Button>
          </div>
        ) : shots.length < 2 ? (
          <div className="space-y-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Take {shots.length === 0 ? 'your first' : 'a second'} photo to verify you're the one punching in.
            </p>
            <Button className="w-full gap-2" onClick={capture}>
              <Camera className="size-4" /> Capture Photo {shots.length + 1}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {shots.map((s, i) => (
                <img key={i} src={s.url} alt={`Shot ${i + 1}`} className="aspect-square w-full rounded-lg object-cover border" />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={retake}>
                <RotateCcw className="size-3.5" /> Retake
              </Button>
              <Button className="flex-1 gap-1.5" onClick={confirm}>
                <Check className="size-3.5" /> Submit
              </Button>
            </div>
          </div>
        )}

        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onClose}>
          <X className="size-3.5" /> Cancel
        </Button>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  )
}

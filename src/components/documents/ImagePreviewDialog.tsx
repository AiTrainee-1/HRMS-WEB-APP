import * as React from 'react'
import { Download, ExternalLink, Maximize, Minus, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const STEPS = [1, 1.5, 2, 3, 4]

/**
 * A photo document shown in the app: zoom in and out with the buttons (or the + and - keys, or a double-click), drag the
 * scroll bars or the image to look around, and download or open it full size.
 */
export function ImagePreviewDialog({
  open,
  onOpenChange,
  url,
  name,
  meta,
  onDownload,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string | null
  name: string
  meta?: string
  onDownload: () => void
}) {
  const [step, setStep] = React.useState(0)
  const viewport = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const zoom = STEPS[step]

  React.useEffect(() => {
    if (open) setStep(0)
  }, [open, url])

  const change = (delta: number) => setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,1000px)] max-w-none flex-col gap-3 sm:max-w-none">
        <DialogHeader>
          <DialogTitle className="truncate pr-10">{name}</DialogTitle>
          {meta && <DialogDescription>{meta}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border hairline p-1" role="group" aria-label="Zoom">
            <Button variant="ghost" size="icon" className="size-10 sm:size-9" onClick={() => change(-1)} disabled={step === 0} aria-label="Zoom out">
              <Minus />
            </Button>
            <span className="w-14 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="size-10 sm:size-9" onClick={() => change(1)} disabled={step === STEPS.length - 1} aria-label="Zoom in">
              <Plus />
            </Button>
            <Button variant="ghost" size="icon" className="size-10 sm:size-9" onClick={() => setStep(0)} disabled={step === 0} aria-label="Fit to the window">
              <Maximize />
            </Button>
          </div>
          <div className="ml-auto flex gap-2">
            {url && (
              <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-8">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Full size
                </a>
              </Button>
            )}
            <Button size="sm" onClick={onDownload} className="min-h-11 sm:min-h-8">
              <Download /> Download
            </Button>
          </div>
        </div>
        <div
          ref={viewport}
          tabIndex={0}
          aria-label={`${name}, zoom ${Math.round(zoom * 100)} percent. Use plus and minus to zoom.`}
          className="focus-ring scrollbar-thin min-h-[40vh] flex-1 overflow-auto rounded-lg border hairline bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:20px_20px]"
          style={{ cursor: zoom > 1 ? 'grab' : 'zoom-in' }}
          onKeyDown={(e) => {
            if (e.key === '+' || e.key === '=') change(1)
            if (e.key === '-') change(-1)
            if (e.key === '0') setStep(0)
          }}
          onPointerDown={(e) => {
            const el = viewport.current
            if (!el || zoom === 1 || e.pointerType !== 'mouse') return
            drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
            el.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const el = viewport.current
            const d = drag.current
            if (!el || !d) return
            el.scrollLeft = d.left - (e.clientX - d.x)
            el.scrollTop = d.top - (e.clientY - d.y)
          }}
          onPointerUp={() => (drag.current = null)}
          onDoubleClick={() => setStep((s) => (s === 0 ? 2 : 0))}
        >
          {url ? (
            <img
              src={url}
              alt={name}
              draggable={false}
              className="mx-auto block max-w-none transition-[width] duration-200 select-none"
              style={{ width: `${zoom * 100}%`, maxHeight: zoom === 1 ? '70vh' : undefined, objectFit: 'contain' }}
            />
          ) : null}
        </div>
        <p className="text-[12px] text-muted-foreground">Double-click the picture to zoom; drag it to look around.</p>
      </DialogContent>
    </Dialog>
  )
}

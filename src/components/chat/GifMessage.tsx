import * as React from 'react'
import { Check, ImageOff, Loader2, Play, RotateCcw } from 'lucide-react'
import { useChatMediaUrl, useNearScreen } from '@/hooks/useChatMedia'
import type { ChatMsg } from '@/api/home-chat'
import { cn } from '@/lib/utils'

export const GIF_WIDTH = 232

/** A GIF's box: its own shape, kept between tall-ish and wide-ish so a bubble never towers over the chat. */
function gifRatio(m: ChatMsg): number {
  const w = m.media?.width ?? 0
  const h = m.media?.height ?? 0
  return w > 0 && h > 0 ? Math.max(0.62, Math.min(1.8, w / h)) : 1.25
}

/**
 * An animated GIF in a bubble (owner 2026-11-25): fetched with the sign-in once it is near the screen
 * (hooks/useChatMedia), the time on a small dark pill over its corner. Click to see it large (where it can be saved).
 * With reduced motion it does not play by itself: a still first frame with a Play badge; it plays in the large view.
 */
export function GifMessage({
  message,
  now,
  isMine,
  time,
  reduced,
  who,
  onOpen,
}: {
  message: ChatMsg
  now: Date
  isMine: boolean
  time: string
  reduced: boolean
  who: string
  onOpen: (m: ChatMsg, url: string) => void
}) {
  const box = React.useRef<HTMLButtonElement>(null)
  const near = useNearScreen(box)
  const { url, status, retry } = useChatMediaUrl(message, now, near)
  const [broken, setBroken] = React.useState(false)
  const ratio = gifRatio(message)

  const label =
    status === 'ready' && !broken
      ? `GIF from ${who}. Open it large`
      : status === 'error' || broken
        ? `GIF from ${who} could not be loaded. Try again`
        : `GIF from ${who}, loading`

  return (
    <button
      ref={box}
      type="button"
      aria-label={`${label}. Sent at ${time}`}
      onClick={() => {
        if (status === 'ready' && url && !broken) onOpen(message, url)
        else if (status === 'error' || broken) {
          setBroken(false)
          retry()
        }
      }}
      style={{ width: GIF_WIDTH, aspectRatio: String(ratio) }}
      className="focus-ring relative block max-w-full overflow-hidden rounded-[10px] bg-foreground/[0.06]"
    >
      {status === 'ready' && url && !broken ? (
        reduced ? (
          <StillFrame url={url} onError={() => setBroken(true)} />
        ) : (
          <img src={url} alt="" draggable={false} onError={() => setBroken(true)} className="size-full object-cover" />
        )
      ) : status === 'error' || broken ? (
        <span className="absolute inset-0 grid place-items-center text-[12.5px] text-muted-foreground">
          <span className="flex flex-col items-center gap-1.5">
            <RotateCcw className="size-5" aria-hidden="true" />
            Couldn’t load · Try again
          </span>
        </span>
      ) : status === 'expired' ? (
        <span className="absolute inset-0 grid place-items-center text-muted-foreground">
          <ImageOff className="size-6" aria-hidden="true" />
        </span>
      ) : (
        <span className="skeleton-shimmer absolute inset-0 grid place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        </span>
      )}
      {reduced && status === 'ready' && !broken && (
        <span aria-hidden="true" className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white">
          <Play className="ml-0.5 size-5 fill-current" />
        </span>
      )}
      <span aria-hidden="true" className="absolute top-1.5 left-1.5 rounded bg-black/55 px-1.5 py-px text-[10px] font-bold tracking-wide text-white">
        GIF
      </span>
      <span
        aria-hidden="true"
        className={cn('absolute right-1.5 bottom-1.5 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-px text-[10.5px] text-white tabular-nums')}
      >
        {time}
        {isMine && <Check className="size-3 opacity-80" />}
      </span>
    </button>
  )
}

/** The first frame of a GIF, drawn once onto a canvas (reduced motion: nothing moves until the person asks). */
function StillFrame({ url, onError }: { url: string; onError: () => void }) {
  const canvas = React.useRef<HTMLCanvasElement>(null)
  const failed = React.useRef(onError)
  React.useEffect(() => {
    failed.current = onError
  }, [onError])
  React.useEffect(() => {
    const img = new Image()
    let live = true
    img.onload = () => {
      const c = canvas.current
      if (!live || !c) return
      c.width = img.naturalWidth || 1
      c.height = img.naturalHeight || 1
      c.getContext('2d')?.drawImage(img, 0, 0)
    }
    img.onerror = () => {
      if (live) failed.current()
    }
    img.src = url
    return () => {
      live = false
    }
  }, [url])
  return <canvas ref={canvas} aria-hidden="true" className="size-full object-cover" />
}

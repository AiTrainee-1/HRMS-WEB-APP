import * as React from 'react'
import { Loader2, Mic, Pause, Play, RotateCcw } from 'lucide-react'
import { barsForMessage, formatDuration, seekPosition, stepPosition } from '@/lib/chat-media'
import { idNum } from '@/lib/chat-thread'
import { useChatMediaUrl } from '@/hooks/useChatMedia'
import type { ChatMsg } from '@/api/home-chat'
import { cn } from '@/lib/utils'
import { seekVoice, toggleVoice, useVoiceTrack } from './voice-playback'

/**
 * A voice message in a bubble (owner 2026-11-25): play / pause, the sender's waveform filling in as it plays, and the
 * length. Click or drag along the waveform to jump; with the keyboard it is a slider (arrows: 5 s, Home / End). The
 * file is fetched with the sign-in the first time it is played (hooks/useChatMedia) and plays through the chat's one
 * shared player (voice-playback.ts), so starting one stops another.
 */
export function VoiceMessage({ message, now, isMine, who }: { message: ChatMsg; now: Date; isMine: boolean; who: string }) {
  // Fetched only once wanted (the first Play) or when this tab already has the file.
  const [wanted, setWanted] = React.useState(false)
  const { url, status, retry } = useChatMediaUrl(message, now, wanted)
  const track = useVoiceTrack(message.id)
  const [dragMs, setDragMs] = React.useState<number | null>(null)
  const playWhenReady = React.useRef(false)
  const wave = React.useRef<HTMLDivElement>(null)

  const bars = React.useMemo(() => barsForMessage(message.media?.waveform, Number.isFinite(idNum(message.id)) ? idNum(message.id) : 0), [message.media?.waveform, message.id])
  const durationMs = message.media?.durationMs || track.durationMs || 0
  const active = track.playing || track.positionMs > 0 || track.loading
  const positionMs = dragMs ?? (active ? track.positionMs : 0)
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0
  const ready = status === 'ready' && !!url
  const busy = (wanted && status === 'loading') || track.loading

  React.useEffect(() => {
    if (ready && url && playWhenReady.current) {
      playWhenReady.current = false
      toggleVoice(message.id, url)
    }
  }, [ready, url, message.id])

  const toggle = () => {
    if (status === 'error' || track.failed) {
      playWhenReady.current = true
      retry()
      return
    }
    if (ready && url) toggleVoice(message.id, url)
    else {
      playWhenReady.current = true
      setWanted(true)
    }
  }

  const seekTo = (ms: number) => {
    if (!ready || !url) {
      playWhenReady.current = true
      setWanted(true)
      return
    }
    seekVoice(message.id, url, ms)
  }

  const xToMs = (clientX: number) => {
    const el = wave.current
    if (!el) return 0
    const box = el.getBoundingClientRect()
    return seekPosition(clientX - box.left, box.width, durationMs)
  }

  const shownMs = active || dragMs != null ? positionMs : durationMs
  const failed = status === 'error' || track.failed
  const label = failed ? `Voice message from ${who} could not be played. Try again` : track.playing ? `Pause voice message from ${who}` : `Play voice message from ${who}, ${formatDuration(durationMs)}`

  return (
    <div className="flex w-[min(260px,62vw)] items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={cn(
          'focus-ring grid size-10 shrink-0 place-items-center rounded-full transition-transform active:scale-95',
          isMine ? 'bg-white/20 text-primary-foreground hover:bg-white/30' : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : failed ? (
          <RotateCcw className="size-[18px]" aria-hidden="true" />
        ) : track.playing ? (
          <Pause className="size-5 fill-current" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          ref={wave}
          role="slider"
          tabIndex={0}
          aria-label={`Position in voice message from ${who}`}
          aria-valuemin={0}
          aria-valuemax={Math.round(durationMs / 1000)}
          aria-valuenow={Math.round(positionMs / 1000)}
          aria-valuetext={`${formatDuration(positionMs)} of ${formatDuration(durationMs)}`}
          className="focus-ring flex h-8 cursor-pointer touch-none items-center gap-[2px] rounded-md"
          onPointerDown={(e) => {
            if (e.button !== 0) return
            e.stopPropagation() // dragging along the waveform is not the bubble's long press
            e.currentTarget.setPointerCapture(e.pointerId)
            setDragMs(xToMs(e.clientX))
          }}
          onPointerMove={(e) => {
            if (dragMs != null) setDragMs(xToMs(e.clientX))
          }}
          onPointerUp={(e) => {
            if (dragMs == null) return
            const ms = xToMs(e.clientX)
            setDragMs(null)
            seekTo(ms)
          }}
          onPointerCancel={() => setDragMs(null)}
          onKeyDown={(e) => {
            const next = stepPosition(e.key, positionMs, durationMs)
            if (next == null) return
            e.preventDefault()
            seekTo(next)
          }}
        >
          {bars.map((h, i) => {
            const played = (i + 0.5) / bars.length <= progress
            return (
              <span
                key={i}
                aria-hidden="true"
                style={{ height: `${Math.round(Math.max(0.12, h) * 100)}%` }}
                className={cn(
                  'min-w-[2px] flex-1 rounded-full transition-colors duration-150',
                  isMine ? (played ? 'bg-primary-foreground' : 'bg-primary-foreground/40') : played ? 'bg-primary' : 'bg-foreground/25',
                )}
              />
            )
          })}
        </div>
        <div className={cn('mt-0.5 flex items-center gap-1 text-[11px] tabular-nums', isMine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          <Mic className="size-3" aria-hidden="true" />
          <span>{formatDuration(shownMs)}</span>
          {failed && <span className="ml-1 font-semibold">· Couldn’t play</span>}
        </div>
      </div>
    </div>
  )
}

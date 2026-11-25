import { useSyncExternalStore } from 'react'
import { onSignOut } from '@/lib/session-cleanup'

/**
 * One audio player for the whole chat (owner 2026-11-25): only one voice message plays at a time, as in WhatsApp, and
 * a long thread of voice messages does not hold an <audio> per bubble. A bubble reads only ITS OWN progress
 * (useVoiceTrack): the progress updates re-draw the playing bubble and nothing else.
 */

export interface VoiceTrack {
  playing: boolean
  positionMs: number
  /** What the file says (a browser recording may not know its length: then 0, and the message's own figure is used). */
  durationMs: number
  loading: boolean
  failed: boolean
}

const IDLE: VoiceTrack = { playing: false, positionMs: 0, durationMs: 0, loading: false, failed: false }

let audio: HTMLAudioElement | null = null
let activeId: string | null = null
let activeUrl: string | null = null
let track: VoiceTrack = IDLE
let frame = 0
const listeners = new Set<() => void>()

function publish(next: Partial<VoiceTrack>) {
  const merged = { ...track, ...next }
  if (
    merged.playing === track.playing &&
    merged.loading === track.loading &&
    merged.failed === track.failed &&
    merged.durationMs === track.durationMs &&
    Math.abs(merged.positionMs - track.positionMs) < 1
  ) {
    return
  }
  track = merged
  listeners.forEach((l) => l())
}

function fileDurationMs(a: HTMLAudioElement): number {
  return Number.isFinite(a.duration) && a.duration > 0 ? Math.round(a.duration * 1000) : 0
}

/** While playing, the position is read every animation frame (smooth progress), at most ~20 times a second. */
function tick() {
  cancelAnimationFrame(frame)
  if (!audio || audio.paused) return
  let last = 0
  const step = (t: number) => {
    if (!audio || audio.paused) return
    if (t - last > 50) {
      last = t
      publish({ positionMs: Math.round(audio.currentTime * 1000), durationMs: fileDurationMs(audio) })
    }
    frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

function player(): HTMLAudioElement {
  if (audio) return audio
  const a = new Audio()
  a.preload = 'auto'
  a.addEventListener('playing', () => {
    publish({ playing: true, loading: false, failed: false })
    tick()
  })
  a.addEventListener('pause', () => publish({ playing: false, positionMs: Math.round(a.currentTime * 1000) }))
  a.addEventListener('waiting', () => publish({ loading: true }))
  a.addEventListener('loadedmetadata', () => publish({ durationMs: fileDurationMs(a) }))
  a.addEventListener('durationchange', () => publish({ durationMs: fileDurationMs(a) }))
  a.addEventListener('ended', () => {
    cancelAnimationFrame(frame)
    // back to the start, like WhatsApp: the bubble shows the full length again
    publish({ playing: false, loading: false, positionMs: 0 })
    activeId = null
    listeners.forEach((l) => l())
  })
  a.addEventListener('error', () => {
    if (!activeId) return
    publish({ playing: false, loading: false, failed: true })
  })
  audio = a
  return a
}

/** Play / pause this message's file (a different message stops the current one first). */
export function toggleVoice(id: number | string, url: string): void {
  const k = String(id)
  const a = player()
  if (activeId === k && activeUrl === url) {
    if (a.paused) void a.play().catch(() => publish({ playing: false, loading: false, failed: true }))
    else a.pause()
    return
  }
  a.pause()
  cancelAnimationFrame(frame)
  activeId = k
  activeUrl = url
  track = { ...IDLE, loading: true }
  listeners.forEach((l) => l())
  a.src = url
  a.currentTime = 0
  void a.play().catch(() => publish({ playing: false, loading: false, failed: true }))
}

/** Jump within the playing (or paused) message; a message that is not the current one starts there. */
export function seekVoice(id: number | string, url: string, ms: number): void {
  const k = String(id)
  const a = player()
  if (activeId !== k || activeUrl !== url) {
    toggleVoice(id, url)
  }
  try {
    a.currentTime = Math.max(0, ms / 1000)
  } catch {
    // not seekable yet: it starts from the beginning instead
  }
  publish({ positionMs: Math.max(0, Math.round(ms)) })
}

export function stopVoice(): void {
  cancelAnimationFrame(frame)
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  activeId = null
  activeUrl = null
  track = IDLE
  listeners.forEach((l) => l())
}
onSignOut(stopVoice)

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** This message's playback: its position while it is the one playing (or paused part-way), otherwise idle. */
export function useVoiceTrack(id: number | string): VoiceTrack {
  const k = String(id)
  return useSyncExternalStore(
    subscribe,
    () => (activeId === k ? track : IDLE),
    () => IDLE,
  )
}

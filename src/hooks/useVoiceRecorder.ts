import * as React from 'react'
import { VOICE_MAX_MS, baseMime, pickRecorderMime, rmsOf, rmsToLevel } from '@/lib/chat-media'

/**
 * Records a voice message in the browser (owner 2026-11-25): the microphone through MediaRecorder (WebM / Opus on
 * Chrome, Edge and Firefox, MP4 / AAC on Safari - lib/chat-media.ts pickRecorderMime), its loudness sampled ten times
 * a second for the live waveform and the bars sent with the message, and a hard stop at two minutes (`onLimit`).
 * The microphone is released as soon as the recording ends, is cancelled or the component goes away.
 */

export interface Recording {
  blob: Blob
  /** The type the browser really made ("audio/webm", "audio/mp4" ...). */
  mime: string
  durationMs: number
  /** Loudness 0..1, ten readings a second. */
  levels: number[]
}

export type StartOutcome = { ok: true } | { ok: false; reason: string }

type Phase = 'idle' | 'starting' | 'recording'

const SAMPLE_MS = 100

export function voiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  )
}

export function useVoiceRecorder({ onLimit }: { onLimit: () => void }) {
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [elapsedMs, setElapsedMs] = React.useState(0)
  /** The latest readings (for the live bars), newest last. */
  const [live, setLive] = React.useState<number[]>([])

  const session = React.useRef<{
    stream: MediaStream
    recorder: MediaRecorder
    chunks: Blob[]
    levels: number[]
    startedAt: number
    ctx: AudioContext | null
    timer: number
    mime: string
  } | null>(null)
  const limitRef = React.useRef(onLimit)
  React.useEffect(() => {
    limitRef.current = onLimit
  }, [onLimit])

  const release = React.useCallback(() => {
    const s = session.current
    session.current = null
    if (!s) return
    window.clearInterval(s.timer)
    s.stream.getTracks().forEach((t) => t.stop())
    void s.ctx?.close().catch(() => undefined)
  }, [])

  const start = React.useCallback(async (): Promise<StartOutcome> => {
    if (session.current) return { ok: true }
    if (!voiceRecordingSupported()) return { ok: false, reason: 'Unsupported' }
    setPhase('starting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    } catch (err) {
      setPhase('idle')
      return { ok: false, reason: (err as { name?: string })?.name ?? 'Error' }
    }
    const mime = pickRecorderMime((m) => MediaRecorder.isTypeSupported(m))
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 })
    } catch {
      try {
        recorder = new MediaRecorder(stream)
      } catch {
        stream.getTracks().forEach((t) => t.stop())
        setPhase('idle')
        return { ok: false, reason: 'Unsupported' }
      }
    }

    // loudness for the waveform (a recording still works without it)
    let ctx: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        ctx = new Ctx()
        analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)
      }
    } catch {
      ctx = null
      analyser = null
    }
    const buf = analyser ? new Float32Array(analyser.fftSize) : null

    const s = {
      stream,
      recorder,
      chunks: [] as Blob[],
      levels: [] as number[],
      startedAt: performance.now(),
      ctx,
      timer: 0,
      mime: recorder.mimeType || mime,
    }
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) s.chunks.push(e.data)
    }
    s.timer = window.setInterval(() => {
      const elapsed = performance.now() - s.startedAt
      let level = 0
      if (analyser && buf) {
        analyser.getFloatTimeDomainData(buf)
        level = rmsToLevel(rmsOf(buf))
      }
      s.levels.push(level)
      setElapsedMs(Math.min(VOICE_MAX_MS, elapsed))
      setLive((prev) => (prev.length >= 48 ? [...prev.slice(1), level] : [...prev, level]))
      if (elapsed >= VOICE_MAX_MS) limitRef.current()
    }, SAMPLE_MS)
    session.current = s
    try {
      recorder.start(1000)
    } catch {
      release()
      setPhase('idle')
      return { ok: false, reason: 'Unsupported' }
    }
    setElapsedMs(0)
    setLive([])
    setPhase('recording')
    return { ok: true }
  }, [release])

  /** Ends the recording: the file when `keep`, nothing (and the microphone released) otherwise. */
  const stop = React.useCallback(
    async (keep: boolean): Promise<Recording | null> => {
      const s = session.current
      if (!s) return null
      window.clearInterval(s.timer)
      const durationMs = Math.min(VOICE_MAX_MS, Math.round(performance.now() - s.startedAt))
      const done = new Promise<void>((resolve) => {
        if (s.recorder.state === 'inactive') return resolve()
        s.recorder.addEventListener('stop', () => resolve(), { once: true })
        window.setTimeout(resolve, 1500) // a recorder that never says it stopped must not hold the composer
      })
      try {
        if (s.recorder.state !== 'inactive') s.recorder.stop()
      } catch {
        // already stopped
      }
      await done
      release()
      setPhase('idle')
      setElapsedMs(0)
      setLive([])
      if (!keep || !s.chunks.length) return null
      const type = baseMime(s.chunks[0].type || s.mime) || 'audio/webm'
      return { blob: new Blob(s.chunks, { type }), mime: type, durationMs, levels: s.levels }
    },
    [release],
  )

  // leaving the page mid-recording: nothing is sent and the microphone goes off
  React.useEffect(
    () => () => {
      const s = session.current
      if (!s) return
      try {
        if (s.recorder.state !== 'inactive') s.recorder.stop()
      } catch {
        // already stopped
      }
      release()
    },
    [release],
  )

  return { phase, recording: phase === 'recording', elapsedMs, live, start, stop }
}

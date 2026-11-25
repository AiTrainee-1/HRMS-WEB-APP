// GIFs and voice messages in Team Chat (owner 2026-11-25) - the pure rules, no React, no DOM and no network, so
// `npm test` covers them (chat-media.test.ts). A port of the mobile app's src/lib/chatMedia.ts plus what a browser
// needs on top:
//  - which picked file may be sent as a GIF (a real GIF, at most 8 MB - the server checks again),
//  - which recording format to ask the browser for (WebM / Ogg Opus on Chrome, Edge and Firefox, MP4 / AAC on Safari),
//  - when a GIF / voice message has expired (the server's word, or its expiry time has passed on this computer),
//  - "0:07" style lengths, "Expires in 3 days" labels,
//  - turning the microphone's loudness into the waveform bars that are drawn and sent with the message.

export type ChatKind = 'text' | 'gif' | 'voice'

export interface ChatMediaInfo {
  /** Where the file is served (members of the channel only, with the sign-in); null once it has expired. */
  url: string | null
  mime: string | null
  size: number | null
  durationMs: number | null
  width: number | null
  height: number | null
  /** Up to 64 loudness bars 0-100, as the sender's device recorded them. */
  waveform: number[] | null
  expiresAt: string | null
  expired: boolean
}

export interface MediaMessageLike {
  id: number | string
  kind?: ChatKind | string | null
  media?: ChatMediaInfo | null
}

export const GIF_MAX_BYTES = 8 * 1024 * 1024
/** A voice message stops by itself at two minutes. */
export const VOICE_MAX_MS = 120_000
/** Anything shorter than this is treated as a mis-click and thrown away. */
export const VOICE_MIN_MS = 700
/** Bars sent to the server (its limit is 64). */
export const WAVEFORM_UPLOAD_BARS = 64
/** Bars drawn in a bubble. */
export const WAVEFORM_BARS = 36

export const VOICE_TEXT = '🎤 Voice message'
export const GIF_TEXT = '🖼️ GIF'

export function messageKind(m: { kind?: string | null } | null | undefined): ChatKind {
  const k = m?.kind
  return k === 'gif' || k === 'voice' ? k : 'text'
}

export function isMediaMessage(m: MediaMessageLike | null | undefined): boolean {
  return messageKind(m) !== 'text'
}

/**
 * True when a GIF / voice message can no longer be seen in the chat: the server said so (no link), or its expiry time
 * has passed here even though the next poll has not said so yet.
 */
export function isMediaExpired(m: MediaMessageLike, now: Date): boolean {
  if (!isMediaMessage(m)) return false
  const media = m.media
  if (!media || media.expired || !media.url) return true
  if (media.expiresAt) {
    const t = new Date(media.expiresAt).getTime()
    if (!Number.isNaN(t) && t <= now.getTime()) return true
  }
  return false
}

/** "0:07", "1:05", "2:00" */
export function formatDuration(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((Number.isFinite(ms ?? NaN) ? (ms as number) : 0) / 1000))
  const m = Math.floor(total / 60)
  const s = String(total % 60).padStart(2, '0')
  return `${m}:${s}`
}

/** "Expires today", "Expires tomorrow", "Expires in 5 days" - null when there is no expiry or it has passed. */
export function expiryLabel(expiresAt: string | null | undefined, now: Date): string | null {
  if (!expiresAt) return null
  const t = new Date(expiresAt)
  if (Number.isNaN(t.getTime()) || t.getTime() <= now.getTime()) return null
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(t) - startOf(now)) / 86_400_000)
  if (days <= 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
}

/** "GIFs and voice messages disappear after 7 days." for the composer; a general sentence when the period is unknown. */
export function expiryNote(days: number | null | undefined): string {
  if (typeof days === 'number' && Number.isFinite(days) && days > 0) {
    return `GIFs and voice messages disappear from the chat after ${days} day${days === 1 ? '' : 's'}.`
  }
  return 'GIFs and voice messages disappear from the chat after a few days.'
}

/** The words a one-line preview (a reply's quote, the actions menu) uses for a message. */
export function previewText(m: { kind?: string | null; text: string; media?: ChatMediaInfo | null }): string {
  const kind = messageKind(m)
  if (kind === 'voice') {
    const ms = m.media?.durationMs
    return ms ? `${VOICE_TEXT} (${formatDuration(ms)})` : VOICE_TEXT
  }
  if (kind === 'gif') return GIF_TEXT
  return m.text
}

// ── picking a GIF ────────────────────────────────────────────────────────────

export interface PickedFile {
  name?: string | null
  type?: string | null
  size?: number | null
}

/** Null when the picked file can be sent as a GIF, otherwise the sentence that says why not. */
export function gifPickProblem(file: PickedFile | null | undefined, maxBytes = GIF_MAX_BYTES): string | null {
  if (!file) return 'No picture was chosen.'
  const mime = (file.type ?? '').toLowerCase()
  const name = (file.name ?? '').toLowerCase()
  // the type the browser reports wins; only when it reports none does the file name decide
  const looksGif = mime ? mime === 'image/gif' : name.endsWith('.gif')
  if (!looksGif) return 'That picture is not a GIF. Please choose a .gif file.'
  if (typeof file.size === 'number' && file.size <= 0) return 'That file is empty. Please choose another GIF.'
  if (typeof file.size === 'number' && file.size > maxBytes) {
    return `That GIF is larger than ${Math.round(maxBytes / (1024 * 1024))} MB. Please choose a smaller one.`
  }
  return null
}

/** True when the file's first bytes are a GIF's ("GIF87a" / "GIF89a"): a renamed picture is caught before upload. */
export function isGifHeader(bytes: ArrayLike<number>): boolean {
  if (bytes.length < 6) return false
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5])
  return sig === 'GIF87a' || sig === 'GIF89a'
}

// ── recording in a browser ───────────────────────────────────────────────────

/**
 * What the recorder is asked for, best first. Chrome, Edge and Firefox record Opus in WebM / Ogg; Safari records AAC in
 * MP4. The server takes all of these (backend api/chat_media.py) and the Android app plays them.
 */
export const RECORDER_MIME_PREFERENCE = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/aac',
] as const

/** The first format the browser can record, or '' to let it choose (and the blob then says what it made). */
export function pickRecorderMime(isSupported: (mime: string) => boolean): string {
  for (const mime of RECORDER_MIME_PREFERENCE) {
    try {
      if (isSupported(mime)) return mime
    } catch {
      // a browser that throws for an unknown type: try the next one
    }
  }
  return ''
}

/** "audio/webm;codecs=opus" -> "audio/webm". */
export function baseMime(mime: string | null | undefined): string {
  return String(mime ?? '').split(';')[0].trim().toLowerCase()
}

/** The extension a file of this type is saved / uploaded with. */
export function extensionForMime(mime: string | null | undefined, kind: ChatKind | string | null | undefined = 'voice'): string {
  const m = baseMime(mime)
  if (m === 'image/gif') return 'gif'
  if (m === 'image/png') return 'png'
  if (m === 'image/jpeg') return 'jpg'
  if (m === 'image/webp') return 'webp'
  if (m === 'audio/webm' || m === 'video/webm') return 'webm'
  if (m === 'audio/ogg') return 'ogg'
  if (m === 'audio/aac') return 'aac'
  if (m === 'audio/3gpp') return '3gp'
  if (m === 'audio/mp4' || m === 'audio/x-m4a' || m === 'audio/m4a') return 'm4a'
  return kind === 'gif' ? 'gif' : 'm4a'
}

/** "voice.webm" - the name a recording is uploaded under. */
export function voiceFileName(mime: string | null | undefined): string {
  return `voice.${extensionForMime(mime, 'voice')}`
}

/** "uktextiles-voice-123.webm" / "uktextiles-gif-123.gif" - the name of a copy saved from the chat. */
export function mediaSaveName(id: number | string, kind: ChatKind | string | null | undefined, mime: string | null | undefined): string {
  const k = kind === 'gif' ? 'gif' : 'voice'
  return `uktextiles-${k}-${id}.${extensionForMime(mime, k)}`
}

// ── waveforms ────────────────────────────────────────────────────────────────

/** Loudness in decibels (0 = loudest, about -160 = silence) as 0..1, floor at -55 dB. */
export function meteringToLevel(db: number | null | undefined): number {
  if (typeof db !== 'number' || Number.isNaN(db)) return 0
  const FLOOR = -55
  if (db >= 0) return 1
  if (db <= FLOOR) return 0
  const linear = (db - FLOOR) / -FLOOR
  // a gentle curve so quiet speech still shows as bars
  return Math.round(Math.pow(linear, 1.4) * 1000) / 1000
}

/** The microphone's RMS amplitude (0..1, from an AnalyserNode's time-domain samples) as a 0..1 bar height. */
export function rmsToLevel(rms: number | null | undefined): number {
  if (typeof rms !== 'number' || !(rms > 0)) return 0
  return meteringToLevel(20 * Math.log10(Math.min(1, rms)))
}

/** The RMS amplitude of time-domain samples (-1..1). */
export function rmsOf(samples: ArrayLike<number>): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i]
  return Math.sqrt(sum / samples.length)
}

/**
 * Squeezes (keeping each group's peak) or stretches a list of 0..1 levels to exactly `count` bars. An empty list gives
 * low flat bars.
 */
export function resampleBars(levels: readonly number[], count: number): number[] {
  if (count <= 0) return []
  if (!levels.length) return Array.from({ length: count }, () => 0.08)
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor((i * levels.length) / count)
    const end = Math.max(start + 1, Math.floor(((i + 1) * levels.length) / count))
    let peak = 0
    for (let j = start; j < end && j < levels.length; j += 1) peak = Math.max(peak, levels[j])
    out.push(Math.max(0, Math.min(1, peak)))
  }
  return out
}

/** What is sent with a voice message: 64 whole numbers 0-100. */
export function waveformForUpload(levels: readonly number[]): number[] {
  return resampleBars(levels, WAVEFORM_UPLOAD_BARS).map((v) => Math.round(v * 100))
}

/** Bars (0..1) to draw for a voice message: the sender's own, or a steady made-up pattern for one without. */
export function barsForMessage(waveform: readonly number[] | null | undefined, seed: number, count = WAVEFORM_BARS): number[] {
  if (waveform && waveform.length) {
    return resampleBars(waveform.map((v) => Math.max(0, Math.min(100, v)) / 100), count).map((v) => Math.max(0.08, v))
  }
  let x = (Math.abs(Math.trunc(seed) || 0) * 2654435761) >>> 0 || 1
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    x ^= x << 13
    x >>>= 0
    x ^= x >>> 17
    x ^= x << 5
    x >>>= 0
    out.push(0.18 + ((x % 1000) / 1000) * 0.6)
  }
  return out
}

/** Where a click / drag at `x` of a waveform `width` wide lands, in milliseconds. */
export function seekPosition(x: number, width: number, durationMs: number): number {
  if (!(width > 0) || !(durationMs > 0)) return 0
  const f = Math.max(0, Math.min(1, x / width))
  return Math.round(f * durationMs)
}

/** A keyboard step on the waveform slider: 5 s, or the whole length for Home / End. */
export function stepPosition(key: string, positionMs: number, durationMs: number): number | null {
  const d = Math.max(0, durationMs)
  if (key === 'ArrowRight' || key === 'ArrowUp') return Math.min(d, positionMs + 5000)
  if (key === 'ArrowLeft' || key === 'ArrowDown') return Math.max(0, positionMs - 5000)
  if (key === 'Home') return 0
  if (key === 'End') return d
  return null
}

// ── errors ───────────────────────────────────────────────────────────────────

/**
 * The words to show for a failed GIF / voice upload: the server's own sentence when it gave one (the app's ApiError
 * carries it as `message` with the answer as `data`), "no internet" when there was no answer at all.
 */
export function uploadErrorMessage(err: unknown, kind: 'gif' | 'voice'): string {
  const e = (err ?? {}) as { status?: number; data?: { error?: unknown }; message?: unknown }
  const server = e.data?.error
  if (typeof server === 'string' && server.trim()) return server
  if (typeof e.status !== 'number') return 'No internet connection. Please check it and try again.'
  if (e.status === 413) return kind === 'gif' ? 'That GIF is too large to send.' : 'That voice message is too large to send.'
  return kind === 'gif' ? 'The GIF wasn’t sent. Please try again.' : 'The voice message wasn’t sent. Please try again.'
}

/** What a microphone failure (getUserMedia's DOMException name) means for the employee. */
export function microphoneProblem(name: string | null | undefined): string {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return "Microphone access is blocked. Allow it in your browser's site settings (the icon left of the address), then try again."
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Plug one in or check your sound settings, then try again.'
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone is busy in another app. Close that app, then try again.'
    case 'Unsupported':
      return 'This browser cannot record voice messages. Please use an up-to-date Chrome, Edge, Firefox or Safari.'
    default:
      return 'The microphone could not be started. Please try again.'
  }
}

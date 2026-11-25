// Run with `npm test`. Team Chat GIFs and voice messages (lib/chat-media.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  GIF_MAX_BYTES,
  WAVEFORM_UPLOAD_BARS,
  barsForMessage,
  baseMime,
  expiryLabel,
  expiryNote,
  extensionForMime,
  formatDuration,
  gifPickProblem,
  isGifHeader,
  isMediaExpired,
  mediaSaveName,
  messageKind,
  meteringToLevel,
  microphoneProblem,
  pickRecorderMime,
  previewText,
  resampleBars,
  rmsOf,
  rmsToLevel,
  seekPosition,
  stepPosition,
  uploadErrorMessage,
  voiceFileName,
  waveformForUpload,
  type ChatMediaInfo,
} from './chat-media.ts'

const now = new Date(2026, 10, 25, 12, 0, 0)
const media = (over: Partial<ChatMediaInfo> = {}): ChatMediaInfo => ({
  url: '/api/chat/messages/9/media',
  mime: 'audio/webm',
  size: 2000,
  durationMs: 7000,
  width: null,
  height: null,
  waveform: null,
  expiresAt: new Date(2026, 10, 30, 12).toISOString(),
  expired: false,
  ...over,
})

describe('kinds and expiry', () => {
  test('a missing or unknown kind is text', () => {
    assert.equal(messageKind({}), 'text')
    assert.equal(messageKind({ kind: 'sticker' }), 'text')
    assert.equal(messageKind({ kind: 'gif' }), 'gif')
    assert.equal(messageKind(null), 'text')
  })
  test('expired by the server, by a missing link or by the clock', () => {
    assert.equal(isMediaExpired({ id: 1, kind: 'voice', media: media() }, now), false)
    assert.equal(isMediaExpired({ id: 1, kind: 'voice', media: media({ expired: true }) }, now), true)
    assert.equal(isMediaExpired({ id: 1, kind: 'voice', media: media({ url: null }) }, now), true)
    assert.equal(isMediaExpired({ id: 1, kind: 'gif', media: null }, now), true)
    assert.equal(isMediaExpired({ id: 1, kind: 'gif', media: media({ expiresAt: new Date(2026, 10, 25, 11).toISOString() }) }, now), true)
    assert.equal(isMediaExpired({ id: 1, kind: 'text', media: null }, now), false)
  })
  test('expiry labels', () => {
    assert.equal(expiryLabel(new Date(2026, 10, 25, 20).toISOString(), now), 'Expires today')
    assert.equal(expiryLabel(new Date(2026, 10, 26, 1).toISOString(), now), 'Expires tomorrow')
    assert.equal(expiryLabel(new Date(2026, 11, 2, 9).toISOString(), now), 'Expires in 7 days')
    assert.equal(expiryLabel(new Date(2026, 10, 24).toISOString(), now), null)
    assert.equal(expiryLabel(null, now), null)
    assert.equal(expiryLabel('nonsense', now), null)
    assert.match(expiryNote(7), /after 7 days/)
    assert.match(expiryNote(1), /after 1 day\./)
    assert.match(expiryNote(null), /a few days/)
  })
  test('durations and previews', () => {
    assert.equal(formatDuration(7000), '0:07')
    assert.equal(formatDuration(65_400), '1:05')
    assert.equal(formatDuration(120_000), '2:00')
    assert.equal(formatDuration(null), '0:00')
    assert.equal(formatDuration(Number.POSITIVE_INFINITY), '0:00')
    assert.equal(previewText({ kind: 'voice', text: 'x', media: media() }), '🎤 Voice message (0:07)')
    assert.equal(previewText({ kind: 'voice', text: 'x', media: null }), '🎤 Voice message')
    assert.equal(previewText({ kind: 'gif', text: 'x' }), '🖼️ GIF')
    assert.equal(previewText({ text: 'hello' }), 'hello')
  })
})

describe('picking a GIF', () => {
  test('the browser type wins, the name decides only without one', () => {
    assert.equal(gifPickProblem({ name: 'fun.gif', type: 'image/gif', size: 1000 }), null)
    assert.equal(gifPickProblem({ name: 'fun.gif', type: '', size: 1000 }), null)
    assert.match(gifPickProblem({ name: 'fun.gif', type: 'image/png', size: 1000 }) ?? '', /not a GIF/)
    assert.match(gifPickProblem({ name: 'photo.jpg', type: '', size: 1000 }) ?? '', /not a GIF/)
    assert.match(gifPickProblem(null) ?? '', /No picture/)
  })
  test('size limits', () => {
    assert.match(gifPickProblem({ name: 'big.gif', type: 'image/gif', size: GIF_MAX_BYTES + 1 }) ?? '', /larger than 8 MB/)
    assert.equal(gifPickProblem({ name: 'ok.gif', type: 'image/gif', size: GIF_MAX_BYTES }), null)
    assert.match(gifPickProblem({ name: 'empty.gif', type: 'image/gif', size: 0 }) ?? '', /empty/)
  })
  test('a real GIF header', () => {
    const bytes = (s: string) => Array.from(s, (c) => c.charCodeAt(0))
    assert.equal(isGifHeader(bytes('GIF89a....')), true)
    assert.equal(isGifHeader(bytes('GIF87a')), true)
    assert.equal(isGifHeader(bytes('\x89PNG\r\n')), false)
    assert.equal(isGifHeader(bytes('GIF')), false)
  })
})

describe('recording formats', () => {
  test('WebM / Opus first, then Ogg, then Safari’s MP4; nothing supported lets the browser choose', () => {
    assert.equal(pickRecorderMime(() => true), 'audio/webm;codecs=opus')
    assert.equal(pickRecorderMime((m) => m.startsWith('audio/ogg')), 'audio/ogg;codecs=opus')
    assert.equal(pickRecorderMime((m) => m === 'audio/mp4'), 'audio/mp4')
    assert.equal(pickRecorderMime(() => false), '')
    assert.equal(
      pickRecorderMime((m) => {
        if (m.includes('webm')) throw new Error('nope')
        return m === 'audio/aac'
      }),
      'audio/aac',
    )
  })
  test('file names and extensions', () => {
    assert.equal(baseMime('audio/webm;codecs=opus'), 'audio/webm')
    assert.equal(voiceFileName('audio/webm;codecs=opus'), 'voice.webm')
    assert.equal(voiceFileName('audio/ogg; codecs=opus'), 'voice.ogg')
    assert.equal(voiceFileName('audio/mp4'), 'voice.m4a')
    assert.equal(voiceFileName(''), 'voice.m4a')
    assert.equal(extensionForMime('image/png', 'gif'), 'png')
    assert.equal(mediaSaveName(12, 'gif', 'image/gif'), 'uktextiles-gif-12.gif')
    assert.equal(mediaSaveName('13', 'voice', 'audio/ogg'), 'uktextiles-voice-13.ogg')
  })
})

describe('waveforms', () => {
  test('loudness to bar height', () => {
    assert.equal(meteringToLevel(0), 1)
    assert.equal(meteringToLevel(-60), 0)
    assert.equal(meteringToLevel(Number.NaN), 0)
    const mid = meteringToLevel(-20)
    assert.ok(mid > 0.3 && mid < 0.8, String(mid))
    assert.equal(rmsToLevel(0), 0)
    assert.equal(rmsToLevel(1), 1)
    assert.ok(rmsToLevel(0.1) > 0 && rmsToLevel(0.1) < 1)
    assert.equal(rmsOf([]), 0)
    assert.equal(Math.round(rmsOf([1, -1, 1, -1]) * 100), 100)
  })
  test('resampling keeps peaks and always gives the asked number of bars', () => {
    assert.deepEqual(resampleBars([0.1, 0.9, 0.2, 0.3], 2), [0.9, 0.3])
    assert.equal(resampleBars([0.5], 5).length, 5)
    assert.deepEqual(resampleBars([], 3), [0.08, 0.08, 0.08])
    assert.deepEqual(resampleBars([1, 2], 0), [])
    const up = waveformForUpload(Array.from({ length: 300 }, (_, i) => (i % 10) / 10))
    assert.equal(up.length, WAVEFORM_UPLOAD_BARS)
    assert.ok(up.every((v) => Number.isInteger(v) && v >= 0 && v <= 100))
  })
  test('drawn bars: the sender’s, or a steady pattern per message', () => {
    const own = barsForMessage([0, 50, 100], 1, 6)
    assert.equal(own.length, 6)
    assert.ok(own.every((v) => v >= 0.08 && v <= 1))
    assert.deepEqual(barsForMessage(null, 42, 8), barsForMessage(null, 42, 8))
    assert.notDeepEqual(barsForMessage(null, 42, 8), barsForMessage(null, 43, 8))
  })
  test('seeking by pointer and by keyboard', () => {
    assert.equal(seekPosition(50, 100, 10_000), 5000)
    assert.equal(seekPosition(-5, 100, 10_000), 0)
    assert.equal(seekPosition(500, 100, 10_000), 10_000)
    assert.equal(seekPosition(10, 0, 10_000), 0)
    assert.equal(stepPosition('ArrowRight', 3000, 10_000), 8000)
    assert.equal(stepPosition('ArrowRight', 8000, 10_000), 10_000)
    assert.equal(stepPosition('ArrowLeft', 3000, 10_000), 0)
    assert.equal(stepPosition('End', 3000, 10_000), 10_000)
    assert.equal(stepPosition('a', 3000, 10_000), null)
  })
})

describe('errors', () => {
  test('the server’s sentence, no internet, or a plain retry', () => {
    assert.equal(uploadErrorMessage({ status: 400, data: { error: 'That GIF is larger than 8 MB.' } }, 'gif'), 'That GIF is larger than 8 MB.')
    assert.match(uploadErrorMessage({ message: 'Network Error' }, 'voice'), /No internet/)
    assert.match(uploadErrorMessage({ status: 500, data: {} }, 'voice'), /voice message wasn’t sent/)
    assert.match(uploadErrorMessage({ status: 413 }, 'gif'), /too large/)
    assert.match(uploadErrorMessage(null, 'gif'), /No internet/)
  })
  test('microphone problems in plain words', () => {
    assert.match(microphoneProblem('NotAllowedError'), /blocked/)
    assert.match(microphoneProblem('NotFoundError'), /No microphone/)
    assert.match(microphoneProblem('NotReadableError'), /busy/)
    assert.match(microphoneProblem('Unsupported'), /cannot record/)
    assert.match(microphoneProblem(undefined), /could not be started/)
  })
})

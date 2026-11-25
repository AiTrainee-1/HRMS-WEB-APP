import * as React from 'react'
import axios from 'axios'
import { chatThreadApi } from '@/api/home-chat'
import { isMediaExpired, type MediaMessageLike } from '@/lib/chat-media'
import { onSignOut } from '@/lib/session-cleanup'

/**
 * This browser's copies of chat GIFs and voice messages (owner 2026-11-25).
 *
 * The server serves a file only to members of the channel and only with the sign-in (GET chat/messages/<id>/media), so
 * it cannot be an <img src> / <audio src> link: each file is fetched once as a blob with the sign-in and shown / played
 * from an object URL. The copies live in memory only (the server sends them `no-store`): an expired message's copy is
 * dropped, the least recently used ones are dropped beyond a budget, and every copy (and its object URL) goes at
 * sign-out, so the next person on the same tab never sees them.
 */

interface Entry {
  url: string
  mime: string
  size: number
  /** Bubbles showing it right now: never evicted while > 0. */
  users: number
  usedAt: number
}

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<Entry>>()
/** Files the server said are gone (410): asked for again only when the message says it is live again. */
const gone = new Set<string>()
const MAX_ENTRIES = 40
const MAX_BYTES = 96 * 1024 * 1024

export class MediaExpiredError extends Error {
  constructor() {
    super('This has expired and is no longer available.')
    this.name = 'MediaExpiredError'
  }
}

function key(id: number | string): string {
  return String(id)
}

function evict() {
  let total = 0
  for (const e of cache.values()) total += e.size
  if (cache.size <= MAX_ENTRIES && total <= MAX_BYTES) return
  const idle = [...cache.entries()].filter(([, e]) => e.users <= 0).sort((a, b) => a[1].usedAt - b[1].usedAt)
  for (const [k, e] of idle) {
    if (cache.size <= MAX_ENTRIES && total <= MAX_BYTES) break
    URL.revokeObjectURL(e.url)
    cache.delete(k)
    total -= e.size
  }
}

function store(id: number | string, blob: Blob): Entry {
  const k = key(id)
  const old = cache.get(k)
  if (old) return old
  const entry: Entry = { url: URL.createObjectURL(blob), mime: blob.type, size: blob.size, users: 0, usedAt: Date.now() }
  cache.set(k, entry)
  gone.delete(k)
  evict()
  return entry
}

/** The file of one message as an object URL, fetching it (once, with the sign-in) when this tab has no copy yet. */
export function loadChatMedia(id: number | string): Promise<Entry> {
  const k = key(id)
  const have = cache.get(k)
  if (have) {
    have.usedAt = Date.now()
    return Promise.resolve(have)
  }
  if (gone.has(k)) return Promise.reject(new MediaExpiredError())
  const running = inflight.get(k)
  if (running) return running
  const job = chatThreadApi
    .mediaBlob(id)
    .then((blob) => {
      if (!blob || !blob.size) throw new Error('The file came back empty.')
      return store(id, blob)
    })
    .catch((err: unknown) => {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 410 || status === 404) {
        gone.add(k)
        throw new MediaExpiredError()
      }
      throw err
    })
    .finally(() => inflight.delete(k))
  inflight.set(k, job)
  return job
}

/** After sending: the file this browser already has becomes that message's copy, so the sender's bubble needs no download. */
export function adoptChatMedia(id: number | string, blob: Blob): void {
  try {
    store(id, blob)
  } catch {
    // the bubble downloads it instead
  }
}

/** Drops one message's copy (it expired). */
export function dropChatMedia(id: number | string): void {
  const k = key(id)
  const e = cache.get(k)
  if (e) {
    URL.revokeObjectURL(e.url)
    cache.delete(k)
  }
  gone.add(k)
}

/** The copy's object URL when this tab already has it (no download). */
export function cachedChatMediaUrl(id: number | string): string | null {
  return cache.get(key(id))?.url ?? null
}

/**
 * Saves a copy of a message's file to the computer / phone (the browser's downloads), while it has not expired: the
 * only way to keep a GIF or a voice message once it disappears from the chat.
 */
export async function downloadChatMedia(id: number | string, fileName: string): Promise<void> {
  const e = await loadChatMedia(id)
  const a = document.createElement('a')
  a.href = e.url
  a.download = fileName
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Every copy and object URL goes at sign-out (and before the next sign-in). */
export function clearChatMedia(): void {
  for (const e of cache.values()) URL.revokeObjectURL(e.url)
  cache.clear()
  inflight.clear()
  gone.clear()
}
onSignOut(clearChatMedia)

export type ChatMediaStatus = 'idle' | 'loading' | 'ready' | 'error' | 'expired'

/**
 * The copy of a GIF / voice message for a bubble: fetched once `active` (the bubble is near the screen), while the
 * message is still available, and dropped (status "expired") once it is not.
 */
export function useChatMediaUrl(m: MediaMessageLike, now: Date, active = true): { url: string | null; status: ChatMediaStatus; retry: () => void } {
  const expired = isMediaExpired(m, now)
  const id = key(m.id)
  const [state, setState] = React.useState<{ id: string; url: string | null; status: ChatMediaStatus }>(() => {
    const url = expired ? null : cachedChatMediaUrl(id)
    return { id, url, status: expired ? 'expired' : url ? 'ready' : 'idle' }
  })
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    if (expired) {
      dropChatMedia(id)
      setState({ id, url: null, status: 'expired' })
      return
    }
    if (!active) return
    let live = true
    let using: Entry | null = null
    setState((s) => (s.id === id && s.status === 'ready' && s.url ? s : { id, url: null, status: 'loading' }))
    loadChatMedia(id)
      .then((e) => {
        if (!live) return
        e.users += 1
        using = e
        setState({ id, url: e.url, status: 'ready' })
      })
      .catch((err) => {
        if (live) setState({ id, url: null, status: err instanceof MediaExpiredError ? 'expired' : 'error' })
      })
    return () => {
      live = false
      if (using) using.users = Math.max(0, using.users - 1)
    }
  }, [id, expired, active, attempt])

  const retry = React.useCallback(() => setAttempt((n) => n + 1), [])
  if (state.id !== id) return { url: null, status: expired ? 'expired' : 'loading', retry }
  return { url: state.url, status: state.status, retry }
}

/** True once `ref` is within `margin` of the visible part of the page (and stays true): media loads only near the screen. */
export function useNearScreen(ref: React.RefObject<Element | null>, margin = '400px'): boolean {
  const [near, setNear] = React.useState(() => typeof IntersectionObserver === 'undefined')
  React.useEffect(() => {
    if (near) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, margin, near])
  return near
}

import * as React from 'react'
import { documentsApi } from '@/api/resources'
import { onSignOut } from '@/lib/session-cleanup'

/**
 * Document files as object URLs, fetched through the authenticated endpoint once per document and kept while the page
 * is open, so "Open" and "Download" work again and again without another download. The URLs are released a minute
 * after the page closes (a tab already showing one keeps its copy).
 */
export function useDocumentFiles() {
  const cache = React.useRef(new Map<number, { url: string; type: string }>())
  const inflight = React.useRef(new Map<number, Promise<{ url: string; type: string }>>())

  React.useEffect(() => {
    const map = cache.current
    const pending = inflight.current
    // Signing out releases the copies at once: the next person on this browser must not reach them.
    const off = onSignOut(() => {
      ;[...map.values()].forEach((v) => URL.revokeObjectURL(v.url))
      map.clear()
      pending.clear()
    })
    return () => {
      off()
      const urls = [...map.values()].map((v) => v.url)
      map.clear()
      setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 60_000)
    }
  }, [])

  return React.useCallback(async (id: number): Promise<{ url: string; type: string }> => {
    const hit = cache.current.get(id)
    if (hit) return hit
    const running = inflight.current.get(id)
    if (running) return running
    const p = documentsApi
      .fetchFile(id)
      .then((blob) => {
        const entry = { url: URL.createObjectURL(blob), type: blob.type || '' }
        cache.current.set(id, entry)
        return entry
      })
      .finally(() => inflight.current.delete(id))
    inflight.current.set(id, p)
    return p
  }, [])
}

/** Saves a file with a given name (an <a download> made for the click, then removed). */
export function saveUrlAs(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

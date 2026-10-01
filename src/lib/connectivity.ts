/**
 * Whether the UKTextiles server can be reached, kept outside React so the axios layer (src/api/client.ts) can
 * report into it and any component can read it with useSyncExternalStore:
 *
 *   const reason = useSyncExternalStore(subscribe, getOfflineReason, getOfflineReason)
 *
 * 'unreachable'  the request got no answer at all (server down, network dropped, DNS/proxy failure)
 * 'unavailable'  a gateway answered 502 / 503 / 504 (server restarting, database offline, restore in progress)
 * null           online (or nothing has failed yet)
 */

export type OfflineReason = 'unreachable' | 'unavailable'

let offlineReason: OfflineReason | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** The current snapshot: a plain string or null, so it is stable between renders. */
export function getOfflineReason(): OfflineReason | null {
  return offlineReason
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function markOffline(reason: OfflineReason) {
  if (offlineReason === reason) return
  offlineReason = reason
  emit()
}

export function markOnline() {
  if (offlineReason === null) return
  offlineReason = null
  emit()
}

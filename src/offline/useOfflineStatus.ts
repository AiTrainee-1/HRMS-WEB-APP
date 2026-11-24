import * as React from 'react'
import type { QueuedOp } from '@/lib/offline-ops'
import { getOfflineStatus, listQueuedOps, subscribeOfflineStatus, subscribeQueueChanges } from '@/offline/engine'

/** The offline sync's status: online / syncing / waiting and failed counts (engine.ts). */
export function useOfflineStatus() {
  return React.useSyncExternalStore(subscribeOfflineStatus, getOfflineStatus, getOfflineStatus)
}

/** The signed-in employee's operations still on this device, oldest first, reloaded whenever the queue changes. */
export function useQueuedOps(kinds?: readonly string[]): QueuedOp[] {
  const [ops, setOps] = React.useState<QueuedOp[]>([])
  const key = kinds?.join('|') ?? ''
  React.useEffect(() => {
    let alive = true
    const wanted = key ? key.split('|') : null
    const load = () =>
      void listQueuedOps().then((all) => {
        if (alive) setOps(wanted ? all.filter((op) => wanted.includes(op.kind)) : all)
      })
    load()
    const stop = subscribeQueueChanges(load)
    return () => {
      alive = false
      stop()
    }
  }, [key])
  return ops
}

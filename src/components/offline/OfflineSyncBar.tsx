import * as React from 'react'
import { Link } from 'wouter'
import { AlertTriangle, CheckCircle2, CloudUpload, RefreshCw, WifiOff, X } from 'lucide-react'
import { API_BASE_URL } from '@/api/client'
import { markOnline } from '@/lib/connectivity'
import { OFFLINE_POPUP_MESSAGE, SYNC_STATE_LABEL, syncState } from '@/lib/offline-ops'
import { syncNow } from '@/offline/engine'
import { useOfflineStatus } from '@/offline/useOfflineStatus'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Is the server reachable again? Plain fetch (never signs out, never flips the connectivity state by itself). */
async function serverAnswers(): Promise<boolean> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 4000)
  try {
    const res = await fetch(`${(API_BASE_URL ?? '').replace(/\/+$/, '')}/healthz?t=${Date.now()}`, { signal: controller.signal })
    return res.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * The offline status (owner 2026-11-24, as the mobile app's OfflineSyncBar): a strip under the header while something
 * is worth saying (Offline / Syncing / Pending n / n could not be sent), a short "All synced" after a sync, and a popup
 * the moment the network goes: "No internet connection. Please turn on your network to sync your data." with Retry.
 * The strip links to the Sync page (/employee/sync), which lists what is still on this device.
 */
export function OfflineSyncBar() {
  const status = useOfflineStatus()
  const state = syncState(status)
  const [popupOpen, setPopupOpen] = React.useState(!status.online)
  const [checking, setChecking] = React.useState(false)
  const [stillOffline, setStillOffline] = React.useState(false)
  const [justSynced, setJustSynced] = React.useState(false)
  const wasSyncing = React.useRef(false)

  // The popup opens each time the network goes, and closes by itself when it is back.
  React.useEffect(() => {
    setPopupOpen(!status.online)
    if (status.online) setStillOffline(false)
  }, [status.online])

  // "All synced" for a few seconds after a sync emptied the queue.
  React.useEffect(() => {
    if (wasSyncing.current && !status.syncing && status.pending === 0 && status.failed === 0) {
      setJustSynced(true)
      const t = window.setTimeout(() => setJustSynced(false), 3500)
      wasSyncing.current = status.syncing
      return () => window.clearTimeout(t)
    }
    wasSyncing.current = status.syncing
  }, [status.syncing, status.pending, status.failed])

  async function retry() {
    setChecking(true)
    setStillOffline(false)
    try {
      const ok = navigator.onLine !== false && (await serverAnswers())
      if (ok) {
        markOnline()
        setPopupOpen(false)
        await syncNow(true)
      } else {
        setStillOffline(true)
      }
    } finally {
      setChecking(false)
    }
  }

  const showStrip = state !== 'online' || status.failed > 0 || justSynced
  const needsAttention = status.failed > 0 && state !== 'offline' && state !== 'syncing'
  const label = needsAttention ? 'Needs attention' : SYNC_STATE_LABEL[state]
  const detail =
    state === 'offline'
      ? status.pending > 0
        ? `${status.pending} waiting to sync. They will be sent when you are back online.`
        : 'What you submit now is saved on this device and sent later.'
      : state === 'syncing'
        ? (status.current ?? 'Sending what was saved on this device…')
        : needsAttention
          ? `${status.failed} could not be sent${status.pending ? ` · ${status.pending} waiting` : ''}. Open to see why.`
          : state === 'pending'
            ? `${status.pending} waiting to sync`
            : 'All synced'

  const tone =
    state === 'offline'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : needsAttention
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
        : state === 'online'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          : 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300'
  const Icon =
    state === 'offline' ? WifiOff : state === 'syncing' ? RefreshCw : needsAttention ? AlertTriangle : state === 'online' ? CheckCircle2 : CloudUpload

  return (
    <>
      {showStrip && (
        <Link
          href="/employee/sync"
          role="status"
          aria-live="polite"
          data-testid="offline-sync-bar"
          data-state={state}
          className={cn('flex shrink-0 items-center gap-2 border-b px-4 py-1.5 text-[12.5px] font-medium lg:px-8', tone)}
        >
          <Icon className={cn('size-3.5 shrink-0', state === 'syncing' && 'animate-spin motion-reduce:animate-none')} aria-hidden />
          <span className="font-semibold">{label}</span>
          <span aria-hidden>·</span>
          <span className="min-w-0 truncate opacity-90">{detail}</span>
        </Link>
      )}

      {popupOpen && (
        <div
          role="alertdialog"
          aria-labelledby="offline-popup-title"
          aria-describedby="offline-popup-text"
          data-testid="offline-popup"
          className="fixed inset-x-4 top-4 z-[70] mx-auto max-w-md rounded-2xl border bg-background p-4 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.45)] sm:top-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <WifiOff className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p id="offline-popup-title" className="font-display text-[15px] font-semibold">
                You are offline
              </p>
              <p id="offline-popup-text" className="mt-0.5 text-[13px] text-muted-foreground">
                {OFFLINE_POPUP_MESSAGE}
              </p>
              {status.pending > 0 && (
                <p className="mt-1.5 text-[12.5px] font-medium text-sky-700 dark:text-sky-300">
                  {status.pending} {status.pending === 1 ? 'request is' : 'requests are'} saved on this device and will sync automatically.
                </p>
              )}
              {stillOffline && (
                <p className="mt-1.5 text-[12.5px] font-medium text-destructive" role="alert">
                  Still no connection. Turn on Wi-Fi or mobile data and try again.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPopupOpen(false)}
              className="-m-1 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPopupOpen(false)}>
              Continue offline
            </Button>
            <Button size="sm" onClick={() => void retry()} disabled={checking} data-testid="offline-popup-retry">
              <RefreshCw className={cn(checking && 'animate-spin motion-reduce:animate-none')} />
              {checking ? 'Checking…' : 'Reconnect'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

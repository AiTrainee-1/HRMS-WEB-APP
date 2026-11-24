import * as React from 'react'
import { AlertTriangle, CheckCircle2, Clock3, CloudUpload, RefreshCw, Trash2, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, GlassCard, PageHero, PageShell } from '@/components/kit'
import { Button } from '@/components/ui/button'
import { SYNC_STATE_LABEL, syncState, type QueuedOp } from '@/lib/offline-ops'
import { discardOp, retryOp, syncNow } from '@/offline/engine'
import { useOfflineStatus, useQueuedOps } from '@/offline/useOfflineStatus'
import { cn } from '@/lib/utils'

function when(ms: number | null): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

function OpRow({ op }: { op: QueuedOp }) {
  const [busy, setBusy] = React.useState<'retry' | 'discard' | null>(null)
  const failed = op.status === 'failed'

  async function discard() {
    if (!window.confirm(`Discard "${op.label}"? It will not be sent to HR.`)) return
    setBusy('discard')
    try {
      await discardOp(op.id)
      toast.success('Discarded')
    } finally {
      setBusy(null)
    }
  }

  async function retry() {
    setBusy('retry')
    try {
      await retryOp(op.id)
    } finally {
      setBusy(null)
    }
  }

  return (
    <GlassCard className={cn('flex flex-col gap-2 p-4', failed && 'border-amber-500/40')}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            failed ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
          )}
        >
          {failed ? <AlertTriangle className="size-4" /> : <Clock3 className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{op.label}</p>
          <p className="text-[12.5px] text-muted-foreground">
            Saved {when(op.createdAt)}
            {op.files.length > 0 && ` · ${op.files.length} photo${op.files.length === 1 ? '' : 's'}`}
            {op.lastTriedAt && ` · last tried ${when(op.lastTriedAt)}`}
          </p>
          <p className={cn('mt-1 text-[13px]', failed ? 'font-medium text-amber-800 dark:text-amber-300' : 'text-muted-foreground')}>
            {failed
              ? `Not accepted: ${op.lastError ?? 'the server refused it.'}`
              : op.lastError
                ? `Waiting to sync (${op.lastError.toLowerCase()}).`
                : 'Waiting to sync.'}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => void discard()} disabled={busy !== null}>
          <Trash2 />
          Discard
        </Button>
        <Button variant="outline" size="sm" onClick={() => void retry()} disabled={busy !== null}>
          <RefreshCw className={cn(busy === 'retry' && 'animate-spin motion-reduce:animate-none')} />
          {failed ? 'Try again' : 'Send now'}
        </Button>
      </div>
    </GlassCard>
  )
}

/**
 * What is still on this device (owner 2026-11-24, the web side of the mobile app's Sync screen): requests and On-Duty
 * punches saved while offline, waiting to be sent, and any the server did not accept (with its reason) to try again or
 * discard. Nothing is deleted until the server confirms it.
 */
export default function Sync() {
  const status = useOfflineStatus()
  const ops = useQueuedOps()
  const state = syncState(status)
  const failed = ops.filter((op) => op.status === 'failed')
  const waiting = ops.filter((op) => op.status === 'pending')

  return (
    <PageShell width="narrow">
      <PageHero
        icon={<CloudUpload />}
        title="Sync"
        subtitle="Requests saved on this device while you were offline. They are sent automatically when you are back online."
        actions={
          <Button onClick={() => void syncNow(true)} disabled={!status.online || status.syncing || waiting.length === 0}>
            <RefreshCw className={cn(status.syncing && 'animate-spin motion-reduce:animate-none')} />
            {status.syncing ? 'Syncing…' : 'Sync now'}
          </Button>
        }
      />

      <GlassCard className="flex items-center gap-3 p-4">
        {state === 'offline' ? (
          <WifiOff className="size-5 text-destructive" aria-hidden />
        ) : state === 'online' ? (
          <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
        ) : (
          <CloudUpload className="size-5 text-sky-600" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-semibold">Status: {SYNC_STATE_LABEL[state]}</p>
          <p className="text-[12.5px] text-muted-foreground">
            {waiting.length} waiting · {failed.length} not accepted
            {status.lastSyncedAt ? ` · last checked ${when(status.lastSyncedAt)}` : ''}
          </p>
        </div>
      </GlassCard>

      {ops.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Everything is synced" description="Nothing is waiting on this device." />
      ) : (
        <div className="flex flex-col gap-3">
          {failed.map((op) => (
            <OpRow key={op.id} op={op} />
          ))}
          {waiting.map((op) => (
            <OpRow key={op.id} op={op} />
          ))}
        </div>
      )}
    </PageShell>
  )
}

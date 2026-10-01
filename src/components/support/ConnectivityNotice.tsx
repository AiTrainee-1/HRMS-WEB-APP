import * as React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, RefreshCw, ServerOff, WifiOff } from 'lucide-react'
import { API_BASE_URL } from '@/api/client'
import { getOfflineReason, markOnline, subscribe, type OfflineReason } from '@/lib/connectivity'
import { parseSupportContact } from '@/lib/support-contact'
import { SupportContactCard } from '@/components/support/SupportContactCard'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 5000
const PROBE_TIMEOUT_MS = 4000

const DETAIL: Record<OfflineReason, string> = {
  unreachable:
    "Check your internet connection; if other websites work, our server may be down. Pages you already opened stay readable, and we'll reconnect automatically.",
  unavailable:
    "The server, or the database behind it, is temporarily unavailable. Pages you already opened stay readable, and we'll reconnect automatically.",
}

/**
 * Asks the server whether it is back. Plain fetch on purpose: it must bypass apiClient's interceptors, so a probe can
 * never sign the user out (401) or flip the connectivity state by itself; only a good answer is acted on. The answer
 * must also look right (a captive-portal or proxy page that says 200 to everything does not count as "back").
 *
 * /healthz answers even while the database is down, so when the last failure was a gateway error (database offline,
 * restore in progress) probe the public endpoint that needs the database instead, or the banner would clear at once
 * and come straight back on the next request.
 */
async function probeServer(reason: OfflineReason): Promise<boolean> {
  const path = reason === 'unavailable' ? '/support-contact' : '/healthz'
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    // The timestamp keeps any cache out of it without adding request headers (which could force a CORS preflight).
    const res = await fetch(`${(API_BASE_URL ?? '').replace(/\/+$/, '')}${path}?t=${Date.now()}`, { signal: controller.signal })
    if (!res.ok) return false
    const body: unknown = await res.json()
    return reason === 'unavailable' ? parseSupportContact(body) !== null : isPlainStatusOk(body)
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

function isPlainStatusOk(body: unknown): boolean {
  return typeof body === 'object' && body !== null && (body as { status?: unknown }).status === 'ok'
}

function OfflineBanner({ reason }: { reason: OfflineReason }) {
  const [expanded, setExpanded] = React.useState(true)
  const [checking, setChecking] = React.useState(false)
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null)
  const busy = React.useRef(false)

  const check = React.useCallback(
    async (manual: boolean) => {
      if (busy.current && !manual) return
      busy.current = true
      if (manual) setChecking(true)
      try {
        if (await probeServer(reason)) markOnline()
        else setLastChecked(new Date())
      } finally {
        busy.current = false
        setChecking(false)
      }
    },
    [reason],
  )

  // Only while this banner is on screen (i.e. while offline): try again every few seconds until the server answers.
  React.useEffect(() => {
    const timer = window.setInterval(() => void check(false), POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [check])

  const Icon = reason === 'unreachable' ? WifiOff : ServerOff

  return (
    <div
      role="region"
      aria-label="Server connection"
      data-testid="connectivity-notice"
      data-reason={reason}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-destructive/40 bg-background/95 shadow-[0_-10px_30px_-10px_rgb(0_0_0/0.4)] backdrop-blur-xl print:hidden"
    >
      {/* Phone: title + buttons, then the explanation, then the contact. Desktop: one band, contact in the middle. */}
      <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:grid-cols-[1fr_auto_auto] lg:px-8">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive">
            <Icon className="size-[18px]" />
          </span>
          <p role="alert" className="font-display text-[15px] leading-tight font-semibold">
            We can't reach the UKTextiles server right now
          </p>
        </div>

        <div className={cn('col-start-2 row-start-1 flex items-center gap-2 lg:col-start-3', expanded && 'lg:row-span-2')}>
          <Button variant="outline" size="sm" onClick={() => void check(true)} disabled={checking} data-testid="connectivity-retry">
            <RefreshCw className={cn(checking && 'animate-spin')} />
            <span className="max-sm:sr-only">{checking ? 'Checking…' : 'Retry'}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide contact details' : 'Show contact details'}
            data-testid="connectivity-toggle"
          >
            {expanded ? <ChevronDown /> : <ChevronUp />}
          </Button>
        </div>

        {expanded && (
          <>
            <p className="col-span-2 row-start-2 text-[12.5px] text-muted-foreground lg:col-span-1 lg:col-start-1">
              {DETAIL[reason]}
              {lastChecked && <span className="ml-1 tabular-nums">Last checked {lastChecked.toLocaleTimeString('en-IN')}.</span>}
            </p>
            <SupportContactCard
              situation="server"
              compact
              title="Server not working?"
              className="col-span-2 row-start-3 lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-xl"
            />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * A slim banner along the bottom of the screen while the server can't be reached (no answer, or a 502/503/504),
 * mounted once at the app root. It does not block anything: pages already loaded stay readable. It shows who to
 * contact (the software-support details HR set, kept on this device for exactly this moment), checks the server every
 * few seconds and goes away by itself when it answers; Retry checks right now.
 */
export function ConnectivityNotice() {
  const reason = React.useSyncExternalStore(subscribe, getOfflineReason, getOfflineReason)
  const queryClient = useQueryClient()
  const wasOffline = React.useRef(false)

  // Back online: pages that failed while the server was away load again by themselves.
  React.useEffect(() => {
    if (reason) {
      wasOffline.current = true
      return
    }
    if (!wasOffline.current) return
    wasOffline.current = false
    void queryClient.refetchQueries({ type: 'active', predicate: (query) => query.state.status === 'error' })
  }, [reason, queryClient])

  if (!reason) return null
  return <OfflineBanner reason={reason} />
}

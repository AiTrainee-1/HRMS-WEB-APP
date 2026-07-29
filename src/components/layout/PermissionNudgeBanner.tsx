import * as React from 'react'
import { AlertTriangle, X } from 'lucide-react'

type DeniedPerm = 'geolocation' | 'notifications'

const MESSAGES: Record<DeniedPerm, string> = {
  geolocation: "Location access is turned off — enable it in your browser's site settings to use Attendance Request.",
  notifications: "Notifications are turned off — enable them in your browser's site settings to get alerts for approvals and updates.",
}

/**
 * Light, non-blocking permission nudge — the web equivalent of the mobile
 * app's permission gate, adapted for the browser: browsers don't support
 * (and actively discourage) proactively prompting for geolocation/camera
 * without a user gesture, and there's no passive way to query camera
 * permission status at all. So this only ever performs passive reads (never
 * triggers a permission dialog) and shows a small dismissible banner if
 * Location or Notifications come back denied — Camera stays entirely on its
 * existing point-of-use flow (CameraCaptureDialog.tsx), which already has
 * its own retry affordance. Dismissal is per-session (component state, not
 * persisted), so it reappears on the next full page load if still denied,
 * without being naggy within a session.
 */
export function PermissionNudgeBanner() {
  const [denied, setDenied] = React.useState<DeniedPerm[]>([])
  const [dismissed, setDismissed] = React.useState<Set<DeniedPerm>>(new Set())

  React.useEffect(() => {
    let cancelled = false

    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setDenied((d) => (d.includes('notifications') ? d : [...d, 'notifications']))
    }

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((status) => {
          if (cancelled) return
          if (status.state === 'denied') {
            setDenied((d) => (d.includes('geolocation') ? d : [...d, 'geolocation']))
          }
        })
        .catch(() => {
          // Some browsers don't support querying this permission name at
          // all — nothing to show in that case, the point-of-use flow in
          // AttendanceRequest.tsx still handles the real request/denial.
        })
    }

    return () => {
      cancelled = true
    }
  }, [])

  const visible = denied.filter((p) => !dismissed.has(p))
  if (visible.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 border-b bg-warning/10 px-4 py-2">
      {visible.map((p) => (
        <div key={p} className="flex items-center gap-2 text-xs text-warning-foreground">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="flex-1">{MESSAGES[p]}</span>
          <button
            onClick={() => setDismissed((s) => new Set(s).add(p))}
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:bg-warning/20"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

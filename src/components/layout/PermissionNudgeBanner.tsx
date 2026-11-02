import * as React from 'react'
import { AlertTriangle, X } from 'lucide-react'

type DeniedPerm = 'geolocation' | 'notifications'

const MESSAGES: Record<DeniedPerm, string> = {
  geolocation: "Location access is turned off — enable it in your browser's site settings to use Attendance Request.",
  notifications: "Notifications are turned off — enable them in your browser's site settings to get alerts for approvals and updates.",
}

/** The phone strip's one line: what is off, in as few words as fit. */
function phoneLine(visible: DeniedPerm[]): string {
  if (visible.length > 1) return 'Location and notifications are off'
  return visible[0] === 'geolocation' ? 'Location is off' : 'Notifications are off'
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
  const [phoneOpen, setPhoneOpen] = React.useState(false)
  if (visible.length === 0) return null

  return (
    <>
      <div className="flex flex-col gap-1.5 border-b hairline bg-amber-500/10 px-4 py-2 max-md:hidden lg:px-8">
        {visible.map((p) => (
          <div key={p} className="flex items-center gap-2 text-[12.5px] text-brand-gold">
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

      {/* PHONE ONLY (< 768px): one 44px amber strip instead of a tall banner per permission (the two full sentences took
          about 150px above every page). The line says what is off; "How" opens the full sentences; X dismisses both. */}
      <div role="status" className="hidden max-md:block max-md:shrink-0 max-md:border-b max-md:border-waiting-border max-md:bg-waiting-bg max-md:text-waiting">
        <div className="max-md:flex max-md:min-h-11 max-md:items-center max-md:gap-2 max-md:pl-4">
          <AlertTriangle className="max-md:size-3.5 max-md:shrink-0" aria-hidden="true" />
          <p className="max-md:min-w-0 max-md:flex-1 max-md:truncate max-md:text-[12px] max-md:font-semibold">
            {phoneLine(visible)} <span className="max-md:font-normal">· turn on in site settings</span>
          </p>
          <button
            type="button"
            onClick={() => setPhoneOpen((v) => !v)}
            aria-expanded={phoneOpen}
            className="focus-ring max-md:min-h-11 max-md:shrink-0 max-md:rounded-full max-md:px-1.5 max-md:text-[12px] max-md:font-bold max-md:underline max-md:underline-offset-2"
          >
            {phoneOpen ? 'Less' : 'How'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(new Set(visible))}
            aria-label="Dismiss"
            className="focus-ring max-md:grid max-md:size-11 max-md:shrink-0 max-md:place-items-center max-md:rounded-full"
          >
            <X className="max-md:size-4" aria-hidden="true" />
          </button>
        </div>
        {phoneOpen && (
          <ul className="max-md:flex max-md:flex-col max-md:gap-1 max-md:px-4 max-md:pb-2.5 max-md:text-[12px] max-md:leading-4">
            {visible.map((p) => (
              <li key={p}>{MESSAGES[p]}</li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

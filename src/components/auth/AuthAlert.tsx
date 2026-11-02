import * as React from 'react'
import { CircleAlert } from 'lucide-react'

/**
 * The sign-in pages' notes (the mobile errorBox / sentBox): rose with an alert icon for a problem, green with the
 * channel icon for "code sent". A problem is announced as an alert; anything else as a status.
 */
export function AuthAlert({
  tone,
  icon,
  children,
  id,
  role,
}: {
  tone: 'error' | 'success'
  /** Defaults to the alert circle. Give it aria-hidden. */
  icon?: React.ReactNode
  children: React.ReactNode
  id?: string
  role?: 'alert' | 'status'
}) {
  return (
    <div id={id} role={role ?? (tone === 'error' ? 'alert' : 'status')} className={`auth-alert auth-alert--${tone}`}>
      {icon ?? <CircleAlert aria-hidden />}
      <div>{children}</div>
    </div>
  )
}

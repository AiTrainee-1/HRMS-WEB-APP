import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { RotateCw, X } from 'lucide-react'
import { SupportInlineLink } from '@/components/support/SupportInlineLink'
import './auth.css'

/**
 * The notice the mobile app raises when the server turns a sign-in down ("Authentication Failed") or a password setup
 * ("Password Setup Failed"): an icon and title, what was tried, the server's own sentence, a retry button that only
 * closes it, and the HR contact. A real modal dialog (focus moves in and back, Escape closes, the page behind is
 * inert), drawn in the sign-in pages' colours.
 */
export function AuthDialog({
  open,
  onClose,
  icon,
  iconTone,
  title,
  subtitle,
  subtitleTone = 'muted',
  info,
  message,
  retryLabel,
  retryTone,
}: {
  open: boolean
  onClose: () => void
  icon: React.ReactNode
  /** Solid red square (sign-in) or a soft red circle (password setup), as on the phone. */
  iconTone: 'solid' | 'soft'
  title: string
  subtitle: string
  subtitleTone?: 'muted' | 'alert'
  /** The grey box: what was tried. */
  info: React.ReactNode
  /** The server's sentence, under the box. */
  message?: React.ReactNode
  retryLabel: string
  retryTone: 'danger' | 'dark'
}) {
  const retryRef = React.useRef<HTMLButtonElement>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="auth-scope auth-dialog-overlay" />
        <DialogPrimitive.Content
          className="auth-scope auth-dialog"
          // Straight to the retry button: Enter or Space closes it and the form is there to fix.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            retryRef.current?.focus()
          }}
        >
          <div className="auth-dialog-head">
            <span className={`auth-dialog-icon auth-dialog-icon--${iconTone}`} aria-hidden>
              {icon}
            </span>
            <div className="auth-dialog-headtext">
              <DialogPrimitive.Title className="auth-dialog-title">{title}</DialogPrimitive.Title>
              <p className={subtitleTone === 'alert' ? 'auth-dialog-sub auth-dialog-sub--alert' : 'auth-dialog-sub'}>{subtitle}</p>
            </div>
            <DialogPrimitive.Close className="auth-dialog-close" aria-label="Close">
              <X aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <DialogPrimitive.Description asChild>
            <div className="auth-dialog-body">
              <div className="auth-dialog-info">{info}</div>
              {message && <p className="auth-dialog-message">{message}</p>}
            </div>
          </DialogPrimitive.Description>

          <button
            ref={retryRef}
            type="button"
            className={`auth-dialog-retry auth-dialog-retry--${retryTone}`}
            onClick={onClose}
          >
            <RotateCw aria-hidden />
            {retryLabel}
          </button>

          <SupportInlineLink situation="hr" lead="Contact HR" showIcon className="auth-help-row" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

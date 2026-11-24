import { ChevronRight, Lock } from 'lucide-react'
import { ChannelIcon } from '@/components/auth/ChannelIcon'
import type { LoginChannelState } from '@/lib/login-methods'
import './login-methods.css'

/**
 * "Continue with SMS OTP" / "Continue with WhatsApp OTP" on the sign-in page (owner 2026-11-24, as in the mobile app).
 * An option HR switched off stays on screen, LOCKED: greyed, dashed, a padlock that shakes now and then (still with
 * reduced motion), "NOT ENABLED", and it cannot be chosen.
 */
export function LoginMethodOption({ state, onChoose }: { state: LoginChannelState; onChoose: () => void }) {
  const locked = !state.enabled
  return (
    <button
      type="button"
      className={`auth-method auth-method--${state.channel}${locked ? ' is-locked' : ''}`}
      onClick={locked ? undefined : onChoose}
      disabled={locked}
      aria-disabled={locked}
      aria-label={locked ? `${state.label}: locked. ${state.lockedReason ?? ''}` : `Continue with ${state.label}`}
      title={locked ? (state.lockedReason ?? undefined) : undefined}
    >
      <span className="auth-method-icon">
        <ChannelIcon channel={state.channel} />
      </span>
      <span className="auth-method-text">
        <span className="auth-method-title">{locked ? state.label : `Continue with ${state.label}`}</span>
        {locked ? (
          <span className="auth-method-locked">
            <Lock className="auth-method-wiggle" aria-hidden />
            NOT ENABLED
          </span>
        ) : (
          <span className="auth-method-sub">Get a one-time code</span>
        )}
      </span>
      {locked ? <Lock className="auth-method-end" aria-hidden /> : <ChevronRight className="auth-method-end" aria-hidden />}
    </button>
  )
}

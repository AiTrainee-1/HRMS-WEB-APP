import * as React from 'react'

/** The ten dots of the supplied arrow, in the same stair-step (the mobile AuthButton's SVG). */
const ARROW_DOTS: ReadonlyArray<readonly [number, number]> = [
  [1.61321, 1.61321], [5.73583, 1.61321], [5.73583, 5.5566], [9.85851, 5.5566], [9.85851, 9.5],
  [13.9811, 9.5], [5.73583, 13.4434], [9.85851, 13.4434], [1.61321, 17.3868], [5.73583, 17.3868],
]

/**
 * The sign-in pages' button (the mobile app's AuthButton): a dark pill with the label on the left and a round mint icon
 * on the right holding a dotted arrow that keeps sliding forward, plus a soft band of light sweeping across the pill
 * every few seconds. Both only move while the button can be pressed, so a disabled or busy one is calm. While `loading`
 * it shows a spinner and `loadingLabel`. Reduced motion: no sweep, the arrow stands still.
 */
export function AuthButton({
  children,
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  type = 'submit',
  onClick,
  className,
}: {
  children: React.ReactNode
  /** A small icon before the label (the channel icon, an arrow). */
  icon?: React.ReactNode
  loading?: boolean
  /** What the button says while busy ("Signing in…"); the label stays when there is none. */
  loadingLabel?: string
  disabled?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
  className?: string
}) {
  const inactive = disabled || loading
  const state = loading ? 'loading' : disabled ? 'disabled' : 'ready'

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={inactive}
      aria-busy={loading || undefined}
      data-state={state}
      className={className ? `auth-btn ${className}` : 'auth-btn'}
    >
      <span className="auth-btn-label">
        {loading ? (
          <>
            <span className="auth-spinner" aria-hidden />
            <span className="auth-btn-text">{loadingLabel ?? children}</span>
          </>
        ) : (
          <>
            {icon}
            <span className="auth-btn-text">{children}</span>
          </>
        )}
      </span>
      <span className="auth-btn-circle" aria-hidden>
        <svg className="auth-btn-arrow" width="16" height="19" viewBox="0 0 16 19">
          {ARROW_DOTS.map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} fill="#0A2E2B" />
          ))}
        </svg>
      </span>
      {!inactive && <span className="auth-btn-shine" aria-hidden />}
    </button>
  )
}

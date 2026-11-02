import * as React from 'react'
import { Eye, EyeOff, type LucideIcon } from 'lucide-react'

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'>

/**
 * The sign-in pages' field (the mobile app's AuthInput): a small capitalised label, a soft filled box with an icon that
 * turns white with an accent edge while typing, an optional show/hide eye for a password, and the error (or a quiet
 * hint) under it. The label is a real <label>; the error and hint are tied to the input for screen readers.
 */
export const AuthInput = React.forwardRef<
  HTMLInputElement,
  NativeInputProps & {
    id: string
    label: string
    /** Something at the right end of the label row: the "Forgot?" link, or a quiet note. */
    labelAside?: React.ReactNode
    icon?: LucideIcon
    /** A password box (with the eye). */
    isPassword?: boolean
    /** Anything else at the right end of the box (e.g. the "passwords match" tick); ignored for a password box's eye. */
    trailing?: React.ReactNode
    error?: string | null
    /** A quiet line under the box, shown while there is no error. */
    hint?: string
    type?: 'text' | 'email' | 'tel'
    className?: string
  }
>(function AuthInput(
  { id, label, labelAside, icon: Icon, isPassword = false, trailing, error, hint, type = 'text', className, ...input },
  ref,
) {
  const [showPassword, setShowPassword] = React.useState(false)
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [input['aria-describedby'], error ? errorId : hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={className ? `auth-field ${className}` : 'auth-field'}>
      <div className="auth-label-row">
        <label htmlFor={id} className="auth-label">
          {label}
        </label>
        {labelAside}
      </div>
      <div className="auth-box" data-invalid={error ? 'true' : undefined}>
        {Icon && <Icon className="auth-box-icon" aria-hidden />}
        <input
          ref={ref}
          id={id}
          {...input}
          type={isPassword && !showPassword ? 'password' : isPassword ? 'text' : type}
          className="auth-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {isPassword ? (
          <button
            type="button"
            className="auth-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            aria-controls={id}
          >
            {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        ) : (
          trailing && <span className="auth-trailing">{trailing}</span>
        )}
      </div>
      {error ? (
        <p id={errorId} className="auth-field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="auth-field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
})

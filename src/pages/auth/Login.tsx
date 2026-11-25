import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { Banknote, CalendarCheck, ChevronRight, Clock, IdCard, KeyRound, Lock, LockKeyhole, Umbrella } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useIsPhone } from '@/hooks/useIsPhone'
import { useLoginOptions } from '@/hooks/useLoginOptions'
import { ApiError } from '@/api/client'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthBrandRow, AuthHeadline } from '@/components/auth/AuthHeader'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { OtpFlow } from '@/components/auth/OtpFlow'
import { LoginMethodOption } from '@/components/auth/LoginMethodOption'
import { AuthSupportCard } from '@/components/support/AuthSupportCard'
import { SupportInlineLink } from '@/components/support/SupportInlineLink'
import { purposeCodes, type OtpChannel } from '@/lib/otp-channel'
import { codesForChannel, keepCodeChannel, loginChannelStates } from '@/lib/login-methods'
import { signInFailureKind } from '@/lib/auth-look'
import { GENERIC_LOGIN_TITLE, loginFailure, type LoginFailure } from '@/lib/login-errors'
import { firstNameOf, type Point } from '@/lib/auth-transition'
import { centreOf, playSignIn, speakWelcome, unlockSpeech } from '@/components/transitions/auth-transitions'

// What the portal is for, on the header (the mobile login's feature chips).
const FEATURES = [
  { icon: CalendarCheck, label: 'Attendance' },
  { icon: Clock, label: 'Duty shifts' },
  { icon: Umbrella, label: 'Leave' },
  { icon: Banknote, label: 'Salary slips' },
] as const

/** The centre of the sign-in button of the form being submitted (the code form's own button), for the portal. */
function submitOrigin(): Point | null {
  const active = document.activeElement as HTMLElement | null
  if (active?.tagName === 'BUTTON') return centreOf(active)
  const form = (active as HTMLInputElement | null)?.form ?? active?.closest('form') ?? null
  return centreOf(form?.querySelector('button[type="submit"]'))
}

export default function Login() {
  const { login, loginWithOtp, isLoading } = useAuth()
  const [, navigate] = useLocation()
  const isPhone = useIsPhone()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  // On the form: a missing field, or the server not answering (then the software-support contact shows too).
  const [error, setError] = React.useState<string | null>(null)
  const [serverDown, setServerDown] = React.useState(false)
  // The server answered and turned the sign-in down (owner 2026-11-25, lib/login-errors.ts): "Employee code not found" /
  // "Incorrect password" / "Password not set" (else "Authentication Failed") with the server's own sentence, and the
  // field it is about marked until it is edited.
  const [rejection, setRejection] = React.useState<{ identifier: string; failure: LoginFailure } | null>(null)
  const [fieldMark, setFieldMark] = React.useState<{ field: 'identifier' | 'password'; note: string } | null>(null)
  // The last refusal, kept while the dialog fades out (its title would otherwise flick back to the generic one).
  const lastRejection = React.useRef(rejection)
  if (rejection) lastRejection.current = rejection
  const shownRejection = rejection ?? lastRejection.current
  // Employee Code + Password is the default and always works (owner 2026-11-24, as in the mobile app). "Continue with
  // SMS OTP" / "Continue with WhatsApp OTP" sit under it; the one chosen opens the code form for that channel only
  // (null = the password form).
  const [codeChannel, setCodeChannel] = React.useState<OtpChannel | null>(null)
  // Which code channels the server offers, asked again whenever the tab comes back into view (HR switches WhatsApp and
  // SMS codes on and off separately). A channel switched off while its form is open: back to the password form.
  const { options, reload: reloadOptions } = useLoginOptions((next) => {
    setCodeChannel((current) => keepCodeChannel(current, next))
  })
  const loginCodes = purposeCodes(options, 'login')
  const channelStates = loginChannelStates(options, !!options)
  const anyLocked = channelStates.some((st) => !st.enabled)
  const showOtp = codeChannel !== null

  /**
   * Signed in (owner 2026-11-25): "Welcome back, <first name>" in a portal that opens from the sign-in button, then the
   * dashboard behind it - the navigation never waits on the animation (components/transitions/auth-transitions.ts).
   */
  function welcome(name: string | null | undefined, origin: Point | null) {
    const first = firstNameOf(name)
    speakWelcome(first)
    playSignIn(origin, first, () => navigate('/employee/dashboard'))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setServerDown(false)
    setFieldMark(null)
    if (!identifier || !password) {
      setError('Enter your employee code and password.')
      return
    }
    // the portal opens from the button that was pressed; the spoken welcome may only start inside the person's own click
    const origin = centreOf((e.nativeEvent as SubmitEvent).submitter ?? (e.currentTarget as HTMLFormElement).querySelector('button[type="submit"]'))
    unlockSpeech()
    try {
      const signedIn = await login(identifier.trim(), password)
      welcome(signedIn.name, origin)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.'
      if (err instanceof ApiError && signInFailureKind(err.status) === 'rejected') {
        const failure = loginFailure(err, message)
        setRejection({ identifier: identifier.trim(), failure })
        if (failure.field && failure.fieldNote) setFieldMark({ field: failure.field, note: failure.fieldNote })
      } else {
        setError(message)
        setServerDown(err instanceof ApiError)
      }
    }
  }

  const header = (
    <>
      <AuthBrandRow />
      <AuthHeadline title="Log in to stay on top of your tasks and attendance.">
        Access your attendance, duty shifts, leave approvals &amp; salary slips seamlessly.
      </AuthHeadline>
      <ul className="auth-features" aria-label="In the portal">
        {FEATURES.map((f) => (
          <li key={f.label} className="auth-chip auth-feature">
            <f.icon aria-hidden />
            {f.label}
          </li>
        ))}
      </ul>
    </>
  )

  return (
    <AuthShell header={header}>
      <h2 className="auth-title">Login</h2>
      <p className="auth-activate">
        Don&apos;t have an account?{' '}
        <Link href="/set-password" className="auth-link">
          Activate
        </Link>
      </p>

      {codeChannel ? (
        <OtpFlow
          key={codeChannel}
          purpose="login"
          codes={codesForChannel(loginCodes, codeChannel)}
          onChannelsChanged={reloadOptions}
          submitLabel="Verify & Sign In"
          submittingLabel="Signing in…"
          onSubmit={async (employeeCode, otp) => {
            const origin = submitOrigin()
            unlockSpeech()
            const signedIn = await loginWithOtp(employeeCode, otp)
            welcome(signedIn.name, origin)
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <AuthInput
            id="identifier"
            label="Employee Code"
            icon={IdCard}
            value={identifier}
            // Not on a phone: it would scroll past the header and may raise the keyboard on arrival (the app never does).
            autoFocus={!isPhone}
            autoComplete="username"
            // Codes may have letters ("UKT-10482"): the full keyboard on phones, never a number pad.
            inputMode="text"
            error={fieldMark?.field === 'identifier' ? fieldMark.note : null}
            onChange={(e) => {
              setIdentifier(e.target.value)
              if (fieldMark?.field === 'identifier') setFieldMark(null)
            }}
            placeholder="e.g. UKT-10482"
          />
          <AuthInput
            id="password"
            label="Password"
            labelAside={
              <Link
                href={purposeCodes(options, 'reset').available ? '/forgot-password' : '/set-password'}
                className="auth-link auth-label-aside"
                aria-label="Forgot password?"
              >
                Forgot?
              </Link>
            }
            icon={Lock}
            isPassword
            className="auth-field--snug"
            value={password}
            autoComplete="current-password"
            error={fieldMark?.field === 'password' ? fieldMark.note : null}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldMark?.field === 'password') setFieldMark(null)
            }}
            placeholder="Enter your password"
          />
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <AuthButton loading={isLoading} loadingLabel="Signing in…" className="auth-signin">
            Sign In to Dashboard
          </AuthButton>
        </form>
      )}

      {showOtp ? (
        <button type="button" onClick={() => setCodeChannel(null)} className="auth-switch">
          <Lock aria-hidden />
          <span>Use my password instead</span>
        </button>
      ) : (
        <div className="auth-methods">
          <div className="auth-divider">
            <span>OR CONTINUE WITH</span>
          </div>
          {channelStates.map((st) => (
            <LoginMethodOption key={st.channel} state={st} onChoose={() => setCodeChannel(st.channel)} />
          ))}
          {anyLocked && (
            <p className="auth-methods-note">
              {options
                ? 'A locked option is switched off by HR right now. Your Employee Code and password always work.'
                : 'Checking which sign-in codes are available... Your Employee Code and password always work.'}
            </p>
          )}
        </div>
      )}

      <div className="auth-divider">
        <span>NEW JOINING</span>
      </div>

      <Link href="/set-password" className="auth-firsttime">
        <span className="auth-firsttime-icon">
          <KeyRound aria-hidden />
        </span>
        <span className="auth-firsttime-text">
          <span className="auth-firsttime-title">First time at UKTextiles?</span>
          <span className="auth-firsttime-sub">Activate your account &amp; set your password</span>
        </span>
        <ChevronRight className="auth-firsttime-chevron" aria-hidden />
      </Link>

      {serverDown && (
        <AuthSupportCard
          situation="server"
          description="The server is not responding, so nobody can sign in right now. If it stays like this, contact:"
          className="auth-servercard"
        />
      )}

      <SupportInlineLink situation="hr" prefix="Need help? " className="auth-help" accentClassName="auth-help-accent" />

      <AuthDialog
        open={rejection !== null}
        onClose={() => {
          setRejection(null)
          // Back to the field the refusal is about (marked under it), ready to correct.
          const field = rejection?.failure.field
          if (field) window.setTimeout(() => document.getElementById(field)?.focus(), 0)
        }}
        icon={<LockKeyhole />}
        iconTone="solid"
        title={shownRejection?.failure.title ?? GENERIC_LOGIN_TITLE}
        subtitle="Security System Notice"
        info={
          <div className="auth-dialog-inforow">
            <span className="auth-dialog-infolabel">Attempted Employee Code</span>
            <span className="auth-dialog-infopill">{shownRejection?.identifier}</span>
          </div>
        }
        message={shownRejection?.failure.message}
        retryLabel="Try Again"
        retryTone="danger"
      />
    </AuthShell>
  )
}

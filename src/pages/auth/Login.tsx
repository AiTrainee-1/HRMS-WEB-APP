import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { Banknote, CalendarCheck, ChevronRight, Clock, IdCard, KeyRound, Lock, LockKeyhole, Umbrella } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useIsPhone } from '@/hooks/useIsPhone'
import { authApi, type LoginOptions } from '@/api/resources'
import { ApiError } from '@/api/client'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthBrandRow, AuthHeadline } from '@/components/auth/AuthHeader'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { OtpFlow } from '@/components/auth/OtpFlow'
import { ChannelIcon } from '@/components/auth/ChannelIcon'
import { AuthSupportCard } from '@/components/support/AuthSupportCard'
import { SupportInlineLink } from '@/components/support/SupportInlineLink'
import { normalizeChannel, switchToCodeLabel } from '@/lib/otp-channel'
import { signInFailureKind } from '@/lib/auth-look'

// What the portal is for, on the header (the mobile login's feature chips).
const FEATURES = [
  { icon: CalendarCheck, label: 'Attendance' },
  { icon: Clock, label: 'Duty shifts' },
  { icon: Umbrella, label: 'Leave' },
  { icon: Banknote, label: 'Salary slips' },
] as const

export default function Login() {
  const { login, loginWithOtp, isLoading } = useAuth()
  const [, navigate] = useLocation()
  const isPhone = useIsPhone()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  // On the form: a missing field, or the server not answering (then the software-support contact shows too).
  const [error, setError] = React.useState<string | null>(null)
  const [serverDown, setServerDown] = React.useState(false)
  // The server answered and turned the sign-in down: the "Authentication Failed" notice, with its own sentence.
  const [rejection, setRejection] = React.useState<{ identifier: string; message: string } | null>(null)
  // Which sign-in methods the server offers. Until it answers (or if it can't), password sign-in works as before.
  const [options, setOptions] = React.useState<LoginOptions | null>(null)
  const [mode, setMode] = React.useState<'otp' | 'password'>('password')
  React.useEffect(() => {
    authApi
      .loginOptions()
      .then((o) => {
        setOptions(o)
        setMode(o.otpLogin ? 'otp' : 'password')
      })
      .catch(() => {})
  }, [])
  const showOtp = mode === 'otp' && options?.otpLogin === true
  const canSwitch = options?.otpLogin === true && options.passwordLogin
  // How the server sends codes (SMS or WhatsApp); null when it did not say (an older server): the words are then neutral.
  const channel = normalizeChannel(options?.otpChannel)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setServerDown(false)
    if (!identifier || !password) {
      setError('Enter your employee code and password.')
      return
    }
    try {
      await login(identifier.trim(), password)
      toast.success('Welcome back!')
      navigate('/employee/dashboard')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.'
      if (err instanceof ApiError && signInFailureKind(err.status) === 'rejected') {
        setRejection({ identifier: identifier.trim(), message })
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

      {showOtp ? (
        <OtpFlow
          purpose="login"
          channel={channel}
          codeLength={options?.codeLength}
          submitLabel="Verify & Sign In"
          submittingLabel="Signing in…"
          onSubmit={async (employeeCode, otp) => {
            await loginWithOtp(employeeCode, otp)
            toast.success('Welcome back!')
            navigate('/employee/dashboard')
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
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="e.g. UKT-10482"
          />
          <AuthInput
            id="password"
            label="Password"
            labelAside={
              <Link
                href={options?.otpReset ? '/forgot-password' : '/set-password'}
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
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <AuthButton loading={isLoading} loadingLabel="Signing in…" className="auth-signin">
            Sign In to Dashboard
          </AuthButton>
        </form>
      )}

      {canSwitch && (
        <button type="button" onClick={() => setMode(showOtp ? 'password' : 'otp')} className="auth-switch">
          {showOtp ? <Lock aria-hidden /> : <ChannelIcon channel={channel} />}
          <span>{showOtp ? 'Use my password instead' : switchToCodeLabel(channel)}</span>
        </button>
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
        onClose={() => setRejection(null)}
        icon={<LockKeyhole />}
        iconTone="solid"
        title="Authentication Failed"
        subtitle="Security System Notice"
        info={
          <div className="auth-dialog-inforow">
            <span className="auth-dialog-infolabel">Attempted Employee Code</span>
            <span className="auth-dialog-infopill">{rejection?.identifier}</span>
          </div>
        }
        message={rejection?.message}
        retryLabel="Try Again"
        retryTone="danger"
      />
    </AuthShell>
  )
}

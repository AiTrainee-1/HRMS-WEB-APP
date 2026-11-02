import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { Circle, CircleCheck, IdCard, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'
import { authApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useIsPhone } from '@/hooks/useIsPhone'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthHeadline, AuthPortalChip, AuthTopRow } from '@/components/auth/AuthHeader'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthButton } from '@/components/auth/AuthButton'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { OtpFlow } from '@/components/auth/OtpFlow'
import { AuthSupportCard } from '@/components/support/AuthSupportCard'
import { activateFootnote, activateIntro, activateStepTitle, normalizeChannel, type OtpChannel } from '@/lib/otp-channel'
import { PASSWORD_RULES, signInFailureKind } from '@/lib/auth-look'

/**
 * First-time access. A new employee first confirms a code sent (by SMS or WhatsApp, as the server is set up) to
 * the number HR registered for them, then chooses a password. The plain form below is only used when the server
 * has activation codes switched off (or can't send them), so nobody is locked out. Drawn like the mobile app's
 * Set Password screen (step pill, step banner, password checklist).
 */
export default function SetPassword() {
  const [, navigate] = useLocation()
  // null until the server answers; if it can't be reached, assume codes are needed (the request will
  // then report the connection problem itself).
  const [otpActivate, setOtpActivate] = React.useState<boolean | null>(null)
  // The channel the server sends codes on; null when it did not say (an older server): the words are then neutral.
  const [channel, setChannel] = React.useState<OtpChannel | null>(null)
  const [codeLength, setCodeLength] = React.useState<number | null>(null)
  const [otpStep, setOtpStep] = React.useState<1 | 2>(1)

  React.useEffect(() => {
    authApi
      .loginOptions()
      .then((o) => {
        setChannel(normalizeChannel(o.otpChannel))
        setCodeLength(o.codeLength ?? null)
        setOtpActivate(o.otpActivate)
      })
      .catch(() => setOtpActivate(true))
  }, [])

  const stepText = otpActivate === false ? 'STEP 1 OF 1' : `STEP ${otpStep} OF 2`

  const header = (
    <>
      <AuthTopRow right={<span className="auth-chip auth-steppill">{stepText}</span>} />
      <AuthPortalChip />
      <AuthHeadline title="Set Password & Activate Account">
        {otpActivate === false ? 'First-time setup to activate your employee account.' : activateIntro(channel)}
      </AuthHeadline>
    </>
  )

  return (
    <AuthShell header={header}>
      <div className="auth-stepbanner">
        <div className="auth-stepbanner-text">
          <h2 className="auth-stepbanner-title">
            {otpActivate === false
              ? 'Verification & Credentials'
              : otpStep === 1
                ? activateStepTitle(channel)
                : 'Confirm code & set password'}
          </h2>
          <p className="auth-stepbanner-sub">
            {otpActivate === false ? 'Enter your employee code and choose a password' : 'Enter your company issued employee code'}
          </p>
        </div>
        <span className="auth-stepbanner-icon">
          <ShieldCheck aria-hidden />
        </span>
      </div>

      {otpActivate === null && (
        <div className="auth-loading" role="status">
          <span className="auth-spinner auth-spinner--accent" aria-hidden />
          <span className="sr-only">Loading…</span>
        </div>
      )}
      {otpActivate === true && (
        <ActivateWithOtp channel={channel} codeLength={codeLength} onStepChange={setOtpStep} onDone={() => navigate('/employee-login')} />
      )}
      {otpActivate === false && <DirectForm onDone={() => navigate('/employee-login')} />}

      <AuthSupportCard
        situation="hr"
        title="Employee Code not recognized?"
        description="Contact HR with your offer letter so they can check your employee code."
        className="auth-helpcard"
      />

      <Link href="/employee-login" className="auth-linkrow">
        Already activated your password? <span className="auth-linkrow-accent">Sign In →</span>
      </Link>
      {otpActivate !== false && (
        <Link href="/forgot-password" className="auth-linkrow auth-linkrow--flush">
          Forgotten an existing password? <span className="auth-linkrow-accent">Reset it here</span>
        </Link>
      )}
    </AuthShell>
  )
}

/** The checklist under the new password (advisory: only "8 characters" gates the button, as the server does). */
function PasswordRules({ value }: { value: string }) {
  return (
    <div className="auth-rules">
      <p className="auth-rules-title" aria-hidden>
        PASSWORD SECURITY RULES
      </p>
      <ul aria-label="Password security rules">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value)
          return (
            <li key={rule.label} className="auth-rule" data-met={met ? 'true' : 'false'}>
              {met ? <CircleCheck className="auth-rule-met" aria-hidden /> : <Circle aria-hidden />}
              <span className="sr-only">{met ? 'Done: ' : 'Not yet: '}</span>
              {rule.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ActivateWithOtp({
  channel,
  codeLength,
  onStepChange,
  onDone,
}: {
  channel: OtpChannel | null
  codeLength: number | null
  onStepChange: (step: 1 | 2) => void
  onDone: () => void
}) {
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const passwordsOk = password.length >= 8 && password === confirm
  const mismatch = confirm.length > 0 && password !== confirm

  return (
    <div className="auth-section">
      <OtpFlow
        purpose="activate"
        channel={channel}
        codeLength={codeLength}
        submitLabel="Set Password & Activate"
        submittingLabel="Saving…"
        extraValid={passwordsOk}
        onStepChange={onStepChange}
        extraFields={
          <>
            <AuthInput
              id="new-password"
              label="New Password"
              icon={Lock}
              isPassword
              className="auth-field--close"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
            <PasswordRules value={password} />
            <AuthInput
              id="confirm-password"
              label="Confirm Password"
              icon={ShieldCheck}
              isPassword
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
              error={mismatch ? 'Passwords do not match' : null}
            />
          </>
        }
        onSubmit={async (employeeCode, otp) => {
          await authApi.activateWithOtp(employeeCode, otp, password)
          toast.success('Password set. You can now sign in.')
          onDone()
        }}
      />
      <p className="auth-footnote">{activateFootnote(channel)}</p>
    </div>
  )
}

type DirectField = 'identifier' | 'password' | 'confirm'

/** The pre-OTP form (no code needed): used only while activation codes are switched off on the server. */
function DirectForm({ onDone }: { onDone: () => void }) {
  const isPhone = useIsPhone()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  // A field that is not right yet (shown under it), and whatever went wrong with the request itself.
  const [fieldError, setFieldError] = React.useState<{ field: DirectField; message: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [serverDown, setServerDown] = React.useState(false)
  // The server answered and turned it down: the "Password Setup Failed" notice, with its own sentence.
  const [rejection, setRejection] = React.useState<{ identifier: string; message: string } | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const errorFor = (field: DirectField) => (fieldError?.field === field ? fieldError.message : null)
  const edited = (field: DirectField) => {
    if (fieldError?.field === field) setFieldError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)
    setError(null)
    setServerDown(false)
    if (!identifier.trim()) return setFieldError({ field: 'identifier', message: 'Enter your employee code, phone, or email.' })
    if (password.length < 8) return setFieldError({ field: 'password', message: 'Password must be at least 8 characters.' })
    if (password !== confirm) return setFieldError({ field: 'confirm', message: 'Passwords do not match.' })

    setSubmitting(true)
    try {
      await authApi.setPassword(identifier.trim(), password)
      toast.success('Password set. You can now sign in.')
      onDone()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not set password.'
      if (err instanceof ApiError && signInFailureKind(err.status) === 'rejected') {
        setRejection({ identifier: identifier.trim(), message })
      } else {
        setError(message)
        setServerDown(err instanceof ApiError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="auth-section">
        <AuthInput
          id="identifier"
          label="Employee Code"
          labelAside={<span className="auth-label-note">On ID or offer letter</span>}
          icon={IdCard}
          value={identifier}
          autoFocus={!isPhone}
          autoComplete="username"
          onChange={(e) => {
            setIdentifier(e.target.value)
            edited('identifier')
          }}
          placeholder="e.g. UKT-10482"
          error={errorFor('identifier')}
          hint="Must match your HR registration record."
        />
        <AuthInput
          id="password"
          label="New Password"
          icon={Lock}
          isPassword
          className="auth-field--lead"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            edited('password')
          }}
          placeholder="Min. 8 characters"
          error={errorFor('password')}
        />
        <PasswordRules value={password} />
        <AuthInput
          id="confirm"
          label="Confirm Password"
          icon={ShieldCheck}
          isPassword
          className="auth-field--lead"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            edited('confirm')
          }}
          placeholder="Re-enter new password"
          error={errorFor('confirm')}
          hint="Must match the new password above."
        />
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <AuthButton loading={submitting} loadingLabel="Saving…" className="auth-btn-gap">
          Set Password &amp; Activate
        </AuthButton>
        {serverDown && (
          <AuthSupportCard
            situation="server"
            description="The server is not responding, so your password could not be set. If it stays like this, contact:"
            className="auth-servercard--form"
          />
        )}
        <p className="auth-footnote">Once verified, your account will be activated and redirected to sign in.</p>
      </form>

      <AuthDialog
        open={rejection !== null}
        onClose={() => setRejection(null)}
        icon={<ShieldAlert />}
        iconTone="soft"
        title="Password Setup Failed"
        subtitle="Employee Code Not Recognized"
        subtitleTone="alert"
        info={
          <p>
            The employee code <b>{rejection?.identifier}</b> — {rejection?.message}
          </p>
        }
        retryLabel="Retry Verification"
        retryTone="dark"
      />
    </>
  )
}

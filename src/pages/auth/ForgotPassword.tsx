import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { Lock, ShieldCheck, TriangleAlert } from 'lucide-react'
import { authApi } from '@/api/resources'
import { AuthShell } from '@/components/auth/AuthShell'
import { AuthHeadline, AuthPortalChip, AuthTopRow } from '@/components/auth/AuthHeader'
import { AuthInput } from '@/components/auth/AuthInput'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { OtpFlow } from '@/components/auth/OtpFlow'
import { ChannelIcon } from '@/components/auth/ChannelIcon'
import { AuthSupportCard } from '@/components/support/AuthSupportCard'
import { normalizeChannel, resetBadge, resetIntro, resetUnavailable, type OtpChannel } from '@/lib/otp-channel'

/**
 * Forgot / reset password: a code (sent by SMS or WhatsApp, as the server is set up) proves it's really you, then
 * choose a new password. The words name the channel the server reports and stay neutral ("a code") when it reports none.
 * Drawn like the mobile app's Forgot Password screen.
 */
export default function ForgotPassword() {
  const [, navigate] = useLocation()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  // null until the server answers; if it can't be reached, assume codes work (the request will then report the
  // connection problem itself) and keep the words neutral.
  const [available, setAvailable] = React.useState<boolean | null>(null)
  const [channel, setChannel] = React.useState<OtpChannel | null>(null)
  const [codeLength, setCodeLength] = React.useState<number | null>(null)

  React.useEffect(() => {
    authApi
      .loginOptions()
      .then((o) => {
        setChannel(normalizeChannel(o.otpChannel))
        setCodeLength(o.codeLength ?? null)
        setAvailable(o.otpReset)
      })
      .catch(() => setAvailable(true))
  }, [])

  const passwordsOk = password.length >= 8 && password === confirm
  const mismatch = confirm.length > 0 && password !== confirm

  const header = (
    <>
      <AuthTopRow
        right={
          <span className="auth-chip auth-resetpill">
            <ChannelIcon channel={channel} />
            {resetBadge(channel)}
          </span>
        }
      />
      <AuthPortalChip />
      <AuthHeadline title="Forgot your password?">{resetIntro(channel)}</AuthHeadline>
    </>
  )

  return (
    <AuthShell header={header}>
      {available === null ? (
        <div className="auth-loading" role="status">
          <span className="auth-spinner auth-spinner--accent" aria-hidden />
          <span className="sr-only">Loading…</span>
        </div>
      ) : available === false ? (
        <div>
          <AuthAlert tone="error" role="status" icon={<TriangleAlert aria-hidden />}>
            {resetUnavailable(channel)} Please ask HR to reset your password, or set one up if you have never had one.
          </AuthAlert>
          <Link href="/set-password" className="auth-linkrow auth-linkrow--plain">
            <span className="auth-linkrow-accent">Set up my password</span>
          </Link>
          <AuthSupportCard situation="hr" className="auth-hrcard" />
        </div>
      ) : (
        <OtpFlow
          purpose="reset"
          channel={channel}
          codeLength={codeLength}
          submitLabel="Set new password"
          submittingLabel="Saving…"
          extraValid={passwordsOk}
          extraFields={
            <>
              <AuthInput
                id="new-password"
                label="New password"
                icon={Lock}
                isPassword
                className="auth-field--tight"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
              <AuthInput
                id="confirm-password"
                label="Confirm password"
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
            await authApi.resetPasswordWithOtp(employeeCode, otp, password)
            toast.success('Password updated. You can now sign in.')
            navigate('/employee-login')
          }}
        />
      )}

      {available !== false && <AuthSupportCard situation="hr" title="Still stuck?" className="auth-helpcard" />}

      <Link href="/employee-login" className="auth-linkrow auth-linkrow--roomy">
        Remembered it? <span className="auth-linkrow-accent">Sign In →</span>
      </Link>
    </AuthShell>
  )
}

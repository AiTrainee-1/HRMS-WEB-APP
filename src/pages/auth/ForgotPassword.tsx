import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { authApi } from '@/api/resources'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/layout/AuthShell'
import { OtpFlow } from '@/components/auth/OtpFlow'
import { ChannelIcon } from '@/components/auth/ChannelIcon'
import { normalizeChannel, resetBadge, resetIntro, resetUnavailable, type OtpChannel } from '@/lib/otp-channel'
import { SupportContactCard } from '@/components/support/SupportContactCard'

/**
 * Forgot / reset password: a code (sent by SMS or WhatsApp, as the server is set up) proves it's really you, then
 * choose a new password. The words name the channel the server reports and stay neutral ("a code") when it reports none.
 */
export default function ForgotPassword() {
  const [, navigate] = useLocation()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  // null until the server answers; if it can't be reached, assume codes work (the request will then report the
  // connection problem itself) and keep the words neutral.
  const [available, setAvailable] = React.useState<boolean | null>(null)
  const [channel, setChannel] = React.useState<OtpChannel | null>(null)

  React.useEffect(() => {
    authApi
      .loginOptions()
      .then((o) => {
        setChannel(normalizeChannel(o.otpChannel))
        setAvailable(o.otpReset)
      })
      .catch(() => setAvailable(true))
  }, [])

  const passwordsOk = password.length >= 8 && password === confirm

  return (
    <AuthShell width="max-w-lg">
      <p className="label-caps flex items-center gap-2 text-brand-gold">
        <span className="grid size-7 place-items-center rounded-md border border-amber-500/30 bg-amber-500/10">
          <ChannelIcon channel={channel} className="size-3.5" />
        </span>
        {resetBadge(channel)}
      </p>
      <h1 className="font-display mt-3 text-[28px] leading-tight font-semibold">Forgot your password?</h1>
      <p className="mt-1.5 text-[14px] text-muted-foreground">{resetIntro(channel)}</p>

      {available === null ? (
        <div className="mt-5 h-28 animate-pulse rounded-md bg-foreground/[0.04]" aria-hidden />
      ) : available === false ? (
        <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-[13.5px]">
          {resetUnavailable(channel)} Please ask HR to reset your password, or{' '}
          <Link href="/set-password" className="font-semibold text-brand-gold underline">
            set it up here
          </Link>{' '}
          if you have never had one.
        </div>
      ) : (
        <OtpFlow
          purpose="reset"
          channel={channel}
          submitLabel="Set new password"
          submittingLabel="Saving…"
          extraValid={passwordsOk}
          extraFields={
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    className="h-11"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    className="h-11"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              </div>
              <p className="-mt-1.5 text-[12px] text-muted-foreground">
                At least 8 characters.
                {confirm && password !== confirm && <span className="ml-1 text-destructive">Passwords don't match.</span>}
              </p>
            </>
          }
          onSubmit={async (employeeCode, otp) => {
            await authApi.resetPasswordWithOtp(employeeCode, otp, password)
            toast.success('Password updated. You can now sign in.')
            navigate('/employee-login')
          }}
        />
      )}

      <SupportContactCard situation="hr" compact title="Still stuck?" className="mt-5" />

      <Link href="/employee-login" className="font-label mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-blue hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </AuthShell>
  )
}

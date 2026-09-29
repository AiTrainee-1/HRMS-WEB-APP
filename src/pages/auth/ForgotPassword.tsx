import * as React from 'react'
import { Link, useLocation } from 'wouter'
import { toast } from 'sonner'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { authApi } from '@/api/resources'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/layout/AuthShell'
import { OtpFlow } from '@/components/auth/OtpFlow'

/** Forgot / reset password: a WhatsApp code proves it's really you, then choose a new password. */
export default function ForgotPassword() {
  const [, navigate] = useLocation()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [available, setAvailable] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    authApi
      .loginOptions()
      .then((o) => setAvailable(o.otpReset))
      .catch(() => setAvailable(true))
  }, [])

  const passwordsOk = password.length >= 8 && password === confirm

  return (
    <AuthShell width="max-w-lg">
      <p className="label-caps flex items-center gap-2 text-brand-gold">
        <span className="grid size-7 place-items-center rounded-md border border-amber-500/30 bg-amber-500/10">
          <MessageCircle className="size-3.5" />
        </span>
        Reset with WhatsApp
      </p>
      <h1 className="font-display mt-3 text-[28px] leading-tight font-semibold">Forgot your password?</h1>
      <p className="mt-1.5 text-[14px] text-muted-foreground">
        Enter your employee code and we'll WhatsApp you a code. Enter it here to choose a new password.
      </p>

      {available === false ? (
        <div className="mt-5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-[13.5px]">
          Resetting with WhatsApp isn't available right now. Please ask HR to reset your password, or{' '}
          <Link href="/set-password" className="font-semibold text-brand-gold underline">
            set it up here
          </Link>{' '}
          if you have never had one.
        </div>
      ) : (
        <OtpFlow
          purpose="reset"
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

      <Link href="/employee-login" className="font-label mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-blue hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </AuthShell>
  )
}

import * as React from 'react'
import { AlertCircle, ArrowRight, IdCard, MessageCircle } from 'lucide-react'
import { authApi, type OtpRequestResult } from '@/api/resources'
import { ApiError } from '@/api/client'
import { useCountdown } from '@/hooks/useCountdown'

const inputClass =
  'h-12 w-full rounded-md border border-input bg-background/70 text-[15px] text-foreground caret-primary outline-none transition placeholder:text-muted-foreground/60 hover:border-foreground/25 focus:border-primary focus:ring-[3px] focus:ring-primary/20'
const buttonClass =
  'bg-brand-gradient glow-primary font-label mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60'

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5" role="alert">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="text-[13px] font-medium text-destructive">{message}</p>
    </div>
  )
}

/**
 * The two steps every WhatsApp-code flow shares: ask for a code by Employee Code, then enter it.
 * `children` is whatever else the final step needs (nothing for sign-in, a new-password pair for a
 * reset), and `onSubmit` receives the code the employee typed.
 */
export function OtpFlow({
  purpose,
  submitLabel,
  submittingLabel,
  extraValid = true,
  extraFields,
  onSubmit,
  onCodeSent,
}: {
  purpose: 'login' | 'reset' | 'activate'
  submitLabel: string
  submittingLabel: string
  /** False while the extra fields (e.g. a new password) aren't valid yet. */
  extraValid?: boolean
  extraFields?: React.ReactNode
  onSubmit: (employeeCode: string, otp: string) => Promise<void>
  onCodeSent?: () => void
}) {
  const [employeeCode, setEmployeeCode] = React.useState('')
  const [otp, setOtp] = React.useState('')
  const [sent, setSent] = React.useState<OtpRequestResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const resend = useCountdown()

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    if (!employeeCode.trim()) return setError('Enter your employee code.')
    setBusy(true)
    try {
      const result = await authApi.requestOtp(employeeCode.trim(), purpose)
      setSent(result)
      setOtp('')
      resend.start(result.resendAfterSeconds)
      onCodeSent?.()
    } catch (err) {
      // Asking again too soon comes back with how long to wait.
      const wait = err instanceof ApiError ? (err.data as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds : undefined
      if (wait) resend.start(wait)
      setError(err instanceof ApiError ? err.message : 'Could not send the code. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code.')
    setBusy(true)
    try {
      await onSubmit(employeeCode.trim(), otp)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!sent) {
    return (
      <form onSubmit={requestCode} className="mt-5 flex flex-col gap-4" noValidate>
        <div>
          <label htmlFor="otp-employee-code" className="label-caps mb-2 block text-foreground/85">
            Employee code
          </label>
          <div className="relative">
            <IdCard className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
            <input
              id="otp-employee-code"
              value={employeeCode}
              autoFocus
              autoComplete="username"
              onChange={(e) => setEmployeeCode(e.target.value)}
              placeholder="e.g. UKT-4092"
              className={`${inputClass} pr-4 pl-11`}
            />
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            We'll send a 6-digit code to the WhatsApp number registered with HR.
          </p>
        </div>
        {error && <ErrorNote message={error} />}
        <button type="submit" disabled={busy} className={buttonClass}>
          <MessageCircle className="size-4" /> {busy ? 'Sending…' : 'Send code on WhatsApp'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[13px] text-foreground/90" role="status">
        Code sent to WhatsApp number <b className="tabular-nums">{sent.maskedPhone}</b>. It expires in{' '}
        {Math.round(sent.expiresInSeconds / 60)} minutes.
      </div>
      <div>
        <label htmlFor="otp-code" className="label-caps mb-2 block text-foreground/85">
          6-digit code
        </label>
        <input
          id="otp-code"
          value={otp}
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="••••••"
          className={`${inputClass} px-4 text-center font-mono text-[22px] tracking-[0.5em]`}
        />
      </div>
      {extraFields}
      {error && <ErrorNote message={error} />}
      <button type="submit" disabled={busy || !extraValid || otp.length !== 6} className={buttonClass}>
        {busy ? submittingLabel : (
          <>
            {submitLabel} <ArrowRight className="size-4" />
          </>
        )}
      </button>
      <div className="flex items-center justify-between text-[13px]">
        <button
          type="button"
          onClick={() => {
            setSent(null)
            setOtp('')
            setError(null)
          }}
          className="font-label font-semibold text-muted-foreground hover:text-foreground hover:underline"
        >
          Change employee code
        </button>
        <button
          type="button"
          disabled={resend.seconds > 0 || busy}
          onClick={() => requestCode()}
          className="font-label font-semibold text-brand-gold hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
        >
          {resend.seconds > 0 ? `Resend code in ${resend.seconds}s` : 'Resend code'}
        </button>
      </div>
    </form>
  )
}

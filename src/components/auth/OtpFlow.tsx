import * as React from 'react'
import { AlertCircle, ArrowRight, IdCard } from 'lucide-react'
import { authApi, type OtpRequestResult } from '@/api/resources'
import { useCountdown } from '@/hooks/useCountdown'
import { ChannelIcon } from '@/components/auth/ChannelIcon'
import {
  EXPIRED_NOTICE,
  cleanSeconds,
  codeLabel,
  describeOtpFailure,
  digitsOnly,
  enterCodeMessage,
  expiryText,
  otpLength,
  resolveChannel,
  sendButtonLabel,
  sendHint,
  sentNoticeParts,
  type OtpChannel,
} from '@/lib/otp-channel'

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
 * The two steps every one-time-code flow shares: ask for a code by Employee Code, then enter it. The server
 * delivers the code by SMS or by WhatsApp (HR chooses) and says which: the words follow that (lib/otp-channel.ts),
 * and read neutrally ("a code") when the server did not say, e.g. an older server.
 * `children` is whatever else the final step needs (nothing for sign-in, a new-password pair for a reset), and
 * `onSubmit` receives the code the employee typed.
 *
 * The code is only ever held in this component's state until it is sent back to the server: it is never logged,
 * stored, or put in a URL. (A WebOTP auto-fill, navigator.credentials.get({ otp }), is deliberately not used: it
 * needs the SMS to end with "@host #code", which the registered SMS template does not have. The input still offers
 * the one-time-code hint, so iOS and Android keyboards suggest the code from the SMS.)
 */
export function OtpFlow({
  purpose,
  channel: advertisedChannel = null,
  codeLength: advertisedLength = null,
  submitLabel,
  submittingLabel,
  extraValid = true,
  extraFields,
  onSubmit,
  onCodeSent,
}: {
  purpose: 'login' | 'reset' | 'activate'
  /** The channel login-options named for this server (a request's own answer takes over once there is one). */
  channel?: OtpChannel | null
  /** How many digits the code has (login-options `codeLength`; 4 by SMS, 6 on WhatsApp). A request's own answer takes over. */
  codeLength?: number | null
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
  const expiry = useCountdown()

  // What the server's last answer said, else what login-options said, else "not known" (neutral words).
  const channel = resolveChannel(sent?.channel, advertisedChannel)
  // The same for the code's length: the request's answer, else login-options, else what the channel implies.
  const length = otpLength(sent?.codeLength ?? advertisedLength, channel)

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault()
    setError(null)
    if (!employeeCode.trim()) return setError('Enter your employee code.')
    setBusy(true)
    try {
      const result = await authApi.requestOtp(employeeCode.trim(), purpose)
      setSent(result)
      setOtp('')
      resend.start(cleanSeconds(result.resendAfterSeconds))
      expiry.start(cleanSeconds(result.expiresInSeconds))
      onCodeSent?.()
    } catch (err) {
      // The server's own sentence (cooldown, hourly limit, "couldn't send", "temporarily unavailable", turned
      // off), and for a cooldown how long to wait.
      const failure = describeOtpFailure(err, 'request')
      if (failure.retryAfterSeconds > 0) resend.start(failure.retryAfterSeconds)
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (otp.length !== length || !/^\d+$/.test(otp)) return setError(enterCodeMessage(length))
    setBusy(true)
    try {
      await onSubmit(employeeCode.trim(), otp)
    } catch (err) {
      setError(describeOtpFailure(err, 'verify').message)
    } finally {
      setBusy(false)
    }
  }

  if (!sent) {
    const waiting = resend.seconds > 0
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
              onChange={(e) => {
                setEmployeeCode(e.target.value)
                // A wait the server asked for belongs to the code it was asked for.
                if (resend.seconds > 0) resend.start(0)
              }}
              placeholder="e.g. UKT-4092"
              className={`${inputClass} pr-4 pl-11`}
            />
          </div>
          <p className="mt-2 text-[12.5px] text-muted-foreground">{sendHint(channel)}</p>
        </div>
        {error && <ErrorNote message={error} />}
        <button type="submit" disabled={busy || waiting} className={buttonClass}>
          <ChannelIcon channel={channel} className="size-4" />{' '}
          {busy ? 'Sending…' : waiting ? `Send code again in ${resend.seconds}s` : sendButtonLabel(channel)}
        </button>
      </form>
    )
  }

  const maskedPhone = typeof sent.maskedPhone === 'string' ? sent.maskedPhone.trim() : ''
  const notice = sentNoticeParts(channel, maskedPhone !== '')
  const expiresText = expiryText(sent.expiresInSeconds)
  // The window the server gave has passed. Only a hint: the server decides what is still valid.
  const expired = cleanSeconds(sent.expiresInSeconds) > 0 && expiry.seconds === 0

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4" noValidate>
      {expired ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[13px] text-foreground/90" role="status" id="otp-notice">
          {EXPIRED_NOTICE}
        </div>
      ) : (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[13px] text-foreground/90" role="status" id="otp-notice">
          {notice.before}
          {maskedPhone && <b className="tabular-nums">{maskedPhone}</b>}
          {notice.after}
          {expiresText && ` ${expiresText}`}
        </div>
      )}
      <div>
        <label htmlFor="otp-code" className="label-caps mb-2 block text-foreground/85">
          {codeLabel(length)}
        </label>
        <input
          id="otp-code"
          value={otp}
          autoFocus
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          enterKeyHint="done"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={length}
          aria-describedby="otp-notice"
          onChange={(e) => setOtp(digitsOnly(e.target.value, length))}
          // "123 456" or "123-456" pasted into a box of `length` characters would lose its last digit before onChange runs.
          onPaste={(e) => {
            e.preventDefault()
            const digits = digitsOnly(e.clipboardData.getData('text'), length)
            if (digits) setOtp(digits)
          }}
          placeholder={'•'.repeat(length)}
          className={`${inputClass} px-4 text-center font-mono text-[22px] tracking-[0.5em]`}
        />
      </div>
      {extraFields}
      {error && <ErrorNote message={error} />}
      <button type="submit" disabled={busy || !extraValid || otp.length !== length} className={buttonClass}>
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
            expiry.start(0)
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

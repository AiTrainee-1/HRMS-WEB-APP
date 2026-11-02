import * as React from 'react'
import { ArrowRight, ClockAlert, IdCard, ShieldEllipsis } from 'lucide-react'
import { authApi, type OtpRequestResult } from '@/api/resources'
import { useCountdown } from '@/hooks/useCountdown'
import { useIsPhone } from '@/hooks/useIsPhone'
import { ChannelIcon } from '@/components/auth/ChannelIcon'
import { AuthAlert } from '@/components/auth/AuthAlert'
import { AuthButton } from '@/components/auth/AuthButton'
import { AuthInput } from '@/components/auth/AuthInput'
import { SupportInlineLink } from '@/components/support/SupportInlineLink'
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

/**
 * The two steps every one-time-code flow shares: ask for a code by Employee Code, then enter it. The server
 * delivers the code by SMS or by WhatsApp (HR chooses) and says which: the words follow that (lib/otp-channel.ts),
 * and read neutrally ("a code") when the server did not say, e.g. an older server.
 * `extraFields` is whatever else the final step needs (nothing for sign-in, a new-password pair for a reset), and
 * `onSubmit` receives the code the employee typed. Drawn like the mobile app's OtpFlow (sign-in pages' AuthInput /
 * AuthButton / notes, and the HR line under step 2).
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
  onStepChange,
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
  /** 1 = asking for a code, 2 = entering it, so a page can show its own progress ("STEP 2 OF 2"). */
  onStepChange?: (step: 1 | 2) => void
}) {
  const [employeeCode, setEmployeeCode] = React.useState('')
  const [otp, setOtp] = React.useState('')
  const [sent, setSent] = React.useState<OtpRequestResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const resend = useCountdown()
  const expiry = useCountdown()
  const isPhone = useIsPhone()

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
      onStepChange?.(2)
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

  function changeEmployee() {
    setSent(null)
    setOtp('')
    setError(null)
    expiry.start(0)
    onStepChange?.(1)
  }

  if (!sent) {
    const waiting = resend.seconds > 0
    return (
      <form onSubmit={requestCode} noValidate>
        <AuthInput
          id="otp-employee-code"
          label="Employee Code"
          icon={IdCard}
          className="auth-field--tight"
          value={employeeCode}
          // Not on a phone on arrival (it would scroll past the header); the code box below does take focus once sent.
          autoFocus={!isPhone}
          autoComplete="username"
          enterKeyHint="send"
          aria-describedby="otp-send-hint"
          onChange={(e) => {
            setEmployeeCode(e.target.value)
            // A wait the server asked for belongs to the code it was asked for.
            if (resend.seconds > 0) resend.start(0)
          }}
          placeholder="e.g. UKT-10482"
        />
        <p id="otp-send-hint" className="auth-hint">
          {sendHint(channel, length)}
        </p>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <AuthButton
          loading={busy}
          loadingLabel="Sending…"
          disabled={waiting}
          icon={<ChannelIcon channel={channel} className="auth-btn-channel" />}
        >
          {waiting ? `Send code again in ${resend.seconds}s` : sendButtonLabel(channel)}
        </AuthButton>
      </form>
    )
  }

  const maskedPhone = typeof sent.maskedPhone === 'string' ? sent.maskedPhone.trim() : ''
  const notice = sentNoticeParts(channel, maskedPhone !== '')
  const expiresText = expiryText(sent.expiresInSeconds)
  // The window the server gave has passed. Only a hint: the server decides what is still valid.
  const expired = cleanSeconds(sent.expiresInSeconds) > 0 && expiry.seconds === 0

  return (
    <form onSubmit={submit} noValidate>
      {expired ? (
        <AuthAlert tone="error" role="status" id="otp-notice" icon={<ClockAlert aria-hidden />}>
          {EXPIRED_NOTICE}
        </AuthAlert>
      ) : (
        <AuthAlert tone="success" id="otp-notice" icon={<ChannelIcon channel={channel} />}>
          {notice.before}
          {maskedPhone && <b className="tabular-nums">{maskedPhone}</b>}
          {notice.after}
          {expiresText && ` ${expiresText}`}
        </AuthAlert>
      )}
      <AuthInput
        id="otp-code"
        label={codeLabel(length)}
        icon={ShieldEllipsis}
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
        placeholder="Enter the code"
      />
      {extraFields}
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      <AuthButton
        loading={busy}
        loadingLabel={submittingLabel}
        disabled={!extraValid || otp.length !== length}
        icon={<ArrowRight className="auth-btn-icon" aria-hidden />}
      >
        {submitLabel}
      </AuthButton>
      <div className="auth-otp-footer">
        <button type="button" onClick={changeEmployee} className="auth-textbtn">
          Change employee code
        </button>
        <button
          type="button"
          disabled={resend.seconds > 0 || busy}
          onClick={() => requestCode()}
          className="auth-textbtn auth-textbtn--accent"
        >
          {resend.seconds > 0 ? `Resend code in ${resend.seconds}s` : 'Resend code'}
        </button>
      </div>
      <SupportInlineLink
        situation="hr"
        prefix="Not getting the code? "
        className="auth-help auth-help--tight"
        accentClassName="auth-help-accent"
      />
    </form>
  )
}

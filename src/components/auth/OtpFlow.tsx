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
  channelChoices,
  channelUnavailable,
  chooseButtonLabel,
  chooseHint,
  cleanSeconds,
  codeLabel,
  codeLengthFor,
  describeOtpFailure,
  digitsOnly,
  enterCodeMessage,
  expiryText,
  fallbackChannels,
  fallbackOffer,
  normalizeChannel,
  otpLength,
  requestChannel,
  resolveChannel,
  sendButtonLabel,
  sendHint,
  sentNoticeParts,
  singleChannel,
  type OtpChannel,
  type PurposeCodes,
} from '@/lib/otp-channel'
import { readRememberedChannel, rememberChannel } from '@/lib/otp-preference'

/**
 * The two steps every one-time-code flow shares: ask for a code by Employee Code, then enter it. The server delivers
 * the code by WhatsApp or by SMS - whichever HR has switched on (`codes`, from login-options via purposeCodes()). With
 * both on, the employee picks ("Send code by WhatsApp" / "Send code by SMS", the last pick first) and, once a code went
 * out, may ask for it the other way instead. The words follow the channel (lib/otp-channel.ts) and read neutrally
 * ("a code") when the server did not say, e.g. an older server.
 * `extraFields` is whatever else the final step needs (nothing for sign-in, a new-password pair for a reset), and
 * `onSubmit` receives the code the employee typed. Drawn like the mobile app's OtpFlow (sign-in pages' AuthInput /
 * AuthButton / notes, and the HR line under step 2).
 *
 * The code is only ever held in this component's state until it is sent back to the server: it is never logged,
 * stored, or put in a URL. (Only the channel picked is remembered, lib/otp-preference.ts. A WebOTP auto-fill,
 * navigator.credentials.get({ otp }), is deliberately not used: it needs the SMS to end with "@host #code", which the
 * registered SMS template does not have. The input still offers the one-time-code hint, so iOS and Android keyboards
 * suggest the code from the SMS.)
 */
export function OtpFlow({
  purpose,
  codes,
  onChannelsChanged,
  submitLabel,
  submittingLabel,
  extraValid = true,
  extraFields,
  onSubmit,
  onCodeSent,
  onStepChange,
}: {
  purpose: 'login' | 'reset' | 'activate'
  /** What the server offers for this purpose: the channels (WhatsApp and SMS are switched on separately), their code
   *  lengths, and whether it takes a `channel` at all. purposeCodes() / unknownCodes() in lib/otp-channel.ts. */
  codes: PurposeCodes
  /** The server refused the channel asked for (HR switched it off meanwhile): reload the sign-in options. */
  onChannelsChanged?: () => void
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
  // The channel the code on screen was asked for (the answer's own `channel` wins when it names one).
  const [sentVia, setSentVia] = React.useState<OtpChannel | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<false | 'ask' | 'submit'>(false)
  // Which channel's request is running (its button shows the spinner).
  const [askingVia, setAskingVia] = React.useState<OtpChannel | null>(null)
  // The channel the resend wait belongs to (null = not known: it holds every button).
  const [waitFor, setWaitFor] = React.useState<OtpChannel | null>(null)
  const [remembered, setRemembered] = React.useState<OtpChannel | null>(() => readRememberedChannel())
  const resend = useCountdown()
  const expiry = useCountdown()
  const isPhone = useIsPhone()

  // Step 1: the ways on offer, the remembered one first. One way: it is used as before; none named: "a code".
  const choices = channelChoices(codes.channels, remembered)
  const only = singleChannel(codes)
  // Step 2: what the server's last answer said, else what was asked for / login-options said, else "not known".
  const channel = resolveChannel(sent?.channel, sentVia ?? only)
  // The same for the code's length: the request's answer, else login-options, else what the channel implies.
  const length = otpLength(sent?.codeLength ?? codeLengthFor(codes, channel), channel)

  /** Whether the server's resend wait holds this channel's button. */
  const waitingFor = (via: OtpChannel | null) => resend.seconds > 0 && (waitFor === null || via === null || waitFor === via)

  /** Asks for a code by `via` (null = the server's choice). `switching` = step 2's "send it the other way instead". */
  async function requestCode(via: OtpChannel | null, switching = false) {
    setError(null)
    if (!employeeCode.trim()) return setError('Enter your employee code.')
    setBusy('ask')
    setAskingVia(via)
    try {
      const result = await authApi.requestOtp(employeeCode.trim(), purpose, requestChannel(codes, via))
      const used = normalizeChannel(result.channel) ?? via
      setSent(result)
      setSentVia(used)
      setOtp('')
      setWaitFor(used)
      resend.start(cleanSeconds(result.resendAfterSeconds))
      expiry.start(cleanSeconds(result.expiresInSeconds))
      // Remembered only when the employee had a choice.
      if (used && codes.choosable && (codes.channels.length > 1 || switching)) {
        rememberChannel(used)
        setRemembered(used)
      }
      onCodeSent?.()
      onStepChange?.(2)
    } catch (err) {
      const gone = channelUnavailable(err)
      if (gone) {
        // HR switched that way off meanwhile: say so, and let the page reload what is on offer now.
        setError(gone.message)
        onChannelsChanged?.()
        return
      }
      // The server's own sentence (cooldown, hourly limit, "couldn't send", "temporarily unavailable", turned
      // off), and for a cooldown how long to wait (for that channel: the other one has its own wait).
      const failure = describeOtpFailure(err, 'request')
      if (failure.retryAfterSeconds > 0 && !switching) {
        setWaitFor(via)
        resend.start(failure.retryAfterSeconds)
      }
      setError(failure.message)
    } finally {
      setBusy(false)
      setAskingVia(null)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (otp.length !== length || !/^\d+$/.test(otp)) return setError(enterCodeMessage(length))
    setBusy('submit')
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
    setSentVia(null)
    setOtp('')
    setError(null)
    expiry.start(0)
    onStepChange?.(1)
  }

  if (!sent) {
    const picking = choices.length > 1
    const main = choices[0] ?? null
    const mainWaiting = waitingFor(main)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!mainWaiting && busy === false) void requestCode(main)
        }}
        noValidate
      >
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
          {picking ? chooseHint(codes) : sendHint(only, codeLengthFor(codes, only))}
        </p>
        {error && <AuthAlert tone="error">{error}</AuthAlert>}
        <AuthButton
          loading={busy === 'ask' && askingVia === main}
          loadingLabel="Sending…"
          disabled={mainWaiting || busy !== false}
          icon={<ChannelIcon channel={main} className="auth-btn-channel" />}
        >
          {mainWaiting
            ? `Send code again in ${resend.seconds}s`
            : picking && main
              ? chooseButtonLabel(main)
              : sendButtonLabel(only)}
        </AuthButton>
        {picking &&
          choices.slice(1).map((via) => {
            const waiting = waitingFor(via)
            const loading = busy === 'ask' && askingVia === via
            return (
              <button
                key={via}
                type="button"
                className="auth-altbtn"
                disabled={waiting || busy !== false}
                aria-busy={loading || undefined}
                onClick={() => void requestCode(via)}
              >
                {loading ? <span className="auth-spinner auth-spinner--accent" aria-hidden /> : <ChannelIcon channel={via} />}
                <span>{loading ? 'Sending…' : waiting ? `Send code again in ${resend.seconds}s` : chooseButtonLabel(via)}</span>
              </button>
            )
          })}
      </form>
    )
  }

  const maskedPhone = typeof sent.maskedPhone === 'string' ? sent.maskedPhone.trim() : ''
  const notice = sentNoticeParts(channel, maskedPhone !== '')
  const expiresText = expiryText(sent.expiresInSeconds)
  // The window the server gave has passed. Only a hint: the server decides what is still valid.
  const expired = cleanSeconds(sent.expiresInSeconds) > 0 && expiry.seconds === 0
  // "Didn't get it? Send by SMS instead": the other ways the answer offered that are still on offer.
  const other = fallbackChannels(sent.otherChannels, channel, codes.choosable ? codes.channels : undefined)[0] ?? null
  const offer = other ? fallbackOffer(other) : null
  const switchingNow = busy === 'ask' && other !== null && askingVia === other

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
        loading={busy === 'submit'}
        loadingLabel={submittingLabel}
        disabled={!extraValid || otp.length !== length || busy === 'ask'}
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
          disabled={resend.seconds > 0 || busy !== false}
          onClick={() => void requestCode(channel)}
          className="auth-textbtn auth-textbtn--accent"
        >
          {resend.seconds > 0 ? `Resend code in ${resend.seconds}s` : 'Resend code'}
        </button>
      </div>
      {offer && other && (
        <p className="auth-fallback">
          <ChannelIcon channel={other} />
          <span>{offer.prefix}</span>
          <button
            type="button"
            className="auth-textbtn auth-textbtn--accent"
            disabled={busy !== false}
            aria-busy={switchingNow || undefined}
            onClick={() => void requestCode(other, true)}
          >
            {switchingNow ? 'Sending…' : offer.action}
          </button>
        </p>
      )}
      <SupportInlineLink
        situation="hr"
        prefix="Not getting the code? "
        className="auth-help auth-help--tight"
        accentClassName="auth-help-accent"
      />
    </form>
  )
}

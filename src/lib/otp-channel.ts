// The words and small rules of the one-time-code (OTP) screens: sign in with a code, reset a forgotten password,
// first-time password. The server sends the code by SMS or by WhatsApp (HR chooses) and tells us which one:
//   GET  /auth/login-options   -> { ..., otpChannel: 'sms' | 'whatsapp' }
//   POST /auth/otp/request     -> { message, maskedPhone, expiresInSeconds, resendAfterSeconds, channel }
// An older server sends neither key (it only ever had WhatsApp). Whatever the answer, a screen must still make
// sense, so every sentence here has three forms: SMS, WhatsApp, and a neutral one ("a code") for "not known".
//
// Pure on purpose (no React, no imports): Node's test runner loads it directly, see otp-channel.test.ts.

export type OtpChannel = 'sms' | 'whatsapp'
export type OtpPurpose = 'login' | 'reset' | 'activate'

/** The channel the server named, or null when it named none (an older server) or something this app does not know. */
export function normalizeChannel(value: unknown): OtpChannel | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return v === 'sms' || v === 'whatsapp' ? v : null
}

/** The first candidate that names a known channel (e.g. the request's own answer, then the one login-options gave). */
export function resolveChannel(...candidates: unknown[]): OtpChannel | null {
  for (const candidate of candidates) {
    const channel = normalizeChannel(candidate)
    if (channel) return channel
  }
  return null
}

type Form = OtpChannel | 'neutral'
const form = (channel: OtpChannel | null): Form => channel ?? 'neutral'

/** Label of the "send the code" button. */
export function sendButtonLabel(channel: OtpChannel | null): string {
  return { sms: 'Send code by SMS', whatsapp: 'Send code on WhatsApp', neutral: 'Send code' }[form(channel)]
}

/** The line under the employee-code field, before any code has been asked for. */
export function sendHint(channel: OtpChannel | null): string {
  return {
    sms: "We'll send a 6-digit code by SMS to the mobile number registered with HR.",
    whatsapp: "We'll send a 6-digit code to the WhatsApp number registered with HR.",
    neutral: "We'll send a 6-digit code to the mobile number registered with HR.",
  }[form(channel)]
}

/**
 * "Code sent ..." as the text around the masked phone number, which the screen draws in bold:
 * `before + phone + after`. With no phone number the whole sentence is in `before`.
 */
export function sentNoticeParts(channel: OtpChannel | null, hasPhone: boolean): { before: string; after: string } {
  if (!hasPhone) {
    return { before: { sms: 'Code sent by SMS.', whatsapp: 'Code sent on WhatsApp.', neutral: 'Code sent.' }[form(channel)], after: '' }
  }
  return {
    before: { sms: 'Code sent by SMS to ', whatsapp: 'Code sent to WhatsApp number ', neutral: 'Code sent to ' }[form(channel)],
    after: '.',
  }
}

/** The whole "Code sent ..." sentence as plain text (what a screen reader gets), with the expiry when it is known. */
export function sentNotice(channel: OtpChannel | null, maskedPhone: unknown, expiresInSeconds: unknown): string {
  const phone = typeof maskedPhone === 'string' ? maskedPhone.trim() : ''
  const { before, after } = sentNoticeParts(channel, phone !== '')
  const expiry = expiryText(expiresInSeconds)
  return `${before}${phone}${after}${expiry ? ` ${expiry}` : ''}`
}

/** "It expires in 5 minutes." (empty when the server did not say how long). */
export function expiryText(expiresInSeconds: unknown): string {
  const seconds = cleanSeconds(expiresInSeconds)
  return seconds > 0 ? `It expires in ${formatDuration(seconds)}.` : ''
}

/** 45 -> "45 seconds", 60 -> "1 minute", 300 -> "5 minutes", 90 -> "1 minute" (never promises more than it has). */
export function formatDuration(seconds: number): string {
  const s = cleanSeconds(seconds)
  if (s < 60) return `${s} ${s === 1 ? 'second' : 'seconds'}`
  const minutes = Math.floor(s / 60)
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

/** The line shown once the code's time is up. The server decides what is valid; this only says what to do next. */
export const EXPIRED_NOTICE = 'This code has expired. Tap "Resend code" to get a new one.'

/** A whole number of seconds, 0 when the value is missing, negative or not a number (an older or odd server). */
export function cleanSeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Only the digits of what was typed or pasted ("123 456" and "123-456" both become 123456), at most `max` of them. */
export function digitsOnly(value: unknown, max = 6): string {
  return typeof value === 'string' ? value.replace(/\D/g, '').slice(0, max) : ''
}

/** The sentence under "Employee Sign In" while the code form is showing. */
export function loginIntro(channel: OtpChannel | null): string {
  return {
    sms: 'Sign in with a one-time code sent by SMS to your registered mobile number.',
    whatsapp: 'Sign in with a one-time code sent to your registered WhatsApp number.',
    neutral: 'Sign in with a one-time code sent to your registered mobile number.',
  }[form(channel)]
}

/** The link that switches the sign-in form from password to a code. */
export function switchToCodeLabel(channel: OtpChannel | null): string {
  return { sms: 'Sign in with an SMS code', whatsapp: 'Sign in with a WhatsApp code', neutral: 'Sign in with a code' }[form(channel)]
}

/** Forgot password: the small heading above the title. */
export function resetBadge(channel: OtpChannel | null): string {
  return { sms: 'Reset with SMS', whatsapp: 'Reset with WhatsApp', neutral: 'Reset with a code' }[form(channel)]
}

/** Forgot password: the sentence under the title. */
export function resetIntro(channel: OtpChannel | null): string {
  return {
    sms: "Enter your employee code and we'll send you a code by SMS. Enter it here to choose a new password.",
    whatsapp: "Enter your employee code and we'll WhatsApp you a code. Enter it here to choose a new password.",
    neutral: "Enter your employee code and we'll send you a code. Enter it here to choose a new password.",
  }[form(channel)]
}

/** Forgot password: the start of the note shown when HR has switched resetting with a code off. */
export function resetUnavailable(channel: OtpChannel | null): string {
  return {
    sms: "Resetting by SMS isn't available right now.",
    whatsapp: "Resetting with WhatsApp isn't available right now.",
    neutral: "Resetting with a code isn't available right now.",
  }[form(channel)]
}

/** First-time access: the sentence under the title while a code is required. */
export function activateIntro(channel: OtpChannel | null): string {
  return {
    sms: 'New to the portal? Confirm your mobile number with an SMS code, then choose a password.',
    whatsapp: 'New to the portal? Confirm your WhatsApp number, then choose a password.',
    neutral: 'New to the portal? Confirm your mobile number with a code, then choose a password.',
  }[form(channel)]
}

// ---- Failures -------------------------------------------------------------------------------------------

export interface OtpFailure {
  /** One plain sentence for the screen. */
  message: string
  /** Seconds before another code can be asked for (the server's cooldown), 0 when it did not say. */
  retryAfterSeconds: number
}

/** The error shape of the app's ApiError, kept structural so this file needs no imports. */
type FailureLike = { status?: unknown; message?: unknown; data?: unknown } | null | undefined

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

/** The sentence the server wrote, taken the way the API client does (message, then detail, then error); '' if none. */
function serverSentence(data: unknown): string {
  const body = record(data)
  if (!body) return ''
  for (const key of ['message', 'detail', 'error']) {
    const value = body[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

/**
 * What to tell the employee when asking for a code (`request`) or sending the code back (`verify`) failed.
 *  - The server's own sentence wins: it says why (cooldown, hourly limit, "SMS is temporarily unavailable",
 *    "We couldn't send the code by SMS", "turned off") and already points to the password or HR.
 *  - 429 from the per-address limit arrives as the framework's "Request was throttled. Expected available in
 *    37 seconds.": reworded, and the 37 becomes the resend countdown.
 *  - No usable sentence (a gateway page, an HTML body, no answer at all): a plain one that still names the way out.
 * `retryAfterSeconds` is the server's number when it sent one ("Please wait 45 seconds ...").
 */
export function describeOtpFailure(err: unknown, kind: 'request' | 'verify'): OtpFailure {
  const e = err as FailureLike
  const status = typeof e?.status === 'number' ? e.status : undefined
  const data = record(e?.data)
  const sentence = serverSentence(e?.data)
  const retryAfterSeconds = cleanSeconds(data?.retryAfterSeconds)

  if (status === undefined) {
    return { message: "We couldn't reach the server. Check your connection and try again.", retryAfterSeconds: 0 }
  }

  if (status === 429 && /throttled/i.test(sentence)) {
    const wait = cleanSeconds(/(\d+)\s*second/i.exec(sentence)?.[1])
    return {
      message: wait > 0
        ? `Too many attempts. Please wait ${formatDuration(wait)} and try again, or contact HR.`
        : 'Too many attempts. Please wait a minute and try again, or contact HR.',
      retryAfterSeconds: wait,
    }
  }

  // The server's sentence is shown for a refusal (4xx) and for the two statuses this feature uses on purpose
  // (502 "couldn't send", 503 "temporarily unavailable"). Any other 5xx text is usually technical.
  if (sentence && (status < 500 || status === 502 || status === 503)) {
    return { message: sentence, retryAfterSeconds }
  }

  if (status === 429) {
    return { message: 'Too many attempts. Please wait a few minutes and try again, or contact HR.', retryAfterSeconds }
  }
  if (kind === 'request') {
    if (status === 403) {
      return { message: 'Codes are turned off right now. Please use your password or contact HR.', retryAfterSeconds: 0 }
    }
    if (status >= 500) {
      return { message: "We couldn't send the code right now. Please try again in a moment, or contact HR.", retryAfterSeconds: 0 }
    }
    return { message: 'Could not send the code. Please try again, or contact HR.', retryAfterSeconds: 0 }
  }
  return { message: 'That did not work. Please try again.', retryAfterSeconds: 0 }
}

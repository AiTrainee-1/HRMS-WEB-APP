// The words and small rules of the one-time-code (OTP) screens: sign in with a code, reset a forgotten password,
// first-time password. The server sends the code by WhatsApp or by SMS. HR switches the two on SEPARATELY (WhatsApp
// Control -> OTP, SMS Control -> OTP Switches), per purpose: either one alone is enough, and with both on the employee
// picks. The server says which:
//   GET  /auth/login-options   -> { ..., otpChannels: { login: ['whatsapp', 'sms'], reset: [...], activate: [...] },
//                                  channels: { whatsapp: { name, codeLength: 6 }, sms: { name, codeLength: 4 } },
//                                  otpChannel, codeLength }   (the last two: the first channel, for older apps)
//   POST /auth/otp/request     { employeeCode, purpose, channel? }
//                              -> { message, maskedPhone, expiresInSeconds, resendAfterSeconds, channel, codeLength,
//                                   otherChannels }
// (see "Which ways a code can be sent" below). The code's length follows the channel: 4 digits by SMS (the approved
// template says XXXX), 6 on WhatsApp. The server says which in `codeLength`; without it the channel decides (sms 4,
// whatsapp 6, unknown 6): see otpLength.
// A server from before independent channels sends only one `otpChannel`; one from before the SMS channel sends none of
// these keys (it only ever had WhatsApp, 6 digits). Whatever the answer, a screen must still make sense, so every
// sentence here has three forms: SMS, WhatsApp, and a neutral one ("a code") for "not known" or "two to pick from".
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

// ---- Which ways a code can be sent -------------------------------------------------------------------------
//
// A server with independent channels lists, per purpose, the ways that work NOW (`otpChannels`, WhatsApp first) and
// each one's code length (`channels`), and takes an optional `channel` on POST /auth/otp/request; a channel switched
// off meanwhile is refused with 400 { code: 'channel_unavailable', availableChannels, message }.
// An older server sends neither key: only `otpLogin` / `otpReset` / `otpActivate` and ONE `otpChannel` + `codeLength`
// for everything. It would ignore a `channel` in the request, so the app never sends it one.

/** Every channel, in the order the server lists them. */
export const OTP_CHANNELS: readonly OtpChannel[] = ['whatsapp', 'sms']

/** 'WhatsApp' / 'SMS'. */
export function channelName(channel: OtpChannel): string {
  return channel === 'sms' ? 'SMS' : 'WhatsApp'
}

/** The known channels of a list from the server, in its order, each once; [] for anything that is not a list. */
export function normalizeChannelList(value: unknown): OtpChannel[] {
  if (!Array.isArray(value)) return []
  const out: OtpChannel[] = []
  for (const item of value) {
    const channel = normalizeChannel(item)
    if (channel && !out.includes(channel)) out.push(channel)
  }
  return out
}

/** The keys of GET /auth/login-options the code screens read. All optional: an older server sends fewer. */
export interface CodeOptionsSource {
  otpLogin?: unknown
  otpReset?: unknown
  otpActivate?: unknown
  passwordLogin?: unknown
  otpChannel?: unknown
  codeLength?: unknown
  otpChannels?: unknown
  channels?: unknown
}

/** What one page (sign-in, forgot password, first-time access) can offer. */
export interface PurposeCodes {
  /** A code can be asked for at all. False = no code option (sign-in by password, HR resets, plain activation). */
  available: boolean
  /**
   * The channels the employee can get it by, WhatsApp first. Two = the employee picks. Empty while `available` = the
   * server did not name one (an older server, or it could not be asked): neutral words, no `channel` sent.
   */
  channels: OtpChannel[]
  /** The server takes a `channel` on POST /auth/otp/request (it sent `otpChannels`). */
  choosable: boolean
  /** Digits of a code by each channel. */
  lengths: Record<OtpChannel, number>
  /** Digits when the channel is not known. */
  neutralLength: number
}

const PURPOSE_FLAG: Record<OtpPurpose, 'otpLogin' | 'otpReset' | 'otpActivate'> = {
  login: 'otpLogin',
  reset: 'otpReset',
  activate: 'otpActivate',
}

/** Each channel's code length: its own `channels[ch].codeLength`, else an older server's `codeLength` for its one channel, else the channel's. */
function channelLengths(options: CodeOptionsSource | null | undefined): Record<OtpChannel, number> {
  const info = record(options?.channels)
  const legacy = normalizeChannel(options?.otpChannel)
  const lengths = { ...OTP_LENGTH_BY_CHANNEL }
  for (const channel of OTP_CHANNELS) {
    const own = record(info?.[channel])?.codeLength
    lengths[channel] = otpLength(own !== undefined ? own : legacy === channel ? options?.codeLength : undefined, channel)
  }
  return lengths
}

/**
 * What GET /auth/login-options offers for one purpose. A new server: the purpose's list in `otpChannels` (empty = no
 * code). An older one: its `otpLogin` / `otpReset` / `otpActivate` switch, with its one `otpChannel` (or none named).
 */
export function purposeCodes(options: CodeOptionsSource | null | undefined, purpose: OtpPurpose): PurposeCodes {
  const lengths = channelLengths(options)
  const neutralLength = otpLength(options?.codeLength, options?.otpChannel)
  const lists = record(options?.otpChannels)
  if (lists && Array.isArray(lists[purpose])) {
    const channels = normalizeChannelList(lists[purpose])
    return { available: channels.length > 0, channels, choosable: true, lengths, neutralLength }
  }
  const available = options?.[PURPOSE_FLAG[purpose]] === true
  const legacy = normalizeChannel(options?.otpChannel)
  return { available, channels: available && legacy ? [legacy] : [], choosable: false, lengths, neutralLength }
}

/** The server could not be asked (offline, an error): offer a code anyway with neutral words; the request will say what is wrong. */
export function unknownCodes(): PurposeCodes {
  return { available: true, channels: [], choosable: false, lengths: { ...OTP_LENGTH_BY_CHANNEL }, neutralLength: DEFAULT_OTP_LENGTH }
}

/** The channel a page's words can name: the only one on offer; null with two (the employee picks) or none known. */
export function singleChannel(codes: PurposeCodes): OtpChannel | null {
  return codes.channels.length === 1 ? codes.channels[0] : null
}

/** Digits of a code sent by `channel` (null = not known). */
export function codeLengthFor(codes: PurposeCodes, channel: OtpChannel | null): number {
  return channel ? codes.lengths[channel] : codes.neutralLength
}

/** The channel the main button sends by: the one remembered from last time when it is still on offer, else the server's first. */
export function preferredChannel(channels: readonly OtpChannel[], remembered: unknown): OtpChannel | null {
  const mine = normalizeChannel(remembered)
  if (mine && channels.includes(mine)) return mine
  return channels[0] ?? null
}

/** The send buttons in order: the preferred channel first (the main button), then the rest in the server's order. */
export function channelChoices(channels: readonly OtpChannel[], remembered: unknown): OtpChannel[] {
  const first = preferredChannel(channels, remembered)
  return first ? [first, ...channels.filter((c) => c !== first)] : []
}

/** A send button while the employee picks: "Send code by WhatsApp" / "Send code by SMS". */
export function chooseButtonLabel(channel: OtpChannel): string {
  return `Send code by ${channelName(channel)}`
}

/** The line under the employee-code field while the employee picks: each way with its digits. */
export function chooseHint(codes: PurposeCodes): string {
  const ways = codes.channels.map((c) => `${channelName(c)} (${codes.lengths[c]} digits)`).join(' or ')
  return `Choose how to get your code: ${ways}. It goes to the mobile number registered with HR.`
}

/** The `channel` to put in POST /auth/otp/request: only to a server that takes one, and only a known channel. */
export function requestChannel(codes: PurposeCodes, channel: OtpChannel | null): OtpChannel | undefined {
  return codes.choosable && channel ? channel : undefined
}

/**
 * The ways to offer after a code went out ("Didn't get it? Send by SMS instead"): the answer's `otherChannels` without
 * the one just used, and - when the sign-in options are known (`onOffer`) - only those still on offer.
 */
export function fallbackChannels(otherChannels: unknown, used: unknown, onOffer?: readonly OtpChannel[]): OtpChannel[] {
  const usedChannel = normalizeChannel(used)
  return normalizeChannelList(otherChannels).filter((c) => c !== usedChannel && (!onOffer || onOffer.includes(c)))
}

/** "Didn't get it? " + "Send by SMS instead" (the second part is the button). */
export function fallbackOffer(channel: OtpChannel): { prefix: string; action: string } {
  return { prefix: "Didn't get it? ", action: `Send by ${channelName(channel)} instead` }
}

export interface ChannelUnavailable {
  /** The channels the server still offers for this purpose (may be empty). */
  available: OtpChannel[]
  /** What the employee reads. */
  message: string
}

/**
 * POST /auth/otp/request refused the channel asked for because HR switched it off meanwhile (400 with
 * `code: 'channel_unavailable'`). The page then reloads the sign-in options. null for any other failure. Reads the
 * app's ApiError (`status` / `data`) or an axios-style `response`.
 */
export function channelUnavailable(err: unknown): ChannelUnavailable | null {
  const e = (err ?? {}) as { status?: unknown; data?: unknown; response?: { status?: unknown; data?: unknown } }
  const status = e.response ? e.response.status : e.status
  const body = record(e.response ? e.response.data : e.data)
  if (status !== 400 || !body || body.code !== 'channel_unavailable') return null
  const available = normalizeChannelList(body.availableChannels ?? body.available_channels)
  const fallback = available.length
    ? `That way of sending codes is not available right now. Use ${available.map(channelName).join(' or ')} instead.`
    : 'Codes cannot be sent right now.'
  return { available, message: serverSentence(body) || fallback }
}

export type LoginMode = 'otp' | 'password'

/**
 * Which form the sign-in page shows once the sign-in options (re)load. `before` = whether codes worked on the last
 * load (null on the first), `now` = whether they work now. The first load opens the code form when codes work; a reload
 * (the tab came back into view) keeps what the employee chose, except: no code -> the password form; codes just came on
 * -> the code form; password sign-in off -> the code form (there is no other way in).
 */
export function nextLoginMode(mode: LoginMode, before: boolean | null, now: boolean, passwordLogin: unknown): LoginMode {
  if (!now) return 'password'
  if (before !== true) return 'otp'
  if (passwordLogin === false) return 'otp'
  return mode
}

/** Digits of a code by channel: SMS 4, WhatsApp 6. */
export const OTP_LENGTH_BY_CHANNEL: Record<OtpChannel, number> = { sms: 4, whatsapp: 6 }

/** The length when the server named neither a code length nor a channel: what codes had before the SMS channel. */
export const DEFAULT_OTP_LENGTH = 6

/**
 * How many digits the code has: the server's `codeLength` when it is a whole number from 4 to 8, else what the
 * channel implies (sms 4, whatsapp 6), else 6. A nonsense number from the server is ignored, never trusted.
 */
export function otpLength(codeLength: unknown, channel?: unknown): number {
  const n = typeof codeLength === 'string' && codeLength.trim() !== '' ? Number(codeLength) : codeLength
  if (typeof n === 'number' && Number.isInteger(n) && n >= 4 && n <= 8) return n
  const ch = normalizeChannel(channel)
  return ch ? OTP_LENGTH_BY_CHANNEL[ch] : DEFAULT_OTP_LENGTH
}

/** The label of the code box: "4-digit code". */
export function codeLabel(length: number): string {
  return `${length}-digit code`
}

/** What the form says when the code typed is not complete: "Enter the 4-digit code." */
export function enterCodeMessage(length: number): string {
  return `Enter the ${length}-digit code.`
}

type Form = OtpChannel | 'neutral'
const form = (channel: OtpChannel | null): Form => channel ?? 'neutral'

/** Label of the "send the code" button. */
export function sendButtonLabel(channel: OtpChannel | null): string {
  return { sms: 'Send code by SMS', whatsapp: 'Send code on WhatsApp', neutral: 'Send code' }[form(channel)]
}

/** The line under the employee-code field, before any code has been asked for. `codeLength` is the server's, if it sent one. */
export function sendHint(channel: OtpChannel | null, codeLength?: unknown): string {
  const n = otpLength(codeLength, channel)
  return {
    sms: `We'll send a ${n}-digit code by SMS to the mobile number registered with HR.`,
    whatsapp: `We'll send a ${n}-digit code to the WhatsApp number registered with HR.`,
    neutral: `We'll send a ${n}-digit code to the mobile number registered with HR.`,
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
export function digitsOnly(value: unknown, max = DEFAULT_OTP_LENGTH): string {
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

/** First-time access: the title of the step banner while the employee code is asked for (the mobile app's words; an
 *  SMS code and a code by an unnamed channel both go to the mobile number, so those two read the same). */
export function activateStepTitle(channel: OtpChannel | null): string {
  return channel === 'whatsapp' ? 'Verify your WhatsApp number' : 'Verify your mobile number'
}

/** First-time access: the small line under the code form saying where the code goes (the mobile app's words). */
export function activateFootnote(channel: OtpChannel | null): string {
  return {
    sms: 'The code is sent by SMS to the mobile number HR has registered for you.',
    whatsapp: 'The code goes to the WhatsApp number HR has registered for you.',
    neutral: 'The code goes to the mobile number HR has registered for you.',
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

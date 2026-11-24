import { OTP_CHANNELS, channelName, purposeCodes, type CodeOptionsSource, type OtpChannel, type PurposeCodes } from './otp-channel.ts'

/**
 * The sign-in page's methods (owner 2026-11-24, same as the mobile app's lib/otp.ts): Employee Code + Password is the
 * default and always works; under it "Continue with SMS OTP" and "Continue with WhatsApp OTP". A channel HR switched
 * off stays on screen LOCKED ("Not enabled") and cannot be chosen.
 */
export interface LoginChannelState {
  channel: OtpChannel
  /** "SMS OTP" / "WhatsApp OTP". */
  label: string
  enabled: boolean
  /** Why it cannot be chosen (null when it can). */
  lockedReason: string | null
}

/** One entry per channel (WhatsApp, SMS). `loaded` = the server answered login-options at least once. */
export function loginChannelStates(options: CodeOptionsSource | null | undefined, loaded = true): LoginChannelState[] {
  const codes = purposeCodes(options, 'login')
  // An older server says codes are on without naming a channel: both options open, the server picks.
  const unnamed = codes.available && codes.channels.length === 0
  return OTP_CHANNELS.map((channel) => {
    const enabled = !!options && (unnamed || codes.channels.includes(channel))
    return {
      channel,
      label: `${channelName(channel)} OTP`,
      enabled,
      lockedReason: enabled
        ? null
        : !loaded || !options
          ? 'Checking if it is available...'
          : `Not enabled. ${channelName(channel)} sign-in codes are switched off by HR right now.`,
    }
  })
}

/** The sign-in options restricted to the one channel the employee chose. */
export function codesForChannel(codes: PurposeCodes, channel: OtpChannel): PurposeCodes {
  if (codes.channels.length === 0) return codes // an older server picks the channel itself
  const on = codes.channels.includes(channel)
  return { ...codes, channels: on ? [channel] : [], available: on }
}

/** After the options were asked again: keep the chosen code form only while its channel is still enabled. */
export function keepCodeChannel(current: OtpChannel | null, options: CodeOptionsSource | null | undefined): OtpChannel | null {
  if (!current) return null
  return loginChannelStates(options).find((st) => st.channel === current)?.enabled ? current : null
}

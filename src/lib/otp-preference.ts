// The channel the employee picked last time on this browser ('whatsapp' | 'sms') for a one-time code, so that with both
// switched on the main button is the one they use (lib/otp-channel.ts channelChoices). Only a preference: never the
// code, never a number. Browser storage may be missing, full or blocked (a private window, site data cleared): every
// read and write is guarded and a failure simply means "no preference" (the server's order).
//
// The storage is a parameter so Node's test runner can check it with a stand-in; the pages use the browser's.
import { normalizeChannel, type OtpChannel } from './otp-channel.ts'

export const OTP_CHANNEL_STORAGE_KEY = 'uktex_otp_channel_v1'

type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** The browser's localStorage; null where there is none (Node's test runner) or reading it throws (blocked site data). */
function browserStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null
  } catch {
    return null
  }
}

/** The remembered channel, or null (none, an unknown value, or storage unavailable). */
export function readRememberedChannel(storage: StorageLike | null = browserStorage()): OtpChannel | null {
  try {
    return normalizeChannel(storage?.getItem(OTP_CHANNEL_STORAGE_KEY) ?? null)
  } catch {
    return null
  }
}

/** Remembers `channel`; quietly does nothing when storage is unavailable. */
export function rememberChannel(channel: OtpChannel, storage: StorageLike | null = browserStorage()): void {
  try {
    storage?.setItem(OTP_CHANNEL_STORAGE_KEY, channel)
  } catch {
    // Not saved: the order simply stays the server's next time.
  }
}

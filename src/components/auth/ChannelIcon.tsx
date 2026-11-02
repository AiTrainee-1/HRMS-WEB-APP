import { MessageCircle, MessageSquareText, Send } from 'lucide-react'
import type { OtpChannel } from '@/lib/otp-channel'

/** The icon for the way a code is sent, as the mobile app picks it: the chat bubble for WhatsApp, a text message for
 *  SMS, and a paper plane while the channel is not known. */
export function ChannelIcon({ channel, className }: { channel: OtpChannel | null; className?: string }) {
  const Icon = channel === 'whatsapp' ? MessageCircle : channel === 'sms' ? MessageSquareText : Send
  return <Icon className={className} aria-hidden />
}

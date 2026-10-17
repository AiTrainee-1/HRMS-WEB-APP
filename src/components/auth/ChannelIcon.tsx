import { MessageCircle, Smartphone } from 'lucide-react'
import type { OtpChannel } from '@/lib/otp-channel'

/** The icon for the way a code is sent: the WhatsApp bubble, or a phone for SMS (and for "not known yet"). */
export function ChannelIcon({ channel, className }: { channel: OtpChannel | null; className?: string }) {
  const Icon = channel === 'whatsapp' ? MessageCircle : Smartphone
  return <Icon className={className} aria-hidden />
}

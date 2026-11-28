import {
  BadgeCheck,
  Bell,
  BellRing,
  Briefcase,
  CakeSlice,
  CalendarCheck,
  CalendarClock,
  DoorOpen,
  FileSignature,
  FileText,
  Fingerprint,
  HandCoins,
  Megaphone,
  MessageCircle,
  MessageCircleQuestion,
  Paperclip,
  PartyPopper,
  Send,
  Timer,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Tone } from '@/components/kit'
import { isApprovalNudge } from '@/lib/notifications'
import type { NormalizedTarget } from '@/lib/notification-target'

// Every `type` the backend sends that has an icon of its own (push_messages.notification_type, approval_workflow,
// mobile_reminder_views ...); anything else gets the generic bell.
const ICONS: Record<string, { icon: LucideIcon; tone: Tone }> = {
  leave: { icon: Send, tone: 'sapphire' },
  permission: { icon: Timer, tone: 'violet' },
  casual_leave: { icon: CalendarClock, tone: 'violet' },
  attendance: { icon: CalendarCheck, tone: 'emerald' },
  resignation: { icon: FileSignature, tone: 'rose' },
  chat: { icon: MessageCircle, tone: 'sapphire' },
  on_duty: { icon: Briefcase, tone: 'sapphire' },
  missing_punch: { icon: Fingerprint, tone: 'amber' },
  outpass: { icon: DoorOpen, tone: 'slate' },
  employee_request: { icon: FileText, tone: 'sapphire' },
  compensation: { icon: HandCoins, tone: 'violet' },
  holiday_work: { icon: PartyPopper, tone: 'amber' },
  // Birthday Compensation (2026-11-25): the employee's placement moving on, and the head being asked to decide one.
  birthday_compensation: { icon: CakeSlice, tone: 'violet' },
  approval: { icon: BadgeCheck, tone: 'sapphire' },
  approval_reminder: { icon: BellRing, tone: 'amber' },
  advance: { icon: Wallet, tone: 'sapphire' },
  visitors: { icon: Users, tone: 'sapphire' },
  salary_slip: { icon: Wallet, tone: 'emerald' },
  id_card: { icon: BadgeCheck, tone: 'sapphire' },
  offer_letter: { icon: FileText, tone: 'sapphire' },
  experience_letter: { icon: FileText, tone: 'sapphire' },
  resignation_letter: { icon: FileText, tone: 'rose' },
  other: { icon: Paperclip, tone: 'sapphire' },
  general: { icon: Megaphone, tone: 'sapphire' },
  // 2026-11-24: HR replied to / moved one of my enquiries.
  enquiry: { icon: MessageCircleQuestion, tone: 'sapphire' },
}

const iconOf = (key: string | undefined) => (key && Object.hasOwn(ICONS, key) ? ICONS[key] : undefined)

/** A notification's icon and colour: its type's, else (a head being asked to act) the reminder bell, else what its
 *  target is about, else a plain bell. */
export function notificationLook(n: { type?: string; message?: string }, target: NormalizedTarget | null): { icon: LucideIcon; tone: Tone } {
  const nudge = target?.role === 'approver' || isApprovalNudge(n.type, n.message)
  return iconOf(n.type) ?? (nudge ? ICONS.approval_reminder : (iconOf(target?.kind) ?? { icon: Bell, tone: 'slate' }))
}

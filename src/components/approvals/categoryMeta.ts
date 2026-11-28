import {
  CakeSlice,
  CalendarCheck,
  CalendarClock,
  DoorOpen,
  FileSignature,
  Fingerprint,
  HandCoins,
  MapPin,
  Send,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import type { Tone } from '@/components/kit'
import type { ApprovalCategory } from '@/lib/approvals-history'

/** Icon and identity colour per category (the card's accent stripe, its type chip, the rail). Status still uses the
 *  status tones; this colour only tells the kinds apart. */
export const CATEGORY_META: Record<ApprovalCategory, { icon: LucideIcon; tone: Tone }> = {
  leave: { icon: Send, tone: 'sapphire' },
  permission: { icon: Timer, tone: 'violet' },
  casual_leave: { icon: CalendarClock, tone: 'violet' },
  attendance: { icon: CalendarCheck, tone: 'emerald' },
  missing_punch: { icon: Fingerprint, tone: 'amber' },
  on_duty: { icon: MapPin, tone: 'sapphire' },
  outpass: { icon: DoorOpen, tone: 'slate' },
  holiday_work: { icon: HandCoins, tone: 'violet' },
  birthday_compensation: { icon: CakeSlice, tone: 'violet' },
  resignation: { icon: FileSignature, tone: 'rose' },
}

/** The thin accent stripe on the left edge of a card, per tone. */
export const TONE_STRIPE: Record<Tone, string> = {
  sapphire: 'bg-primary',
  amber: 'bg-warning',
  emerald: 'bg-success',
  rose: 'bg-destructive',
  violet: 'bg-[var(--brand-violet)]',
  slate: 'bg-muted-foreground',
}

/**
 * Phones (< 768px): the mobile app fills the chosen category pill with the category's own colour. The same fills as
 * the stripe, each with a foreground that passes AA in both phone themes (text-background is near-white in light,
 * near-black in dark). Phone-only classes (kit/MOBILE.md).
 */
export const PHONE_TONE_FILL: Record<Tone, string> = {
  sapphire: 'max-md:bg-primary max-md:text-primary-foreground',
  amber: 'max-md:bg-warning max-md:text-warning-foreground',
  emerald: 'max-md:bg-success max-md:text-success-foreground',
  rose: 'max-md:bg-destructive max-md:text-destructive-foreground',
  violet: 'max-md:bg-[var(--brand-violet)] max-md:text-background',
  slate: 'max-md:bg-muted-foreground max-md:text-background',
}

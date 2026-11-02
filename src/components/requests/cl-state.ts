import { CalendarCheck2, CalendarClock, CalendarOff, CalendarRange, type LucideIcon } from 'lucide-react'
import type { StatusTone, Tone } from '@/components/kit'
import type { MonthCardState } from '@/lib/casual-leave'

/** This month's Casual Leave state as a colour role, icon and pill (shared by the Leave card and the CL page hero). */
export const CL_STATE: Record<MonthCardState['tone'], { tone: Tone; status: StatusTone; icon: LucideIcon; word: string }> = {
  open: { tone: 'emerald', status: 'approved', icon: CalendarCheck2, word: 'Available' },
  half: { tone: 'violet', status: 'info', icon: CalendarRange, word: 'Half left' },
  used: { tone: 'sapphire', status: 'info', icon: CalendarClock, word: 'Used' },
  closed: { tone: 'slate', status: 'neutral', icon: CalendarOff, word: 'Not available' },
}

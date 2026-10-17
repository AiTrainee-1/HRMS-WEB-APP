import { Bed, Cake, Gift, HandCoins, Hourglass, PartyPopper, Sunrise, Sunset, Timer, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MarkerSymbolName } from '@/lib/attendance-flags'

const SYMBOLS: Record<MarkerSymbolName, LucideIcon> = {
  timer: Timer,
  sunrise: Sunrise,
  sunset: Sunset,
  cake: Cake,
  bed: Bed,
  hourglass: Hourglass,
  handCoins: HandCoins,
  party: PartyPopper,
  gift: Gift,
}

/** The symbol of a compensation marker or kind (decorative: the label next to it says the same in words). A name this
 * app does not know draws the generic gift. */
export function MarkerSymbol({ name, className }: { name: MarkerSymbolName | string | undefined; className?: string }) {
  const Icon = (name && (SYMBOLS as Record<string, LucideIcon | undefined>)[name]) || Gift
  return <Icon aria-hidden className={cn('size-4 shrink-0', className)} />
}

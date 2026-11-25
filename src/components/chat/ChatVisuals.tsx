import { ShieldCheck } from 'lucide-react'
import { initialsOf } from '@/lib/chat-thread'
import { cn } from '@/lib/utils'
import { tintFor } from './chat-style'

/** The little curved "tail" on the first bubble of a run, WhatsApp-style. Coloured by the class (currentColor). */
export function BubbleTail({ side, className }: { side: 'left' | 'right'; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="9"
      height="13"
      viewBox="0 0 9 13"
      className={cn('pointer-events-none absolute top-0', side === 'right' ? '-right-[7px]' : '-left-[7px]', className)}
    >
      <path d={side === 'right' ? 'M0 0 H8.4 C7.2 1.4 3.6 6.4 0 12.6 Z' : 'M9 0 H0.6 C1.8 1.4 5.4 6.4 9 12.6 Z'} fill="currentColor" />
    </svg>
  )
}

/** A colleague's initials on their own soft colour; HR / management as a shield. */
export function ChatAvatar({ name, isHr, size = 28, className }: { name: string; isHr: boolean; size?: number; className?: string }) {
  if (isHr) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn('grid shrink-0 place-items-center rounded-full bg-violet-bg text-violet', className)}
      >
        <ShieldCheck style={{ width: size * 0.54, height: size * 0.54 }} />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.37) }}
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold', tintFor(name || '?').avatar, className)}
    >
      {initialsOf(name)}
    </span>
  )
}

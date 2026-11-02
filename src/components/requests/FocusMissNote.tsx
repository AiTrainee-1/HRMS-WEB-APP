import * as React from 'react'
import { SearchX, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The small note a page shows when a link (a notification's View button) asked for an item that is not in its list any
 * more: "That request is no longer in this list". Calm sapphire, read out once (role="status"), with a close button.
 * Pair it with hooks/useFocusItem's `missing` / `dismiss`.
 */
export function FocusMissNote({ children, onDismiss, className }: { children?: React.ReactNode; onDismiss?: () => void; className?: string }) {
  return (
    <div role="status" className={cn('flex items-start gap-2.5 rounded-xl border border-info-border bg-info-bg px-3.5 py-2.5 text-[13px] text-info', className)}>
      <SearchX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-5 font-medium">{children ?? 'That request is no longer in this list.'}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close this note"
          className="focus-ring -my-2.5 -mr-2 grid size-11 shrink-0 place-items-center rounded-md hover:bg-foreground/[0.06] sm:-my-1.5 sm:size-8"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

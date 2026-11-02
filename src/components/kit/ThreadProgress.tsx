import { cn } from '@/lib/utils'

/**
 * The thread-line progress indicator: a hairline track with a silk thread running along it. Without `value` it runs
 * (indeterminate: "working on it"); with `value` (0-100) it fills to that point. The app shell shows one under the top
 * bar while a page's first data loads — pages use it for uploads, multi-step forms, or "3 of 5 documents".
 *
 *   <ThreadProgress label="Uploading photo" />
 *   <ThreadProgress value={60} label="Profile 60% complete" />
 */
export function ThreadProgress({ value, label = 'Loading', className }: { value?: number; label?: string; className?: string }) {
  const determinate = typeof value === 'number' && Number.isFinite(value)
  const pct = determinate ? Math.max(0, Math.min(100, value)) : undefined
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuenow={pct}
      data-value={determinate ? pct : undefined}
      className={cn('thread-progress w-full', className)}
      style={determinate ? ({ '--progress': pct } as React.CSSProperties) : undefined}
    />
  )
}

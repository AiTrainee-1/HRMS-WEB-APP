import * as React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadErrorMessage } from '@/lib/load-error'
import { cn } from '@/lib/utils'
import { fadeRise, staggerDelay } from './motion'
import { TONE_SOFT, type Tone } from './tones'

/**
 * Nothing to show (yet). A tinted icon on a small woven swatch, a plain sentence, and optionally the one action that
 * fixes it ("Apply for leave"). Say what the person can do, not what the system lacks.
 * Phones (< 768px): the mobile app's EmptyState - no dashed box, the icon in an 80px tinted circle (compact: 48px),
 * a 17px bold title in the secondary text colour, a 13px muted line.
 *
 *   <EmptyState icon={CalendarCheck} title="No leave requests yet" description="When you apply, it shows here." action={<Button>Apply for leave</Button>} />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  tone = 'sapphire',
  compact,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: Tone
  /** Less padding, for inside a card. */
  compact?: boolean
  className?: string
}) {
  return (
    <motion.div
      variants={fadeRise}
      initial="hidden"
      animate="show"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-foreground/15 text-center max-md:border-0',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12 max-md:gap-3.5 max-md:px-8 max-md:py-8',
        className,
      )}
    >
      <span className={cn('weave-static relative grid size-20 place-items-center rounded-full', compact && 'max-md:size-12')} aria-hidden="true">
        <span
          className={cn(
            'grid size-12 place-items-center rounded-full border shadow-clay-sm max-md:border-0',
            !compact && 'max-md:size-20',
            TONE_SOFT[tone],
          )}
        >
          <Icon className={cn('size-6', !compact && 'max-md:size-10')} />
        </span>
      </span>
      <h3 className="font-display text-lg font-semibold max-md:text-[17px] max-md:font-bold max-md:text-secondary-foreground">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground max-md:text-[13px] max-md:leading-5">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </motion.div>
  )
}

/**
 * Could not load. Says why in plain words and offers Try again; announced to screen readers (role="alert"). Pass the
 * query's `error` + `what` ("your leave requests") to get the standard sentence (lib/load-error), or your own `message`.
 *
 *   if (q.isError) return <ErrorState error={q.error} what="your leave requests" onRetry={() => q.refetch()} retrying={q.isFetching} />
 */
export function ErrorState({
  title = 'Could not load this',
  message,
  error,
  what = 'this information',
  onRetry,
  retrying,
  compact,
  className,
}: {
  title?: string
  message?: string
  error?: unknown
  what?: string
  onRetry?: () => void
  retrying?: boolean
  compact?: boolean
  className?: string
}) {
  const text = message ?? loadErrorMessage(error, what)
  return (
    <motion.div
      variants={fadeRise}
      initial="hidden"
      animate="show"
      role="alert"
      data-testid="load-error"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-rejected-border bg-rejected-bg/60 max-md:border-transparent max-md:bg-rejected-bg sm:flex-row sm:items-center',
        compact ? 'p-3' : 'p-4 sm:p-5',
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-rejected-bg text-rejected" aria-hidden="true">
        <AlertTriangle className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-foreground/80">{text}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={retrying} className="min-h-11 sm:min-h-9">
          <RefreshCw className={cn(retrying && 'animate-spin')} aria-hidden="true" /> {retrying ? 'Trying…' : 'Try again'}
        </Button>
      )}
    </motion.div>
  )
}

/** One shimmering placeholder block; size it with className (h-4 w-32, size-10 rounded-full ...). */
export function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton-shimmer block rounded-md', className)} />
}

/**
 * Loading placeholders shaped like what is coming, so nothing jumps when it arrives: `rows` = list rows (avatar + two
 * lines + a pill), `cards` = request cards, `tiles` = a KPI row. Announced once as "Loading".
 *
 *   if (q.isLoading) return <SkeletonList variant="cards" count={3} />
 */
export function SkeletonList({
  variant = 'rows',
  count = 4,
  className,
  label = 'Loading',
}: {
  variant?: 'rows' | 'cards' | 'tiles'
  count?: number
  className?: string
  label?: string
}) {
  const items = Array.from({ length: count }, (_, i) => i)
  return (
    <div role="status" aria-label={label} className={className}>
      <span className="sr-only">{label}…</span>
      {variant === 'tiles' ? (
        <div className="grid grid-cols-2 gap-3 max-md:gap-2.5 lg:grid-cols-4">
          {items.map((i) => (
            <div key={i} className="glass rounded-xl p-4" style={{ opacity: 1 - i * 0.08 }}>
              <SkeletonBlock className="size-9 rounded-lg" />
              <SkeletonBlock className="mt-4 h-3 w-20" />
              <SkeletonBlock className="mt-2 h-7 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-md:gap-2.5">
          {items.map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 - i * 0.12 }}
              transition={{ delay: staggerDelay(i) }}
              className={cn('glass flex items-center gap-3 rounded-xl', variant === 'cards' ? 'p-4 sm:p-5' : 'p-3')}
            >
              <SkeletonBlock className={cn('shrink-0 rounded-full', variant === 'cards' ? 'size-11' : 'size-9')} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <SkeletonBlock className="h-3.5 w-2/5" />
                <SkeletonBlock className="h-3 w-3/5" />
                {variant === 'cards' && <SkeletonBlock className="h-3 w-1/4" />}
              </div>
              <SkeletonBlock className="h-6 w-20 rounded-full" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

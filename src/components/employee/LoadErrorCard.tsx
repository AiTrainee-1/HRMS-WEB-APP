import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** "We could not load this" with the reason (lib/load-error.ts) and a Try again button; announced to screen readers. */
export function LoadErrorCard({
  title,
  message,
  onRetry,
  retrying,
  className,
}: {
  title: string
  message: string
  onRetry: () => void
  retrying: boolean
  className?: string
}) {
  return (
    <Card className={cn('border-destructive/30 bg-destructive/10', className)} data-testid="load-error">
      <CardContent role="alert" className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-start gap-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p>
            <span className="font-semibold">{title}</span> {message}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
          <RefreshCw className={cn(retrying && 'animate-spin')} /> Try again
        </Button>
      </CardContent>
    </Card>
  )
}

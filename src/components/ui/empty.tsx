import * as React from 'react'
import { cn } from '@/lib/utils'

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn('flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 px-6 text-center', className)}
      {...props}
    />
  )
}

function EmptyIcon({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty-icon"
      className={cn('mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6', className)}
      {...props}
    >
      {children}
    </div>
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 data-slot="empty-title" className={cn('text-sm font-semibold', className)} {...props} />
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="empty-description" className={cn('text-muted-foreground text-sm max-w-sm', className)} {...props} />
}

export { Empty, EmptyIcon, EmptyTitle, EmptyDescription }

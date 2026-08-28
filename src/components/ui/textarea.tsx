import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full rounded-xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-3 py-2 text-sm text-foreground caret-primary shadow-sm transition-all duration-200 outline-none placeholder:text-muted-foreground hover:bg-white/80 dark:hover:bg-white/10 hover:border-white/80 dark:hover:border-white/20 focus-visible:bg-white dark:focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-brand-blue/15 focus-visible:border-brand-blue disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-20 w-full rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm px-3 py-2 text-sm shadow-sm transition-all duration-200 outline-none placeholder:text-muted-foreground hover:bg-white/80 hover:border-white/80 focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-brand-blue/15 focus-visible:border-brand-blue disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

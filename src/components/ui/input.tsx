import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // text-foreground and caret-primary are explicit, not inherited: an
        // input that leaves its colour to the cascade is one stray parent
        // style away from typing invisibly, and a default caret is easy to
        // lose against a tinted field.
        'flex h-10 w-full min-w-0 rounded-xl border border-white/60 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm px-3 py-1 text-sm text-foreground caret-primary shadow-sm transition-all duration-200 outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground hover:bg-white/80 dark:hover:bg-white/10 hover:border-white/80 dark:hover:border-white/20 focus-visible:bg-white dark:focus-visible:bg-card focus-visible:ring-[3px] focus-visible:ring-brand-blue/15 focus-visible:border-brand-blue disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

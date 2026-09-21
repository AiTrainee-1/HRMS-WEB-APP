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
        // style away from typing invisibly.
        'flex h-10 w-full min-w-0 rounded-md border border-input bg-background/60 px-3 py-1 text-sm text-foreground caret-primary transition-all duration-200 outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

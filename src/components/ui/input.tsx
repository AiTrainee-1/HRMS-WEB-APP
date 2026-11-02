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
        // Phones: 16px text (smaller makes iOS zoom the page on focus) in the app's 48px white field.
        'max-md:h-12 max-md:rounded-lg max-md:bg-card max-md:pr-3.5 max-md:text-base',
        'flex h-10 w-full min-w-0 rounded-md border border-input bg-background/60 px-3 py-1 text-sm text-foreground caret-primary shadow-[inset_0_1px_2px_rgb(0_0_0/0.05)] transition-[border-color,box-shadow,background-color] duration-200 outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-primary focus-visible:bg-background/80 focus-visible:ring-[3px] focus-visible:ring-primary/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

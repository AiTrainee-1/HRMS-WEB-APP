import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Phones: 16px text (no iOS focus zoom), the app's white field.
        'max-md:rounded-lg max-md:bg-card max-md:px-3.5 max-md:py-3 max-md:text-base',
        'flex min-h-20 w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground caret-primary shadow-[inset_0_1px_2px_rgb(0_0_0/0.05)] transition-[border-color,box-shadow,background-color] duration-200 outline-none placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-primary focus-visible:bg-background/80 focus-visible:ring-[3px] focus-visible:ring-primary/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

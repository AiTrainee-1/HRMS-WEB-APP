import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full min-w-0 rounded-xl border border-white/60 bg-white/50 backdrop-blur-sm px-3 py-1 text-sm shadow-sm transition-all duration-200 outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground hover:bg-white/80 hover:border-white/80 focus-visible:bg-white focus-visible:ring-[3px] focus-visible:ring-brand-blue/15 focus-visible:border-brand-blue disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

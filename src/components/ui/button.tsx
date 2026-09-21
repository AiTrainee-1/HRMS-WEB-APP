import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Sovereign Loom buttons: restrained 4px radius ("precision-milled"), Plus
// Jakarta Sans labels, a sapphire gradient for the primary action and a
// hairline outline for secondary ones.
const buttonVariants = cva(
  "font-label inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[0.01em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          'bg-brand-gradient text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110 glow-primary',
        gradient:
          'bg-brand-gradient text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:brightness-110 glow-primary',
        destructive:
          'bg-destructive/15 text-destructive border border-destructive/30 hover:bg-destructive/25',
        outline:
          'border border-foreground/15 bg-foreground/[0.03] text-foreground hover:border-primary/50 hover:bg-primary/10',
        secondary: 'bg-secondary text-secondary-foreground border hairline hover:bg-accent',
        ghost: 'text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground',
        glass: 'glass text-foreground hover:border-primary/40 hover:bg-primary/10',
        success:
          'bg-success/15 text-success border border-success/30 hover:bg-success/25',
        link: 'text-brand-blue underline-offset-4 hover:underline px-0',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-[15px]',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }

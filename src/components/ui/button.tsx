import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Sovereign Loom buttons: Plus Jakarta Sans labels, a sapphire gradient for the primary action with a silk sheen that
// sweeps across on hover (pointer devices; .btn-sheen in index.css), and a hairline outline for secondary ones.
// Focus: a 2px ring with a gap, visible on every variant in both themes.
// Phones (< 768px): the mobile app's pill buttons (BorderRadius.full) at a 44px touch height; filled ones lose the
// coloured drop glow. A tile-like Button that must stay square on phones adds max-md:rounded-xl (kit/MOBILE.md).
const buttonVariants = cva(
  "font-label inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[0.01em] transition-[background-color,border-color,color,box-shadow,transform,filter] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] max-md:rounded-full",
  {
    variants: {
      variant: {
        default:
          'btn-sheen bg-brand-gradient text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_16px_-8px_rgb(37_99_235/0.7)] hover:brightness-110 glow-primary max-md:shadow-[inset_0_1px_0_rgb(255_255_255/0.16)]',
        gradient:
          'btn-sheen bg-brand-gradient text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_16px_-8px_rgb(37_99_235/0.7)] hover:brightness-110 glow-primary max-md:shadow-[inset_0_1px_0_rgb(255_255_255/0.16)]',
        destructive: 'bg-rejected-bg text-rejected border border-rejected-border hover:brightness-95 dark:hover:brightness-125',
        outline:
          'border border-foreground/15 bg-foreground/[0.03] text-foreground hover:border-primary/50 hover:bg-primary/10',
        secondary: 'bg-secondary text-secondary-foreground border hairline hover:bg-accent',
        ghost: 'text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground',
        glass: 'glass text-foreground hover:border-primary/40 hover:bg-primary/10',
        success: 'bg-approved-bg text-approved border border-approved-border hover:brightness-95 dark:hover:brightness-125',
        link: 'text-brand-blue underline-offset-4 hover:underline px-0',
      },
      size: {
        default: 'h-9 px-4 py-2 max-md:h-11 max-md:px-5',
        sm: 'h-8 px-3 text-xs max-md:h-9 max-md:px-3.5',
        lg: 'h-11 px-6 text-[15px] max-md:h-12 max-md:px-7 max-md:font-bold',
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

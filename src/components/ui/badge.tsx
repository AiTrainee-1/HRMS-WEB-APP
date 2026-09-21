import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Pill status chips: the one place the design system allows full rounding.
const badgeVariants = cva('chip w-fit shrink-0', {
  variants: {
    variant: {
      default: 'chip-info',
      secondary: 'chip-muted',
      destructive: 'chip-danger',
      outline: 'border-foreground/15 text-foreground',
      success: 'chip-success',
      warning: 'chip-warning',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant, className }))} {...props} />
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }

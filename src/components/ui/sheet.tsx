import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn('ui-fade fixed inset-0 z-50 bg-[#020617]/60 backdrop-blur-sm max-md:bg-[rgb(15_30_45/0.5)] max-md:backdrop-blur-none', className)}
      {...props}
    />
  )
}

// Slides in from its side (.ui-slide-* in index.css, keyed on data-state).
// Phones (< 768px): a solid surface (no frosting); side="bottom" is the mobile app's BottomSheet (24px corners, handle,
// at most 88% tall, clears the home indicator).
const sheetVariants = cva(
  'bg-popover/95 backdrop-blur-2xl border-[var(--glass-border)] fixed z-50 flex flex-col gap-4 shadow-clay-lg max-md:bg-popover max-md:backdrop-blur-none',
  {
    variants: {
      side: {
        top: 'ui-slide-top inset-x-0 top-0 border-b',
        bottom:
          'ui-slide-bottom inset-x-0 bottom-0 rounded-t-xl border-t max-md:max-h-[88dvh] max-md:rounded-t-3xl max-md:pt-5 max-md:pb-[env(safe-area-inset-bottom)]',
        left: 'ui-slide-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
        right: 'ui-slide-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
      },
    },
    defaultVariants: { side: 'right' },
  },
)

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & VariantProps<typeof sheetVariants>) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content data-slot="sheet-content" className={cn(sheetVariants({ side }), className)} {...props}>
        {side === 'bottom' && (
          <span
            aria-hidden="true"
            className="pointer-events-none hidden max-md:absolute max-md:top-3 max-md:left-1/2 max-md:block max-md:h-1 max-md:w-9 max-md:-translate-x-1/2 max-md:rounded-full max-md:bg-input"
          />
        )}
        {children}
        <SheetPrimitive.Close className="absolute top-2.5 right-2.5 grid size-10 place-items-center rounded-md text-foreground/70 transition-colors outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn('text-foreground font-semibold', className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description data-slot="sheet-description" className={cn('text-muted-foreground text-sm', className)} {...props} />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }

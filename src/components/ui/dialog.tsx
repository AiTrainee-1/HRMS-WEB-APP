import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

// Enter / exit come from .ui-fade / .ui-pop in index.css (keyed on Radix's data-state, so the exit plays before
// unmount); a silk thread runs along the top of every dialog.
// Phones (< 768px): the mobile app's BottomSheet - full width on the bottom edge, 24px top corners, a drag-handle bar,
// at most 88% of the screen tall (scrolls inside), clears the home indicator, slides up (index.css). Same props.
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn('ui-fade fixed inset-0 z-50 bg-[#020617]/60 backdrop-blur-sm max-md:bg-[rgb(15_30_45/0.5)] max-md:backdrop-blur-none', className)}
      {...props}
    />
  )
}

function DialogContent({ className, children, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'ui-pop bg-popover text-popover-foreground border border-[var(--glass-border)] fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl p-6 shadow-clay-lg sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin',
          'max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:w-full max-md:max-w-none! max-md:translate-x-0 max-md:translate-y-0 max-md:max-h-[88dvh] max-md:rounded-t-3xl max-md:rounded-b-none max-md:border-x-0 max-md:border-b-0 max-md:p-4 max-md:pt-7 max-md:pb-[calc(env(safe-area-inset-bottom)+20px)]',
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" className="bg-silk pointer-events-none absolute inset-x-8 top-0 h-[2px] rounded-b-full opacity-80 max-md:hidden" />
        {/* The bottom sheet's drag handle (phones only; decoration - close with the X, a tap outside or Esc). */}
        <span
          aria-hidden="true"
          className="pointer-events-none hidden max-md:absolute max-md:top-3 max-md:left-1/2 max-md:block max-md:h-1 max-md:w-9 max-md:-translate-x-1/2 max-md:rounded-full max-md:bg-input"
        />
        {children}
        <DialogPrimitive.Close className="absolute top-2.5 right-2.5 grid size-10 place-items-center rounded-md text-foreground/70 transition-colors outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="dialog-header" className={cn('flex flex-col gap-2 pr-8 text-center max-md:gap-1 max-md:text-left sm:text-left', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-display text-xl font-semibold max-md:text-lg max-md:font-bold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}

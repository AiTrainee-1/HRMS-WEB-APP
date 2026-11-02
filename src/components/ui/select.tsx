import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        // Phones: the app's 48px white field, 16px text.
        'max-md:h-12 max-md:rounded-lg max-md:bg-card max-md:px-3.5 max-md:text-base',
        'group flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.05)] transition-[border-color,box-shadow,background-color] duration-200 outline-none hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 data-[state=open]:border-primary aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          'ui-pop bg-popover/95 backdrop-blur-xl text-popover-foreground relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-[var(--glass-border)] shadow-clay-lg',
          position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.Viewport className={cn('p-1', position === 'popper' && 'w-full min-w-[var(--radix-select-trigger-width)]')}>
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'focus:bg-primary/12 focus:text-foreground data-[state=checked]:font-semibold relative flex w-full cursor-default items-center gap-2 rounded-md py-2 pr-8 pl-2.5 text-sm outline-none select-none pointer-coarse:min-h-11 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center text-brand-blue">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem }

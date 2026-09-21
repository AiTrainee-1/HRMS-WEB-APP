import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('glass text-muted-foreground inline-flex h-10 w-fit items-center justify-center rounded-md p-1', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "font-label data-[state=active]:bg-brand-gradient data-[state=active]:text-white data-[state=active]:shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] hover:text-foreground inline-flex flex-1 items-center justify-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn('flex-1 outline-none', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

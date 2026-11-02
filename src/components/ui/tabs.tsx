import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SPRING } from '@/components/kit/motion'

// The active tab is a sapphire pill that springs from tab to tab (a shared-layout indicator) with a silk thread along
// its foot. Tabs keeps Radix's API (value / defaultValue / onValueChange); it only tracks the value itself so the
// triggers know which one carries the pill.
const TabsContext = React.createContext<{ value: string | undefined; id: string } | null>(null)

function Tabs({ value, defaultValue, onValueChange, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [inner, setInner] = React.useState(defaultValue)
  const current = value ?? inner
  const id = React.useId()
  const ctx = React.useMemo(() => ({ value: current, id }), [current, id])
  return (
    <TabsContext.Provider value={ctx}>
      <TabsPrimitive.Root
        value={current}
        onValueChange={(v) => {
          if (value === undefined) setInner(v)
          onValueChange?.(v)
        }}
        {...props}
      />
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('glass text-muted-foreground inline-flex h-10 w-fit items-center justify-center gap-1 rounded-lg p-1 max-md:h-12 max-md:rounded-xl', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, children, value, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const ctx = React.useContext(TabsContext)
  const active = !!ctx && ctx.value === value
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        'max-md:rounded-lg',
        'font-label relative inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-200 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-white',
        // Without the shared context (a trigger rendered outside our <Tabs>), fall back to a plain filled active state.
        !ctx && 'data-[state=active]:bg-brand-gradient',
        className,
      )}
      {...props}
    >
      {active && (
        <motion.span
          layoutId={`tabs-${ctx.id}`}
          transition={SPRING}
          aria-hidden="true"
          className="bg-brand-gradient absolute inset-0 rounded-md shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_16px_-8px_rgb(37_99_235/0.7)] max-md:rounded-lg max-md:shadow-none"
        >
          <span className="bg-silk absolute inset-x-3 bottom-[3px] h-[2px] rounded-full opacity-80 max-md:hidden" />
        </motion.span>
      )}
      <span className="relative z-10 inline-flex min-w-0 items-center gap-1.5">{children}</span>
    </TabsPrimitive.Trigger>
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

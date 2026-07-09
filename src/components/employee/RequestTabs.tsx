import * as React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Reveal } from './Reveal'

export function RequestTabs<T>({
  liveItems,
  confirmedItems,
  renderItem,
  liveLabel = 'Live Requests',
  confirmedLabel = 'Confirmed Requests',
  emptyLive,
  emptyConfirmed,
}: {
  liveItems: T[]
  confirmedItems: T[]
  renderItem: (item: T) => React.ReactNode
  liveLabel?: string
  confirmedLabel?: string
  emptyLive: React.ReactNode
  emptyConfirmed: React.ReactNode
}) {
  return (
    <Tabs defaultValue="live" className="w-full">
      <TabsList>
        <TabsTrigger value="live">
          {liveLabel} {liveItems.length > 0 && <span className="ml-1 opacity-70">({liveItems.length})</span>}
        </TabsTrigger>
        <TabsTrigger value="confirmed">{confirmedLabel}</TabsTrigger>
      </TabsList>
      <TabsContent value="live" className="mt-4 flex flex-col gap-3">
        {liveItems.length === 0
          ? emptyLive
          : liveItems.map((item, i) => (
              <Reveal key={i} index={i}>
                {renderItem(item)}
              </Reveal>
            ))}
      </TabsContent>
      <TabsContent value="confirmed" className="mt-4 flex flex-col gap-3">
        {confirmedItems.length === 0
          ? emptyConfirmed
          : confirmedItems.map((item, i) => (
              <Reveal key={i} index={i}>
                {renderItem(item)}
              </Reveal>
            ))}
      </TabsContent>
    </Tabs>
  )
}

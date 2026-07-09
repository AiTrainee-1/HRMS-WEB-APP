import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Send, Smile, Reply, X, MessageCircle } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/employee/EmptyState'
import { chatApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/types'
import { format, parseISO } from 'date-fns'

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👏', '🙏']

function MessageBubble({ msg, onReply, onReact, isMine }: { msg: ChatMessage; onReply: () => void; onReact: (emoji: string) => void; isMine: boolean }) {
  return (
    <div className={cn('group flex flex-col gap-1', isMine && 'items-end')}>
      <span className="text-xs text-muted-foreground px-1">{msg.senderName}</span>
      <div className={cn('relative max-w-[75%] rounded-lg px-3 py-2 text-sm', isMine ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
        {msg.replyTo && (
          <div className={cn('mb-1 rounded border-l-2 px-2 py-1 text-xs opacity-80', isMine ? 'border-primary-foreground/50' : 'border-primary/50')}>
            <p className="font-medium">{msg.replyTo.senderName}</p>
            <p className="line-clamp-1">{msg.replyTo.text}</p>
          </div>
        )}
        <p>{msg.text}</p>
        <div className="absolute top-1 -right-16 hidden gap-1 group-hover:flex">
          <Button variant="secondary" size="icon" className="size-7" onClick={onReply}>
            <Reply className="size-3.5" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" size="icon" className="size-7">
                <Smile className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex gap-1">
                {QUICK_EMOJI.map((e) => (
                  <button key={e} className="text-lg hover:scale-125 transition-transform" onClick={() => onReact(e)}>
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {msg.reactions.length > 0 && (
        <div className="flex gap-1 px-1">
          {msg.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => onReact(r.emoji)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs',
                r.reactedByMe ? 'border-primary bg-primary/10' : 'border-border bg-background',
              )}
            >
              {r.emoji} {r.count}
            </button>
          ))}
        </div>
      )}
      <span className="text-[10px] text-muted-foreground px-1">{format(parseISO(msg.createdAt), 'HH:mm')}</span>
    </div>
  )
}

function ChannelView({ channelId }: { channelId: string }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [text, setText] = React.useState('')
  const [replyTo, setReplyTo] = React.useState<ChatMessage | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['chat-messages', channelId],
    queryFn: () => chatApi.messages(channelId, { limit: 50 }),
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  })

  const sendMutation = useMutation({
    mutationFn: () => chatApi.send(channelId, text, replyTo?.id),
    onSuccess: () => {
      setText('')
      setReplyTo(null)
      qc.invalidateQueries({ queryKey: ['chat-messages', channelId] })
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not send message'),
  })

  const reactMutation = useMutation({
    mutationFn: ({ id, emoji, active }: { id: string; emoji: string; active: boolean }) =>
      active ? chatApi.unreact(id, emoji) : chatApi.react(id, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-messages', channelId] }),
  })

  function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    sendMutation.mutate()
  }

  const messages = data ?? []

  return (
    <div className="flex h-[60vh] flex-col rounded-lg border bg-background">
      <ScrollArea className="flex-1 p-4">
        {isLoading && <Skeleton className="h-full w-full" />}
        {!isLoading && messages.length === 0 && <EmptyState icon={MessageCircle} title="No messages yet" description="Start the conversation." />}
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              isMine={m.senderId === user?.employeeId}
              onReply={() => setReplyTo(m)}
              onReact={(emoji) => {
                const existing = m.reactions.find((r) => r.emoji === emoji)
                reactMutation.mutate({ id: m.id, emoji, active: !!existing?.reactedByMe })
              }}
            />
          ))}
        </div>
      </ScrollArea>
      {replyTo && (
        <div className="flex items-center justify-between border-t bg-muted/50 px-3 py-1.5 text-xs">
          <span>
            Replying to <strong>{replyTo.senderName}</strong>: {replyTo.text.slice(0, 60)}
          </span>
          <Button variant="ghost" size="icon" className="size-6" onClick={() => setReplyTo(null)}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}
      <form onSubmit={handleSend} className="flex items-center gap-2 border-t p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
        <Button type="submit" variant="gradient" size="icon" disabled={sendMutation.isPending || !text.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}

export default function Chat() {
  const { data: channels, isLoading } = useQuery({ queryKey: ['chat-channels'], queryFn: chatApi.channels })

  if (isLoading) return <Skeleton className="h-96 w-full" />

  const company = channels?.find((c) => c.type === 'company')
  const department = channels?.find((c) => c.type === 'department')

  if (!company && !department) {
    return <EmptyState icon={MessageCircle} title="No chat channels available" />
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Chat" subtitle="Company-wide and department conversations" icon={<MessageCircle />} />
      <Tabs defaultValue={company ? 'company' : 'department'}>
        <TabsList>
          {company && <TabsTrigger value="company">Company</TabsTrigger>}
          {department && <TabsTrigger value="department">{department.departmentName ?? 'Department'}</TabsTrigger>}
        </TabsList>
        {company && (
          <TabsContent value="company" className="mt-4">
            <ChannelView channelId={company.id} />
          </TabsContent>
        )}
        {department && (
          <TabsContent value="department" className="mt-4">
            <ChannelView channelId={department.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

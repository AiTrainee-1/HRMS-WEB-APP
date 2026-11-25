import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Loader2, SendHorizonal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { chatThreadApi, type ChatMsg } from '@/api/home-chat'
import { downloadChatMedia } from '@/hooks/useChatMedia'
import { expiryLabel, expiryNote, mediaSaveName } from '@/lib/chat-media'
import { reactionTotal, reactionsHaveNames, reactorRows, type ChatReactionLike } from '@/lib/chat-thread'
import { cn } from '@/lib/utils'
import { ChatAvatar } from './ChatVisuals'
import { emojiName } from './chat-style'

/** A GIF seen large (owner 2026-11-25), with "Save GIF" while it has not expired. */
export function GifViewer({ message, url, now, onClose }: { message: ChatMsg | null; url: string | null; now: Date; onClose: () => void }) {
  const [saving, setSaving] = React.useState(false)
  const expiry = message ? expiryLabel(message.media?.expiresAt, now) : null
  return (
    <Dialog open={!!message && !!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>GIF from {message?.senderName}</DialogTitle>
          <DialogDescription>{expiry ? `${expiry}. Save it to keep a copy.` : 'Save it to keep a copy.'}</DialogDescription>
        </DialogHeader>
        {url && (
          <div className="grid max-h-[62dvh] place-items-center overflow-hidden rounded-xl bg-black/80">
            <img src={url} alt={`GIF from ${message?.senderName ?? 'a colleague'}`} className="max-h-[62dvh] w-auto max-w-full object-contain" />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={saving || !message}
            onClick={async () => {
              if (!message) return
              setSaving(true)
              try {
                await downloadChatMedia(message.id, mediaSaveName(message.id, 'gif', message.media?.mime))
                toast.success('GIF saved to your downloads')
              } catch {
                toast.error('The GIF could not be saved. It may have expired.')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Download />} Save GIF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The GIF picked from the computer / phone, before it is sent (owner 2026-11-25: the mobile app's GifSendSheet). */
export function GifSendDialog({
  file,
  expiryDays,
  replyingTo,
  onCancel,
  onSend,
}: {
  file: File | null
  expiryDays: number | null
  replyingTo: string | null
  onCancel: () => void
  onSend: (file: File) => void
}) {
  const [preview, setPreview] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => {
      URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [file])
  const sizeKb = file ? Math.max(1, Math.round(file.size / 1024)) : 0
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send this GIF?</DialogTitle>
          <DialogDescription>
            {replyingTo ? `As a reply to ${replyingTo}. ` : ''}
            {expiryNote(expiryDays)}
          </DialogDescription>
        </DialogHeader>
        {preview && (
          <div className="grid max-h-[50dvh] place-items-center overflow-hidden rounded-xl bg-foreground/[0.06]">
            <img src={preview} alt="The GIF you picked" className="max-h-[50dvh] w-auto max-w-full object-contain" />
          </div>
        )}
        <p className="text-[12px] text-muted-foreground">
          {file?.name} · {sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => file && onSend(file)} disabled={!file}>
            <SendHorizonal /> Send GIF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Who reacted with what (owner 2026-11-25): "All" and one tab per emoji, you first. The names come with the message
 * (servers since 2026-11-25); for a message without them they are asked for once (GET chat/messages/<id>/reactions).
 * The emoji tab offers adding / removing your own reaction.
 */
export function ReactionsDialog({
  message,
  initialEmoji,
  onClose,
  onToggle,
}: {
  message: ChatMsg | null
  initialEmoji: string | null
  onClose: () => void
  onToggle: (m: ChatMsg, emoji: string) => void
}) {
  const [tab, setTab] = React.useState<string | null>(initialEmoji)
  const [forId, setForId] = React.useState<string | null>(null)
  const id = message ? String(message.id) : null
  if (id !== forId) {
    setForId(id)
    setTab(initialEmoji)
  }
  const named = !!message && reactionsHaveNames(message.reactions)
  const fetched = useQuery({
    queryKey: ['chat-reactions', id],
    queryFn: () => chatThreadApi.reactions(id as string),
    enabled: !!id && !named,
    staleTime: 15_000,
  })
  const reactions: ChatReactionLike[] = message ? (named ? message.reactions : (fetched.data?.reactions ?? message.reactions)) : []
  const rows = reactorRows(reactions, tab)
  const total = reactionTotal(reactions)
  const current = tab ? reactions.find((r) => r.emoji === tab) : null

  return (
    <Dialog open={!!message} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reactions</DialogTitle>
          <DialogDescription>
            {total === 1 ? '1 reaction' : `${total} reactions`} on {message?.senderName}’s message
          </DialogDescription>
        </DialogHeader>
        <div role="tablist" aria-label="Show reactions" className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <TabChip selected={tab == null} onClick={() => setTab(null)} label={`All ${total}`}>
            All <span className="tabular-nums">{total}</span>
          </TabChip>
          {reactions.map((r) => (
            <TabChip key={r.emoji} selected={tab === r.emoji} onClick={() => setTab(r.emoji)} label={`${emojiName(r.emoji)} ${r.count}`}>
              <span aria-hidden="true">{r.emoji}</span> <span className="tabular-nums">{r.count}</span>
            </TabChip>
          ))}
        </div>
        <div className="max-h-[42dvh] min-h-24 overflow-y-auto">
          {fetched.isPending && !named ? (
            <p className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading who reacted…
            </p>
          ) : rows.length ? (
            <ul className="flex flex-col">
              {rows.map((r) => (
                <li key={r.key} className="flex min-h-12 items-center gap-3 border-b hairline last:border-b-0">
                  <ChatAvatar name={r.isMe ? 'You' : r.name} isHr={false} size={32} />
                  <span className={cn('min-w-0 flex-1 truncate text-[14px]', r.isMe && 'font-semibold')}>{r.name}</span>
                  <span className="text-xl" role="img" aria-label={emojiName(r.emoji)}>
                    {r.emoji}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-[13px] text-muted-foreground">
              {fetched.isError ? 'Could not load who reacted. Please try again.' : 'Names are not available for these reactions.'}
            </p>
          )}
        </div>
        {message && tab && (
          <DialogFooter>
            <Button variant={current?.reactedByMe ? 'outline' : 'default'} onClick={() => onToggle(message, tab)}>
              <span aria-hidden="true">{tab}</span> {current?.reactedByMe ? 'Remove my reaction' : 'React with this too'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TabChip({ selected, onClick, label, children }: { selected: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'focus-ring flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition-colors',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

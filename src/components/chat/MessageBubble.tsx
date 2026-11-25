import * as React from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle, BadgeCheck, Check, Clock3, Copy, Download, FileImage, ImageOff, Loader2, MicOff, Mic, MoreHorizontal, Reply,
  RotateCcw, SmilePlus, Trash2,
} from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { EASE_OUT } from '@/components/kit'
import { reactionTotal, reactionsSummary, timeLabel } from '@/lib/chat-thread'
import { expiryLabel, formatDuration, isMediaExpired, messageKind, previewText } from '@/lib/chat-media'
import type { ChatMsg, OutgoingMedia } from '@/api/home-chat'
import { cn } from '@/lib/utils'
import { BUBBLE, CHAT_EMOJIS, emojiName, tintFor } from './chat-style'
import { BubbleTail, ChatAvatar } from './ChatVisuals'
import { GifMessage } from './GifMessage'
import { VoiceMessage } from './VoiceMessage'

export interface BubbleActions {
  onReply: (m: ChatMsg) => void
  onReact: (m: ChatMsg, emoji: string) => void
  onCopy: (m: ChatMsg) => void
  onSave: (m: ChatMsg) => void
  onOpenReactions: (m: ChatMsg, emoji: string | null) => void
  onOpenGif: (m: ChatMsg, url: string) => void
  onQuote: (id: number | string) => void
}

const LONG_PRESS_MS = 450

/**
 * One message, WhatsApp-style (owner 2026-11-25, the mobile app's MessageBubble): my messages on the right in the brand
 * colour, everyone else's on the left with their name and avatar at the start of a run, a tail on the first bubble of a
 * run, the time inside the bubble, a quote of the message replied to (click it to jump there), GIFs and voice messages
 * (or "expired" in their place), and reaction chips under the bubble - click one to see who reacted.
 *
 * The message menu (react with one of six emojis, Reply, Copy, Save, who reacted) opens from the "More" button (shown
 * on hover / keyboard focus with a mouse, always on touch screens), a right-click, or a long press on a touch screen.
 */
export function MessageBubble({
  msg,
  isMine,
  isHr,
  startsGroup,
  endsGroup,
  highlighted,
  now,
  reduced,
  saving,
  actions,
}: {
  msg: ChatMsg
  isMine: boolean
  isHr: boolean
  startsGroup: boolean
  endsGroup: boolean
  /** Flash once: the reader clicked a quote of this message. */
  highlighted: boolean
  /** "Now", refreshed each minute, for expiry. */
  now: Date
  reduced: boolean
  /** "Saving…" in the menu while this message's file is being saved. */
  saving: boolean
  actions: BubbleActions
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const press = React.useRef<number | null>(null)
  // An action that moves the focus itself (Reply puts it in the message box) keeps it there when the menu closes.
  const keepFocus = React.useRef(false)
  const time = timeLabel(msg.createdAt)
  const kind = messageKind(msg)
  const expired = kind !== 'text' && isMediaExpired(msg, now)
  const who = isMine ? 'You' : isHr ? `${msg.senderName} (HR)` : msg.senderName
  const colors = isMine ? BUBBLE.mine : isHr ? BUBBLE.hr : BUBBLE.theirs
  const isGif = kind === 'gif' && !expired
  const showName = !isMine && startsGroup

  const cancelPress = () => {
    if (press.current != null) window.clearTimeout(press.current)
    press.current = null
  }

  // the time sits in the bubble's bottom-right corner; this invisible copy keeps the last line of text off it
  const metaSpacer = (
    <span aria-hidden="true" className="invisible ml-2 inline-flex items-center text-[10.5px] tabular-nums select-none">
      {time}
      {isMine && <span className="inline-block w-4" />}
    </span>
  )
  const meta = (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute right-2 bottom-1 flex items-center gap-0.5 text-[10.5px] tabular-nums',
        isMine ? 'text-primary-foreground/80' : 'text-muted-foreground',
      )}
    >
      {time}
      {isMine && <Check className="size-3 opacity-80" />}
    </span>
  )

  let content: React.ReactNode
  if (expired) {
    content = (
      <p className={cn('flex items-center gap-1.5 py-0.5 text-[14px] italic', isMine ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
        {kind === 'voice' ? <MicOff className="size-4 shrink-0" aria-hidden="true" /> : <ImageOff className="size-4 shrink-0" aria-hidden="true" />}
        {kind === 'voice' ? 'Voice message expired' : 'GIF expired'}
        {metaSpacer}
      </p>
    )
  } else if (kind === 'gif') {
    content = <GifMessage message={msg} now={now} isMine={isMine} time={time} reduced={reduced} who={who} onOpen={actions.onOpenGif} />
  } else if (kind === 'voice') {
    content = (
      <div>
        <VoiceMessage message={msg} now={now} isMine={isMine} who={who} />
        <p className="h-3" aria-hidden="true" />
      </div>
    )
  } else {
    content = (
      <p className="text-[14.5px] leading-[1.45] break-words whitespace-pre-wrap [overflow-wrap:anywhere] max-md:text-[15px]">
        {msg.text}
        {metaSpacer}
      </p>
    )
  }

  const quote = msg.replyTo ? (
    <button
      type="button"
      onClick={() => actions.onQuote(msg.replyTo!.id)}
      className={cn(
        'focus-ring mt-0.5 mb-1 block w-full min-w-0 rounded-lg border-l-[3px] px-2 py-1 text-left',
        isMine ? 'border-primary-foreground/80 bg-white/15' : 'border-primary/70 bg-foreground/[0.05]',
      )}
    >
      <span className="sr-only">Replying to </span>
      <span className={cn('block truncate text-[11.5px] font-semibold', isMine ? 'text-primary-foreground' : 'text-primary')}>{msg.replyTo.senderName}</span>
      <span className={cn('flex items-center gap-1 text-[12.5px]', isMine ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
        {msg.replyTo.kind === 'voice' && <Mic className="size-3.5 shrink-0" aria-hidden="true" />}
        {msg.replyTo.kind === 'gif' && <FileImage className="size-3.5 shrink-0" aria-hidden="true" />}
        <span className="line-clamp-2 min-w-0">
          {msg.replyTo.kind === 'voice' ? 'Voice message' : msg.replyTo.kind === 'gif' ? 'GIF' : msg.replyTo.text}
        </span>
      </span>
      <span className="sr-only">. Go to that message</span>
    </button>
  ) : null

  const sender = showName ? (
    <span className="mb-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold">
      <span className={cn('truncate', isHr ? 'text-violet' : tintFor(msg.senderName || '?').name)}>{msg.senderName}</span>
      {isHr && (
        <span className="font-label flex shrink-0 items-center gap-0.5 rounded-full bg-violet-bg px-1.5 text-[9.5px] font-bold tracking-wide text-violet">
          <BadgeCheck className="size-2.5" aria-hidden="true" /> HR
        </span>
      )}
    </span>
  ) : null

  return (
    <motion.div
      data-msg-id={String(msg.id)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className={cn('group flex items-start gap-2', isMine ? 'justify-end' : 'justify-start', startsGroup ? 'mt-2' : 'mt-0.5', endsGroup && 'mb-1')}
    >
      {!isMine && <div className="w-7 shrink-0 pt-0.5">{startsGroup && <ChatAvatar name={msg.senderName} isHr={isHr} />}</div>}

      <div className={cn('flex max-w-[min(78%,560px)] min-w-0 flex-col max-md:max-w-[82%]', isMine ? 'items-end' : 'items-start')}>
        <div className={cn('flex max-w-full min-w-0 items-center gap-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverAnchor asChild>
              <div
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenuOpen(true)
                }}
                onPointerDown={(e) => {
                  if (e.pointerType !== 'touch') return
                  cancelPress()
                  press.current = window.setTimeout(() => {
                    press.current = null
                    setMenuOpen(true)
                  }, LONG_PRESS_MS)
                }}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                className={cn(
                  'relative min-w-16 max-w-full rounded-[14px] px-2.5 pt-1.5 pb-[7px] [-webkit-touch-callout:none] [@media(pointer:coarse)]:select-none',
                  colors.fill,
                  !isMine && 'shadow-[0_1px_1.5px_rgb(15_23_42/0.08)] dark:shadow-none',
                  isGif && 'p-1 pt-1 pb-1',
                  startsGroup && (isMine ? 'rounded-tr-[3px]' : 'rounded-tl-[3px]'),
                  highlighted && 'chat-flash',
                )}
              >
                {startsGroup && <BubbleTail side={isMine ? 'right' : 'left'} className={colors.tail} />}
                <span className="sr-only">
                  {who}
                  {time ? ` at ${time}` : ''}:{' '}
                </span>
                {isGif ? (
                  <>
                    {(sender || quote) && (
                      <div className="px-1.5 pt-0.5 pb-1">
                        {sender}
                        {quote}
                      </div>
                    )}
                    {content}
                  </>
                ) : (
                  <>
                    {sender}
                    {quote}
                    {content}
                  </>
                )}
                {!isGif && meta}
              </div>
            </PopoverAnchor>

            <div
              className={cn(
                'flex shrink-0 flex-col gap-0.5 transition-opacity duration-150',
                'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
                menuOpen && '[@media(hover:hover)]:opacity-100',
              )}
            >
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 rounded-full text-muted-foreground max-md:size-8" aria-label={`Options for ${who}'s message: react, reply and more`}>
                  <MoreHorizontal />
                </Button>
              </PopoverTrigger>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full text-muted-foreground max-md:hidden"
                onClick={() => actions.onReply(msg)}
                aria-label={`Reply to ${who}`}
              >
                <Reply />
              </Button>
            </div>

            <PopoverContent
              align={isMine ? 'end' : 'start'}
              className="w-[min(300px,calc(100vw-24px))] p-2"
              aria-label={`Message options for ${who}'s message`}
              onCloseAutoFocus={(e) => {
                if (!keepFocus.current) return
                keepFocus.current = false
                e.preventDefault()
              }}
            >
              <MessageMenu
                msg={msg}
                now={now}
                expired={expired}
                saving={saving}
                onDone={(moveFocus) => {
                  keepFocus.current = moveFocus
                  setMenuOpen(false)
                }}
                actions={actions}
              />
            </PopoverContent>
          </Popover>
        </div>

        {msg.reactions.length > 0 && (
          <div
            className={cn('relative z-[1] -mt-1 flex flex-wrap gap-1 px-2', isMine ? 'justify-end' : 'justify-start')}
            role="group"
            aria-label={`Reactions: ${reactionsSummary(msg.reactions)}`}
          >
            {msg.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => actions.onOpenReactions(msg, r.emoji)}
                aria-label={`${emojiName(r.emoji)}, ${r.count}${r.reactedByMe ? ', including you' : ''}. See who reacted`}
                className={cn(
                  'focus-ring flex min-h-6 items-center gap-0.5 rounded-full border px-1.5 text-[12px] font-semibold tabular-nums shadow-[0_1px_2px_rgb(15_23_42/0.08)] transition-transform hover:scale-105',
                  r.reactedByMe ? 'border-primary/40 bg-accent text-accent-foreground' : 'border-border bg-card text-muted-foreground',
                )}
              >
                <span aria-hidden="true">{r.emoji}</span>
                <span aria-hidden="true">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

/** The message menu (owner 2026-11-25, the mobile app's MessageActionsSheet). */
function MessageMenu({
  msg,
  now,
  expired,
  saving,
  onDone,
  actions,
}: {
  msg: ChatMsg
  now: Date
  expired: boolean
  saving: boolean
  /** Closes the menu; true when the action moves the focus elsewhere itself. */
  onDone: (moveFocus: boolean) => void
  actions: BubbleActions
}) {
  const kind = messageKind(msg)
  const expiry = kind !== 'text' && !expired ? expiryLabel(msg.media?.expiresAt, now) : null
  const total = reactionTotal(msg.reactions)
  const row = 'focus-ring flex min-h-11 w-full items-center gap-3 rounded-lg px-2.5 text-left text-[14px] hover:bg-muted'
  return (
    <div>
      <p className="truncate px-1 text-[12px] font-semibold text-muted-foreground">{msg.senderName}</p>
      <p className="mb-2 line-clamp-2 px-1 text-[13px]">
        {expired ? `${kind === 'voice' ? 'Voice message' : 'GIF'} expired` : previewText(msg)}
      </p>
      <div role="group" aria-label="React" className="mb-1.5 flex justify-between gap-0.5 rounded-full bg-muted p-1">
        {CHAT_EMOJIS.map(({ emoji, name }) => {
          const mine = msg.reactions.some((r) => r.emoji === emoji && r.reactedByMe)
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={mine}
              aria-label={`${mine ? 'Remove' : 'React with'} ${name}`}
              onClick={() => {
                actions.onReact(msg, emoji)
                onDone(false)
              }}
              className={cn(
                'focus-ring grid size-10 place-items-center rounded-full text-[22px] transition-transform hover:scale-125 motion-reduce:hover:scale-100',
                mine && 'bg-primary/15 ring-2 ring-primary/50',
              )}
            >
              {emoji}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className={row}
        onClick={() => {
          onDone(true)
          actions.onReply(msg)
        }}
      >
        <Reply className="size-[18px] text-muted-foreground" aria-hidden="true" /> Reply
      </button>
      {kind === 'text' && msg.text.trim() && (
        <button
          type="button"
          className={row}
          onClick={() => {
            onDone(false)
            actions.onCopy(msg)
          }}
        >
          <Copy className="size-[18px] text-muted-foreground" aria-hidden="true" /> Copy text
        </button>
      )}
      {kind !== 'text' && !expired && (
        <button
          type="button"
          className={cn(row, 'py-1.5')}
          disabled={saving}
          onClick={() => {
            onDone(false)
            actions.onSave(msg)
          }}
        >
          {saving ? <Loader2 className="size-[18px] animate-spin text-muted-foreground" aria-hidden="true" /> : <Download className="size-[18px] text-muted-foreground" aria-hidden="true" />}
          <span className="min-w-0">
            <span className="block">{saving ? 'Saving…' : kind === 'gif' ? 'Save GIF' : 'Save voice message'}</span>
            <span className="block text-[11.5px] leading-4 text-muted-foreground">
              {expiry ? `${expiry}. ` : ''}Keep a copy - it disappears from the chat after that.
            </span>
          </span>
        </button>
      )}
      {total > 0 && (
        <button
          type="button"
          className={row}
          onClick={() => {
            onDone(true)
            actions.onOpenReactions(msg, null)
          }}
        >
          <SmilePlus className="size-[18px] text-muted-foreground" aria-hidden="true" /> See who reacted
          <span className="ml-auto text-[12px] text-muted-foreground tabular-nums">{total}</span>
        </button>
      )}
    </div>
  )
}

export interface PendingSend {
  tempId: string
  text: string
  replyTo: ChatMsg['replyTo']
  status: 'sending' | 'failed'
  error?: string
  /** A GIF / voice message on its way (the file stays here so it can be retried). */
  media?: OutgoingMedia
}

/** My message (text, GIF or voice) on its way: "Sending…" until the server has it; a failed one offers Try again and Remove. */
export function PendingBubble({ p, onRetry, onDiscard }: { p: PendingSend; onRetry: () => void; onDiscard: () => void }) {
  const failed = p.status === 'failed'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 mb-1 flex flex-col items-end">
      <div
        className={cn(
          'relative max-w-[min(78%,560px)] min-w-16 rounded-[14px] rounded-tr-[3px] px-2.5 pt-1.5 pb-1 text-primary-foreground max-md:max-w-[82%]',
          failed ? 'bg-destructive/85' : 'bg-primary opacity-75',
        )}
      >
        <BubbleTail side="right" className={failed ? 'text-destructive/85' : 'text-primary'} />
        {p.replyTo && (
          <div className="mt-0.5 mb-1 rounded-lg border-l-[3px] border-primary-foreground/80 bg-white/15 px-2 py-1 text-[12.5px]">
            <p className="truncate text-[11.5px] font-semibold">{p.replyTo.senderName}</p>
            <p className="line-clamp-2 opacity-85">{p.replyTo.text}</p>
          </div>
        )}
        {p.media?.kind === 'voice' ? (
          <p className="flex items-center gap-1.5 text-[14px]">
            <Mic className="size-4" aria-hidden="true" /> Voice message · {formatDuration(p.media.durationMs)}
          </p>
        ) : p.media?.kind === 'gif' ? (
          <p className="flex items-center gap-1.5 text-[14px]">
            <FileImage className="size-4" aria-hidden="true" /> GIF
          </p>
        ) : (
          <p className="text-[14.5px] leading-[1.45] break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{p.text}</p>
        )}
        {!failed && (
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-primary-foreground/80">
            Sending <Clock3 className="size-3" aria-hidden="true" />
          </span>
        )}
      </div>
      {failed && (
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-[12px] text-rejected" role="alert">
          <AlertCircle className="size-3.5" aria-hidden="true" /> {p.error || 'Not sent.'}
          <Button variant="ghost" size="sm" className="h-8" onClick={onRetry}>
            <RotateCcw /> Try again
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={onDiscard}>
            <Trash2 /> Remove
          </Button>
        </div>
      )}
    </motion.div>
  )
}

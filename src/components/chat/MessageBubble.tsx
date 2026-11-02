import * as React from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Loader2, Reply, RotateCcw, ShieldCheck, SmilePlus, Trash2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { EASE_OUT } from '@/components/kit'
import { initialsOf, reactionsSummary, timeLabel, type ChatReactionLike } from '@/lib/chat-thread'
import type { ChatMsg } from '@/api/home-chat'
import { cn } from '@/lib/utils'

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👏', '🙏']

/**
 * One chat message. Reply and React are real buttons that are always reachable: visible on touch screens, shown on
 * hover or keyboard focus with a mouse (never hover-only). Reactions are toggle buttons that say what they do. HR /
 * management messages carry an "HR" badge so nobody mistakes them for a colleague's.
 */
export function MessageBubble({
  msg,
  isMine,
  isHr,
  startsGroup,
  endsGroup,
  onReply,
  onReact,
}: {
  msg: ChatMsg
  isMine: boolean
  isHr: boolean
  startsGroup: boolean
  endsGroup: boolean
  onReply: (m: ChatMsg) => void
  onReact: (m: ChatMsg, emoji: string) => void
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const time = timeLabel(msg.createdAt)
  const who = isMine ? 'You' : isHr ? `${msg.senderName} (HR)` : msg.senderName

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className={cn('group flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row', startsGroup ? 'mt-3' : 'mt-0.5')}
    >
      {!isMine && (
        <span
          aria-hidden="true"
          className={cn(
            'grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold max-md:size-7 max-md:border-0 max-md:text-[10.5px]',
            endsGroup ? '' : 'invisible',
            isHr ? 'border border-violet-border bg-violet-bg text-violet' : 'border border-info-border bg-info-bg text-info',
          )}
        >
          {isHr ? <ShieldCheck className="size-4" /> : initialsOf(msg.senderName)}
        </span>
      )}

      <div className={cn('flex max-w-[min(78%,560px)] min-w-0 flex-col max-md:max-w-[80%]', isMine ? 'items-end' : 'items-start')}>
        {startsGroup && !isMine && (
          <span className="mb-1 flex items-center gap-1.5 px-1 text-[12px] font-semibold text-muted-foreground max-md:mb-0.5 max-md:text-primary">
            {msg.senderName}
            {isHr && (
              <span className="font-label rounded-full border border-violet-border bg-violet-bg px-1.5 text-[10.5px] font-bold text-violet">HR</span>
            )}
          </span>
        )}
        <div className={cn('flex min-w-0 items-center gap-1', isMine ? 'flex-row-reverse' : 'flex-row')}>
          <div
            // Phones: the app's bubbles - 18px corners with a 6px tail corner, 15px text, no shadow on mine.
            className={cn(
              'min-w-0 rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.45] shadow-clay-sm max-md:rounded-[18px] max-md:px-3 max-md:pt-2 max-md:pb-1.5 max-md:text-[15px] max-md:leading-[21px]',
              isMine && 'max-md:shadow-none!',
              isMine
                ? 'bg-brand-gradient text-white'
                : isHr
                  ? 'border border-violet-border bg-violet-bg text-foreground'
                  : 'glass text-foreground',
              isMine ? (endsGroup ? 'rounded-br-md max-md:rounded-br-[6px]' : '') : endsGroup ? 'rounded-bl-md max-md:rounded-bl-[6px]' : '',
            )}
          >
            <span className="sr-only">{who} said: </span>
            {msg.replyTo && (
              <div
                className={cn(
                  'mb-1.5 rounded-lg border-l-[3px] px-2.5 py-1 text-[12.5px]',
                  isMine ? 'border-white/70 bg-white/15' : 'border-primary bg-foreground/[0.05]',
                )}
              >
                <p className="font-semibold">
                  <span className="sr-only">Replying to </span>
                  {msg.replyTo.senderName}
                </p>
                <p className="line-clamp-2 opacity-85">{msg.replyTo.text}</p>
              </div>
            )}
            <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{msg.text}</p>
          </div>

          <div
            className={cn(
              'flex shrink-0 gap-0.5 transition-opacity duration-150',
              'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100',
              pickerOpen && '[@media(hover:hover)]:opacity-100',
            )}
          >
            <Button variant="ghost" size="icon" className="size-9 rounded-full max-md:size-8 max-md:text-muted-foreground sm:size-8" onClick={() => onReply(msg)} aria-label={`Reply to ${who}`}>
              <Reply />
            </Button>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 rounded-full max-md:size-8 max-md:text-muted-foreground sm:size-8" aria-label={`React to ${who}'s message`}>
                  <SmilePlus />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1.5" align={isMine ? 'end' : 'start'}>
                <div className="flex gap-0.5" role="group" aria-label="Pick a reaction">
                  {QUICK_EMOJI.map((e) => {
                    const mine = msg.reactions.some((r) => r.emoji === e && r.reactedByMe)
                    return (
                      <button
                        key={e}
                        type="button"
                        aria-pressed={mine}
                        aria-label={`${mine ? 'Remove' : 'Add'} reaction ${e}`}
                        className={cn(
                          'focus-ring grid size-10 place-items-center rounded-lg text-xl transition-transform hover:scale-125',
                          mine && 'bg-info-bg',
                        )}
                        onClick={() => {
                          onReact(msg, e)
                          setPickerOpen(false)
                        }}
                      >
                        {e}
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {msg.reactions.length > 0 && (
          <Reactions reactions={msg.reactions} onToggle={(e) => onReact(msg, e)} alignEnd={isMine} />
        )}
        {endsGroup && time && (
          <time dateTime={msg.createdAt ?? undefined} className="mt-1 px-1 text-[11px] text-muted-foreground tabular-nums">
            {time}
          </time>
        )}
      </div>
    </motion.div>
  )
}

function Reactions({ reactions, onToggle, alignEnd }: { reactions: ChatReactionLike[]; onToggle: (emoji: string) => void; alignEnd: boolean }) {
  return (
    <div className={cn('mt-1 flex flex-wrap gap-1 px-1', alignEnd && 'justify-end')} role="group" aria-label={`Reactions: ${reactionsSummary(reactions)}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          aria-pressed={r.reactedByMe}
          aria-label={`${r.emoji} ${r.count}${r.reactedByMe ? ', you reacted. Remove' : '. Add yours'}`}
          className={cn(
            'focus-ring flex min-h-7 items-center gap-1 rounded-full border px-2 text-[12.5px] font-semibold tabular-nums transition-transform hover:scale-105',
            r.reactedByMe ? 'border-info-border bg-info-bg text-info' : 'border-foreground/15 bg-card',
          )}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span aria-hidden="true">{r.count}</span>
        </button>
      ))}
    </div>
  )
}

export interface PendingSend {
  tempId: string
  text: string
  replyTo: ChatMsg['replyTo']
  status: 'sending' | 'failed'
  error?: string
}

/** A message on its way: "Sending…" until the server has it; a failed one offers Try again and Remove. */
export function PendingBubble({ p, onRetry, onDiscard }: { p: PendingSend; onRetry: () => void; onDiscard: () => void }) {
  const failed = p.status === 'failed'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex flex-col items-end">
      <div className={cn('max-w-[min(78%,560px)] rounded-2xl rounded-br-md px-3.5 py-2.5 text-[14px] text-white shadow-clay-sm', failed ? 'bg-destructive/80' : 'bg-brand-gradient opacity-70')}>
        {p.replyTo && (
          <div className="mb-1.5 rounded-lg border-l-[3px] border-white/70 bg-white/15 px-2.5 py-1 text-[12.5px]">
            <p className="font-semibold">{p.replyTo.senderName}</p>
            <p className="line-clamp-2 opacity-85">{p.replyTo.text}</p>
          </div>
        )}
        <p className="break-words whitespace-pre-wrap [overflow-wrap:anywhere]">{p.text}</p>
      </div>
      {failed ? (
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-[12px] text-rejected" role="alert">
          <AlertCircle className="size-3.5" aria-hidden="true" /> {p.error || 'Not sent.'}
          <Button variant="ghost" size="sm" className="h-8" onClick={onRetry}>
            <RotateCcw /> Try again
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={onDiscard}>
            <Trash2 /> Remove
          </Button>
        </div>
      ) : (
        // Not a live region: sending my own message is not read out (a failure still is, through the alert above).
        <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Sending…
        </span>
      )}
    </motion.div>
  )
}

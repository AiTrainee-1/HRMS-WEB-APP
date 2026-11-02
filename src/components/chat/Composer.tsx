import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Reply, SendHorizonal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { collapse } from '@/components/kit'
import { CHAT_MAX_LENGTH, prepareOutgoing } from '@/lib/chat-thread'
import type { ChatMsg } from '@/api/home-chat'
import { cn } from '@/lib/utils'

/**
 * The message box: grows with the text (up to 6 lines), Enter sends, Shift+Enter adds a line. Shows who you are
 * replying to (with a cancel button) and a counter near the 2,000-character limit.
 */
export const Composer = React.forwardRef<HTMLTextAreaElement, {
  channelName: string
  replyTo: ChatMsg | null
  onCancelReply: () => void
  onSend: (text: string) => void
}>(function Composer({ channelName, replyTo, onCancelReply, onSend }, ref) {
  const [text, setText] = React.useState('')
  const inner = React.useRef<HTMLTextAreaElement>(null)
  React.useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement)

  // Auto-grow.
  React.useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 6 * 22 + 20)}px`
  }, [text])

  const ready = prepareOutgoing(text)
  const near = text.length >= CHAT_MAX_LENGTH * 0.9

  function submit() {
    if (!ready) return
    onSend(ready)
    setText('')
  }

  return (
    // Phones: the app's composer - a white bar with a hairline on top, a round soft field and a 46px round send button.
    <div className="border-t hairline bg-card/70 backdrop-blur-sm max-md:border-input max-md:bg-card max-md:backdrop-blur-none dark:bg-white/[0.02] max-md:dark:bg-card">
      <AnimatePresence initial={false}>
        {replyTo && (
          <motion.div variants={collapse} initial="hidden" animate="show" exit="hidden" className="overflow-hidden">
            <div className="flex items-center gap-2 border-b hairline px-3 py-2 text-[13px] max-md:mx-3 max-md:mt-2 max-md:rounded-lg max-md:border-b-0 max-md:border-l-[3px] max-md:border-l-ring max-md:bg-muted max-md:py-1.5 max-md:pr-1 max-md:text-[12.5px]">
              <Reply className="size-4 shrink-0 text-info" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                Replying to <strong>{replyTo.senderName}</strong>: <span className="text-muted-foreground">{replyTo.text}</span>
              </span>
              <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" onClick={onCancelReply} aria-label="Cancel the reply">
                <X />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <form
        className="flex items-end gap-2 p-3 max-md:px-3 max-md:pt-2 max-md:pb-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message {channelName}
        </label>
        <textarea
          id="chat-input"
          ref={inner}
          rows={1}
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
            if (e.key === 'Escape' && replyTo) onCancelReply()
          }}
          placeholder={`Message ${channelName}…`}
          aria-describedby="chat-hint"
          className="scrollbar-thin min-h-11 flex-1 resize-none rounded-xl border border-foreground/15 bg-background/60 px-3.5 py-2.5 text-[14px] leading-[22px] outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 max-md:rounded-[22px] max-md:border-border max-md:bg-muted max-md:text-base max-md:leading-[22px]"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-xl max-md:size-[46px] max-md:rounded-full" disabled={!ready} aria-label="Send message">
          <SendHorizonal />
        </Button>
      </form>
      {/* Phones: the keyboard tip means nothing on a touch screen, so only the near-the-limit counter shows there. */}
      <p id="chat-hint" className={cn('px-4 pb-2 text-[11px] text-muted-foreground', near ? 'text-waiting' : 'max-md:hidden')}>
        {near ? `${text.length}/${CHAT_MAX_LENGTH} characters` : 'Enter to send · Shift + Enter for a new line'}
      </p>
    </div>
  )
})

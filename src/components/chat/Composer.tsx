import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FileImage, Mic, Reply, SendHorizonal, Smile, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { collapse } from '@/components/kit'
import { CHAT_MAX_LENGTH, prepareOutgoing } from '@/lib/chat-thread'
import {
  VOICE_MAX_MS, VOICE_MIN_MS, formatDuration, gifPickProblem, isGifHeader, microphoneProblem, previewText, resampleBars,
} from '@/lib/chat-media'
import type { ChatMsg } from '@/api/home-chat'
import { useVoiceRecorder, voiceRecordingSupported, type Recording } from '@/hooks/useVoiceRecorder'
import { useIsPhone } from '@/hooks/useIsPhone'
import { cn } from '@/lib/utils'
import { COMPOSER_EMOJIS } from './chat-style'

/**
 * The WhatsApp-style message box (owner 2026-11-25): emoji, the text (grows up to 6 lines; Enter sends, Shift+Enter
 * adds a line), a GIF from the computer / phone (or pasted), and - while the box is empty - the microphone.
 *
 * Voice messages: click the mic to record (the browser asks for the microphone the first time), then Send or the bin;
 * Esc throws it away. It stops and sends by itself at two minutes. Shows who you are replying to and a counter near the
 * 2,000-character limit.
 */
export const Composer = React.forwardRef<
  HTMLTextAreaElement,
  {
    channelName: string
    replyTo: ChatMsg | null
    onCancelReply: () => void
    onSend: (text: string) => void
    onPickGif: (file: File) => void
    onVoiceRecorded: (rec: Recording) => void
  }
>(function Composer({ channelName, replyTo, onCancelReply, onSend, onPickGif, onVoiceRecorded }, ref) {
  const [text, setText] = React.useState('')
  const [emojiOpen, setEmojiOpen] = React.useState(false)
  const isPhone = useIsPhone()
  const inner = React.useRef<HTMLTextAreaElement>(null)
  const filePicker = React.useRef<HTMLInputElement>(null)
  React.useImperativeHandle(ref, () => inner.current as HTMLTextAreaElement)

  // ── voice ──────────────────────────────────────────────────────────────────
  const finishRef = React.useRef<(send: boolean, reason?: 'limit') => void>(() => undefined)
  const voice = useVoiceRecorder({ onLimit: () => finishRef.current(true, 'limit') })
  const finishing = React.useRef(false)

  const finish = React.useCallback(
    async (send: boolean, reason?: 'limit') => {
      if (finishing.current) return
      finishing.current = true
      try {
        const rec = await voice.stop(send)
        if (!send || !rec) return
        if (rec.durationMs < VOICE_MIN_MS) {
          toast.info('Record a little longer to send a voice message.')
          return
        }
        if (reason === 'limit') toast.info('Voice messages can be up to 2 minutes, so it was sent.')
        onVoiceRecorded(rec)
      } finally {
        finishing.current = false
        requestAnimationFrame(() => inner.current?.focus())
      }
    },
    [voice, onVoiceRecorded],
  )
  React.useEffect(() => {
    finishRef.current = (send, reason) => void finish(send, reason)
  }, [finish])

  const startVoice = async () => {
    const outcome = await voice.start()
    if (!outcome.ok) toast.error(microphoneProblem(outcome.reason))
  }

  // Esc anywhere throws a recording away (the box itself is hidden while recording).
  React.useEffect(() => {
    if (!voice.recording) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void finish(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [voice.recording, finish])

  // ── text ───────────────────────────────────────────────────────────────────
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

  function insertEmoji(emoji: string) {
    const el = inner.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    const next = (text.slice(0, start) + emoji + text.slice(end)).slice(0, CHAT_MAX_LENGTH)
    setText(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const at = Math.min(next.length, start + emoji.length)
      el.setSelectionRange(at, at)
    })
  }

  // ── GIFs ───────────────────────────────────────────────────────────────────
  async function takeGif(file: File | null | undefined) {
    if (!file) return
    const problem = gifPickProblem(file)
    if (problem) {
      toast.error(problem)
      return
    }
    try {
      const head = new Uint8Array(await file.slice(0, 6).arrayBuffer())
      if (!isGifHeader(head)) {
        toast.error('That file is not a real GIF. Please choose a .gif file.')
        return
      }
    } catch {
      // unreadable here: the server checks it again
    }
    onPickGif(file)
  }

  const recording = voice.recording || voice.phase === 'starting'
  const bars = resampleBars(voice.live, 32)

  return (
    // Phones: the app's composer - a white bar with a hairline on top, a round soft field and a 46px round send button.
    <div className="border-t hairline bg-card/70 backdrop-blur-sm max-md:border-input max-md:bg-card max-md:backdrop-blur-none dark:bg-white/[0.02] max-md:dark:bg-card">
      <AnimatePresence initial={false}>
        {replyTo && !recording && (
          <motion.div variants={collapse} initial="hidden" animate="show" exit="hidden" className="overflow-hidden">
            <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border-l-[3px] border-l-primary bg-muted py-1.5 pr-1 pl-2.5 text-[13px] max-md:text-[12.5px]">
              <Reply className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-primary">Replying to {replyTo.senderName}</span>
                <span className="block truncate text-muted-foreground">{previewText(replyTo)}</span>
              </span>
              <Button variant="ghost" size="icon" className="size-9 shrink-0 rounded-full" onClick={onCancelReply} aria-label="Cancel the reply">
                <X />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {recording ? (
        <div className="flex items-center gap-2 p-3 max-md:px-3 max-md:pt-2 max-md:pb-2.5" role="group" aria-label="Recording a voice message">
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-full text-rejected hover:bg-rejected-bg"
            onClick={() => void finish(false)}
            aria-label="Delete the recording"
          >
            <Trash2 />
          </Button>
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-muted px-3.5">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-rejected motion-safe:animate-pulse" />
            <span className="shrink-0 text-[13.5px] font-semibold tabular-nums" aria-live="off">
              {formatDuration(voice.elapsedMs)}
              <span className="font-normal text-muted-foreground"> / {formatDuration(VOICE_MAX_MS)}</span>
            </span>
            <span aria-hidden="true" className="flex h-7 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
              {bars.map((h, i) => (
                <span key={i} className="min-w-[2px] flex-1 rounded-full bg-primary/70" style={{ height: `${Math.round(Math.max(0.1, h) * 100)}%` }} />
              ))}
            </span>
            <span className="sr-only">{voice.phase === 'starting' ? 'Starting the microphone…' : 'Recording. Press Escape to throw it away.'}</span>
          </div>
          <Button
            size="icon"
            className="size-11 shrink-0 rounded-full max-md:size-[46px]"
            onClick={() => void finish(true)}
            disabled={!voice.recording}
            aria-label="Send the voice message"
          >
            <SendHorizonal />
          </Button>
        </div>
      ) : (
        <form
          className="flex items-end gap-1.5 p-3 max-md:px-2.5 max-md:pt-2 max-md:pb-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="flex min-h-11 min-w-0 flex-1 items-end rounded-[22px] border border-foreground/15 bg-background/60 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40 max-md:border-border max-md:bg-muted">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-full text-muted-foreground" aria-label="Add an emoji">
                  <Smile />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-[min(340px,calc(100vw-24px))] p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
                <div role="group" aria-label="Emoji" className="scrollbar-thin grid max-h-60 grid-cols-8 gap-0.5 overflow-y-auto">
                  {COMPOSER_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => insertEmoji(e)}
                      className="focus-ring grid size-9 place-items-center rounded-lg text-[21px] hover:bg-muted"
                      aria-label={`Insert ${e}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
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
              onPaste={(e) => {
                const gif = Array.from(e.clipboardData?.files ?? []).find((f) => f.type === 'image/gif')
                if (gif) {
                  e.preventDefault()
                  void takeGif(gif)
                }
              }}
              placeholder={isPhone ? 'Message' : `Message ${channelName}…`}
              aria-describedby="chat-hint"
              className="scrollbar-thin min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 pr-1 text-[14px] leading-[22px] outline-none placeholder:text-muted-foreground max-md:text-base max-md:leading-[22px]"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-full text-muted-foreground"
              aria-label="Send a GIF from your computer or phone"
              onClick={() => filePicker.current?.click()}
            >
              <FileImage />
            </Button>
            <input
              ref={filePicker}
              type="file"
              accept="image/gif,.gif"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                void takeGif(file)
              }}
            />
          </div>
          {ready || !voiceRecordingSupported() ? (
            <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full max-md:size-[46px]" disabled={!ready} aria-label="Send message">
              <SendHorizonal />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              className={cn('size-11 shrink-0 rounded-full max-md:size-[46px]')}
              onClick={() => void startVoice()}
              aria-label="Record a voice message"
            >
              <Mic />
            </Button>
          )}
        </form>
      )}
      {/* Phones: the keyboard tip means nothing on a touch screen, so only the near-the-limit counter shows there. */}
      <p id="chat-hint" className={cn('px-4 pb-2 text-[11px] text-muted-foreground', near ? 'text-waiting' : 'max-md:hidden', recording && 'hidden')}>
        {near ? `${text.length}/${CHAT_MAX_LENGTH} characters` : 'Enter to send · Shift + Enter for a new line · the mic records a voice message'}
      </p>
    </div>
  )
})

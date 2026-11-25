import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, History, Loader2, MessageCircle, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, SkeletonList, popIn, useReducedMotion } from '@/components/kit'
import { chatThreadApi, type ChatMsg, type OutgoingMedia } from '@/api/home-chat'
import { ApiError } from '@/api/client'
import { usePageVisible } from '@/hooks/useHomeSources'
import { adoptChatMedia, downloadChatMedia } from '@/hooks/useChatMedia'
import type { Recording } from '@/hooks/useVoiceRecorder'
import { copyText } from '@/lib/clipboard'
import {
  CHAT_PAGE_SIZE, arrivalAnnouncement, buildChatRows, countUnseen, isMyReaction, isNearLatest, mergeLatestPage, mergeMessages,
  newestId, oldestId, pageMayHaveMore, replaceMessage, slidOutOfPage, toggleReactionLocal, unseenLabel,
} from '@/lib/chat-thread'
import { GIF_TEXT, VOICE_TEXT, mediaSaveName, messageKind, uploadErrorMessage, voiceFileName, waveformForUpload } from '@/lib/chat-media'
import { cn } from '@/lib/utils'
import { WALLPAPER } from './chat-style'
import { Composer } from './Composer'
import { GifSendDialog, GifViewer, ReactionsDialog } from './ChatDialogs'
import { MessageBubble, PendingBubble, type BubbleActions, type PendingSend } from './MessageBubble'
import { stopVoice } from './voice-playback'
import './chat.css'

const POLL_MS = 4000

/**
 * One channel's conversation, WhatsApp-style (owner 2026-11-25). The newest 50 messages are polled every 4 s, but only
 * while this tab is visible; older pages are loaded on request ("Show earlier messages", `before=`), and the reader
 * keeps their place while they load. Reading older messages while new ones arrive shows a "N new messages" pill instead
 * of jumping. Messages pushed out of the polled newest page by new ones stay on screen; a message the server no longer
 * sends inside the stretch the newest page covers (HR deleted it) goes (lib/chat-thread.ts mergeLatestPage).
 *
 * Text, GIFs (picked or pasted, at most 8 MB) and voice messages (recorded here, at most 2 minutes) are sent; one being
 * sent shows "Sending…" at once and a failed one can be retried. GIFs and voice messages are fetched with the sign-in
 * and expire ("GIF expired"). The message menu reacts, replies, copies and saves; reaction chips show who reacted.
 * Screen readers hear only other people's NEW messages (one polite announcement per poll), never older pages being
 * loaded or their own sent messages. The parent keys this component by channel id, so no state carries over from one
 * channel to another.
 */
export function ChannelThread({
  channelId,
  channelName,
  myId,
  myName,
  expiryDays,
}: {
  channelId: string
  channelName: string
  myId: string | number | null
  myName: string
  /** How many days GIFs and voice messages stay (the server's setting), when known. */
  expiryDays: number | null
}) {
  const qc = useQueryClient()
  const visible = usePageVisible()
  const reduced = useReducedMotion()
  const key = React.useMemo(() => ['chat-thread', String(channelId)] as const, [channelId])

  const latest = useQuery({
    queryKey: key,
    queryFn: () => chatThreadApi.messages(channelId, { limit: CHAT_PAGE_SIZE }),
    refetchInterval: visible ? POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  const [older, setOlder] = React.useState<ChatMsg[]>([])
  const [hasMore, setHasMore] = React.useState<boolean | null>(null)
  const [loadingOlder, setLoadingOlder] = React.useState(false)
  const [pending, setPending] = React.useState<PendingSend[]>([])
  const [replyTo, setReplyTo] = React.useState<ChatMsg | null>(null)
  const [atBottom, setAtBottom] = React.useState(true)
  const [lastSeen, setLastSeen] = React.useState<number | null>(null)
  // "Now" for expiry, refreshed each minute.
  const [now, setNow] = React.useState(() => new Date())
  const [highlight, setHighlight] = React.useState<string | null>(null)
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [reactionsFor, setReactionsFor] = React.useState<{ id: string; emoji: string | null } | null>(null)
  const [gifView, setGifView] = React.useState<{ id: string; url: string } | null>(null)
  const [gifToSend, setGifToSend] = React.useState<File | null>(null)

  const scroller = React.useRef<HTMLDivElement>(null)
  const composer = React.useRef<HTMLTextAreaElement>(null)
  const keepPlace = React.useRef<{ height: number; top: number } | null>(null)
  const firstScroll = React.useRef(true)
  const announcedUpTo = React.useRef<number | null>(null)
  const [announcement, setAnnouncement] = React.useState({ text: '', n: 0 })

  React.useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  // Leaving the chat stops a voice message that is playing.
  React.useEffect(() => () => stopVoice(), [])

  // Each poll returns only the newest page, so new messages push the oldest out of it. Those were on screen: move them
  // into `older` during render (before anything is drawn), so they never vanish and the reader's place never moves.
  const [polledPage, setPolledPage] = React.useState(latest.data)
  const [gapAfter, setGapAfter] = React.useState<number | null>(null)
  if (latest.data !== polledPage) {
    setPolledPage(latest.data)
    const { kept, gap } = slidOutOfPage(polledPage, latest.data)
    if (gap && atBottom) {
      // More than a page arrived at once and the reader is at the latest: start again from the newest page.
      setOlder([])
      setHasMore(true)
    } else if (kept.length) {
      setOlder((prev) => mergeMessages(prev, kept))
      // Reading older messages: fetch the ones between what is kept and the new page, so there is no hole.
      if (gap) setGapAfter(newestId(kept))
    }
  }

  React.useEffect(() => {
    if (gapAfter == null) return
    let live = true
    chatThreadApi
      .messages(channelId, { after: gapAfter })
      .then((page) => {
        if (live) setOlder((prev) => mergeMessages(prev, page))
      })
      .catch(() => {
        // The hole could not be filled: show only the newest page rather than a conversation with messages missing.
        if (!live) return
        setOlder([])
        setHasMore(true)
      })
      .finally(() => {
        if (live) setGapAfter(null)
      })
    return () => {
      live = false
    }
  }, [gapAfter, channelId])

  // The newest page is the truth for the stretch it covers: a message HR deleted there goes from the screen too.
  const messages = React.useMemo(() => mergeLatestPage(older, latest.data), [older, latest.data])
  const rows = React.useMemo(() => buildChatRows(messages, myId, new Date()), [messages, myId])
  const newest = newestId(messages)
  const byId = React.useMemo(() => new Map(messages.map((m) => [String(m.id), m])), [messages])

  // Whether "Show earlier" is offered: decided by the first page, then by each older page.
  React.useEffect(() => {
    if (hasMore === null && latest.data) setHasMore(pageMayHaveMore(latest.data.length))
    // An empty channel: the first message anyone posts is new and is announced.
    if (announcedUpTo.current == null && latest.data) announcedUpTo.current = newestId(latest.data) ?? 0
  }, [latest.data, hasMore])

  const scrollToBottom = React.useCallback(
    (smooth: boolean) => {
      const el = scroller.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduced ? 'smooth' : 'auto' })
    },
    [reduced],
  )

  // After older messages are put on top, stay on the message that was being read.
  React.useLayoutEffect(() => {
    const el = scroller.current
    const k = keepPlace.current
    if (el && k) {
      el.scrollTop = k.top + (el.scrollHeight - k.height)
      keepPlace.current = null
    }
  }, [older])

  // New messages: follow them when the reader is at the bottom (or just sent one); otherwise count them for the pill.
  React.useLayoutEffect(() => {
    if (newest == null) return
    // Screen readers: other people's messages newer than the last announced one (nothing on the first load).
    const said = arrivalAnnouncement(messages, announcedUpTo.current, myId)
    announcedUpTo.current = Math.max(announcedUpTo.current ?? newest, newest)
    if (said) setAnnouncement((a) => ({ text: said, n: a.n + 1 }))
    if (firstScroll.current) {
      firstScroll.current = false
      scrollToBottom(false)
      setLastSeen(newest)
      return
    }
    if (atBottom) {
      scrollToBottom(true)
      setLastSeen(newest)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest])

  React.useLayoutEffect(() => {
    if (pending.length) scrollToBottom(true)
  }, [pending.length, scrollToBottom])

  function onScroll() {
    const el = scroller.current
    if (!el) return
    const near = isNearLatest(el.scrollHeight - el.scrollTop - el.clientHeight)
    if (near !== atBottom) setAtBottom(near)
    if (near && newest != null && newest !== lastSeen) setLastSeen(newest)
  }

  const unseen = atBottom ? 0 : countUnseen(messages, lastSeen, myId)

  async function loadOlder() {
    const before = oldestId(messages)
    const el = scroller.current
    if (before == null || loadingOlder) return
    setLoadingOlder(true)
    try {
      const page = await chatThreadApi.messages(channelId, { before, limit: CHAT_PAGE_SIZE })
      if (el) keepPlace.current = { height: el.scrollHeight, top: el.scrollTop }
      setOlder((prev) => mergeMessages(page, prev))
      setHasMore(pageMayHaveMore(page.length))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load earlier messages. Please try again.')
    } finally {
      setLoadingOlder(false)
    }
  }

  // ── sending ─────────────────────────────────────────────────────────────────
  async function deliver(p: PendingSend, replyId: string | number | null) {
    try {
      const sent = p.media ? await chatThreadApi.sendMedia(channelId, p.media, replyId) : await chatThreadApi.send(channelId, p.text, replyId)
      // the file is already here: it becomes that message's copy, so my own bubble needs no download
      if (p.media && sent?.id != null) adoptChatMedia(sent.id, p.media.blob)
      qc.setQueryData<ChatMsg[]>(key, (prev) => mergeMessages(prev, [sent]))
      setPending((list) => list.filter((x) => x.tempId !== p.tempId))
      setLastSeen(Number(sent.id))
      void qc.invalidateQueries({ queryKey: key })
    } catch (err) {
      const error = p.media
        ? uploadErrorMessage(err, p.media.kind)
        : err instanceof ApiError
          ? err.message
          : 'No connection. Check your internet and try again.'
      setPending((list) => list.map((x) => (x.tempId === p.tempId ? { ...x, status: 'failed', error } : x)))
    }
  }

  const replyIds = React.useRef(new Map<string, string | number | null>())

  function queue(text: string, media?: OutgoingMedia) {
    const p: PendingSend = {
      tempId: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.senderName, text: replyTo.text, kind: replyTo.kind } : null,
      status: 'sending',
      media,
    }
    const replyId = replyTo?.id ?? null
    replyIds.current.set(p.tempId, replyId)
    setPending((list) => [...list, p])
    setReplyTo(null)
    setAtBottom(true)
    void deliver(p, replyId)
  }

  const send = (text: string) => queue(text)

  const sendVoice = (rec: Recording) =>
    queue(VOICE_TEXT, {
      kind: 'voice',
      blob: rec.blob,
      mime: rec.mime,
      fileName: voiceFileName(rec.mime),
      durationMs: rec.durationMs,
      waveform: waveformForUpload(rec.levels),
    })

  const sendGif = (file: File) => {
    setGifToSend(null)
    queue(GIF_TEXT, { kind: 'gif', blob: file, mime: 'image/gif', fileName: file.name || 'animation.gif' })
  }

  function retry(p: PendingSend) {
    const again = { ...p, status: 'sending' as const, error: undefined }
    setPending((list) => list.map((x) => (x.tempId === p.tempId ? again : x)))
    void deliver(again, replyIds.current.get(p.tempId) ?? null)
  }

  // ── reactions (flip at once; the server's answer replaces the guess) ────────
  async function react(m: ChatMsg, emoji: string) {
    const remove = isMyReaction(m, emoji)
    const guess = toggleReactionLocal(m, emoji, remove, { id: myId, name: myName })
    const apply = (next: ChatMsg) => {
      qc.setQueryData<ChatMsg[]>(key, (prev) => replaceMessage(prev, next))
      setOlder((prev) => replaceMessage(prev, next))
    }
    apply(guess)
    try {
      const server = remove ? await chatThreadApi.unreact(m.id, emoji) : await chatThreadApi.react(m.id, emoji)
      if (server && typeof server === 'object' && 'id' in server) apply(server)
      void qc.invalidateQueries({ queryKey: ['chat-reactions', String(m.id)] })
    } catch (err) {
      apply(m)
      toast.error(err instanceof ApiError ? err.message : 'Could not update the reaction')
    }
  }

  function startReply(m: ChatMsg) {
    setReplyTo(m)
    requestAnimationFrame(() => composer.current?.focus())
  }

  /** A quote was clicked: bring the quoted message into view and flash it. */
  function jumpTo(id: number | string) {
    const el = scroller.current?.querySelector(`[data-msg-id="${CSS.escape(String(id))}"]`)
    if (!el) {
      toast.info(hasMore ? 'That message is further up. Use “Show earlier messages” to find it.' : 'That message is no longer in the chat.')
      return
    }
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    setHighlight(String(id))
    window.setTimeout(() => setHighlight((h) => (h === String(id) ? null : h)), 1600)
  }

  async function save(m: ChatMsg) {
    const kind = messageKind(m)
    setSavingId(String(m.id))
    try {
      await downloadChatMedia(m.id, mediaSaveName(m.id, kind, m.media?.mime))
      toast.success(kind === 'gif' ? 'GIF saved to your downloads' : 'Voice message saved to your downloads')
    } catch {
      toast.error('It could not be saved. It may have expired.')
    } finally {
      setSavingId(null)
    }
  }

  const actions: BubbleActions = {
    onReply: startReply,
    onReact: (m, e) => void react(m, e),
    onCopy: async (m) => {
      if (await copyText(m.text)) toast.success('Message copied')
      else toast.error('Could not copy the message')
    },
    onSave: (m) => void save(m),
    onOpenReactions: (m, emoji) => setReactionsFor({ id: String(m.id), emoji }),
    onOpenGif: (m, url) => setGifView({ id: String(m.id), url }),
    onQuote: jumpTo,
  }

  // ── render ──────────────────────────────────────────────────────────────────
  let body: React.ReactNode
  if (latest.isPending) {
    body = <SkeletonList variant="rows" count={5} label="Loading messages" className="p-4" />
  } else if (latest.isError && !latest.data) {
    body = (
      <div className="p-4">
        <ErrorState error={latest.error} what="the messages" onRetry={() => latest.refetch()} retrying={latest.isFetching} />
      </div>
    )
  } else if (messages.length === 0 && pending.length === 0) {
    body = (
      <div className="grid h-full place-items-center p-4">
        <EmptyState icon={MessageCircle} title="No messages yet" description={`Say hello to ${channelName}. Your message shows here for everyone in it.`} />
      </div>
    )
  } else {
    body = (
      <div className="flex min-h-full flex-col justify-end px-3 pt-3 pb-4 sm:px-5">
        {hasMore && (
          <div className="mb-2 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="min-h-11 rounded-full max-md:min-h-10 max-md:border-0 max-md:bg-accent max-md:px-4 max-md:text-[13px] max-md:text-primary sm:min-h-8"
            >
              {loadingOlder ? <Loader2 className="animate-spin" /> : <History />} {loadingOlder ? 'Loading…' : 'Show earlier messages'}
            </Button>
          </div>
        )}
        {hasMore === false && older.length > 0 && <p className="mb-2 text-center text-[12px] text-muted-foreground">This is the start of the conversation.</p>}
        {/* Not live: older pages, "Sending…" bubbles and my own echoed messages are added here and must stay silent.
            New messages from others are announced once by the hidden region below the scroller. */}
        <div role="log" aria-label={`Messages in ${channelName}`} aria-live="off">
          {rows.map((r) =>
            r.kind === 'day' ? (
              <div key={r.key} className="sticky top-1 z-10 my-3 flex justify-center">
                <span className="font-label rounded-md border border-border/70 bg-card px-3 py-1 text-[11.5px] font-semibold tracking-wide text-muted-foreground shadow-[0_1px_2px_rgb(15_23_42/0.06)] dark:bg-[#1b2640]">
                  {r.label}
                </span>
              </div>
            ) : (
              <MessageBubble
                key={r.key}
                msg={r.message}
                isMine={r.isMine}
                isHr={r.isHr}
                startsGroup={r.startsGroup}
                endsGroup={r.endsGroup}
                highlighted={highlight === String(r.message.id)}
                now={now}
                reduced={reduced}
                saving={savingId === String(r.message.id)}
                actions={actions}
              />
            ),
          )}
          {pending.map((p) => (
            <PendingBubble key={p.tempId} p={p} onRetry={() => retry(p)} onDiscard={() => setPending((l) => l.filter((x) => x.tempId !== p.tempId))} />
          ))}
        </div>
      </div>
    )
  }

  const reactionsMessage = reactionsFor ? (byId.get(reactionsFor.id) ?? null) : null
  const gifMessage = gifView ? (byId.get(gifView.id) ?? null) : null

  return (
    // Phones: no framed box - the conversation runs edge to edge, filling the height the page gives it.
    <div className="glass-raised relative flex h-[min(72dvh,760px)] min-h-[440px] flex-col overflow-hidden rounded-2xl max-md:-mx-4 max-md:h-auto max-md:min-h-0 max-md:flex-1 max-md:rounded-none max-md:border-0! max-md:bg-none! max-md:bg-transparent! max-md:shadow-none!">
      {latest.isError && latest.data && (
        <p role="status" className="flex items-center justify-center gap-1.5 border-b border-waiting-border bg-waiting-bg px-3 py-1.5 text-[12px] font-semibold text-waiting">
          <WifiOff className="size-3.5" aria-hidden="true" /> Can't refresh right now. Trying again…
        </p>
      )}
      <div ref={scroller} onScroll={onScroll} className={cn('scrollbar-thin relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto', WALLPAPER)}>
        {body}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {/* The toggling no-break space makes a repeated identical announcement still count as a change. */}
        {announcement.text}
        {announcement.n % 2 ? ' ' : ''}
      </div>

      <AnimatePresence>
        {!atBottom && messages.length > 0 && (
          <motion.div
            variants={popIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="pointer-events-none absolute inset-x-0 bottom-28 flex justify-center max-md:bottom-[88px]"
          >
            <Button
              size="sm"
              variant={unseen > 0 ? 'default' : 'glass'}
              className="pointer-events-auto min-h-10 rounded-full shadow-clay max-md:text-[12.5px]"
              onClick={() => {
                scrollToBottom(true)
                if (newest != null) setLastSeen(newest)
              }}
            >
              <ArrowDown /> {unseenLabel(unseen)}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Composer
        ref={composer}
        channelName={channelName}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={send}
        onPickGif={setGifToSend}
        onVoiceRecorded={sendVoice}
      />

      <ReactionsDialog
        message={reactionsMessage}
        initialEmoji={reactionsFor?.emoji ?? null}
        onClose={() => setReactionsFor(null)}
        onToggle={(m, e) => void react(m, e)}
      />
      <GifViewer message={gifMessage} url={gifView?.url ?? null} now={now} onClose={() => setGifView(null)} />
      <GifSendDialog
        file={gifToSend}
        expiryDays={expiryDays}
        replyingTo={replyTo?.senderName ?? null}
        onCancel={() => setGifToSend(null)}
        onSend={sendGif}
      />
    </div>
  )
}

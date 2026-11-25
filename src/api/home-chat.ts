import { apiClient, apiRequest } from './client'
import type { ChatChannel } from '@/types'
import type { ChatMessageLike, ChatReactionLike } from '@/lib/chat-thread'
import type { ChatKind, ChatMediaInfo } from '@/lib/chat-media'

// Team Chat, typed the way the server really answers (backend chat_views.py): ids are numbers, HR / management messages
// carry `isHr` and no sender id, and a reaction call answers with the message as it now is. (The shared chatApi in
// resources.ts calls the same endpoints with the older string-id types.)
// Since 2026-11-25 a message may be a GIF or a voice message (`kind`, `media`), each reaction says who reacted
// (`people`), and a reply's quote says what kind of message it quotes.

export interface ChatMsg extends ChatMessageLike {
  id: number | string
  senderId: number | string | null
  replyTo: { id: number | string; senderName: string; text: string; kind?: ChatKind | string | null } | null
  /** "text" (or missing, from an older server), "gif" or "voice". */
  kind?: ChatKind | string | null
  /** The GIF / voice file: null for a text message; `expired` (no url) once its time is up. */
  media?: ChatMediaInfo | null
}

/** A channel, with how many days GIFs and voice messages stay (HR sets it; servers since 2026-11-25). */
export type ChatChannelInfo = ChatChannel & { mediaExpiryDays?: number | null }

/** A GIF picked from the computer / phone or a voice message just recorded, on its way to the server. */
export type OutgoingMedia =
  | { kind: 'gif'; blob: Blob; mime: string; fileName: string }
  | { kind: 'voice'; blob: Blob; mime: string; fileName: string; durationMs: number; waveform: number[] }

export const chatThreadApi = {
  channels: () => apiRequest<ChatChannelInfo[]>({ method: 'GET', url: '/chat/channels' }),
  /**
   * The newest `limit` messages, or the `limit` before `before` (an id), oldest first. With `after` (an id) the server
   * ignores `limit` and answers with EVERY newer message, oldest first.
   */
  messages: (channelId: string | number, params: { before?: number; after?: number; limit?: number } = {}) =>
    apiRequest<ChatMsg[]>({ method: 'GET', url: `/chat/channels/${channelId}/messages`, params: { limit: 50, ...params } }),
  send: (channelId: string | number, text: string, replyToId?: number | string | null) =>
    apiRequest<ChatMsg>({
      method: 'POST',
      url: `/chat/channels/${channelId}/messages`,
      data: replyToId != null ? { text, reply_to_id: replyToId } : { text },
    }),
  /**
   * POST chat/channels/<id>/media (multipart): kind=gif|voice, file, durationMs + waveform for a voice message,
   * replyToId. The server checks type, size and length again and answers with the message (400 {error, code} for a file
   * it does not take).
   */
  sendMedia: (channelId: string | number, item: OutgoingMedia, replyToId?: number | string | null) => {
    const form = new FormData()
    form.append('kind', item.kind)
    form.append('file', item.blob, item.fileName)
    if (item.kind === 'voice') {
      form.append('durationMs', String(Math.round(item.durationMs)))
      form.append('waveform', JSON.stringify(item.waveform))
    }
    if (replyToId != null) form.append('replyToId', String(replyToId))
    return apiRequest<ChatMsg>({ method: 'POST', url: `/chat/channels/${channelId}/media`, data: form, timeout: 90_000 })
  },
  react: (messageId: number | string, emoji: string) =>
    apiRequest<ChatMsg>({ method: 'POST', url: `/chat/messages/${messageId}/reactions`, data: { emoji } }),
  unreact: (messageId: number | string, emoji: string) =>
    apiRequest<ChatMsg>({ method: 'DELETE', url: `/chat/messages/${messageId}/reactions`, data: { emoji } }),
  /** Who reacted with what (GET chat/messages/<id>/reactions), for a message whose reactions came without names. */
  reactions: (messageId: number | string) =>
    apiRequest<{ messageId: number | string; reactions: ChatReactionLike[] }>({ method: 'GET', url: `/chat/messages/${messageId}/reactions` }),
  /**
   * The GIF / voice file itself (GET chat/messages/<id>/media), fetched with the sign-in like every other call: it is
   * served only to members of the channel, never as a public link. 410 once it has expired.
   */
  mediaBlob: async (messageId: number | string, signal?: AbortSignal): Promise<Blob> => {
    const res = await apiClient.get<Blob>(`/chat/messages/${messageId}/media`, {
      responseType: 'blob',
      signal,
      skipOfflineDetection: true,
      timeout: 60_000,
    })
    return res.data
  },
}

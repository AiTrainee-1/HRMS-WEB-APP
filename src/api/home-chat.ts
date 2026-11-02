import { apiRequest } from './client'
import type { ChatChannel } from '@/types'
import type { ChatMessageLike } from '@/lib/chat-thread'

// Team Chat, typed the way the server really answers (backend chat_views.py): ids are numbers, HR / management messages
// carry `isHr` and no sender id, and a reaction call answers with the message as it now is. (The shared chatApi in
// resources.ts calls the same endpoints with the older string-id types.)

export interface ChatMsg extends ChatMessageLike {
  id: number | string
  senderId: number | string | null
  replyTo: { id: number | string; senderName: string; text: string } | null
}

export const chatThreadApi = {
  channels: () => apiRequest<ChatChannel[]>({ method: 'GET', url: '/chat/channels' }),
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
  react: (messageId: number | string, emoji: string) =>
    apiRequest<ChatMsg>({ method: 'POST', url: `/chat/messages/${messageId}/reactions`, data: { emoji } }),
  unreact: (messageId: number | string, emoji: string) =>
    apiRequest<ChatMsg>({ method: 'DELETE', url: `/chat/messages/${messageId}/reactions`, data: { emoji } }),
}

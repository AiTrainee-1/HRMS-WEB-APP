// Pure helpers for Team Chat (no React, no network), tested in chat-thread.test.ts. A port of the mobile app's
// src/lib/chatThread.ts:
//  - merging the "latest 50" poll with older pages loaded with "Show earlier messages",
//  - day separators ("Today", "Yesterday", "Mon, 27 Oct", "12 Dec 2025"),
//  - grouping consecutive messages from one person,
//  - how many new messages arrived while the employee was reading older ones,
//  - flipping a reaction straight away (the server's answer then replaces it).
// Message ids are numbers on the server; the web app's older types call them strings, so both are accepted.

export interface ChatReactionLike {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface ChatMessageLike {
  id: number | string
  senderId: number | string | null
  senderName: string
  isHr?: boolean
  text: string
  reactions: ChatReactionLike[]
  createdAt: string | null
}

/** Newest page the screen polls, and the size of each "show earlier" page. */
export const CHAT_PAGE_SIZE = 50

/** Longest message the app lets someone type (the server has no limit; this keeps a chat a chat). */
export const CHAT_MAX_LENGTH = 2000

/** Messages from the same person this close together are drawn as one group. */
const GROUP_GAP_MS = 5 * 60 * 1000

/** The numeric order of an id ("123" and 123 are the same message). NaN for an id that is not a number. */
export function idNum(id: number | string | null | undefined): number {
  if (typeof id === 'number') return id
  const n = Number(id)
  return Number.isFinite(n) ? n : NaN
}

/** The same message? (123 and "123" are.) */
export function sameId(a: number | string | null | undefined, b: number | string | null | undefined): boolean {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

/**
 * Joins message lists into one list, oldest first, one entry per id. When the same id appears twice the LATER list wins,
 * so pass the freshest data last (older pages first, the newest poll last).
 */
export function mergeMessages<T extends { id: number | string }>(...lists: (readonly T[] | null | undefined)[]): T[] {
  const byId = new Map<string, T>()
  for (const list of lists) {
    if (!list) continue
    for (const m of list) {
      if (m && m.id != null) byId.set(String(m.id), m)
    }
  }
  return [...byId.values()].sort((a, b) => idNum(a.id) - idNum(b.id))
}

/** Puts one changed message (e.g. the server's answer to a reaction) into a list, if it is there. */
export function replaceMessage<T extends { id: number | string }>(list: readonly T[] | null | undefined, updated: T): T[] {
  if (!list) return []
  return list.map((m) => (sameId(m.id, updated.id) ? updated : m))
}

/** The id to ask the server for "messages before this one", or null when nothing is loaded. */
export function oldestId(list: readonly { id: number | string }[]): number | null {
  let min: number | null = null
  for (const m of list) {
    const n = idNum(m.id)
    if (Number.isFinite(n) && (min == null || n < min)) min = n
  }
  return min
}

export function newestId(list: readonly { id: number | string }[]): number | null {
  let max: number | null = null
  for (const m of list) {
    const n = idNum(m.id)
    if (Number.isFinite(n) && (max == null || n > max)) max = n
  }
  return max
}

/** A page shorter than the page size means the server has nothing older. */
export function pageMayHaveMore(pageLength: number, pageSize = CHAT_PAGE_SIZE): boolean {
  return pageLength >= pageSize
}

/**
 * What the "newest page" poll just let go of. Each poll returns only the newest `pageSize` messages, so when new ones
 * arrive the oldest slide out of it; the thread keeps those (they were on screen) instead of letting them vanish.
 *  - `kept`: messages of the previous page older than everything in the new one. Nothing is kept when the new page is
 *    short (it then holds the whole channel, so a missing message was deleted, not pushed out) or empty.
 *  - `gap`: the new page is full and starts after the newest message of the previous one, so messages may exist between
 *    the two that were never fetched (more than a page arrived between two polls, e.g. after the tab was hidden).
 */
export function slidOutOfPage<T extends { id: number | string }>(
  prev: readonly T[] | null | undefined,
  next: readonly T[] | null | undefined,
  pageSize = CHAT_PAGE_SIZE,
): { kept: T[]; gap: boolean } {
  if (!prev?.length || !next?.length || !pageMayHaveMore(next.length, pageSize)) return { kept: [], gap: false }
  const floor = oldestId(next)
  if (floor == null) return { kept: [], gap: false }
  const kept = prev.filter((m) => idNum(m.id) < floor)
  const top = newestId(prev)
  return { kept, gap: kept.length > 0 && top != null && top < floor }
}

// ── reactions ────────────────────────────────────────────────────────────────

/** Adds or removes MY reaction on a message, the way the server will once it answers. */
export function toggleReactionLocal<T extends ChatMessageLike>(message: T, emoji: string, remove: boolean): T {
  const reactions = message.reactions.map((r) => ({ ...r }))
  const existing = reactions.find((r) => r.emoji === emoji)
  if (remove) {
    if (!existing || !existing.reactedByMe) return message
    existing.count -= 1
    existing.reactedByMe = false
    return { ...message, reactions: reactions.filter((r) => r.count > 0) }
  }
  if (existing) {
    if (existing.reactedByMe) return message
    existing.count += 1
    existing.reactedByMe = true
    return { ...message, reactions }
  }
  return { ...message, reactions: [...reactions, { emoji, count: 1, reactedByMe: true }] }
}

export function isMyReaction(message: ChatMessageLike, emoji: string): boolean {
  return message.reactions.some((r) => r.emoji === emoji && r.reactedByMe)
}

/** "👍 2 including you, ❤️ 1" for screen readers. */
export function reactionsSummary(reactions: readonly ChatReactionLike[]): string {
  return reactions.map((r) => `${r.emoji} ${r.count}${r.reactedByMe ? ' including you' : ''}`).join(', ')
}

// ── days and times ───────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function parseTime(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Local calendar day key, e.g. "2026-10-31". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "Today", "Yesterday", "Mon, 27 Oct" (this year) or "12 Dec 2025" (another year). */
export function dayLabel(d: Date, now: Date): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (d.getFullYear() === now.getFullYear()) return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** "9:05 AM" */
export function timeLabel(value: string | null | undefined): string {
  const d = parseTime(value)
  if (!d) return ''
  const h = d.getHours()
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

// ── rows the list draws ──────────────────────────────────────────────────────

export type ChatRow<T extends ChatMessageLike> =
  | { kind: 'day'; key: string; label: string }
  | {
      kind: 'message'
      key: string
      message: T
      isMine: boolean
      isHr: boolean
      /** First message of a run from this sender: show the name. */
      startsGroup: boolean
      /** Last message of a run: show the time and the avatar. */
      endsGroup: boolean
    }

function sameSender(a: ChatMessageLike, b: ChatMessageLike): boolean {
  if (a.senderId == null && b.senderId == null) return a.senderName === b.senderName
  return sameId(a.senderId, b.senderId)
}

function sameGroup(a: ChatMessageLike, b: ChatMessageLike): boolean {
  if (!sameSender(a, b)) return false
  const ta = parseTime(a.createdAt)
  const tb = parseTime(b.createdAt)
  if (!ta || !tb) return false
  if (dayKey(ta) !== dayKey(tb)) return false
  return Math.abs(tb.getTime() - ta.getTime()) <= GROUP_GAP_MS
}

/** True for a message HR or management wrote (the server sends `isHr`; older servers: no sender id). */
export function isHrMessage(m: ChatMessageLike): boolean {
  return m.isHr === true || m.senderId == null
}

export function isMine(m: ChatMessageLike, myEmployeeId: number | string | null | undefined): boolean {
  return myEmployeeId != null && sameId(m.senderId, myEmployeeId)
}

/** The messages (any order) as list rows, OLDEST FIRST: a day separator before each day's first message. */
export function buildChatRows<T extends ChatMessageLike>(
  messages: readonly T[],
  myEmployeeId: number | string | null | undefined,
  now: Date,
): ChatRow<T>[] {
  const sorted = [...messages].sort((a, b) => idNum(a.id) - idNum(b.id))
  const rows: ChatRow<T>[] = []
  let lastDay: string | null = null
  sorted.forEach((m, i) => {
    const t = parseTime(m.createdAt)
    const key = t ? dayKey(t) : 'unknown'
    if (key !== lastDay) {
      rows.push({ kind: 'day', key: `day-${key}`, label: t ? dayLabel(t, now) : 'Earlier' })
      lastDay = key
    }
    const prev = sorted[i - 1]
    const next = sorted[i + 1]
    rows.push({
      kind: 'message',
      key: `m-${m.id}`,
      message: m,
      isMine: isMine(m, myEmployeeId),
      isHr: isHrMessage(m),
      startsGroup: !prev || !sameGroup(prev, m),
      endsGroup: !next || !sameGroup(m, next),
    })
  })
  return rows
}

// ── scrolling and the "new messages" pill ────────────────────────────────────

/** Within this many pixels of the bottom the reader counts as "at the latest messages": new ones simply appear. */
export const NEAR_LATEST_PX = 120

export function isNearLatest(distanceFromBottom: number, threshold = NEAR_LATEST_PX): boolean {
  return distanceFromBottom <= threshold
}

/** Messages from other people newer than the last one the reader saw. */
export function countUnseen(
  messages: readonly ChatMessageLike[],
  lastSeenId: number | null,
  myEmployeeId: number | string | null | undefined,
): number {
  if (lastSeenId == null) return 0
  let n = 0
  for (const m of messages) {
    if (idNum(m.id) > lastSeenId && !isMine(m, myEmployeeId)) n += 1
  }
  return n
}

/** Longest message text read out by the screen-reader announcement (the full message is in the list). */
const ANNOUNCE_MAX_CHARS = 160

/**
 * What a screen reader says when other people's messages arrive: "New message from Priya Raman: hello" or
 * "3 new messages, latest from HR Desk (HR): …". Only messages newer than `sinceId` and not mine count, so loading
 * older pages and my own sent messages are never read out. Empty when there is nothing to say.
 */
export function arrivalAnnouncement(
  messages: readonly ChatMessageLike[],
  sinceId: number | null,
  myEmployeeId: number | string | null | undefined,
): string {
  if (sinceId == null) return ''
  const fresh = messages.filter((m) => idNum(m.id) > sinceId && !isMine(m, myEmployeeId)).sort((a, b) => idNum(a.id) - idNum(b.id))
  if (!fresh.length) return ''
  const last = fresh[fresh.length - 1]
  const who = isHrMessage(last) ? `${last.senderName} (HR)` : last.senderName
  const flat = last.text.replace(/\s+/g, ' ').trim()
  const text = flat.length > ANNOUNCE_MAX_CHARS ? `${flat.slice(0, ANNOUNCE_MAX_CHARS - 1)}…` : flat
  return fresh.length === 1 ? `New message from ${who}: ${text}` : `${fresh.length} new messages, latest from ${who}: ${text}`
}

/** "1 new message" / "12 new messages" / "99+ new messages" */
export function unseenLabel(count: number): string {
  if (count <= 0) return 'Latest messages'
  if (count > 99) return '99+ new messages'
  return `${count} new message${count === 1 ? '' : 's'}`
}

/** What gets sent: trimmed, and never longer than the limit. Empty means "nothing to send". */
export function prepareOutgoing(text: string, max = CHAT_MAX_LENGTH): string {
  return text.trim().slice(0, max)
}

/** Initials for an avatar: "Priya Raman" -> "PR", "HR" -> "HR". */
export function initialsOf(name: string | null | undefined): string {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

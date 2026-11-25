// Shared looks for the WhatsApp-style chat (owner 2026-11-25, the mobile app's components/chat/chatVisuals.tsx and
// emoji.ts). Plain values and functions only; the drawn pieces are in ChatVisuals.tsx.

/** A soft, stable colour per colleague so a busy channel is easier to scan (status token pairs: AA in both themes). */
const TINTS = [
  { avatar: 'bg-info-bg text-info', name: 'text-info' },
  { avatar: 'bg-approved-bg text-approved', name: 'text-approved' },
  { avatar: 'bg-waiting-bg text-waiting', name: 'text-waiting' },
  { avatar: 'bg-violet-bg text-violet', name: 'text-violet' },
  { avatar: 'bg-rejected-bg text-rejected', name: 'text-rejected' },
] as const

export function tintFor(name: string): (typeof TINTS)[number] {
  let h = 0
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

/**
 * The bubble colours: mine in the brand colour, everyone else's raised off the chat's soft "wallpaper", HR in a violet
 * tint. `tail` gives the SVG tail the same colour (it is drawn with currentColor).
 */
export const BUBBLE = {
  mine: { fill: 'bg-primary text-primary-foreground', tail: 'text-primary' },
  theirs: { fill: 'bg-card text-foreground dark:bg-[#1b2640]', tail: 'text-card dark:text-[#1b2640]' },
  hr: { fill: 'bg-[#efeafe] text-foreground dark:bg-[#2a2350]', tail: 'text-[#efeafe] dark:text-[#2a2350]' },
} as const

/** The chat area behind the bubbles. */
export const WALLPAPER = 'bg-[#eef2f8] dark:bg-[#0d1527]'

/** The six reactions the chat offers, with the words a screen reader says for each. */
export const CHAT_EMOJIS: { emoji: string; name: string }[] = [
  { emoji: '👍', name: 'Thumbs up' },
  { emoji: '❤️', name: 'Heart' },
  { emoji: '😂', name: 'Laughing' },
  { emoji: '😮', name: 'Surprised' },
  { emoji: '😢', name: 'Sad' },
  { emoji: '🙏', name: 'Thank you' },
]

export function emojiName(emoji: string): string {
  return CHAT_EMOJIS.find((e) => e.emoji === emoji)?.name ?? emoji
}

/** The composer's emoji panel: the everyday faces, hands and symbols, most used first. */
export const COMPOSER_EMOJIS: string[] = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋',
  '😎', '🤩', '🥳', '🤗', '🤔', '😐', '😶', '🙄', '😏', '😴', '😌', '😜', '🤪', '😝', '😕', '😟',
  '😮', '😲', '😳', '🥺', '😢', '😭', '😤', '😡', '🤯', '😱', '😓', '🤒', '🤕', '😷', '🤧', '🥱',
  '👍', '👎', '👏', '🙌', '🙏', '🤝', '👌', '✌️', '🤞', '👋', '💪', '👀', '🫡', '🤙', '☝️', '✋',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '💯', '🔥', '✨', '🎉', '🎊', '🎂', '🎁', '🏆', '⭐',
  '✅', '❌', '⚠️', '❓', '❗', '📌', '📅', '⏰', '☕', '🍵', '🍛', '🍰', '🌞', '🌧️', '🚗', '🏭',
]

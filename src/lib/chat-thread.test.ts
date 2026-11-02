// Run with `npm test`. Team Chat rules (lib/chat-thread.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  arrivalAnnouncement,
  buildChatRows,
  countUnseen,
  dayLabel,
  initialsOf,
  isHrMessage,
  isNearLatest,
  mergeMessages,
  newestId,
  oldestId,
  pageMayHaveMore,
  prepareOutgoing,
  reactionsSummary,
  replaceMessage,
  slidOutOfPage,
  timeLabel,
  toggleReactionLocal,
  unseenLabel,
  type ChatMessageLike,
} from './chat-thread.ts'

const now = new Date(2026, 9, 31, 15, 0, 0)
const msg = (id: number | string, over: Partial<ChatMessageLike> = {}): ChatMessageLike => ({
  id,
  senderId: 5,
  senderName: 'Priya Raman',
  text: `m${id}`,
  reactions: [],
  createdAt: new Date(2026, 9, 31, 10, Number(id)).toISOString(),
  ...over,
})

describe('merging', () => {
  test('one per id, later list wins, oldest first, string and number ids are the same', () => {
    const older = [msg(1), msg(2)]
    const latest = [msg('2', { text: 'edited' }), msg(3)]
    const merged = mergeMessages(older, latest)
    assert.deepEqual(merged.map((m) => String(m.id)), ['1', '2', '3'])
    assert.equal(merged[1].text, 'edited')
    assert.deepEqual(mergeMessages(null, undefined), [])
  })
  test('replace, oldest, newest, more pages', () => {
    const list = [msg(4), msg(9), msg(6)]
    assert.equal(replaceMessage(list, msg('9', { text: 'x' }))[1].text, 'x')
    assert.equal(oldestId(list), 4)
    assert.equal(newestId(list), 9)
    assert.equal(oldestId([]), null)
    assert.equal(pageMayHaveMore(50), true)
    assert.equal(pageMayHaveMore(12), false)
  })
})

describe('messages sliding out of the polled newest page', () => {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => msg(from + i))
  const ids = (list: readonly ChatMessageLike[]) => list.map((m) => Number(m.id))

  test('new messages push the oldest out: those are kept, no gap', () => {
    // 51-100 were on screen; 10 arrived, the poll now returns 61-110.
    const { kept, gap } = slidOutOfPage(range(51, 100), range(61, 110))
    assert.deepEqual(ids(kept), ids(range(51, 60)))
    assert.equal(gap, false)
    // Merged with the new page, the conversation stays whole.
    assert.deepEqual(ids(mergeMessages(kept, range(61, 110))), ids(range(51, 110)))
  })
  test('works with the page size passed in and with string ids', () => {
    const { kept } = slidOutOfPage([msg('1'), msg('2'), msg('3')], [msg('2'), msg('3'), msg('4')], 3)
    assert.deepEqual(kept.map((m) => String(m.id)), ['1'])
  })
  test('a short new page holds the whole channel: nothing is kept (a missing message was deleted)', () => {
    assert.deepEqual(slidOutOfPage([msg(1), msg(2), msg(3)], [msg(2), msg(3)], 50), { kept: [], gap: false })
  })
  test('nothing before, nothing now, or the same page: nothing kept', () => {
    assert.deepEqual(slidOutOfPage(undefined, range(1, 3), 3), { kept: [], gap: false })
    assert.deepEqual(slidOutOfPage(range(1, 3), [], 3), { kept: [], gap: false })
    assert.deepEqual(slidOutOfPage(range(1, 3), undefined, 3), { kept: [], gap: false })
    assert.deepEqual(slidOutOfPage(range(1, 3), range(1, 3), 3), { kept: [], gap: false })
  })
  test('more than a page arrived between two polls: everything is kept and the gap is reported', () => {
    const { kept, gap } = slidOutOfPage(range(1, 3), range(10, 12), 3)
    assert.deepEqual(ids(kept), [1, 2, 3])
    assert.equal(gap, true)
  })
  test('a full new page that still overlaps the old one is not a gap', () => {
    assert.equal(slidOutOfPage(range(1, 3), range(3, 5), 3).gap, false)
  })
})

describe('screen-reader announcement of new messages', () => {
  test('only other people, only newer than the last announced', () => {
    const list = [msg(1, { senderId: 9 }), msg(2), msg(3, { senderId: 9 })]
    assert.equal(arrivalAnnouncement(list, 1, 9), 'New message from Priya Raman: m2')
    assert.equal(arrivalAnnouncement(list, 3, 9), '')
    assert.equal(arrivalAnnouncement(list, null, 9), '')
    // My own messages are never read out.
    assert.equal(arrivalAnnouncement([msg(4, { senderId: 9 })], 3, 9), '')
  })
  test('several: count and the latest one, HR marked', () => {
    const list = [msg(5), msg(7, { senderName: 'HR Desk', senderId: null, text: 'Office closed\n tomorrow' }), msg(6)]
    assert.equal(arrivalAnnouncement(list, 4, 9), '3 new messages, latest from HR Desk (HR): Office closed tomorrow')
  })
  test('long text is clipped', () => {
    const said = arrivalAnnouncement([msg(2, { text: 'x'.repeat(500) })], 1, 9)
    assert.ok(said.endsWith('…'))
    assert.ok(said.length < 200)
  })
})

describe('reactions', () => {
  test('add, add to existing, remove', () => {
    const m = msg(1, { reactions: [{ emoji: '👍', count: 2, reactedByMe: false }] })
    const added = toggleReactionLocal(m, '👍', false)
    assert.deepEqual(added.reactions, [{ emoji: '👍', count: 3, reactedByMe: true }])
    const fresh = toggleReactionLocal(m, '🎉', false)
    assert.equal(fresh.reactions.length, 2)
    const removed = toggleReactionLocal(msg(1, { reactions: [{ emoji: '🎉', count: 1, reactedByMe: true }] }), '🎉', true)
    assert.deepEqual(removed.reactions, [])
    assert.equal(toggleReactionLocal(m, '👍', true), m)
    assert.equal(reactionsSummary(added.reactions), '👍 3 including you')
  })
})

describe('rows', () => {
  test('day separators, grouping, mine and HR', () => {
    const yesterday = new Date(2026, 9, 30, 18, 0).toISOString()
    const rows = buildChatRows(
      [
        msg(1, { createdAt: yesterday }),
        msg(2),
        msg(3),
        msg(4, { senderId: 9, senderName: 'Me' }),
        msg(5, { senderId: null, senderName: 'HR' }),
      ],
      '9',
      now,
    )
    assert.deepEqual(
      rows.map((r) => (r.kind === 'day' ? `day:${r.label}` : `${r.message.id}:${r.startsGroup ? 'S' : ''}${r.endsGroup ? 'E' : ''}${r.isMine ? 'M' : ''}${r.isHr ? 'H' : ''}`)),
      ['day:Yesterday', '1:SE', 'day:Today', '2:S', '3:E', '4:SEM', '5:SEH'],
    )
  })
  test('dayLabel and timeLabel', () => {
    assert.equal(dayLabel(new Date(2026, 9, 27), now), 'Tue, 27 Oct')
    assert.equal(dayLabel(new Date(2025, 11, 12), now), '12 Dec 2025')
    assert.equal(timeLabel(new Date(2026, 9, 31, 9, 5).toISOString()), '9:05 AM')
    assert.equal(timeLabel(null), '')
  })
  test('HR messages', () => {
    assert.equal(isHrMessage(msg(1, { isHr: true })), true)
    assert.equal(isHrMessage(msg(1, { senderId: null })), true)
    assert.equal(isHrMessage(msg(1)), false)
  })
})

describe('new messages pill', () => {
  test('counts others only, after the last seen', () => {
    const list = [msg(1), msg(2), msg(3, { senderId: 9 }), msg(4)]
    assert.equal(countUnseen(list, 1, 9), 2)
    assert.equal(countUnseen(list, null, 9), 0)
    assert.equal(unseenLabel(1), '1 new message')
    assert.equal(unseenLabel(12), '12 new messages')
    assert.equal(unseenLabel(150), '99+ new messages')
    assert.equal(isNearLatest(40), true)
    assert.equal(isNearLatest(400), false)
  })
  test('outgoing text and initials', () => {
    assert.equal(prepareOutgoing('  hi  '), 'hi')
    assert.equal(prepareOutgoing('abcdef', 3), 'abc')
    assert.equal(prepareOutgoing('   '), '')
    assert.equal(initialsOf('Priya Raman'), 'PR')
    assert.equal(initialsOf('HR'), 'HR')
    assert.equal(initialsOf(''), '?')
  })
})

import type { PunchTile } from './onduty-punches.ts'

/** What a queued On-Duty operation carries in its `meta` (offline/queued-requests.ts). */
export interface QueuedOnDutyLike {
  kind: string
  status: 'pending' | 'failed'
  meta: Record<string, unknown>
}

/** The punch numbers saved on this device (not yet sent) for this session. A failed one is not counted: it can be taken again. */
export function queuedPunchNumbers(ops: readonly QueuedOnDutyLike[], sessionId: number | null): Map<number, string | null> {
  const out = new Map<number, string | null>()
  for (const op of ops) {
    if (op.kind !== 'onDuty.punch' || op.status !== 'pending') continue
    const sid = op.meta.sessionId
    if (sessionId != null && sid != null && Number(sid) !== sessionId) continue
    const n = Number(op.meta.punchNumber)
    if (n >= 1 && n <= 4) out.set(n, typeof op.meta.time === 'string' ? op.meta.time : null)
  }
  return out
}

/**
 * The four tiles with the punches saved offline shown as taken ("Saved · waiting to sync"), so the same punch is not
 * recorded twice while it waits. The server's own state wins once it has the punch.
 */
export function withQueuedPunches(tiles: readonly PunchTile[], queued: Map<number, string | null>): PunchTile[] {
  return tiles.map((t) => {
    if (t.state !== 'open' || !queued.has(t.punchNumber)) return t
    return {
      ...t,
      state: 'done',
      doneStatus: 'pending',
      time: queued.get(t.punchNumber) ?? null,
      statusLabel: 'Saved · waiting to sync',
      note: null,
      selectable: false,
    }
  })
}

/** OT punches saved on this device for this session (counted into the "OT punches" list while they wait). */
export function queuedOtCount(ops: readonly QueuedOnDutyLike[], sessionId: number | null): number {
  return ops.filter(
    (op) =>
      op.kind === 'onDuty.otPunch' &&
      op.status === 'pending' &&
      (sessionId == null || op.meta.sessionId == null || Number(op.meta.sessionId) === sessionId),
  ).length
}

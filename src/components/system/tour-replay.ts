// "Replay the welcome tour" from another page (Help): the tour starts as soon as the dashboard is on screen.

let pending = false
const listeners = new Set<() => void>()

export function requestTourReplay(): void {
  pending = true
  listeners.forEach((l) => l())
}

/** Takes the pending replay request (true once per request). */
export function takeTourReplay(): boolean {
  const was = pending
  pending = false
  return was
}

export function subscribeTourReplay(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function tourReplayPending(): boolean {
  return pending
}

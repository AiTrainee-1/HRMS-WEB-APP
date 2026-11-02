/**
 * Things held in memory for the signed-in person that the TanStack Query cache does not own (object URLs made from
 * their files, per-page blob caches, ...). A module that keeps such state registers a cleanup with `onSignOut`; every
 * sign-out (the button, a 401 from the server, the resignation/deactivation guard) and every successful sign-in runs
 * them through `runSignOutCleanups`, so the next person on the same browser tab never sees the previous one's data.
 *
 * Pure: no React, no DOM, no storage.
 */

type Cleanup = () => void

const cleanups = new Set<Cleanup>()

/** Registers `fn` to run at the next and every later sign-out. Returns a function that unregisters it. */
export function onSignOut(fn: Cleanup): () => void {
  cleanups.add(fn)
  return () => {
    cleanups.delete(fn)
  }
}

/**
 * Runs every registered cleanup once. One that throws never stops the others (a sign-out must always finish);
 * the errors are returned so a caller or a test can see them.
 */
export function runSignOutCleanups(): unknown[] {
  const errors: unknown[] = []
  for (const fn of [...cleanups]) {
    try {
      fn()
    } catch (err) {
      errors.push(err)
    }
  }
  return errors
}

/** How many cleanups are registered (for tests). */
export function signOutCleanupCount(): number {
  return cleanups.size
}

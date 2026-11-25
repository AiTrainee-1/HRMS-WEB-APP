import * as React from 'react'

// The Dashboard's salary eye (owner 2026-11-25, as in the mobile app's components/home/salaryVisibility.ts): amounts are
// HIDDEN by default (an office PC is often seen by others), the eye shows them and this browser remembers the choice.
// Shared: the Last salary card and My Insights follow the same eye, so showing / hiding on either one does both (and
// another tab of the app follows through the `storage` event). The key is the one the Last salary card always used.

const SHOW_KEY = 'uktex_home_salary_shown_v1'

let shown: boolean | null = null
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(SHOW_KEY) === '1'
  } catch {
    return false
  }
}

function current(): boolean {
  if (shown === null) shown = read()
  return shown
}

function publish(next: boolean) {
  shown = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === SHOW_KEY) publish(e.newValue === '1')
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Show or hide the salary amounts everywhere on the Dashboard; the choice is remembered on this browser. */
export function setSalaryShown(next: boolean) {
  publish(next)
  try {
    localStorage.setItem(SHOW_KEY, next ? '1' : '0')
  } catch {
    /* only a preference */
  }
}

/** [shown, set]: whether the Dashboard's salary amounts are visible (false = masked, the default). */
export function useSalaryShown(): [boolean, (next: boolean) => void] {
  const value = React.useSyncExternalStore(subscribe, current, () => false)
  return [value, setSalaryShown]
}

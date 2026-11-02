import type * as React from 'react'

/**
 * Arrow-key handling for a row of options (tabs, segments): Left/Right (and Up/Down) move to the next enabled option and
 * select it, Home/End jump to the ends. `buttons` are the option elements in order; disabled ones are skipped.
 */
export function rovingKeyDown<V>(
  e: React.KeyboardEvent,
  values: readonly V[],
  current: V,
  isDisabled: (v: V) => boolean,
  select: (v: V) => void,
  buttons: (HTMLElement | null)[],
): void {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
  if (!keys.includes(e.key)) return
  e.preventDefault()
  const enabled = values.map((v, i) => ({ v, i })).filter(({ v }) => !isDisabled(v))
  if (!enabled.length) return
  const at = Math.max(0, enabled.findIndex(({ v }) => v === current))
  let next = at
  if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = enabled.length - 1
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (at - 1 + enabled.length) % enabled.length
  else next = (at + 1) % enabled.length
  const target = enabled[next]
  select(target.v)
  buttons[target.i]?.focus()
}

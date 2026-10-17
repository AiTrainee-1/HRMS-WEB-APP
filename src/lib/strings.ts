// Small text helpers shared by the pure lib modules (no imports, so Node's test runner can load them).

/** 'some_new_kind' -> 'Some new kind'; '' for blank input. Used to name a kind / status this app has no wording for. */
export function humanize(value: string): string {
  const words = value.replace(/[_-]+/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

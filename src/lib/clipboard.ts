/**
 * Puts text on the clipboard; true when it worked. Uses the async Clipboard API, which only exists on secure origins
 * (https, localhost), and falls back to a hidden text field + execCommand('copy') for a plain-http intranet address or an
 * older WebView. Never throws: the caller says "copied" or "could not copy" from the answer.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Permission denied or no focus: try the fallback below.
  }
  try {
    const field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(field)
    return ok
  } catch {
    return false
  }
}

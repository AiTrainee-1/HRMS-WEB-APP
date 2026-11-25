// "A new version of the web app is out" (owner 2026-11-25). A Vite build names its entry script after its content
// (/assets/index-<hash>.js) and index.html points at it, so a deployed build differs from the running one exactly when
// the entry script named by a fresh copy of index.html differs from the one this page loaded. Checked every 10 minutes
// and when the tab comes back into view (never more often than once a minute), never in a loop.
// Pure (no DOM, no network): tested in app-version.test.ts; the check itself is components/system/UpdateAvailable.tsx.

/** How often an open tab asks. */
export const VERSION_CHECK_EVERY_MS = 10 * 60_000
/** Coming back to the tab asks at most this often. */
export const VERSION_CHECK_MIN_GAP_MS = 60_000

/** The entry script an index.html loads: the first `<script type="module" src="...">`, as written; null when none. */
export function entryScriptOf(html: string | null | undefined): string | null {
  if (!html) return null
  const tags = html.match(/<script\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    if (!/\btype\s*=\s*["']?module["']?/i.test(tag)) continue
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (src) return src[1]
  }
  return null
}

/** The path part of a script address ("https://x/assets/index-1.js?v=2" -> "/assets/index-1.js"), so the page's own
 *  absolute script URL and index.html's relative one compare equal. */
export function scriptPath(src: string | null | undefined): string | null {
  if (!src) return null
  const noQuery = src.split(/[?#]/)[0]
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/]+(\/.*)$/i.exec(noQuery)
  const path = m ? m[1] : noQuery
  return path.startsWith('/') ? path : `/${path.replace(/^\.\//, '')}`
}

/** True when the fetched index.html loads a different entry script than the running page: a new build is deployed.
 *  Unknown on either side (dev server, a failed fetch, an odd page) is never "new". */
export function isNewBuild(running: string | null | undefined, deployed: string | null | undefined): boolean {
  const a = scriptPath(running)
  const b = scriptPath(deployed)
  if (!a || !b) return false
  // only hashed build output counts: the dev server's /src/main.tsx never prompts
  if (!/\/assets\//.test(a) || !/\/assets\//.test(b)) return false
  return a !== b
}

/** Whether a check is due now (the last one was long enough ago). */
export function checkDue(lastCheckedAt: number | null, now: number, minGapMs = VERSION_CHECK_MIN_GAP_MS): boolean {
  return lastCheckedAt == null || now - lastCheckedAt >= minGapMs
}

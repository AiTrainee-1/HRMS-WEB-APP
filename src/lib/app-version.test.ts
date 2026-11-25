// Run with `npm test`. The "new version" check (lib/app-version.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { checkDue, entryScriptOf, isNewBuild, scriptPath } from './app-version.ts'

const built = (hash: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <script>window.__theme = 'dark'</script>
    <script type="module" crossorigin src="/assets/index-${hash}.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-aa11.js">
    <link rel="stylesheet" crossorigin href="/assets/index-ff00.css">
  </head>
  <body><div id="root"></div></body>
</html>`

describe('reading index.html', () => {
  test('the module entry script, not an inline one or a preload', () => {
    assert.equal(entryScriptOf(built('Ab12Cd')), '/assets/index-Ab12Cd.js')
    assert.equal(entryScriptOf('<script src="/a.js"></script><script src=\'/assets/x.js\' type=module></script>'), '/assets/x.js')
    assert.equal(entryScriptOf('<html></html>'), null)
    assert.equal(entryScriptOf(''), null)
    assert.equal(entryScriptOf(null), null)
  })
  test('script paths compare without host or query', () => {
    assert.equal(scriptPath('https://emp.example.com/assets/index-1.js?v=2'), '/assets/index-1.js')
    assert.equal(scriptPath('/assets/index-1.js'), '/assets/index-1.js')
    assert.equal(scriptPath('assets/index-1.js'), '/assets/index-1.js')
    assert.equal(scriptPath('./assets/index-1.js'), '/assets/index-1.js')
    assert.equal(scriptPath(null), null)
  })
})

describe('is there a new build?', () => {
  test('a different hashed entry script is new; the same one is not', () => {
    assert.equal(isNewBuild('https://emp.example.com/assets/index-Ab12Cd.js', entryScriptOf(built('Zz99'))), true)
    assert.equal(isNewBuild('https://emp.example.com/assets/index-Ab12Cd.js', entryScriptOf(built('Ab12Cd'))), false)
  })
  test('unknown, or the dev server, is never new', () => {
    assert.equal(isNewBuild(null, '/assets/index-1.js'), false)
    assert.equal(isNewBuild('/assets/index-1.js', null), false)
    assert.equal(isNewBuild('/src/main.tsx', '/src/main.tsx?t=2'), false)
    assert.equal(isNewBuild('/src/main.tsx', '/assets/index-1.js'), false)
  })
  test('checks are spaced out', () => {
    assert.equal(checkDue(null, 1000), true)
    assert.equal(checkDue(1000, 30_000), false)
    assert.equal(checkDue(1000, 61_000), true)
    assert.equal(checkDue(1000, 5000, 1000), true)
  })
})

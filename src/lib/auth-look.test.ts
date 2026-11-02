// Run with `npm test`. The sign-in pages' look and small rules (lib/auth-look.ts).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import {
  AUTH_BACKDROP_GRADIENT,
  AUTH_COLORS,
  AUTH_FONTS_HREF,
  AUTH_LIGHTFALL,
  LIGHTFALL_MIN_DPR,
  LIGHTFALL_PIXEL_BUDGET,
  PASSWORD_RULES,
  WEB_APP_VERSION,
  WEB_APP_VERSION_LABEL,
  frameDue,
  hexToRgb,
  lightfallDpr,
  prepColors,
  signInFailureKind,
} from './auth-look.ts'

describe('the version chip', () => {
  test('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }
    assert.equal(WEB_APP_VERSION, pkg.version)
    assert.equal(WEB_APP_VERSION_LABEL, `v${pkg.version}`)
  })
})

describe('the mobile look', () => {
  test('colours and Lightfall settings are the mobile app\'s', () => {
    assert.deepEqual([...AUTH_COLORS.gradient], ['#043B35', '#0B7A6B', '#14B8A6'])
    assert.equal(AUTH_COLORS.pill, '#0A2E2B')
    assert.equal(AUTH_COLORS.pillCircle, '#5EEAD4')
    assert.deepEqual([...AUTH_LIGHTFALL.colors], ['#A7F3D0', '#5EEAD4', '#FFFFFF'])
    assert.equal(AUTH_LIGHTFALL.backgroundColor, '#0F766E')
    assert.equal(AUTH_LIGHTFALL.glow, 0.85)
    assert.equal(AUTH_LIGHTFALL.dpr, 0.7)
    assert.equal(AUTH_LIGHTFALL.fps, 30)
    assert.equal(AUTH_LIGHTFALL.streakCount, 6)
    assert.equal(AUTH_LIGHTFALL.zoom, 2)
  })

  test('the backdrop gradient is the Lightfall page\'s 160 degree emerald', () => {
    assert.equal(AUTH_BACKDROP_GRADIENT, 'linear-gradient(160deg, #043B35 0%, #0B7A6B 55%, #14B8A6 100%)')
  })

  test('fonts come from Google Fonts only, Sora and Manrope at the weights used', () => {
    const url = new URL(AUTH_FONTS_HREF)
    assert.equal(url.origin, 'https://fonts.googleapis.com')
    assert.deepEqual(url.searchParams.getAll('family'), ['Manrope:wght@500;600;700', 'Sora:wght@600;700'])
    assert.equal(url.searchParams.get('display'), 'swap')
  })
})

describe('lightfallDpr', () => {
  test('a phone header keeps the full 0.7', () => {
    assert.equal(lightfallDpr(390, 400), 0.7)
    assert.equal(lightfallDpr(430, 460), 0.7)
  })

  test('a whole desktop page drops just enough to stay inside the pixel budget', () => {
    for (const [w, h] of [[1440, 900], [1920, 1080], [2560, 1440]]) {
      const dpr = lightfallDpr(w, h)
      assert.ok(dpr < 0.7, `${w}x${h} -> ${dpr}`)
      assert.ok(w * h * dpr * dpr <= LIGHTFALL_PIXEL_BUDGET * 1.01, `${w}x${h} draws ${Math.round(w * h * dpr * dpr)}`)
    }
  })

  test('never below the floor, never above the cap', () => {
    assert.equal(lightfallDpr(7680, 4320), LIGHTFALL_MIN_DPR)
    assert.equal(lightfallDpr(100, 100, 0.5), 0.5)
    assert.equal(lightfallDpr(7680, 4320, 0.2), 0.2) // a cap below the floor wins
  })

  test('nonsense sizes or settings get the cap', () => {
    assert.equal(lightfallDpr(0, 400), 0.7)
    assert.equal(lightfallDpr(Number.NaN, 400), 0.7)
    assert.equal(lightfallDpr(-5, 400), 0.7)
    assert.equal(lightfallDpr(400, 400, 0), 0.7)
    assert.equal(lightfallDpr(400, 400, 0.5, 0), 0.5)
  })
})

describe('frameDue', () => {
  test('30 fps on a 60 Hz screen draws every second frame', () => {
    const fps = 30
    let last = 0
    let drawn = 0
    for (let i = 1; i <= 60; i++) {
      const now = i * (1000 / 60)
      if (frameDue(now, last, fps)) {
        drawn++
        last = now
      }
    }
    assert.equal(drawn, 30)
  })

  test('no cap (0, negative, NaN) draws every frame', () => {
    assert.equal(frameDue(1, 0, 0), true)
    assert.equal(frameDue(1, 0, -1), true)
    assert.equal(frameDue(1, 0, Number.NaN), true)
  })
})

describe('colours for the shader', () => {
  test('hexToRgb reads channels as 0..1 and pads broken values', () => {
    assert.deepEqual(hexToRgb('#FFFFFF'), [1, 1, 1])
    assert.deepEqual(hexToRgb('#000000'), [0, 0, 0])
    assert.deepEqual(hexToRgb('#FF'), [1, 0, 0])
    assert.deepEqual(hexToRgb('zzzzzz'), [0, 0, 0])
  })

  test('prepColors fills all 8 slots with the last colour repeated', () => {
    const { arr, count } = prepColors(AUTH_LIGHTFALL.colors)
    assert.equal(count, 3)
    assert.equal(arr.length, 8)
    assert.deepEqual(arr[7], hexToRgb('#FFFFFF'))
    assert.deepEqual(arr[0], hexToRgb('#A7F3D0'))
  })

  test('no colours falls back to the original defaults; more than 8 are cut', () => {
    assert.equal(prepColors([]).count, 3)
    assert.equal(prepColors(null).count, 3)
    assert.equal(prepColors(Array.from({ length: 12 }, () => '#123456')).count, 8)
  })
})

describe('PASSWORD_RULES', () => {
  const met = (p: string) => PASSWORD_RULES.map((r) => r.test(p))

  test('the three advisory checks', () => {
    assert.deepEqual(met(''), [false, false, false])
    assert.deepEqual(met('abcdefgh'), [true, false, false])
    assert.deepEqual(met('Abcdefgh'), [true, true, false])
    assert.deepEqual(met('Abcdefg1'), [true, true, true])
    assert.deepEqual(met('abc!'), [false, false, true])
  })

  test('the labels are the mobile app\'s', () => {
    assert.deepEqual(
      PASSWORD_RULES.map((r) => r.label),
      ['At least 8 characters long', 'Includes uppercase & lowercase letters', 'Contains at least 1 number or special symbol'],
    )
  })
})

describe('signInFailureKind', () => {
  test('an answer below 500 is a rejection', () => {
    for (const status of [400, 401, 403, 404, 429]) assert.equal(signInFailureKind(status), 'rejected')
  })

  test('no answer or a 5xx is the server', () => {
    for (const status of [undefined, null, 'x', Number.NaN, 500, 502, 503, 504]) assert.equal(signInFailureKind(status), 'server')
  })
})

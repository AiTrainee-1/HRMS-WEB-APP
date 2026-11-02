import * as React from 'react'
import { Mesh, Program, Renderer, Triangle } from 'ogl'
import { isLowPowerDevice, useReducedMotion } from '@/components/kit/useReducedMotion'
import {
  AUTH_BACKDROP_GRADIENT,
  AUTH_LIGHTFALL,
  LOW_POWER_LIGHTFALL,
  frameDue,
  hexToRgb,
  lightfallDpr,
  prepColors,
  type LightfallSettings,
} from '@/lib/auth-look'

// Lightfall (React Bits) drawn straight into the page with ogl: the shaders, the colour handling and the frame loop of
// the mobile app's scripts/lightfall/lightfall.entry.js, which is the supplied component without its React wrapper.
// The mobile app needs a WebView (or an iframe on its web preview) to run it; a browser does not.

const VERTEX = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uBgColor;
uniform vec3  uMouseColor;
uniform float uSpeed;
uniform int   uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform float uLightMode;

varying vec2 vUv;

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

vec3 tanhv(vec3 x) {
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

vec2 sceneC(vec2 frag, vec2 r) {
  vec2 P = (frag + frag - r) / r.x;
  float z = 0.0;
  float d = 1e3;
  vec4 O = vec4(0.0);
  for (int k = 0; k < 39; k++) {
    if (d <= 1e-4) break;
    O = z * normalize(vec4(P, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    d = 1.0 - sqrt(length(O * O));
    z += d;
  }
  return vec2(O.x, atan(O.z, O.y));
}

void mainImage(out vec4 o, vec2 C) {
  vec2 r = iResolution.xy;
  vec2 uv0 = (C + C - r) / r.x;
  float T = 0.1 * iTime * uSpeed + 9.0;
  float angRings = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
  vec2 Y = vec2(5e-3, 6.28318530718 / angRings);

  vec2 c0 = sceneC(C, r);
  vec2 cdx = sceneC(C + vec2(1.0, 0.0), r);
  vec2 cdy = sceneC(C + vec2(0.0, 1.0), r);
  vec2 dCx = cdx - c0;
  vec2 dCy = cdy - c0;
  dCx.y -= 6.28318530718 * floor(dCx.y / 6.28318530718 + 0.5);
  dCy.y -= 6.28318530718 * floor(dCy.y / 6.28318530718 + 0.5);
  vec2 fw = abs(dCx) + abs(dCy);
  C = c0;

  vec2 P = vec2(2.0, 1.0) * uv0 - (r / r.x) * vec2(0.0, 1.0);
  vec4 O = uLightMode > 0.5
    ? vec4(0.0)
    : vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(P, P) + 6.0), 0.0);

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mN = (iMouse + iMouse - r) / r.x;
    float md = length(uv0 - mN);
    mGlow = exp(-md * md / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
    O.rgb += uMouseColor * mGlow * 0.25;
  }

  float zr = 5e-4 * uStreakWidth;
  vec2 rr = vec2(max(length(fw), 1e-5));
  float tail = 19.0 / max(uStreakLength, 0.05);

  for (int m = 0; m < 16; m++) {
    if (m >= uStreakCount) break;
    float jf = float(m) + 1.0;
    float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
    Pp -= floor(Pp / Y + 0.5) * Y;
    float h = fract(8663.0 * ic);
    vec3 col = palette(h);
    float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
    weight *= (1.0 + mGlow * 2.0);
    vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
    vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
    O.rgb += dot(sm, vec2(exp(tail * Pp.y), 3.0)) * col * weight;
    C.x += Y.x / 8.0;
  }

  vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
  if (uLightMode > 0.5) {
    float peak = max(colr.r, max(colr.g, colr.b));
    float coverage = smoothstep(0.035, 0.58, peak) * uOpacity;
    vec3 chroma = clamp(colr / max(peak, 1e-4), 0.0, 1.0);
    chroma = pow(chroma, vec3(1.35));
    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));
    chroma /= max(chromaPeak, 1e-4);
    o = vec4(mix(vec3(1.0), chroma, coverage * 0.94), 1.0);
  } else {
    o = vec4(colr, uOpacity);
  }
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`

/**
 * The sign-in header's animated light streaks over the emerald gradient (the mobile app's LightfallView). Purely
 * decorative: hidden from screen readers, never takes a pointer, and it costs as little as it can:
 *  - one canvas, drawn at 0.7 canvas pixels per CSS pixel at most, fewer on a large screen (lightfallDpr), at 30 frames
 *    a second at most (20 fps and 0.5 on a low-power device);
 *  - it stops drawing while the tab is hidden, while it is scrolled out of view, and while `paused` (the page sets that
 *    when the white sheet covers it);
 *  - with "reduce motion" on, or when WebGL is missing, fails or is lost, no canvas at all: the gradient alone (the
 *    element's own background) carries the look;
 *  - everything it made on the GPU is released when it unmounts.
 * The canvas fades in over 700 ms once its first frame is drawn, as the mobile WebView does.
 */
export function Lightfall({
  settings = AUTH_LIGHTFALL,
  paused = false,
  className,
}: {
  settings?: LightfallSettings
  paused?: boolean
  className?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const pausedRef = React.useRef(paused)
  const syncRef = React.useRef<(() => void) | null>(null)
  const reducedMotion = useReducedMotion()
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    pausedRef.current = paused
    syncRef.current?.()
  }, [paused])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || reducedMotion || failed) return

    const lowPower = isLowPowerDevice()
    const dprCap = Math.min(settings.dpr, lowPower ? LOW_POWER_LIGHTFALL.dpr : settings.dpr)
    const fps = lowPower ? Math.min(settings.fps, LOW_POWER_LIGHTFALL.fps) : settings.fps

    let renderer: Renderer
    try {
      renderer = new Renderer({
        dpr: dprCap,
        alpha: true,
        antialias: false,
        depth: false,
        powerPreference: 'low-power',
      })
    } catch {
      // No WebGL at all (ogl throws when the context cannot be made): the gradient stays.
      setFailed(true)
      return
    }
    const gl = renderer.gl
    if (!gl) {
      setFailed(true)
      return
    }
    const canvas = gl.canvas
    canvas.setAttribute('aria-hidden', 'true')
    canvas.setAttribute('tabindex', '-1')
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      display: 'block',
      pointerEvents: 'none',
      // The canvas's black becomes see-through and only the light shows over the gradient.
      mixBlendMode: 'screen',
      opacity: '0',
      transition: 'opacity 700ms ease',
    })
    container.appendChild(canvas)

    const { arr, count } = prepColors(settings.colors)
    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uColor0: { value: arr[0] },
      uColor1: { value: arr[1] },
      uColor2: { value: arr[2] },
      uColor3: { value: arr[3] },
      uColor4: { value: arr[4] },
      uColor5: { value: arr[5] },
      uColor6: { value: arr[6] },
      uColor7: { value: arr[7] },
      uColorCount: { value: count },
      uBgColor: { value: hexToRgb(settings.backgroundColor) },
      uMouseColor: { value: [0, 0, 0] },
      uSpeed: { value: settings.speed },
      uStreakCount: { value: Math.max(1, Math.min(16, Math.round(settings.streakCount))) },
      uStreakWidth: { value: settings.streakWidth },
      uStreakLength: { value: settings.streakLength },
      uGlow: { value: settings.glow },
      uDensity: { value: settings.density },
      uTwinkle: { value: settings.twinkle },
      uZoom: { value: settings.zoom },
      uBgGlow: { value: settings.backgroundGlow },
      uOpacity: { value: settings.opacity },
      uMouseEnabled: { value: 0 },
      uMouseStrength: { value: 0.5 },
      uMouseRadius: { value: 1 },
      uLightMode: { value: 0 },
    }

    let program: Program | null = null
    let geometry: Triangle | null = null
    let mesh: Mesh | null = null
    let ro: ResizeObserver | null = null
    let io: IntersectionObserver | null = null
    let raf = 0
    let disposed = false
    let pageVisible = !document.hidden
    let onScreen = true
    let lastTime = 0
    let lastDraw = 0
    let clock = 0 // animation time in ms; does not advance while stopped, so it carries on where it left off
    let shown = false

    function onVisibility() {
      pageVisible = !document.hidden
      sync()
    }

    function onContextLost(event: Event) {
      event.preventDefault()
      fail()
    }

    function dispose() {
      if (disposed) return
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      syncRef.current = null
      ro?.disconnect()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      program?.remove()
      geometry?.remove()
      // Hand the GPU memory back now rather than whenever the garbage collector gets to it.
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      canvas.remove()
    }

    function fail() {
      dispose()
      setFailed(true)
    }

    function draw() {
      if (!mesh) return
      uniforms.iTime.value = clock * 0.001
      try {
        renderer.render({ scene: mesh })
      } catch {
        fail()
        return
      }
      if (!shown) {
        shown = true
        canvas.style.opacity = '1'
      }
    }

    function loop(t: number) {
      raf = requestAnimationFrame(loop)
      const dt = lastTime ? t - lastTime : 0
      lastTime = t
      clock += Math.min(dt, 100)
      if (!frameDue(t, lastDraw, fps)) return
      lastDraw = t
      draw()
    }

    function sync() {
      if (disposed) return
      const run = pageVisible && onScreen && !pausedRef.current
      if (run && !raf) {
        lastTime = 0
        raf = requestAnimationFrame(loop)
      } else if (!run && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    try {
      program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms })
      // ogl only warns when a shader does not compile; check, so a broken GPU driver falls back to the gradient.
      if (!gl.getProgramParameter(program.program, gl.LINK_STATUS)) throw new Error('Lightfall shader did not link')
      geometry = new Triangle(gl)
      mesh = new Mesh(gl, { geometry, program })
    } catch {
      fail()
      return
    }

    const host = container
    function resize() {
      if (disposed) return
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      renderer.dpr = lightfallDpr(width, height, dprCap)
      renderer.setSize(width, height)
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1]
      // While stopped, keep the still frame right for the new size.
      if (!raf && shown) draw()
    }

    canvas.addEventListener('webglcontextlost', onContextLost)
    resize()
    ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    ro?.observe(container)
    io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1]
            if (entry) onScreen = entry.isIntersecting
            sync()
          })
    io?.observe(container)
    document.addEventListener('visibilitychange', onVisibility)
    syncRef.current = sync

    // The first frame straight away, even if the page starts hidden or paused, so the streaks are there when it shows.
    draw()
    sync()

    return dispose
  }, [reducedMotion, failed, settings])

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={className}
      style={{ background: AUTH_BACKDROP_GRADIENT, isolation: 'isolate' }}
    />
  )
}

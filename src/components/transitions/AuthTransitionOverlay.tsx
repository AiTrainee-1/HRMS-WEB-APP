import * as React from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/components/kit/useReducedMotion'
import { signInTimeline, signOutTimeline, totalMs, welcomeLine, type AuthTransitionRequest, type Point } from '@/lib/auth-transition'
import { authTransitions } from './auth-transitions'
import './transitions.css'

/**
 * The full-screen moments around signing in and out (owner 2026-11-25), mounted once at the app root (App.tsx) so they
 * outlive the page that started them. lib/auth-transition.ts has the rules and timings.
 */
export function AuthTransitionOverlay() {
  const req = React.useSyncExternalStore(authTransitions.subscribe, authTransitions.current, () => null)
  const ids = React.useRef(new WeakMap<object, number>())
  const counter = React.useRef(0)
  if (!req) return null
  let id = ids.current.get(req)
  if (id == null) {
    counter.current += 1
    id = counter.current
    ids.current.set(req, id)
  }
  return req.kind === 'sign-in' ? <SignInPortal key={id} req={req} /> : <SignOutScene key={id} req={req} />
}

/** Runs the cover's phases: `onCovered` once the screen is covered, then "leaving", then closes the overlay. */
function usePhases(enterMs: number, holdMs: number, exitMs: number, onCovered: () => void): 'enter' | 'hold' | 'leave' {
  const [phase, setPhase] = React.useState<'enter' | 'hold' | 'leave'>('enter')
  const covered = React.useRef(onCovered)
  React.useEffect(() => {
    const t1 = window.setTimeout(() => {
      setPhase('hold')
      covered.current()
    }, enterMs)
    const t2 = window.setTimeout(() => setPhase('leave'), enterMs + holdMs)
    const t3 = window.setTimeout(() => authTransitions.close(), enterMs + holdMs + exitMs)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [enterMs, holdMs, exitMs])
  return phase
}

// ── sign-in: a portal opens from the button ─────────────────────────────────

/** A steady pseudo-random sequence (the same particles every time). */
function seeded(seed: number) {
  let x = seed
  return () => {
    x = (x * 9301 + 49297) % 233280
    return x / 233280
  }
}

const SILK = ['#5B8BFF', '#A78BFA', '#FBBF24', '#5EEAD4', '#FFFFFF']

interface Particle {
  dx: number
  dy: number
  size: number
  delay: number
  duration: number
  color: string
  blur: number
}

function makeParticles(count: number): Particle[] {
  const rand = seeded(11)
  return Array.from({ length: count }, (_, i) => {
    // depth: 0 = far (small, slow, sharp), 1 = near (big, fast, out of focus)
    const depth = rand()
    const angle = rand() * Math.PI * 2
    const dist = 160 + depth * 520 + rand() * 120
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 2 + depth * 7,
      delay: 0.12 + rand() * 0.5,
      duration: 1.1 + (1 - depth) * 0.7,
      color: SILK[i % SILK.length],
      blur: depth > 0.72 ? 2.5 : depth > 0.45 ? 1 : 0,
    }
  })
}

/** Dust scattered over the screen, for the two depth layers that drift towards the viewer. */
function makeDust(count: number, seed: number): { x: number; y: number; r: number; o: number }[] {
  const rand = seeded(seed)
  return Array.from({ length: count }, () => ({ x: rand() * 100, y: rand() * 100, r: 0.6 + rand() * 1.4, o: 0.25 + rand() * 0.6 }))
}
const DUST_FAR = makeDust(46, 3)
const DUST_NEAR = makeDust(18, 29)

/** A layer of dust that slowly comes towards the viewer: far layers move little, near ones more (depth). */
function DustLayer({ dots, scale, blur, size, delay }: { dots: typeof DUST_FAR; scale: number; blur: number; size: number; delay: number }) {
  return (
    <motion.svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ filter: blur ? `blur(${blur}px)` : undefined }}
      initial={{ opacity: 0, scale: 1 }}
      animate={{ opacity: 1, scale }}
      transition={{ opacity: { delay, duration: 0.5 }, scale: { delay, duration: 2.2, ease: 'linear' } }}
    >
      {dots.map((d, i) => (
        <ellipse key={i} cx={d.x} cy={d.y} rx={(d.r * size) / 10} ry={(d.r * size * 1.5) / 10} fill="#E0F2FE" opacity={d.o} />
      ))}
    </motion.svg>
  )
}

function SignInPortal({ req }: { req: Extract<AuthTransitionRequest, { kind: 'sign-in' }> }) {
  const reduced = useReducedMotion()
  const t = signInTimeline(reduced)
  const phase = usePhases(t.enterMs, t.holdMs, t.exitMs, req.onCovered)
  const [view] = React.useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const origin: Point = req.origin ?? { x: view.w / 2, y: view.h * 0.72 }
  // the portal must reach the farthest corner
  const radius = Math.ceil(
    Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(view.w - origin.x, origin.y),
      Math.hypot(origin.x, view.h - origin.y),
      Math.hypot(view.w - origin.x, view.h - origin.y),
    ) + 24,
  )
  const particles = React.useMemo(() => makeParticles(reduced ? 0 : 42), [reduced])
  const line = welcomeLine(req.firstName)
  const leaving = phase === 'leave'
  const enterS = t.enterMs / 1000

  const backdrop = `radial-gradient(120% 120% at ${origin.x}px ${origin.y}px, #0f766e 0%, #1d4ed8 34%, #1e1b4b 62%, #050914 100%)`

  return (
    <motion.div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{ pointerEvents: leaving ? 'none' : 'auto' }}
      initial={false}
      animate={leaving ? { opacity: 0, scale: reduced ? 1 : 1.06 } : { opacity: 1, scale: 1 }}
      transition={{ duration: t.exitMs / 1000, ease: [0.65, 0, 0.35, 1] }}
    >
      {reduced ? (
        <motion.div className="absolute inset-0" style={{ background: backdrop }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: enterS }} />
      ) : (
        <motion.div
          className="absolute inset-0"
          style={{ background: backdrop }}
          initial={{ clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` }}
          animate={{ clipPath: `circle(${radius}px at ${origin.x}px ${origin.y}px)` }}
          transition={{ duration: enterS, ease: [0.7, 0, 0.2, 1] }}
        />
      )}

      {!reduced && (
        <>
          {/* depth: far dust drifts a little, near dust more and out of focus */}
          <DustLayer dots={DUST_FAR} scale={1.12} blur={0} size={1} delay={0.25} />
          <DustLayer dots={DUST_NEAR} scale={1.45} blur={1.6} size={2.4} delay={0.4} />
          {/* the portal's rim, racing out ahead of the fill */}
          <motion.span
            aria-hidden="true"
            className="absolute rounded-full"
            style={{
              left: origin.x,
              top: origin.y,
              width: radius * 2,
              height: radius * 2,
              marginLeft: -radius,
              marginTop: -radius,
              border: '3px solid rgba(94,234,212,0.85)',
              boxShadow: '0 0 40px 8px rgba(94,234,212,0.45), inset 0 0 40px 6px rgba(91,139,255,0.35)',
            }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: [1, 1, 0] }}
            transition={{ duration: enterS * 1.05, ease: [0.7, 0, 0.2, 1] }}
          />
          {/* rings at different depths: near ones thick, fast and soft; far ones thin and sharp */}
          {[
            { delay: 0.32, size: 0.36, width: 2, blur: 0, color: 'rgba(251,191,36,0.75)', dur: 1.25 },
            { delay: 0.44, size: 0.62, width: 4, blur: 1.5, color: 'rgba(167,139,250,0.65)', dur: 1.05 },
            { delay: 0.58, size: 1.0, width: 9, blur: 5, color: 'rgba(91,139,255,0.55)', dur: 0.9 },
          ].map((r, i) => {
            const d = Math.min(view.w, view.h) * r.size
            return (
              <motion.span
                key={i}
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 rounded-full"
                style={{ width: d, height: d, marginLeft: -d / 2, marginTop: -d / 2, border: `${r.width}px solid ${r.color}`, filter: r.blur ? `blur(${r.blur}px)` : undefined }}
                initial={{ scale: 0.2, opacity: 0 }}
                animate={{ scale: [0.2, 1.15, 1.6], opacity: [0, 1, 0] }}
                transition={{ delay: r.delay, duration: r.dur, ease: 'easeOut' }}
              />
            )
          })}
          {/* the glow behind the words */}
          <motion.span
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(94,234,212,0.35) 0%, rgba(91,139,255,0.18) 40%, transparent 70%)' }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          {/* particles flying out from the button, with depth */}
          {particles.map((p, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              className="absolute rounded-full"
              style={{
                left: origin.x,
                top: origin.y,
                width: p.size,
                height: p.size,
                marginLeft: -p.size / 2,
                marginTop: -p.size / 2,
                background: p.color,
                boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                filter: p.blur ? `blur(${p.blur}px)` : undefined,
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
              animate={{ x: p.dx, y: p.dy, opacity: [0, 1, 0], scale: [0.4, 1, 0.8] }}
              transition={{ delay: p.delay, duration: p.duration, ease: [0.16, 1, 0.3, 1] }}
            />
          ))}
        </>
      )}

      {/* the welcome, revealed */}
      <div className="absolute inset-0 grid place-items-center px-6 text-center" role="status" aria-live="polite">
        <div>
          <motion.p
            className="font-display text-[clamp(30px,6vw,56px)] leading-tight font-semibold text-white [text-shadow:0_6px_30px_rgba(2,6,23,0.55)]"
            // a left-to-right wipe; the insets reach past the text so its glow is never cut into a box
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, clipPath: 'inset(-40% 100% -40% -10%)', filter: 'blur(6px)' }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, clipPath: 'inset(-40% -10% -40% -10%)', filter: 'blur(0px)' }}
            transition={{ delay: reduced ? 0.05 : 0.5, duration: reduced ? 0.2 : 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            {line}
          </motion.p>
          <motion.span
            aria-hidden="true"
            className="mx-auto mt-3 block h-[3px] w-40 origin-left rounded-full"
            style={{ background: 'linear-gradient(90deg, #5EEAD4, #5B8BFF 40%, #A78BFA 70%, #FBBF24)' }}
            initial={reduced ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: reduced ? 0.05 : 0.8, duration: reduced ? 0.2 : 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.p
            className="mt-3 text-[14px] font-medium tracking-wide text-white/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0.05 : 0.95, duration: 0.4 }}
          >
            Opening your dashboard…
          </motion.p>
        </div>
      </div>
    </motion.div>
  )
}

// ── sign-out: out of the door, and the door closes ──────────────────────────

const INK = 'var(--foreground)'

function SignOutScene({ req }: { req: Extract<AuthTransitionRequest, { kind: 'sign-out' }> }) {
  const reduced = useReducedMotion()
  const t = signOutTimeline(reduced)
  const phase = usePhases(t.enterMs, t.holdMs, t.exitMs, req.onCovered)
  const leaving = phase === 'leave'
  const start = t.enterMs / 1000
  const total = totalMs(t) / 1000
  // seconds from the start: out of the doorway and away; the door shuts once they are clear of it; the light goes out
  const walkDelay = start + 0.05
  const walkDur = total - t.exitMs / 1000 + 0.1 - walkDelay
  const doorDelay = start + 0.72
  const timing = {
    '--so-walk-delay': `${walkDelay}s`,
    '--so-walk-dur': `${walkDur}s`,
    '--so-door-delay': `${doorDelay}s`,
    '--so-light-delay': `${doorDelay + 0.5}s`,
  } as React.CSSProperties

  return (
    <motion.div
      className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-background"
      style={{
        pointerEvents: leaving ? 'none' : 'auto',
        backgroundImage: 'radial-gradient(900px 520px at 50% 40%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 70%)',
        ...timing,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: (leaving ? t.exitMs : t.enterMs) / 1000, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-[min(440px,88vw)] flex-col items-center">
        <svg viewBox="0 0 360 250" className="w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="so-inside" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F59E0B" stopOpacity={0.15} />
              <stop offset="1" stopColor="#92400E" stopOpacity={0.45} />
            </linearGradient>
          </defs>
          {/* ground and the path away */}
          <ellipse cx={180} cy={226} rx={170} ry={10} fill="var(--foreground)" opacity={0.08} />
          <path d="M140 224 Q230 232 350 226" stroke="var(--foreground)" strokeOpacity={0.18} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="2 9" />
          {/* the little home */}
          <rect x={186} y={52} width={18} height={40} fill="var(--muted-foreground)" stroke={INK} strokeWidth={3} />
          <rect x={60} y={110} width={160} height={112} rx={4} fill="var(--card)" stroke={INK} strokeWidth={3.5} />
          <path d="M44 118 L140 46 L236 118 Z" fill="var(--primary)" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
          <path d="M70 108 L140 56 L210 108" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={3} fill="none" strokeLinecap="round" />
          {/* window: warm light that goes out once the door shuts */}
          <rect x={164} y={134} width={36} height={32} rx={3} fill="#1E293B" stroke={INK} strokeWidth={3} />
          <rect x={167} y={137} width={30} height={26} fill="#FCD34D" opacity={reduced ? 0.3 : 0.95} className={reduced ? undefined : 'so-light'} />
          <path d="M182 134 V166 M164 150 H200" stroke={INK} strokeWidth={2.5} />
          {/* doorway: the warm inside, seen while the door is open */}
          <rect x={92} y={150} width={44} height={72} fill="#FDE68A" stroke={INK} strokeWidth={3} />
          <rect x={92} y={150} width={44} height={72} fill="url(#so-inside)" />

          {/* the walker: steps out of the doorway and walks away along the path (in front of the house) */}
          {!reduced && (
            <g className="so-walker">
              <Walker />
            </g>
          )}

          {/* the door, hinged on the left: open (seen edge-on) -> shut, with a little settle */}
          <g className={reduced ? undefined : 'so-door'}>
            <rect x={92} y={150} width={44} height={72} fill="color-mix(in srgb, var(--primary) 55%, #7c2d12)" stroke={INK} strokeWidth={3} />
            <rect x={99} y={158} width={30} height={22} rx={2} fill="none" stroke={INK} strokeOpacity={0.45} strokeWidth={2} />
            <rect x={99} y={188} width={30} height={26} rx={2} fill="none" stroke={INK} strokeOpacity={0.45} strokeWidth={2} />
            <circle cx={128} cy={189} r={3} fill="#FBBF24" stroke={INK} strokeWidth={1.5} />
          </g>
          {/* door step */}
          <rect x={86} y={220} width={56} height={6} rx={2} fill="var(--muted-foreground)" stroke={INK} strokeWidth={2} />
        </svg>
        {/* No words on screen (owner 2026-11-25: the door says it); screen readers still hear it. */}
        <p className="sr-only" role="status">
          You are signed out.
        </p>
      </div>
    </motion.div>
  )
}

/** A small walking character (drawn about the origin, feet at y = 0): legs and arms swing, the body bobs. */
function Walker() {
  return (
    <g>
      <ellipse cx={0} cy={2} rx={11} ry={2.6} fill="var(--foreground)" opacity={0.15} />
      {/* legs */}
      <path className="so-limb so-limb--back" d="M0 -20 L0 -2" stroke="#334155" strokeWidth={5.5} strokeLinecap="round" />
      <path className="so-limb" d="M0 -20 L0 -2" stroke="#1B1B3A" strokeWidth={5.5} strokeLinecap="round" />
      <g className="so-bob">
        <path className="so-limb" d="M0 -36 L0 -22" stroke="#FFE4D2" strokeWidth={4.5} strokeLinecap="round" />
        <rect x={-8} y={-42} width={16} height={24} rx={6} fill="var(--primary)" stroke="#1B1B3A" strokeWidth={2.2} />
        {/* a bag on the shoulder: off home */}
        <path d="M-6 -40 L6 -24" stroke="#1B1B3A" strokeWidth={1.6} />
        <rect x={4} y={-28} width={9} height={8} rx={2} fill="#F59E0B" stroke="#1B1B3A" strokeWidth={1.6} />
        <path className="so-limb so-limb--back" d="M0 -36 L0 -22" stroke="#FFE4D2" strokeWidth={4.5} strokeLinecap="round" />
        {/* head, facing the way they walk */}
        <circle cx={0} cy={-52} r={10} fill="#FFE4D2" stroke="#1B1B3A" strokeWidth={2.2} />
        <path d="M-10 -53 C-10 -63 -3 -64 0 -64 C6 -64 11 -60 10 -53 L5 -57 L1 -54 L-3 -58 L-7 -54 Z" fill="#2B59D9" stroke="#1B1B3A" strokeWidth={1.8} strokeLinejoin="round" />
        <circle cx={4} cy={-51} r={1.4} fill="#1B1B3A" />
        <path d="M3 -46 Q6 -45 7 -47" stroke="#1B1B3A" strokeWidth={1.3} fill="none" strokeLinecap="round" />
      </g>
    </g>
  )
}

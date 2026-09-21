import * as React from 'react'
import GradientWaves from './GradientWaves'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  React.useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Full-screen background for the signed-out pages (login, set password):
 * the React Bits <GradientWaves /> with its demo settings, on the demo's
 * deep-violet backdrop. Same in light and dark theme. If WebGL isn't
 * available the waves don't draw and the dark gradient carries the look.
 */
export function AuthBackground() {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% 0%, #1a0b3d 0%, #060010 65%)' }}
    >
      <GradientWaves
        horizonColor="#5227FF"
        waveColor="#FF9FFC"
        crestColor="#FFFFFF"
        speed={reducedMotion ? 0.05 : 0.4}
        amplitude={2.5}
        waveScale={0.6}
        waveRatio={0.9}
        swell={35}
        turbulence={20}
        tilt={1.11}
        zoom={1.0}
        height={5.5}
        fogDepth={15}
        detail="medium"
        brightness={1.0}
        opacity={1.0}
        mouseInteraction={!reducedMotion}
        parallaxStrength={0.5}
        grain
        grainIntensity={0.05}
      />
    </div>
  )
}

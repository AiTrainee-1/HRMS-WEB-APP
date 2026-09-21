import { cn } from '@/lib/utils'

/**
 * The app-wide loading indicator: a tile that tumbles and lands on its
 * shadow. Styles live in index.css (`.app-loader`). It shrinks by itself
 * inside short boxes (see `.loader-box` there), so any container can host it.
 */
export function Loader({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('app-loader', className)}>
      <span className="sr-only">{label}…</span>
    </span>
  )
}

/** Centred loader for a whole page or route while it loads. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] w-full place-items-center">
      <Loader label={label} />
    </div>
  )
}

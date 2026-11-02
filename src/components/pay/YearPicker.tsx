import { SegmentedControl } from '@/components/kit'
import { cn } from '@/lib/utils'

/**
 * The year chips of the Salary and Compensation pages: one springing pill per year the server has (newest first). The
 * track scrolls sideways on a phone when there are many years.
 * Phones (< 768px): the mobile app's year chips instead - separate white pills with a hairline border, the chosen year
 * filled sapphire - and only when there is more than one year to pick from (kit/MOBILE.md).
 */
export function YearPicker({
  years,
  value,
  onChange,
  ariaLabel = 'Year',
  className,
}: {
  years: readonly number[]
  value: number
  onChange: (year: number) => void
  ariaLabel?: string
  className?: string
}) {
  if (years.length === 0) return null
  return (
    <>
      <SegmentedControl
        ariaLabel={ariaLabel}
        size="sm"
        value={String(value)}
        onChange={(v) => onChange(Number(v))}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        className={cn(className, 'max-md:hidden')}
      />
      {years.length > 1 && (
        <div role="radiogroup" aria-label={ariaLabel} className="hidden max-md:flex max-md:flex-wrap max-md:gap-2">
          {years.map((y) => {
            const active = y === value
            return (
              <button
                key={y}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(y)}
                className={cn(
                  'focus-ring max-md:min-h-9 max-md:rounded-full max-md:border max-md:px-3.5 max-md:text-[12.5px] max-md:font-semibold max-md:tabular-nums max-md:transition-colors',
                  active
                    ? 'max-md:border-primary max-md:bg-primary max-md:text-primary-foreground'
                    : 'max-md:border-border max-md:bg-card max-md:text-secondary-foreground',
                )}
              >
                {y}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

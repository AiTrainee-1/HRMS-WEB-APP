import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function MonthYearPicker({
  month,
  year,
  onChange,
  disableFuture = true,
}: {
  month: number
  year: number
  onChange: (month: number, year: number) => void
  disableFuture?: boolean
}) {
  const now = new Date()
  const isCurrentOrFuture = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)

  function shift(delta: number) {
    let m = month + delta
    let y = year
    if (m > 12) {
      m = 1
      y += 1
    } else if (m < 1) {
      m = 12
      y -= 1
    }
    onChange(m, y)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Previous month">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-semibold">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => shift(1)}
        disabled={disableFuture && isCurrentOrFuture}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

import type { CalMonth } from '@/lib/month-switch'

/**
 * The props MonthYearPicker (desktop) and PhoneMonthBar (phones) take, from a page's month ({ year, month }): the
 * records pages use the Attendance page's two month controls as they are (owner 2026-11-02: "the same monthly filter").
 * `min` / `max`: how far the arrows go (default: back without limit, forward to the current month).
 */
export function monthPickerProps(month: CalMonth, setMonth: (m: CalMonth) => void, min?: CalMonth | null, max?: CalMonth | null) {
  return {
    month: month.month,
    year: month.year,
    onChange: (m: number, y: number) => setMonth({ year: y, month: m }),
    min: min ?? null,
    max: max ?? null,
  }
}

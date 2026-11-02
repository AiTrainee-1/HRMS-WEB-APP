import * as React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PHONE_FIELD_LABEL } from '@/components/requests/phone'
import { cn } from '@/lib/utils'

function parse24(value: string): { hour12: string; minute: string; meridiem: 'AM' | 'PM' } {
  if (!value) return { hour12: '', minute: '', meridiem: 'AM' }
  const [hStr, mStr] = value.split(':')
  const h24 = parseInt(hStr, 10)
  const meridiem: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
  let hour12 = h24 % 12
  if (hour12 === 0) hour12 = 12
  return { hour12: String(hour12), minute: (mStr ?? '00').padStart(2, '0'), meridiem }
}

function to24(hour12: string, minute: string, meridiem: 'AM' | 'PM'): string {
  let h = parseInt(hour12, 10)
  if (meridiem === 'AM') {
    if (h === 12) h = 0
  } else if (h !== 12) {
    h += 12
  }
  return `${String(h).padStart(2, '0')}:${minute}`
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

/** 12-hour AM/PM time picker (hour / minute / meridiem selects) that stores
 * and emits a 24-hour "HH:MM" string — the wire format every request
 * endpoint already expects. Only the picker UI is 12-hour; nothing about
 * what gets sent to the backend changes.
 * Phones: the app's field label, and the three selects share the row as 48px fields (hour and minute wider). */
export function TimePickerField({
  label, value, onChange, disabled,
}: {
  label?: React.ReactNode
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { hour12, minute, meridiem } = parse24(value)
  const labelId = React.useId()

  const set = (nextHour: string, nextMinute: string, nextMeridiem: 'AM' | 'PM') => {
    if (!nextHour || !nextMinute) return
    onChange(to24(nextHour, nextMinute, nextMeridiem))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span id={labelId} className={cn('text-sm leading-none font-medium select-none', PHONE_FIELD_LABEL)}>{label}</span>}
      <div className="flex gap-1.5 max-md:gap-2" role="group" aria-labelledby={label ? labelId : undefined}>
        <Select value={hour12} onValueChange={(h) => set(h, minute || '00', meridiem)} disabled={disabled}>
          <SelectTrigger className="w-16 max-md:w-auto max-md:flex-1" aria-label="Hour"><SelectValue placeholder="HH" /></SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={minute} onValueChange={(m) => set(hour12 || '12', m, meridiem)} disabled={disabled}>
          <SelectTrigger className="w-16 max-md:w-auto max-md:flex-1" aria-label="Minute"><SelectValue placeholder="MM" /></SelectTrigger>
          <SelectContent>
            {MINUTES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={meridiem} onValueChange={(v) => set(hour12 || '12', minute || '00', v as 'AM' | 'PM')} disabled={disabled}>
          <SelectTrigger className="w-[68px] max-md:w-[84px]" aria-label="AM or PM"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

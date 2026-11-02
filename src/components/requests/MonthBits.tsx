import { ChevronRight, Hourglass } from 'lucide-react'
import { monthLabel, type CalMonth } from '@/lib/month-switch'

/** The note's words: "1 request waiting in October 2026" / "3 requests waiting in other months (latest October 2026)". */
function waitingElsewhereText(count: number, month: CalMonth): string {
  return count === 1 ? `1 request waiting in ${monthLabel(month)}` : `${count} requests waiting in other months (latest ${monthLabel(month)})`
}

/**
 * Under the four count cards of a month-scoped list (mirrors the mobile app's WaitingElsewhereNote): requests still
 * waiting for a decision that belong to OTHER months than the one on screen - a request for the 31st still pending on
 * the 1st would otherwise drop out of the list when the month turns. The whole line is a button: `onShow` opens that
 * month (the page also opens Waiting). Renders nothing when there are none.
 */
export function WaitingElsewhereNote({ count, month, onShow }: { count: number; month: CalMonth | null; onShow: (m: CalMonth) => void }) {
  if (count <= 0 || !month) return null
  return (
    <button
      type="button"
      onClick={() => onShow(month)}
      className="focus-ring flex w-full items-center gap-2 rounded-xl border border-waiting-border bg-waiting-bg px-3.5 py-2 text-left text-[13px] text-waiting max-md:min-h-11 max-md:border-0 max-md:px-3 max-md:py-[9px] max-md:text-[12px] max-md:active:opacity-85"
    >
      <Hourglass className="size-4 shrink-0 max-md:size-[15px]" aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-5 font-medium max-md:leading-4 max-md:font-semibold max-md:text-secondary-foreground">
        {waitingElsewhereText(count, month)}
      </span>
      <span className="font-semibold max-md:font-[800] max-md:text-primary">Show</span>
      <ChevronRight className="size-4 shrink-0 max-md:text-primary" aria-hidden="true" />
    </button>
  )
}

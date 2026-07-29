import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { AttendanceDay } from '@/types'
import { format, parseISO } from 'date-fns'

export function DayDetailPanel({ day, onClose }: { day: AttendanceDay | null; onClose: () => void }) {
  return (
    <Dialog open={!!day} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>{format(parseISO(day.date), 'EEEE, MMMM d, yyyy')}</DialogTitle>
              <DialogDescription className="flex items-center gap-2">
                <span className="capitalize">{day.status.replace('_', ' ')}</span>
                {day.isLate && (day.status === 'present' || day.status === 'half_shift') && (
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                    Late Arrival
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {day.status === 'no_record' || day.status === 'future' || !day.firstPunch ? (
              <p className="text-sm text-muted-foreground">No attendance record for this day.</p>
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">First Punch In</span>
                  <span className="font-medium">{day.firstPunch}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Punch Out</span>
                  <span className="font-medium">{day.lastPunch ?? '—'}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Punches</span>
                  <span className="font-medium">{day.totalPunches ?? 0}</span>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

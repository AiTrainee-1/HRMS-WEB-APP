import { useLocation } from 'wouter'
import { MapPin, Clock, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useGeoPunchStatus } from '@/hooks/useGeoAttendance'

/**
 * Compact status banner on the Attendance page — the actual punch
 * interaction (location permission, Office Geo Punch vs On-Duty, the
 * 4-slot timeline, camera capture) lives on its own dedicated page
 * (/employee/attendance-request), which gives it room for a proper
 * step-by-step wizard instead of squeezing it into this card.
 */
export function GeoPunchCard() {
  const [, navigate] = useLocation()
  const { data: status, isLoading } = useGeoPunchStatus()
  const nextNum = status?.nextPunchNumber
  const nextType = status?.nextPunchType
  const hasPending = (status?.onDutyRequests ?? []).some(
    (r) => r.status === 'pending_hod' || r.status === 'pending_hr',
  )

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="size-4 text-primary" />
          Location Punch
        </div>
        {isLoading ? (
          <span className="text-sm text-muted-foreground">Loading…</span>
        ) : hasPending ? (
          <span className="flex items-center gap-1.5 text-sm text-warning-foreground">
            <Clock className="size-3.5" /> On-Duty request awaiting approval
          </span>
        ) : nextNum == null ? (
          <span className="text-sm text-muted-foreground">All 4 punches recorded for today.</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Next: Punch {nextNum} · {nextType === 'IN' ? 'Check-In' : 'Check-Out'}
          </span>
        )}
        <Button
          variant="gradient"
          size="sm"
          className="ml-auto gap-2"
          onClick={() => navigate('/employee/attendance-request')}
        >
          <MapPin className="size-3.5" />
          {nextType === 'OUT' ? 'Punch Out' : 'Punch In'}
          <ChevronRight className="size-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
}

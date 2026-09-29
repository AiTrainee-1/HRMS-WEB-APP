import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { resolveDeductionPool } from '@/lib/deductions'
import type { DeductionPreview } from '@/types'

function Stat({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`text-xl font-bold ${alert ? 'text-destructive' : ''}`}>{value}</p>
    </div>
  )
}

/** The monthly late-deduction preview, shared by My Shift and the Permission
 * page. Same numbers HR sees on their Report Log. With a current backend it
 * shows the whole pool (late-ins + early-outs + excess permissions); with an
 * older one, or for a Production employee, the shorter classic view. */
export function LateDeductionCard({
  deductions, monthlyLimit, lateCount,
}: {
  deductions: DeductionPreview
  /** Allowed-permission cap from a permission row, used only if the stats carry none. */
  monthlyLimit?: number
  /** Total late days; shown only when there is no late-in / early-out split. */
  lateCount?: number
}) {
  const { freeAllowance, permissionCap, breakdown, showLateIn, showEarlyOut } = resolveDeductionPool(deductions, monthlyLimit)
  // Only name the kinds of occurrence the company actually checks.
  const kinds = [showLateIn && 'morning late-ins', showEarlyOut && 'evening early-outs', 'Overdue / Excess permissions']
    .filter((k): k is string => !!k)
  const kindList = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : kinds[0]
  const money = deductions.salaryDeductionAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const outcome = (
    <>
      <Stat label="Billable" value={deductions.billableLateCount} alert={deductions.billableLateCount > 0} />
      <Stat label="Shift Deductions" value={deductions.shiftDeductions} alert={deductions.shiftDeductions > 0} />
      <Stat label="Salary Impact" value={`₹${money}`} alert={deductions.salaryDeductionAmount > 0} />
    </>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lateness & Deductions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {breakdown ? (
          <>
            <p className="text-xs text-muted-foreground">
              Your monthly pool counts {kindList} together. The first {freeAllowance} each month are free; every
              one after that is billable and can cost a shift deduction from your salary.
            </p>
            <p className="text-xs text-muted-foreground">
              Only your first {permissionCap} approved permissions each month are Allowed. Any beyond that are
              Overdue / Excess: they do not protect the day and are counted here.
              {' '}These figures are what counts toward deductions, so they can be lower than the days flagged late
              or early on your attendance: a day that also has an Excess permission on the same side is counted
              once, as that permission, and non-working days are left out.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {showLateIn && <Stat label="Late-Ins" value={breakdown.lateIn} />}
              {showEarlyOut && <Stat label="Early-Outs" value={breakdown.earlyOut} />}
              <Stat label="Excess Permissions" value={breakdown.excess} />
              <Stat label="Free Allowance Used" value={`${deductions.permissionsUsed}/${freeAllowance}`} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{outcome}</div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              You get {freeAllowance} free lates/permissions per month (combined). Every 3 beyond that costs a
              ¼ shift deduction from salary.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {lateCount != null && <Stat label="Late Count" value={lateCount} />}
              <Stat label="Free Allowance Used" value={`${deductions.permissionsUsed}/${freeAllowance}`} />
              {outcome}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

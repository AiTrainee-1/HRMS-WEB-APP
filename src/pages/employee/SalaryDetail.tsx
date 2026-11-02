import * as React from 'react'
import { Link, useParams } from 'wouter'
import { toast } from 'sonner'
import { ArrowLeft, ChartColumnDecreasing, Coins, Download, Loader2, ReceiptText, Scale, TrendingDown, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, GlassCard, KpiTile, PageHero, PageShell, SectionHeader, SkeletonBlock, SkeletonList, StatusPill } from '@/components/kit'
import {
  AttendanceCard,
  ChangedByHrCard,
  PhoneDeductionsCard,
  PhoneEarningsCard,
  PhoneNetHero,
  PhoneVerifyNote,
  SlipWaterfall,
} from '@/components/pay/SlipParts'
import { PhoneCardTitle } from '@/components/pay/PhoneParts'
import { paySalaryApi } from '@/api/pay-salary'
import { ApiError } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useSalaryBreakdown } from '@/hooks/usePaySalary'
import { formatINR } from '@/lib/money'
import { cycleText, slipPdfFileName } from '@/lib/salary-insights'

const rupees = (n: number) => formatINR(Math.round(n))

/** Saves a blob under `name` (a fresh object URL each time, so downloading twice works). */
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked later: some browsers still read the URL after click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export default function SalaryDetail() {
  const { id } = useParams<{ id: string }>()
  const q = useSalaryBreakdown(id)
  const p = q.data
  // The signed-in person's name for the phone view's identity row (from the session: no extra request).
  const { user } = useAuth()
  const [downloading, setDownloading] = React.useState(false)

  async function download() {
    if (!id || downloading) return
    setDownloading(true)
    try {
      const blob = await paySalaryApi.pdf(id)
      saveBlob(blob, slipPdfFileName(p ? { id, month: p.month, year: p.year, slipNumber: p.slipNumber } : { id }))
      toast.success('Salary slip downloaded')
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined
      toast.error(
        status === undefined
          ? 'Could not reach the server. Check your connection and try again.'
          : status === 404
            ? 'This salary slip PDF was not found.'
            : 'Could not download this salary slip. Please try again.',
      )
    } finally {
      setDownloading(false)
    }
  }

  // The server's own 404 ({ error: "Salary slip not found" }) means not this employee's slip; a bare 404 is an older
  // server without the breakdown route (the PDF still works there).
  const notFound =
    q.error instanceof ApiError &&
    q.error.status === 404 &&
    typeof (q.error.data as { error?: unknown } | undefined)?.error === 'string'
  const cycle = p ? cycleText(p) : null
  const production = p?.kind === 'production'

  return (
    <PageShell>
      <PageHero
        icon={<ReceiptText />}
        title={p?.period.label || 'Salary slip'}
        subtitle={
          p
            ? `${cycle ? `${cycle}. ` : ''}How this pay was worked out, line by line.`
            : 'How this pay was worked out, line by line.'
        }
        actions={
          <>
            <Button asChild variant="ghost" className="min-h-11 max-md:h-9 max-md:min-h-9 max-md:bg-muted max-md:px-3.5 max-md:text-[13px] sm:min-h-9">
              <Link href="/employee/salary">
                <ArrowLeft aria-hidden="true" /> All slips
              </Link>
            </Button>
            {/* Phones: the download is the full-width button at the end of the slip (as in the app). */}
            {!notFound && (
              <Button onClick={download} disabled={downloading} className="min-h-11 max-md:hidden sm:min-h-9">
                {downloading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                {downloading ? 'Downloading…' : 'Download PDF'}
              </Button>
            )}
          </>
        }
        kpis={
          p ? (
            <>
              <PhoneNetHero period={p} />
              <KpiTile className="max-md:hidden" label="Final payable" value={p.netPayable} format={rupees} icon={Wallet} tone="emerald" hint="what this slip pays you" />
              <KpiTile
                className="max-md:hidden"
                label={production ? 'Pay for shifts' : 'Salary earned'}
                value={p.earnedGross}
                format={rupees}
                icon={Coins}
                tone="sapphire"
                hint={p.allocated != null ? `of ${rupees(p.allocated)} allocated` : production ? 'for the shifts you worked' : undefined}
              />
              {production ? (
                <KpiTile
                  className="max-md:hidden"
                  label="Late deduction"
                  value={p.lateDeduction ?? '—'}
                  format={rupees}
                  icon={TrendingDown}
                  tone="rose"
                  hint={p.lateDeduction == null ? 'not recorded' : undefined}
                />
              ) : (
                <KpiTile
                  className="max-md:hidden"
                  label="Lost to attendance"
                  value={p.attendanceLoss ?? '—'}
                  format={rupees}
                  icon={TrendingDown}
                  tone="rose"
                  hint={p.attendanceLoss == null ? 'not recorded on this slip' : 'absent days, late and permission'}
                />
              )}
              <KpiTile className="max-md:hidden" label="Deductions" value={p.totalDeductions} format={rupees} icon={Scale} tone="amber" hint="PF, ESI, tax, advance and others" />
            </>
          ) : undefined
        }
      >
        {q.isPending && <SkeletonList variant="tiles" count={4} label="Loading the salary slip" />}
      </PageHero>

      {q.isError ? (
        <ErrorState
          title={notFound ? 'Salary slip not found' : 'Could not load this slip'}
          message={notFound ? 'This salary slip does not exist or is not yours. Go back to your slips and open it from there.' : undefined}
          error={q.error}
          what="this salary slip"
          onRetry={notFound ? undefined : () => q.refetch()}
          retrying={q.isFetching}
        />
      ) : !p ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <GlassCard className="flex flex-col gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <SkeletonBlock className="h-3.5 w-1/2" />
                <SkeletonBlock className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </GlassCard>
          <SkeletonList variant="cards" count={2} />
        </div>
      ) : (
        <div className="grid gap-4 max-md:gap-3 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          {/* Phones: who the slip is for, as in the app (the session's name; no extra request). */}
          {user && (
            <GlassCard className="hidden max-md:flex max-md:items-center max-md:gap-3 max-md:p-3.5!">
              <span
                aria-hidden="true"
                className="max-md:grid max-md:size-10 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-accent max-md:font-[family-name:var(--font-display)] max-md:text-[15px] max-md:font-bold max-md:text-primary"
              >
                {(user.name || '?').trim().charAt(0).toUpperCase() || '?'}
              </span>
              <span className="max-md:min-w-0 max-md:flex-1">
                <span className="max-md:block max-md:truncate max-md:font-[family-name:var(--font-display)] max-md:text-[14.5px] max-md:font-semibold">{user.name}</span>
                <span className="max-md:mt-0.5 max-md:block max-md:text-[12px] max-md:text-muted-foreground">
                  {[p.slipNumber && `Slip ${p.slipNumber}`, cycle].filter(Boolean).join(' · ') || 'Salary slip'}
                </span>
              </span>
            </GlassCard>
          )}
          <GlassCard variant="stitched" tone="silk" className="flex min-w-0 flex-col gap-4 max-md:gap-0">
            <SectionHeader
              className="max-md:hidden"
              as="h3"
              icon={Wallet}
              tone="emerald"
              title={production ? 'From shifts worked to what you get' : 'From your salary to what you get'}
              description="Read from top to bottom. Every line says why."
            />
            <PhoneCardTitle icon={ChartColumnDecreasing} title="How your pay was worked out" />
            <SlipWaterfall period={p} />
          </GlassCard>
          <div className="flex min-w-0 flex-col gap-4 max-md:gap-3">
            <ChangedByHrCard period={p} />
            <AttendanceCard period={p} />
            <PhoneEarningsCard period={p} />
            <PhoneDeductionsCard period={p} />
            <PhoneVerifyNote />
            {!notFound && (
              <Button size="lg" onClick={download} disabled={downloading} className="hidden max-md:inline-flex max-md:w-full">
                {downloading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                {downloading ? 'Downloading…' : 'Download PDF'}
              </Button>
            )}
            <GlassCard padding="sm" className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground max-md:hidden">
              {p.slipNumber && (
                <span>
                  Slip number <span className="font-semibold text-foreground">{p.slipNumber}</span>
                </span>
              )}
              {cycle && (
                <StatusPill tone="info" size="sm" icon={false}>
                  {cycle}
                </StatusPill>
              )}
            </GlassCard>
          </div>
        </div>
      )}
    </PageShell>
  )
}

import { Calculator, ScrollText } from 'lucide-react'
import { GlassCard, SectionHeader } from '@/components/kit'
import { clMonthTable, summaryLines, summaryTiles, type CLSummary, type SummaryTile } from '@/lib/cl-summary'
import { cn } from '@/lib/utils'

const TILE_TONE: Record<SummaryTile['tone'], string | undefined> = {
  primary: 'text-violet',
  used: undefined,
  free: 'text-approved',
  plain: undefined,
}

/**
 * "Balance in detail" (owner 2026-11-28; the mobile app's ClSummaryCard): the server's sentence about this employee, the
 * figures (total for the year, used, available, carried forward, given this month, usable this month), the lines under
 * them (waiting, usable now after approved requests and after waiting ones too, carried in from last year, lapsed, left
 * for the rest of the year), the months from the start to the month shown as a compact table, and the policy in words.
 * Every figure is the server's `summary` (the same ledger as the balance); the page picks the one for the year on screen
 * with pickClSummary and leaves this out without one.
 */
export function ClBalanceDetail({ summary: s }: { summary: CLSummary }) {
  const tiles = summaryTiles(s)
  const lines = summaryLines(s)
  const table = clMonthTable(s)
  return (
    <section aria-labelledby="cl-detail-title" className="flex flex-col gap-4 max-md:gap-2.5" data-testid="cl-balance-detail">
      <SectionHeader id="cl-detail-title" icon={Calculator} tone="violet" title="Balance in detail" description={`As of ${s.monthLabel}.`} />
      <GlassCard className="flex flex-col gap-4 max-md:gap-3 max-md:p-3.5!">
        {s.personalText && <p className="text-[14px] leading-6 font-medium max-md:text-[13px] max-md:leading-[19px]">{s.personalText}</p>}
        <div className="grid gap-5 max-md:gap-3 lg:grid-cols-[1.2fr_1fr] lg:items-start">
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {tiles.map((t) => (
                <div key={t.key} className="min-w-0">
                  <dt className="text-[10.5px] font-bold tracking-[0.03em] text-muted-foreground uppercase">{t.label}</dt>
                  <dd className={cn('text-[20px] font-bold tabular-nums', TILE_TONE[t.tone])}>
                    <span aria-hidden="true">{t.value}</span>
                    <span className="sr-only">{t.spoken}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {lines.length > 0 && (
              <dl className="flex flex-col text-[13px]">
                {lines.map((l) => (
                  <div key={l.key} className="flex items-baseline justify-between gap-3 border-b hairline py-2 last:border-b-0 max-md:border-input">
                    <dt className="min-w-0 text-muted-foreground">{l.label}</dt>
                    <dd className="shrink-0 font-semibold tabular-nums">{l.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          {table && (
            <div className="flex flex-col gap-1">
              <p className="label-caps text-muted-foreground">Month by month</p>
              <table className="w-full table-fixed text-[13px] max-md:text-[12px]">
                <caption className="sr-only">
                  Casual Leave month by month in {s.year}, in days
                </caption>
                <thead className="border-b hairline">
                  <tr>
                    <th scope="col" className="w-1/4 py-2 pr-2 text-left text-[10.5px] font-bold tracking-[0.03em] text-muted-foreground uppercase max-md:w-[18%] max-md:pr-1 max-md:text-[10px] max-md:tracking-normal max-md:normal-case">
                      Month
                    </th>
                    {table.columns.map((c) => (
                      <th
                        key={c.key}
                        scope="col"
                        className="px-1 py-2 text-right text-[10.5px] font-bold tracking-[0.03em] text-muted-foreground uppercase max-md:px-0.5 max-md:text-[10px] max-md:tracking-normal max-md:normal-case max-md:wrap-anywhere"
                      >
                        {c.key === 'carriedIn' ? (
                          <>
                            <span aria-hidden="true">{c.label}</span>
                            <span className="sr-only">Carried in</span>
                          </>
                        ) : (
                          c.label
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr key={r.key} className={cn('border-b hairline last:border-b-0', r.current && 'bg-violet-bg')}>
                      <th scope="row" className="py-2 pr-2 text-left font-medium max-md:pr-1">
                        <span className="max-md:hidden">{r.label}</span>
                        <span className="hidden max-md:inline">{r.short}</span>
                        {r.current && <span className="sr-only"> (the month shown)</span>}
                      </th>
                      {r.cells.map((cell, i) => (
                        <td key={table.columns[i].key} className={cn('px-1 py-2 text-right tabular-nums max-md:px-0.5', table.columns[i].key === 'balance' && 'font-semibold')}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {table.columns.some((c) => c.key === 'carriedIn') && (
                <p className="text-[11.5px] text-muted-foreground">In = unused days carried in from the month before. Left = what the month ended with.</p>
              )}
            </div>
          )}
        </div>
        {s.policyText && (
          <div className="flex items-start gap-2 rounded-lg bg-foreground/[0.04] px-3 py-2.5 text-[13px] max-md:text-[12px] max-md:leading-[17px]">
            <ScrollText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p>
              <span className="font-semibold">The Casual Leave policy: </span>
              {s.policyText}
            </p>
          </div>
        )}
      </GlassCard>
    </section>
  )
}

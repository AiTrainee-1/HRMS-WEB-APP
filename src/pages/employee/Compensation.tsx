import * as React from 'react'
import { Link } from 'wouter'
import { format, parseISO } from 'date-fns'
import { HandCoins, Info, RefreshCw, UserCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/employee/EmptyState'
import { LoadErrorCard } from '@/components/employee/LoadErrorCard'
import { Reveal } from '@/components/employee/Reveal'
import { CompensationItemCard } from '@/components/employee/CompensationItemCard'
import { MarkerSymbol } from '@/components/employee/MarkerSymbol'
import { ContactBlockCard } from '@/components/support/ContactBlockCard'
import { useCompensation } from '@/hooks/useCompensation'
import {
  ASK_HR_TEXT,
  ASK_HR_TITLE,
  STAFF_ONLY_MESSAGE,
  allowanceBanners,
  applyFilter,
  enabledNotice,
  filterOptions,
  groupItems,
  type AllowanceBanner,
  type CompensationFilterId,
  type CompensationPayload,
} from '@/lib/compensation'
import { loadErrorMessage } from '@/lib/load-error'
import { cn } from '@/lib/utils'

type TabId = 'mine' | 'ask'

export default function Compensation() {
  const query = useCompensation()
  const [tab, setTab] = React.useState<TabId>('mine')
  const payload = query.data

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="HR & Workflows"
        title="Compensation"
        subtitle="Everything the system detected for you and everything HR assigned: late-in allowances, shift compensation, Sunday and holiday work, birthday leave."
        icon={<HandCoins />}
        actions={
          payload?.isStaff ? (
            <Button variant="glass" size="sm" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="Refresh compensation">
              <RefreshCw className={cn(query.isFetching && 'animate-spin')} /> Refresh
            </Button>
          ) : undefined
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : !payload ? (
        <LoadErrorCard
          title="We could not load this page."
          message={loadErrorMessage(query.error, 'your compensation')}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      ) : !payload.isStaff ? (
        <Card className="border-primary/30" data-testid="compensation-staff-only">
          <CardContent role="status" className="flex items-start gap-3 py-1 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-brand-blue" />
            <p>{payload.message ?? STAFF_ONLY_MESSAGE}</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="flex w-full flex-col gap-4">
          <TabsList className="h-auto w-full sm:w-fit">
            <TabsTrigger value="mine" className="h-auto py-2 leading-tight whitespace-normal">
              My Compensation
            </TabsTrigger>
            <TabsTrigger value="ask" className="h-auto py-2 leading-tight whitespace-normal">
              Ask Request for Compensation
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="flex flex-col gap-4">
            {/* A refresh that failed leaves the list already on screen in place, with a way to try again. */}
            {query.isError && (
              <LoadErrorCard
                title="We could not refresh this page."
                message={loadErrorMessage(query.error, 'your compensation')}
                onRetry={() => query.refetch()}
                retrying={query.isFetching}
              />
            )}
            <MyCompensation payload={payload} onAsk={() => setTab('ask')} />
          </TabsContent>
          <TabsContent value="ask" className="flex flex-col gap-4">
            <AskForCompensation payload={payload} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

// ---- My Compensation ----------------------------------------------------------------------------------------------

function MyCompensation({ payload, onAsk }: { payload: CompensationPayload; onAsk: () => void }) {
  const [filter, setFilter] = React.useState<CompensationFilterId>('all')
  const options = filterOptions(payload.items)
  // A filter whose items have gone (a refresh) falls back to "all" instead of showing an empty page.
  const active = options.some((o) => o.id === filter) ? filter : 'all'
  const groups = groupItems(applyFilter(payload.items, active))
  const notice = enabledNotice(payload.enabled)
  const banners = allowanceBanners(payload)

  return (
    <>
      {notice && (
        <Card className="border-warning/50 bg-warning/10" data-testid="compensation-off-notice">
          <CardContent role="status" className="flex items-center gap-2 py-1 text-sm">
            <Info className="size-4 shrink-0" />
            {notice}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <BalanceCard shifts={payload.balanceShifts} />
        <div className="flex flex-col gap-4 lg:col-span-2">
          {banners.map((b) => (
            <AllowanceCard key={b.when} banner={b} />
          ))}
          {banners.length === 0 && payload.enabled?.allowance && (
            <Card>
              <CardContent className="flex items-start gap-3 py-1 text-sm text-muted-foreground">
                <MarkerSymbol name="timer" className="mt-0.5 text-teal-600 dark:text-teal-300" />
                <p>
                  No late-in allowance applies today or on your next working day. When you work past your shift end, you get
                  one for your next working day automatically.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {payload.items.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Nothing detected for you yet"
          description="When you work past your shift end, or on a Sunday or a company holiday, it shows up here. If you think something is missing, ask HR."
          action={
            <Button variant="outline" size="sm" className="mt-2" onClick={onAsk}>
              Ask Request for Compensation
            </Button>
          }
        />
      ) : (
        <>
          <div role="group" aria-label="Filter by kind" className="flex flex-wrap gap-2">
            {options.map((o) => {
              const selected = o.id === active
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(o.id)}
                  className={cn(
                    'font-label inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
                    selected
                      ? 'border-transparent bg-brand-gradient text-white'
                      : 'border-foreground/15 text-foreground/80 hover:border-primary/50 hover:bg-primary/10',
                  )}
                >
                  {o.label}
                  <span className={cn('tabular-nums', selected ? 'text-white/80' : 'text-muted-foreground')}>{o.count}</span>
                </button>
              )
            })}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="Nothing of this kind"
              action={
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilter('all')}>
                  Show everything
                </Button>
              }
            />
          ) : (
            groups.map((group) => (
              <section key={group.id} aria-labelledby={`comp-group-${group.id}`} className="flex flex-col gap-3">
                <div>
                  <h2 id={`comp-group-${group.id}`} className="font-display text-[20px] font-semibold">
                    {group.title}
                    <span className="ml-2 text-[14px] font-normal text-muted-foreground tabular-nums">{group.items.length}</span>
                  </h2>
                  {group.hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{group.hint}</p>}
                </div>
                {group.items.map((item, i) => (
                  <Reveal key={item.key} index={i}>
                    <CompensationItemCard item={item} />
                  </Reveal>
                ))}
              </section>
            ))
          )}
        </>
      )}
    </>
  )
}

function BalanceCard({ shifts }: { shifts: number }) {
  return (
    <Card data-testid="compensation-balance">
      <CardContent className="flex items-start gap-4 py-1">
        <span className="grid size-12 shrink-0 place-items-center rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
          <MarkerSymbol name="bed" className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="label-caps text-muted-foreground">Compensation balance</p>
          <p className="metric mt-1 text-[38px] leading-none">
            {shifts.toFixed(2)}
            <span className="ml-1.5 text-[15px] font-normal text-muted-foreground">{shifts > 1 ? 'shifts' : 'shift'}</span>
          </p>
          <p className="mt-2 text-[12.5px] text-muted-foreground">
            Shifts credited to you (mainly from approved Sunday / holiday work), less the compensation days HR already
            gave you. Only HR can use your balance: ask HR to give you the day.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function AllowanceCard({ banner }: { banner: AllowanceBanner }) {
  return (
    <Card className="border-teal-500/40 bg-teal-500/10" data-testid={`compensation-allowance-${banner.when}`}>
      <CardContent className="flex items-start gap-3 py-1">
        <MarkerSymbol name="timer" className="mt-0.5 size-5 text-teal-600 dark:text-teal-300" />
        <div className="min-w-0">
          <p className="label-caps text-teal-700 dark:text-teal-300">
            {banner.heading} · {format(parseISO(banner.date), 'EEE, d MMM')}
          </p>
          <p className="mt-1 text-[15px] font-semibold">{banner.headline}</p>
          {banner.detail && <p className="mt-1 text-[13px] text-muted-foreground">{banner.detail}</p>}
          <p className="mt-1 text-[12.5px] text-muted-foreground">It is automatic: there is nothing to claim.</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Ask Request for Compensation ---------------------------------------------------------------------------------

function AskForCompensation({ payload }: { payload: CompensationPayload }) {
  const ask = payload.askHr
  const points = ask?.points ?? []
  return (
    <>
      <Card data-testid="compensation-ask">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[19px]">
            <HandCoins className="size-5 text-brand-blue" /> {ask?.title ?? ASK_HR_TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-[14px] text-foreground/85">{ask?.text ?? ASK_HR_TEXT}</p>
          {points.length > 0 && (
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px] text-muted-foreground marker:text-brand-blue">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13.5px]">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-semibold">You cannot assign compensation to yourself.</span> Nothing in this app lets you
              claim it: only HR can assign it. If you worked extra and it is missing from your list, tell HR the date and
              the time you worked until, and HR will check it.
            </p>
          </div>
        </CardContent>
      </Card>

      <ContactBlockCard block={ask?.contact} title="Contact HR" description="Call, message or email HR to request or claim compensation." />

      <p className="text-[13px] text-muted-foreground">
        Sunday and holiday work is approved by your Department Head after HR raises it.{' '}
        <Link href="/employee/hod" className="inline-flex items-center gap-1 font-semibold text-brand-blue hover:underline">
          <UserCheck className="size-3.5" /> See who your Department Head is
        </Link>
      </p>
    </>
  )
}

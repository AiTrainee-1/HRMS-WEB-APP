import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { toPng } from 'html-to-image'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { BadgeCheck, Download, Loader2, MousePointerClick, OctagonAlert, QrCode, Rotate3d, RotateCw, ShieldAlert, ShieldCheck, SquareUser } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, GlassCard, PageHero, PageShell, SectionHeader, SkeletonBlock, StatusPill, useReducedMotion } from '@/components/kit'
import { SupportContactCard } from '@/components/support/SupportContactCard'
import { IdCardFront, IdCardBack } from '@/components/idcard/IdCardViews'
import { UktLogo } from '@/components/layout/mobile/UktLogo'
import { idCardApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { cardDate, cardFileName, employeeStatusInfo } from '@/lib/id-card'
import { cn } from '@/lib/utils'

/**
 * The employee's ID card: one card that flips (click, Enter or Space) between front and back, tilts a little under the
 * mouse, carries a "NOT ACTIVE" stamp when HR's record says the person no longer works here, and downloads either side
 * as a sharp PNG (drawn from a flat copy of the card, so the PNG is never caught mid-flip).
 */
export default function IdCard() {
  const { user } = useAuth()
  const reduced = useReducedMotion()
  const [flipped, setFlipped] = React.useState(false)
  const [saving, setSaving] = React.useState<'front' | 'back' | null>(null)
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 })
  const exportFront = React.useRef<HTMLDivElement>(null)
  const exportBack = React.useRef<HTMLDivElement>(null)

  const q = useQuery({
    queryKey: ['idcard', user?.employeeId],
    queryFn: () => idCardApi.get(user!.employeeId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
  const data = q.data
  const status = employeeStatusInfo(data?.status)
  const stamp = status.kind === 'ended' ? status.label : null
  const isProduction = data?.employmentType === 'production'

  async function download(side: 'front' | 'back') {
    const el = (side === 'front' ? exportFront : exportBack).current
    if (!el || !data) return
    setSaving(side)
    try {
      const dataUrl = await toPng(el, { pixelRatio: 3, cacheBust: true })
      const link = document.createElement('a')
      link.download = cardFileName(data.code, side)
      link.href = dataUrl
      link.click()
    } catch {
      toast.error('Could not make the picture. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  const hero = (
    <PageHero
      icon={<BadgeCheck />}
      title="Digital ID Card"
      subtitle={
        <>
          <span className="max-md:hidden">Your official employee ID. Show it at the gate; the QR on the back lets anyone check it is real.</span>
          <span className="hidden max-md:inline">Show this when someone asks for your ID</span>
        </>
      }
      // Phones: the downloads move under the card (the app's Show back / Share row), so the title row has no actions.
      className="max-md:[&>div.flex>div+div]:w-auto"
      actions={
        data ? (
          <>
            <Button variant="outline" onClick={() => download('front')} disabled={!!saving} className="min-h-11 max-md:hidden sm:min-h-9">
              {saving === 'front' ? <Loader2 className="animate-spin" /> : <Download />} Front (PNG)
            </Button>
            <Button variant="outline" onClick={() => download('back')} disabled={!!saving} className="min-h-11 max-md:hidden sm:min-h-9">
              {saving === 'back' ? <Loader2 className="animate-spin" /> : <Download />} Back (PNG)
            </Button>
          </>
        ) : undefined
      }
    />
  )

  if (q.isPending) {
    return (
      <PageShell>
        {hero}
        <div className="grid place-items-center py-6" role="status" aria-label="Loading your ID card">
          <SkeletonBlock className="h-[380px] w-[240px] rounded-xl" />
        </div>
      </PageShell>
    )
  }

  if (q.isError || !data) {
    return (
      <PageShell>
        {hero}
        <ErrorState error={q.error} what="your ID card" onRetry={() => q.refetch()} retrying={q.isFetching} />
        <SupportContactCard situation="hr" compact className="w-full max-w-md" />
      </PageShell>
    )
  }

  const w = isProduction ? 380 : 240
  const h = isProduction ? 240 : 380
  const side = flipped ? 'back' : 'front'
  const statusChip = status.unknown
    ? null
    : status.kind === 'active'
      ? 'max-md:bg-approved-bg max-md:text-approved'
      : status.kind === 'ended'
        ? 'max-md:bg-rejected-bg max-md:text-rejected'
        : 'max-md:bg-info-bg max-md:text-info'

  return (
    <PageShell>
      {hero}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
        {/* Phones: no frame around the card - the app shows it on the page itself, as wide as the screen allows. */}
        <GlassCard
          variant="raised"
          padding="lg"
          className="relative flex flex-col items-center gap-5 overflow-hidden max-md:gap-4 max-md:overflow-visible max-md:border-0! max-md:bg-none! max-md:bg-transparent! max-md:p-0! max-md:shadow-none!"
        >
          <div aria-hidden="true" className="weave-static pointer-events-none absolute inset-0 opacity-60 max-md:hidden" />
          {/* Phones: the app's title row (UKT mark, credential, company) with HR's status chip, then the warning. */}
          <div className="hidden max-md:flex max-md:w-full max-md:items-center max-md:gap-2.5">
            <div className="max-md:flex max-md:min-w-0 max-md:flex-1 max-md:items-center max-md:gap-2.5">
              <UktLogo className="max-md:h-[22px]" />
              <div className="max-md:min-w-0">
                <p className="font-display max-md:text-[16.5px] max-md:font-bold">{isProduction ? 'Production Credential' : 'Staff Credential'}</p>
                <p className="max-md:mt-px max-md:truncate max-md:text-[12px] max-md:text-muted-foreground">{data.company?.name || 'UK Textiles'}</p>
              </div>
            </div>
            {statusChip && (
              <span className={cn('max-md:inline-flex max-md:shrink-0 max-md:items-center max-md:gap-1.5 max-md:rounded-full max-md:px-2.5 max-md:py-[5px] max-md:text-[11.5px] max-md:font-semibold', statusChip)}>
                <span aria-hidden="true" className="max-md:size-[7px] max-md:rounded-full max-md:bg-current" />
                <span className="sr-only">Employment status from HR: </span>
                {status.label}
              </span>
            )}
          </div>
          {stamp && (
            <p
              role="status"
              className="hidden max-md:flex max-md:w-full max-md:items-start max-md:gap-2.5 max-md:rounded-lg max-md:border max-md:border-destructive max-md:bg-rejected-bg max-md:p-3 max-md:text-[13px] max-md:leading-[19px] max-md:text-rejected"
            >
              <OctagonAlert className="max-md:size-5 max-md:shrink-0" aria-hidden="true" />
              <span>
                HR’s records show your status as <strong className="max-md:font-semibold">{stamp}</strong>. This card is not valid for entry or
                verification. If this is wrong, please contact HR.
              </span>
            </p>
          )}
          <div className="relative w-full overflow-x-auto py-2">
            {/* Phones: scaled to the app's size (about 300px wide for staff, the full width for production). */}
            <div className={cn('mx-auto', isProduction ? 'max-md:[zoom:0.88]' : 'max-md:[zoom:1.25]')} style={{ width: w, perspective: 1200 }}>
              <motion.button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                onPointerMove={(e) => {
                  if (reduced || e.pointerType !== 'mouse') return
                  const r = e.currentTarget.getBoundingClientRect()
                  setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -8, y: ((e.clientX - r.left) / r.width - 0.5) * 10 })
                }}
                onPointerLeave={() => setTilt({ x: 0, y: 0 })}
                aria-label={`ID card, showing the ${flipped ? 'back' : 'front'}. Press to flip it.`}
                aria-pressed={flipped}
                className="focus-ring relative block rounded-xl"
                style={{ width: w, height: h, transformStyle: 'preserve-3d' }}
                animate={{ rotateY: (flipped ? 180 : 0) + tilt.y, rotateX: tilt.x }}
                transition={{ type: 'spring', stiffness: 160, damping: 20 }}
              >
                <span className="absolute inset-0 rounded-xl shadow-clay-lg" style={{ backfaceVisibility: 'hidden' }} aria-hidden={flipped}>
                  <IdCardFront data={data} stamp={stamp} />
                </span>
                <span
                  className="absolute inset-0 rounded-xl shadow-clay-lg"
                  style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                  aria-hidden={!flipped}
                >
                  <IdCardBack data={data} stamp={stamp} />
                </span>
              </motion.button>
            </div>
          </div>
          <Button variant="glass" onClick={() => setFlipped((f) => !f)} className="relative min-h-11 max-md:hidden">
            <RotateCw className={cn('transition-transform duration-500', flipped && 'rotate-180')} /> Show the {flipped ? 'front' : 'back'}
          </Button>

          {/* Phones: the app's hint, its two pill buttons (flip / save the side on show) and its info card. */}
          <div className="hidden max-md:flex max-md:w-full max-md:flex-col max-md:gap-3">
            <p className="max-md:flex max-md:items-center max-md:justify-center max-md:gap-1 max-md:text-center max-md:text-[12px] max-md:text-muted-foreground">
              <MousePointerClick className="max-md:size-[13px] max-md:shrink-0" aria-hidden="true" />
              Tap the card to see the {flipped ? 'front' : 'back (blood group, emergency contact, QR code)'}
            </p>
            <div className="max-md:flex max-md:gap-2.5">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setFlipped((f) => !f)}
                className="max-md:flex-1 max-md:border-0 max-md:bg-accent max-md:font-semibold max-md:text-primary"
                aria-label={flipped ? 'Show the front of the card' : 'Show the back of the card'}
              >
                <Rotate3d aria-hidden="true" /> {flipped ? 'Show front' : 'Show back'}
              </Button>
              <Button size="lg" onClick={() => download(side)} disabled={!!saving} className="max-md:flex-1 max-md:font-semibold">
                {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />} Save {side}
              </Button>
            </div>
            <div className="max-md:rounded-xl max-md:border max-md:bg-card max-md:p-3.5">
              <p className="max-md:flex max-md:items-start max-md:gap-2.5 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">
                <span aria-hidden="true" className="max-md:grid max-md:size-8 max-md:shrink-0 max-md:place-items-center max-md:rounded-[10px] max-md:bg-accent max-md:text-primary">
                  <QrCode className="max-md:size-[17px]" />
                </span>
                {stamp
                  ? 'Because HR’s record says you no longer work here, a QR check will not show you as active. If this is wrong, contact HR.'
                  : 'The QR code on the back opens the company’s check page, so security can confirm the card is yours.'}
              </p>
              <p className="max-md:mt-3 max-md:flex max-md:items-start max-md:gap-2.5 max-md:border-t max-md:pt-3 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-secondary-foreground">
                <span aria-hidden="true" className="max-md:grid max-md:size-8 max-md:shrink-0 max-md:place-items-center max-md:rounded-[10px] max-md:bg-accent max-md:text-primary">
                  <SquareUser className="max-md:size-[17px]" />
                </span>
                The photo and details are the ones HR has on file. To change anything, please contact HR.
              </p>
            </div>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-6 max-md:hidden">
          <GlassCard variant={stamp ? 'stitched' : 'plain'} tone="rose" padding="lg" className="flex flex-col gap-4">
            <SectionHeader
              as="h2"
              icon={stamp ? ShieldAlert : ShieldCheck}
              tone={stamp ? 'rose' : 'emerald'}
              title="Card status"
              action={!status.unknown ? <StatusPill tone={status.isActive ? 'approved' : 'rejected'}>{status.label}</StatusPill> : undefined}
            />
            <p className="text-[13.5px] text-muted-foreground">
              {stamp
                ? 'HR’s record says you no longer work here, so the card is stamped NOT ACTIVE and a QR check will not show you as active. If this is wrong, contact HR.'
                : 'The QR on the back opens a public page that shows your name, photo and that you are an employee of UK Textiles.'}
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="label-caps text-muted-foreground">Employee code</dt>
                <dd className="font-label mt-0.5 font-bold">{data.code}</dd>
              </div>
              <div>
                <dt className="label-caps text-muted-foreground">Department</dt>
                <dd className="mt-0.5 font-medium">{data.department || '—'}</dd>
              </div>
              <div>
                <dt className="label-caps text-muted-foreground">Designation</dt>
                <dd className="mt-0.5 font-medium">{data.designation || '—'}</dd>
              </div>
              <div>
                <dt className="label-caps text-muted-foreground">Joined</dt>
                <dd className="mt-0.5 font-medium">{cardDate(data.joinDate) || '—'}</dd>
              </div>
            </dl>
          </GlassCard>

          <GlassCard padding="lg" className="flex flex-col gap-3">
            <SectionHeader as="h2" icon={QrCode} title="Using your card" />
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] text-muted-foreground">
              <li>Click the card (or press Enter on it) to see the other side.</li>
              <li>Download a side as a picture to keep on your phone or print.</li>
              <li>Details on the card are kept by HR. To change anything, contact HR.</li>
            </ul>
          </GlassCard>
        </div>
      </div>

      {/* Flat copies used only to make the PNGs (off screen, hidden from screen readers). */}
      <div aria-hidden="true" className="pointer-events-none fixed top-0 -left-[10000px]" inert>
        <div ref={exportFront} className="inline-block bg-transparent p-1">
          <IdCardFront data={data} stamp={stamp} />
        </div>
        <div ref={exportBack} className="inline-block bg-transparent p-1">
          <IdCardBack data={data} stamp={stamp} />
        </div>
      </div>
    </PageShell>
  )
}

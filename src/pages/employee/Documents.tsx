import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  CreditCard, Download, Eye, Factory, FileBadge, FileClock, FileImage, FileMinus, FileSignature, FileSpreadsheet,
  FileText, FileType2, Fingerprint, FolderOpen, GraduationCap, Layers, Loader2, Lock, MousePointerClick, Search, ShieldCheck,
  Upload, Vote, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  EmptyState, ErrorState, GlassCard, KpiTile, PageHero, PageShell, SectionHeader, SkeletonList, TONE_SOFT, listItem,
  relativeTime, type Tone,
} from '@/components/kit'
import { ImagePreviewDialog } from '@/components/documents/ImagePreviewDialog'
import { documentsApi, employeeApi } from '@/api/resources'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/api/client'
import { saveUrlAs, useDocumentFiles } from '@/hooks/useDocumentFiles'
import { fileKind, filterDocuments, groupByCategory, kindLabel, openModeFor, safeFileName, type FileKind } from '@/lib/documents'
import type { EmployeeDocument } from '@/types'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  pan_card: CreditCard,
  aadhaar_card: Fingerprint,
  educational_certificate: GraduationCap,
  voter_id_or_birth_certificate: Vote,
  bank_passbook: Wallet,
  offer_letter: FileSignature,
  experience_letter: FileClock,
  resignation_letter: FileMinus,
  staff_letter: FileBadge,
  production_employee_documents: Factory,
}

const KIND_ICON: Record<FileKind, LucideIcon> = { pdf: FileText, image: FileImage, word: FileType2, sheet: FileSpreadsheet, other: FileText }
const KIND_TONE: Record<FileKind, Tone> = { pdf: 'rose', image: 'violet', word: 'sapphire', sheet: 'emerald', other: 'slate' }

// Phones (< 768px), kit/MOBILE.md: the app has no KPI tiles here (its gradient card below carries the numbers), and its
// category card has a 34px tinted icon well (the kit's phone section title would drop the tile).
const PHONE_HERO = 'max-md:[&>div.grid]:hidden'
const PHONE_CATEGORY_TITLE =
  'max-md:[&_span[aria-hidden]]:size-[34px] max-md:[&_span[aria-hidden]]:rounded-[10px] max-md:[&_span[aria-hidden]]:bg-accent max-md:[&_span[aria-hidden]]:text-primary max-md:[&_h2]:text-[15px]'

function shortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The files HR keeps for the employee. Files are only served through the signed-in endpoint, so each one is fetched as
 * a blob (once per visit, see useDocumentFiles). Open: a photo shows here with zoom, a PDF opens in a new tab, anything
 * else downloads. Download always saves the file under its own (cleaned) name.
 */
export default function Documents() {
  const q = useQuery({ queryKey: ['my-documents'], queryFn: documentsApi.list })
  // The phone card's name, code and photo: the layout already reads this profile (same key and function), so no extra request.
  const { user } = useAuth()
  const profile = useQuery({
    queryKey: ['employee', user?.employeeId],
    queryFn: () => employeeApi.get(user!.employeeId),
    enabled: !!user,
    staleTime: 5 * 60_000,
  })
  const getFile = useDocumentFiles()
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<{ id: number; action: 'open' | 'download' } | null>(null)
  const [preview, setPreview] = React.useState<{ doc: EmployeeDocument; url: string } | null>(null)

  const all = q.data ?? []
  const groupsAll = groupByCategory(all)
  const filtered = filterDocuments(all, query).filter((d) => !category || (d.category || 'other') === category)
  const groups = groupByCategory(filtered)
  const newest = [...all].sort((a, b) => (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? ''))[0]

  async function download(doc: EmployeeDocument) {
    setBusy({ id: doc.id, action: 'download' })
    try {
      const { url } = await getFile(doc.id)
      saveUrlAs(url, safeFileName(doc.originalFilename))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download this document. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function open(doc: EmployeeDocument) {
    const guess = openModeFor(doc.originalFilename)
    // A new tab must be opened during the click itself (browsers block it after a wait), so open it now and fill it in.
    const tab = guess === 'tab' ? window.open('', '_blank') : null
    if (tab) tab.document.title = 'Opening document…'
    setBusy({ id: doc.id, action: 'open' })
    try {
      const { url, type } = await getFile(doc.id)
      const mode = openModeFor(doc.originalFilename, type)
      if (mode === 'preview') {
        tab?.close()
        setPreview({ doc, url })
      } else if (mode === 'tab') {
        if (tab) tab.location.href = url
        else if (!window.open(url, '_blank', 'noopener')) saveUrlAs(url, safeFileName(doc.originalFilename))
      } else {
        tab?.close()
        saveUrlAs(url, safeFileName(doc.originalFilename))
        toast.info('This kind of file opens in its own program, so it was downloaded.')
      }
    } catch (err) {
      tab?.close()
      toast.error(err instanceof ApiError ? err.message : 'Could not open this document. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageShell>
        <PageHero
          icon={<FolderOpen />}
          title="My Documents"
          subtitle={
            <>
              <span className="max-md:hidden">ID proofs, certificates and letters HR keeps for you. Photos open here; PDFs open in a new tab.</span>
              <span className="hidden max-md:inline">Records HR keeps for you</span>
            </>
          }
          className={PHONE_HERO}
          kpis={
            q.isSuccess && all.length > 0 ? (
              <>
                <KpiTile label="Files on record" value={all.length} icon={Layers} tone="sapphire" />
                <KpiTile label="Categories" value={groupsAll.length} icon={FolderOpen} tone="violet" />
                <KpiTile label="Last added" value={newest?.uploadedAt ? relativeTime(newest.uploadedAt) : '—'} icon={Upload} tone="emerald" hint={newest?.categoryLabel} />
              </>
            ) : undefined
          }
        />

        {q.isPending ? (
          <SkeletonList variant="rows" count={5} label="Loading your documents" />
        ) : q.isError ? (
          <ErrorState error={q.error} what="your documents" onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : all.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No documents yet" description="When HR adds a document for you (ID proof, offer letter, certificates), it shows here." />
        ) : (
          <>
            {/* Phones: the app's gradient card (who, "private to you", files / categories / last added) and its tip. */}
            <PhoneDocumentsHero
              name={[profile.data?.firstName, profile.data?.lastName].filter(Boolean).join(' ') || user?.name || 'My documents'}
              meta={[profile.data?.employeeCode, profile.data?.departmentName || profile.data?.designationTitle].filter(Boolean).join(' · ')}
              photo={profile.data?.photoUrl}
              files={all.length}
              categories={groupsAll.length}
              lastAdded={shortDate(newest?.uploadedAt)}
            />
            <p className="hidden max-md:mb-3 max-md:flex max-md:items-start max-md:gap-2 max-md:rounded-lg max-md:bg-accent max-md:p-3 max-md:text-[12.5px] max-md:leading-[18px] max-md:text-accent-foreground">
              <MousePointerClick className="max-md:mt-px max-md:size-4 max-md:shrink-0 max-md:text-primary" aria-hidden="true" />
              <span>
                Tap <strong className="max-md:font-semibold">Open</strong> to see a file. Use <strong className="max-md:font-semibold">Download</strong> to keep a copy on
                your phone.
              </span>
            </p>
            <div className="flex flex-col gap-3 max-md:mb-3.5">
              <div className="relative sm:max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="doc-search" className="sr-only">
                  Search documents
                </label>
                <Input id="doc-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or type" className="h-11 pr-10 pl-9 max-md:h-11 max-md:pr-10" />
                {query && (
                  <Button variant="ghost" size="icon" className="absolute top-1/2 right-1 size-9 -translate-y-1/2" onClick={() => setQuery('')} aria-label="Clear the search">
                    <X />
                  </Button>
                )}
              </div>
              {groupsAll.length > 1 && (
                // Phones: the app's chip row scrolls sideways, running to the screen edges.
                <div
                  className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:pb-0.5 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
                  role="group"
                  aria-label="Show a category"
                >
                  <CategoryChip active={!category} onClick={() => setCategory(null)} label="All" count={all.length} />
                  {groupsAll.map((g) => (
                    <CategoryChip
                      key={g.category}
                      icon={CATEGORY_ICONS[g.category] ?? FolderOpen}
                      active={category === g.category}
                      onClick={() => setCategory(category === g.category ? null : g.category)}
                      label={g.categoryLabel}
                      count={g.files.length}
                    />
                  ))}
                </div>
              )}
            </div>

            {groups.length === 0 ? (
              <EmptyState icon={Search} title="No documents match" description="Try other words, or show all categories." compact />
            ) : (
              <div className="grid gap-5 max-md:grid-cols-1 max-md:gap-3 lg:grid-cols-2">
                {groups.map((g, gi) => {
                  const Icon = CATEGORY_ICONS[g.category] ?? FolderOpen
                  return (
                    <motion.section key={g.category} {...listItem(gi)} aria-labelledby={`cat-${g.category}`} className="max-md:min-w-0">
                      <GlassCard padding="lg" className="flex h-full flex-col gap-4 max-md:gap-2.5 max-md:p-3.5!">
                        <SectionHeader as="h2" id={`cat-${g.category}`} icon={Icon} title={g.categoryLabel} count={g.files.length} className={PHONE_CATEGORY_TITLE} />
                        <ul className="flex flex-col gap-2">
                          {g.files.map((doc) => (
                            <DocRow key={doc.id} doc={doc} busy={busy?.id === doc.id ? busy.action : null} onOpen={() => open(doc)} onDownload={() => download(doc)} />
                          ))}
                        </ul>
                      </GlassCard>
                    </motion.section>
                  )
                })}
              </div>
            )}
            <p className="hidden max-md:mt-3.5 max-md:flex max-md:items-start max-md:gap-1.5 max-md:px-1.5 max-md:text-[11.5px] max-md:leading-[17px] max-md:text-muted-foreground">
              <Lock className="max-md:mt-0.5 max-md:size-[13px] max-md:shrink-0" aria-hidden="true" />
              Only you and HR can see these files.
            </p>
          </>
        )}
      </PageShell>

      <ImagePreviewDialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        url={preview?.url ?? null}
        name={preview?.doc.originalFilename ?? ''}
        meta={preview ? [preview.doc.categoryLabel, preview.doc.uploadedAt ? `added ${relativeTime(preview.doc.uploadedAt)}` : null].filter(Boolean).join(' · ') : undefined}
        onDownload={() => preview && saveUrlAs(preview.url, safeFileName(preview.doc.originalFilename))}
      />
    </>
  )
}

function CategoryChip({
  active,
  onClick,
  label,
  count,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  /** Phones only: the category's icon before the label, as the app shows it. */
  icon?: LucideIcon
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'focus-ring font-label flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
        active ? 'border-info-border bg-info-bg text-info' : 'border-foreground/15 bg-card/60 text-foreground/80 hover:border-primary/40',
        // Phones: the app's chips - white with a hairline, the chosen one filled sapphire, a round count at the end.
        'max-md:min-h-[38px] max-md:shrink-0 max-md:pr-1.5 max-md:pl-3 max-md:text-[12.5px] max-md:active:opacity-80',
        active ? 'max-md:border-primary max-md:bg-primary max-md:text-primary-foreground' : 'max-md:border-border max-md:bg-card max-md:text-secondary-foreground',
      )}
    >
      {Icon && <Icon className={cn('hidden max-md:block max-md:size-3.5', !active && 'max-md:text-muted-foreground')} aria-hidden="true" />}
      <span className="max-md:max-w-[180px] max-md:truncate">{label}</span>
      <span
        className={cn(
          'rounded-full bg-foreground/[0.08] px-1.5 text-[11px] tabular-nums max-md:grid max-md:h-[22px] max-md:min-w-[22px] max-md:place-items-center',
          active ? 'max-md:bg-white/20' : 'max-md:bg-muted max-md:text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

/** The mobile app's gradient documents card: photo, name, code and department, a "private" lock, and three figures
 *  split by thin dividers. Phone-only. */
function PhoneDocumentsHero({
  name,
  meta,
  photo,
  files,
  categories,
  lastAdded,
}: {
  name: string
  meta: string
  photo?: string
  files: number
  categories: number
  lastAdded: string
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="hidden max-md:relative max-md:mb-3 max-md:block max-md:overflow-hidden max-md:rounded-3xl max-md:bg-[linear-gradient(135deg,#0f172a,#1e3a8a_55%,#2563eb)] max-md:p-[18px] max-md:text-white max-md:dark:bg-[linear-gradient(135deg,#0b1220,#111827_50%,#1e3a5f)]">
      <span aria-hidden="true" className="max-md:absolute max-md:-top-[90px] max-md:-right-[60px] max-md:size-[200px] max-md:rounded-full max-md:bg-white/[0.08]" />
      <div className="max-md:relative max-md:flex max-md:items-center max-md:gap-3">
        <Avatar className="max-md:size-[46px] max-md:border max-md:border-white/50">
          {photo && <AvatarImage src={photo} alt="" className="object-cover" />}
          <AvatarFallback className="max-md:bg-white/15 max-md:text-[15px] max-md:font-bold max-md:text-white">{initials || 'ME'}</AvatarFallback>
        </Avatar>
        <div className="max-md:min-w-0 max-md:flex-1">
          <p className="font-display max-md:truncate max-md:text-[17px] max-md:font-bold">{name}</p>
          {meta && <p className="max-md:mt-0.5 max-md:truncate max-md:text-[12.5px] max-md:text-white/80">{meta}</p>}
        </div>
        <span title="Private to you" className="max-md:grid max-md:size-[38px] max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:bg-white/15">
          <ShieldCheck className="max-md:size-[18px]" aria-hidden="true" />
          <span className="sr-only">Private to you</span>
        </span>
      </div>
      <dl className="max-md:relative max-md:mt-4 max-md:flex max-md:items-stretch max-md:rounded-xl max-md:bg-white/10 max-md:py-2.5">
        <div className="max-md:flex max-md:flex-1 max-md:flex-col-reverse max-md:items-center">
          <dt className="max-md:mt-px max-md:text-[11px] max-md:text-white/75">{files === 1 ? 'File' : 'Files'}</dt>
          <dd className="font-display max-md:text-[19px] max-md:font-bold max-md:tabular-nums">{files}</dd>
        </div>
        <span aria-hidden="true" className="max-md:w-px max-md:bg-white/20" />
        <div className="max-md:flex max-md:flex-1 max-md:flex-col-reverse max-md:items-center">
          <dt className="max-md:mt-px max-md:text-[11px] max-md:text-white/75">{categories === 1 ? 'Category' : 'Categories'}</dt>
          <dd className="font-display max-md:text-[19px] max-md:font-bold max-md:tabular-nums">{categories}</dd>
        </div>
        <span aria-hidden="true" className="max-md:w-px max-md:bg-white/20" />
        <div className="max-md:flex max-md:flex-[1.4] max-md:flex-col-reverse max-md:items-center max-md:justify-end">
          <dt className="max-md:mt-px max-md:text-[11px] max-md:text-white/75">Last added</dt>
          <dd className="font-display max-md:pt-[3px] max-md:pb-0.5 max-md:text-[13.5px] max-md:font-bold max-md:tabular-nums">{lastAdded || '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

function DocRow({ doc, busy, onOpen, onDownload }: { doc: EmployeeDocument; busy: 'open' | 'download' | null; onOpen: () => void; onDownload: () => void }) {
  const kind = fileKind(doc.originalFilename)
  const Icon = KIND_ICON[kind]
  const meta = [kindLabel(kind), doc.uploadedAt ? `added ${relativeTime(doc.uploadedAt)}` : null, doc.uploadedBy ? `by ${doc.uploadedBy}` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    // Phones: the app's file row - a soft grey row, a 42px kind tile, the name on up to two lines, round 40px buttons.
    <li className="group flex items-center gap-3 rounded-lg border hairline bg-foreground/[0.02] p-2.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.04] max-md:gap-2.5 max-md:border-0 max-md:bg-muted max-md:py-2.5 max-md:pr-1 max-md:pl-2.5">
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg border max-md:size-[42px] max-md:rounded-[11px] max-md:border-0', TONE_SOFT[KIND_TONE[kind]])} aria-hidden="true">
        <Icon className="size-[18px] max-md:size-[22px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold max-md:line-clamp-2 max-md:text-[13.5px] max-md:leading-[18px] max-md:whitespace-normal max-md:[overflow-wrap:anywhere]" title={doc.originalFilename}>
          {doc.originalFilename}
        </p>
        <p className="truncate text-[12px] text-muted-foreground max-md:mt-0.5 max-md:text-[11.5px]">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="min-h-10 max-md:size-10 max-md:min-h-10 max-md:border-border max-md:bg-card max-md:px-0 max-md:text-primary sm:min-h-8"
          onClick={onOpen}
          disabled={!!busy}
          aria-label={`Open ${doc.originalFilename}`}
        >
          {busy === 'open' ? <Loader2 className="animate-spin" /> : <Eye />}
          <span className="hidden sm:inline sm:max-md:hidden">Open</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 max-md:rounded-full max-md:border max-md:border-border max-md:bg-card max-md:text-primary sm:size-8 sm:max-md:size-10"
          onClick={onDownload}
          disabled={!!busy}
          aria-label={`Download ${doc.originalFilename}`}
        >
          {busy === 'download' ? <Loader2 className="animate-spin" /> : <Download />}
        </Button>
      </div>
    </li>
  )
}

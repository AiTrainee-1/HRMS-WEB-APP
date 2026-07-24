import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FolderOpen, Eye, Download, CreditCard, Fingerprint, GraduationCap, Vote, Wallet,
  FileSignature, FileClock, FileMinus, FileBadge, Factory, type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/employee/EmptyState'
import { documentsApi } from '@/api/resources'
import { ApiError } from '@/api/client'
import type { EmployeeDocument } from '@/types'

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

// Files are only ever served through the authenticated /employee-documents/:id/file
// endpoint — a plain <a href> wouldn't carry the Bearer token, so both view and
// download fetch the file as a blob first (documentsApi.fetchFile), same as the
// salary-slip PDF handling elsewhere in this app.
async function openInNewTab(doc: EmployeeDocument) {
  const blob = await documentsApi.fetchFile(doc.id)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function triggerDownload(doc: EmployeeDocument) {
  const blob = await documentsApi.fetchFile(doc.id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = doc.originalFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function Documents() {
  const { data, isLoading } = useQuery({ queryKey: ['my-documents'], queryFn: documentsApi.list })

  const grouped = (data ?? []).reduce<Record<string, { label: string; files: EmployeeDocument[] }>>((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = { label: doc.categoryLabel, files: [] }
    acc[doc.category].files.push(doc)
    return acc
  }, {})

  async function handleView(doc: EmployeeDocument) {
    try {
      await openInNewTab(doc)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not open this document')
    }
  }

  async function handleDownload(doc: EmployeeDocument) {
    try {
      await triggerDownload(doc)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download this document')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="My Documents" subtitle="ID proofs, certificates, and letters on file" icon={<FolderOpen />} />

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <EmptyState icon={FolderOpen} title="No documents yet" description="Documents uploaded by HR will appear here." />
      )}

      <div className="flex flex-col gap-3">
        {Object.entries(grouped).map(([category, { label, files }]) => {
          const Icon = CATEGORY_ICONS[category] ?? FolderOpen
          return (
            <Card key={category}>
              <CardContent className="flex flex-col gap-2 py-1">
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <p className="font-medium">{label}</p>
                </div>
                <div className="flex flex-col gap-1.5 pb-1 pl-10">
                  {files.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">{doc.originalFilename}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => handleView(doc)} title="View">
                          <Eye className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDownload(doc)} title="Download">
                          <Download className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

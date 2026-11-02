// Pure helpers for "My Documents" (no React, no network), tested in documents.test.ts. A port of the mobile app's
// src/lib/documents.ts, for the browser: what kind of file it is, how it opens (image -> preview here, PDF -> a new tab,
// anything else -> download), a safe download name, and the category groups.

export interface DocumentLike {
  id: number
  category: string
  categoryLabel: string
  originalFilename: string
  uploadedAt: string | null
}

export type FileKind = 'pdf' | 'image' | 'word' | 'sheet' | 'other'

export function extensionOf(filename: string | null | undefined): string {
  const name = (filename ?? '').trim()
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).toLowerCase()
}

export function fileKind(filename: string | null | undefined): FileKind {
  const ext = extensionOf(filename)
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'heif', 'bmp'].includes(ext)) return 'image'
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return 'word'
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet'
  return 'other'
}

/** Images every browser can draw itself (HEIC cannot). */
export function isPreviewableImage(filename: string | null | undefined): boolean {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extensionOf(filename))
}

/** How "Open" behaves: show the picture here, open a PDF in a new tab, otherwise download the file. */
export type OpenMode = 'preview' | 'tab' | 'download'

export function openModeFor(filename: string | null | undefined, blobType?: string | null): OpenMode {
  if (isPreviewableImage(filename) || /^image\/(png|jpe?g|webp|gif|bmp)$/i.test(blobType ?? '')) return 'preview'
  if (fileKind(filename) === 'pdf' || /^application\/pdf$/i.test(blobType ?? '')) return 'tab'
  return 'download'
}

export function mimeTypeFor(filename: string | null | undefined): string {
  switch (extensionOf(filename)) {
    case 'pdf':
      return 'application/pdf'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    case 'bmp':
      return 'image/bmp'
    case 'heic':
      return 'image/heic'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'xls':
      return 'application/vnd.ms-excel'
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case 'csv':
      return 'text/csv'
    case 'txt':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}

/** What the file is, in words. */
export function kindLabel(kind: FileKind): string {
  switch (kind) {
    case 'pdf':
      return 'PDF'
    case 'image':
      return 'Photo'
    case 'word':
      return 'Word file'
    case 'sheet':
      return 'Spreadsheet'
    default:
      return 'File'
  }
}

/**
 * A file name that is safe to save: no folder separators or characters Windows rejects, no leading dots, not too long,
 * and it keeps its extension. HR types these names, so they can contain anything.
 */
export function safeFileName(name: string | null | undefined, fallback = 'document'): string {
  const raw = (name ?? '').normalize('NFC')
  const ext = extensionOf(raw)
  const base = ext ? raw.slice(0, raw.length - ext.length - 1) : raw
  const cleanBase = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s_]+/, '')
    .trim()
    .slice(0, 80)
    .trim()
  const cleanExt = ext.replace(/[^a-z0-9]/g, '').slice(0, 8)
  const finalBase = cleanBase || fallback
  return cleanExt ? `${finalBase}.${cleanExt}` : finalBase
}

export interface CategoryGroup<T extends DocumentLike> {
  category: string
  categoryLabel: string
  files: T[]
}

function time(value: string | null | undefined): number {
  if (!value) return 0
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Groups by category (in the order HR's categories first appear), newest file first in each. */
export function groupByCategory<T extends DocumentLike>(docs: readonly T[] | null | undefined): CategoryGroup<T>[] {
  const groups = new Map<string, CategoryGroup<T>>()
  for (const doc of docs ?? []) {
    const key = doc.category || 'other'
    if (!groups.has(key)) groups.set(key, { category: key, categoryLabel: doc.categoryLabel || 'Other', files: [] })
    groups.get(key)!.files.push(doc)
  }
  for (const g of groups.values()) g.files.sort((a, b) => time(b.uploadedAt) - time(a.uploadedAt) || b.id - a.id)
  return [...groups.values()]
}

/** Keeps only the documents whose name or category contains the words typed (case-insensitive). */
export function filterDocuments<T extends DocumentLike>(docs: readonly T[] | null | undefined, query: string): T[] {
  const q = query.trim().toLowerCase()
  const list = [...(docs ?? [])]
  if (!q) return list
  return list.filter((d) => `${d.originalFilename} ${d.categoryLabel}`.toLowerCase().includes(q))
}

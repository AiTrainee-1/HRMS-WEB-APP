// Run with `npm test`. My Documents rules (lib/documents.ts).
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  extensionOf,
  fileKind,
  filterDocuments,
  groupByCategory,
  isPreviewableImage,
  kindLabel,
  mimeTypeFor,
  openModeFor,
  safeFileName,
} from './documents.ts'

describe('file kinds', () => {
  test('extension and kind', () => {
    assert.equal(extensionOf('Aadhaar.PDF'), 'pdf')
    assert.equal(extensionOf('.hidden'), '')
    assert.equal(extensionOf('noext'), '')
    assert.equal(fileKind('scan.jpeg'), 'image')
    assert.equal(fileKind('offer.docx'), 'word')
    assert.equal(fileKind('pay.xlsx'), 'sheet')
    assert.equal(fileKind('x.zip'), 'other')
    assert.equal(kindLabel('image'), 'Photo')
  })
  test('how Open behaves', () => {
    assert.equal(isPreviewableImage('a.png'), true)
    assert.equal(isPreviewableImage('a.heic'), false)
    assert.equal(openModeFor('a.png'), 'preview')
    assert.equal(openModeFor('a.pdf'), 'tab')
    assert.equal(openModeFor('a.docx'), 'download')
    assert.equal(openModeFor('noext', 'application/pdf'), 'tab')
    assert.equal(openModeFor('noext', 'image/jpeg'), 'preview')
    assert.equal(mimeTypeFor('a.JPG'), 'image/jpeg')
    assert.equal(mimeTypeFor('a.bin'), 'application/octet-stream')
  })
})

describe('safeFileName', () => {
  test('cleans what Windows rejects and keeps the extension', () => {
    assert.equal(safeFileName('a/b:c*?.pdf'), 'a_b_c_.pdf')
    assert.equal(safeFileName('..secret.png'), 'secret.png')
    assert.equal(safeFileName(''), 'document')
    assert.equal(safeFileName('.pdf'), 'pdf')
    assert.equal(safeFileName('...'), 'document')
    assert.equal(safeFileName('x'.repeat(200) + '.pdf').length, 84)
  })
})

describe('groups and search', () => {
  const docs = [
    { id: 1, category: 'pan_card', categoryLabel: 'PAN Card', originalFilename: 'pan.pdf', uploadedAt: '2026-01-01T00:00:00Z' },
    { id: 2, category: 'offer_letter', categoryLabel: 'Offer Letter', originalFilename: 'offer.pdf', uploadedAt: '2026-02-01T00:00:00Z' },
    { id: 3, category: 'pan_card', categoryLabel: 'PAN Card', originalFilename: 'pan-new.png', uploadedAt: '2026-03-01T00:00:00Z' },
  ]
  test('groupByCategory keeps first-seen order, newest first inside', () => {
    const g = groupByCategory(docs)
    assert.deepEqual(g.map((x) => x.category), ['pan_card', 'offer_letter'])
    assert.deepEqual(g[0].files.map((f) => f.id), [3, 1])
    assert.deepEqual(groupByCategory(null), [])
  })
  test('filterDocuments by name or category', () => {
    assert.deepEqual(filterDocuments(docs, 'offer').map((d) => d.id), [2])
    assert.deepEqual(filterDocuments(docs, 'PAN').map((d) => d.id), [1, 3])
    assert.equal(filterDocuments(docs, '  ').length, 3)
  })
})

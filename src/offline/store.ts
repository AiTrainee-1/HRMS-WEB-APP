import type { QueuedOp } from '@/lib/offline-ops'

/**
 * Where the offline queue lives: IndexedDB, which keeps the operations (and the selfies of On-Duty punches, as Blobs)
 * across reloads and browser restarts. Where IndexedDB cannot be opened (some private windows) the queue is kept in
 * memory: it still works for as long as the tab stays open.
 */
const DB_NAME = 'uktex-employee-offline'
const STORE = 'ops'

let dbPromise: Promise<IDBDatabase | null> | null = null
const memory = new Map<string, QueuedOp>()

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        if (!db) return resolve(undefined)
        const tx = db.transaction(STORE, mode)
        const req = work(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req ? req.result : undefined)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export async function allOps(): Promise<QueuedOp[]> {
  const db = await openDb()
  if (!db) return [...memory.values()]
  return ((await run<QueuedOp[]>('readonly', (s) => s.getAll() as IDBRequest<QueuedOp[]>)) ?? []) as QueuedOp[]
}

export async function putOp(op: QueuedOp): Promise<void> {
  const db = await openDb()
  if (!db) {
    memory.set(op.id, op)
    return
  }
  await run('readwrite', (s) => s.put(op))
}

export async function getOp(id: string): Promise<QueuedOp | undefined> {
  const db = await openDb()
  if (!db) return memory.get(id)
  return run<QueuedOp>('readonly', (s) => s.get(id) as IDBRequest<QueuedOp>)
}

export async function deleteOp(id: string): Promise<void> {
  const db = await openDb()
  if (!db) {
    memory.delete(id)
    return
  }
  await run('readwrite', (s) => s.delete(id))
}

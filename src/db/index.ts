// IndexedDB 打开与事务封装

export const DB_NAME = 'seedance-live'
export const DB_VERSION = 1

export const STORE_TASKS = 'tasks'
export const STORE_ASSETS = 'assets'
export const STORE_BLOBS = 'blobs'
export const STORE_COVERS = 'covers'

let dbPromise: Promise<IDBDatabase> | null = null
let activeDb: IDBDatabase | null = null

export type StorageErrorKind = 'unavailable' | 'quota' | 'transaction'

export class StorageError extends Error {
  readonly kind: StorageErrorKind

  constructor(
    message: string,
    kind: StorageErrorKind,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'StorageError'
    this.kind = kind
  }
}

function toStorageError(error: unknown, fallback: StorageErrorKind): StorageError {
  if (error instanceof StorageError) return error
  const cause = error instanceof Error || error instanceof DOMException ? error : undefined
  const name = cause?.name ?? ''
  const kind: StorageErrorKind = name === 'QuotaExceededError' ? 'quota' : fallback
  const message = cause?.message || (kind === 'quota' ? 'Storage quota exceeded' : 'IndexedDB operation failed')
  return new StorageError(message, kind, cause ? { cause } : undefined)
}

function clearCachedDb(db?: IDBDatabase) {
  if (!db || activeDb === db) {
    activeDb = null
    dbPromise = null
  }
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch (error) {
      dbPromise = null
      reject(toStorageError(error, 'unavailable'))
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_COVERS)) {
        db.createObjectStore(STORE_COVERS, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => {
      const db = req.result
      activeDb = db
      db.onclose = () => clearCachedDb(db)
      db.onversionchange = () => {
        db.close()
        clearCachedDb(db)
      }
      resolve(db)
    }
    req.onerror = () => {
      activeDb = null
      dbPromise = null
      reject(toStorageError(req.error, 'unavailable'))
    }
    req.onblocked = () => {
      dbPromise = null
      reject(new StorageError('IndexedDB open request was blocked', 'unavailable'))
    }
  })
  return dbPromise
}

export async function closeDb(): Promise<void> {
  if (!dbPromise && !activeDb) return
  try {
    const db = activeDb ?? await dbPromise
    db?.close()
  } finally {
    activeDb = null
    dbPromise = null
  }
}

export async function withTransaction<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  operation: (stores: Record<string, IDBObjectStore>, tx: IDBTransaction) => T,
): Promise<Awaited<T>> {
  const db = await openDb()
  try {
    return await runTransaction(db, storeNames, mode, operation)
  } catch (error) {
    if (!isInvalidStateError(error)) throw error
    clearCachedDb(db)
    const reopened = await openDb()
    try {
      return await runTransaction(reopened, storeNames, mode, operation)
    } catch (retryError) {
      throw toStorageError(retryError, 'unavailable')
    }
  }
}

function runTransaction<T>(
  db: IDBDatabase,
  storeNames: string | string[],
  mode: IDBTransactionMode,
  operation: (stores: Record<string, IDBObjectStore>, tx: IDBTransaction) => T,
): Promise<Awaited<T>> {
  return new Promise<Awaited<T>>((resolve, reject) => {
    let tx: IDBTransaction
    let result: T
    try {
      tx = db.transaction(storeNames, mode)
      const names = typeof storeNames === 'string' ? [storeNames] : storeNames
      const stores = Object.fromEntries(names.map((name) => [name, tx.objectStore(name)]))
      result = operation(stores, tx)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'InvalidStateError') clearCachedDb(db)
      reject(toStorageError(error, 'transaction'))
      return
    }

    tx.oncomplete = () => Promise.resolve(result).then(resolve, (error) => reject(toStorageError(error, 'transaction')))
    tx.onerror = () => reject(toStorageError(tx.error, 'transaction'))
    tx.onabort = () => reject(toStorageError(tx.error, 'transaction'))
  })
}

function isInvalidStateError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === 'InvalidStateError'
  if (error instanceof StorageError && error.cause instanceof DOMException) {
    return error.cause.name === 'InvalidStateError'
  }
  return false
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// 单 store 事务兼容封装；写操作只在事务真正提交后返回。
export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return withTransaction(storeName, mode, (stores) => requestResult(fn(stores[storeName])))
}

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IDBKeyRange, indexedDB } from 'fake-indexeddb'
import {
  closeDb,
  DB_NAME,
  openDb,
  StorageError,
  STORE_TASKS,
  withStore,
  withTransaction,
} from '@/db/index'

describe('IndexedDB transaction infrastructure', () => {
  beforeEach(async () => {
    Object.assign(globalThis, { indexedDB, IDBKeyRange })
    await closeDb()
    await deleteDatabase()
  })

  afterEach(async () => {
    await closeDb()
    await deleteDatabase()
  })

  it('reopens after the cached connection is closed', async () => {
    const first = await openDb()
    first.close()
    await withStore(STORE_TASKS, 'readwrite', (store) => store.put({ id: 'after-close' }))
    const value = await withStore(STORE_TASKS, 'readonly', (store) => store.get('after-close'))
    expect(value).toEqual({ id: 'after-close' })
  })

  it('resolves writes only after transaction completion', async () => {
    await withStore(STORE_TASKS, 'readwrite', (store) => store.put({ id: 'task-1' }))
    const value = await withStore(STORE_TASKS, 'readonly', (store) => store.get('task-1'))
    expect(value).toEqual({ id: 'task-1' })
  })

  it('rejects when a transaction aborts', async () => {
    const promise = withTransaction(STORE_TASKS, 'readwrite', (stores, transaction) => {
      stores[STORE_TASKS].put({ id: 'task-abort' })
      transaction.abort()
    })
    await expect(promise).rejects.toBeInstanceOf(StorageError)
  })
})

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Database deletion blocked'))
  })
}

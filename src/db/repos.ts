import type { StoredAsset, VideoTask } from '@/types'
import { toRaw } from 'vue'
import { withStore, withTransaction, STORE_TASKS, STORE_ASSETS, STORE_BLOBS, STORE_COVERS } from './index'

// Pinia state 是 deep reactive（Proxy），IndexedDB 的 structured clone 不能克隆 Proxy。
// toRaw 只脱最外层，嵌套的 params/数组仍是 Proxy，structuredClone 仍会失败。
// 用 JSON 序列化穿透所有层 Proxy，得到纯普通对象（VideoTask 无 Date/Map/函数，安全）。
export function toStorable<T>(obj: T): T {
  const raw = toRaw(obj as unknown) as T
  return JSON.parse(JSON.stringify(raw))
}

// —— tasks ——
export function putTask(task: VideoTask): Promise<IDBValidKey> {
  return withStore(STORE_TASKS, 'readwrite', (s) => s.put(toStorable(task)))
}

export function getAllTasks(): Promise<VideoTask[]> {
  return withStore(STORE_TASKS, 'readonly', (s) => s.getAll() as IDBRequest<VideoTask[]>)
}

export function deleteTask(id: string): Promise<undefined> {
  return withStore(STORE_TASKS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export function clearTasks(): Promise<undefined> {
  return withStore(STORE_TASKS, 'readwrite', (s) => s.clear() as IDBRequest<undefined>)
}

// —— assets ——
export function putAsset(asset: StoredAsset): Promise<IDBValidKey> {
  return withStore(STORE_ASSETS, 'readwrite', (s) => s.put(toStorable(asset)))
}

export function getAsset(id: string): Promise<StoredAsset | undefined> {
  return withStore(STORE_ASSETS, 'readonly', (s) => s.get(id) as IDBRequest<StoredAsset | undefined>)
}

export function getAssets(ids: string[]): Promise<StoredAsset[]> {
  if (!ids.length) return Promise.resolve([])
  return withTransaction(STORE_ASSETS, 'readonly', (stores) => {
    const requests = ids.map((id) => {
      const req = stores[STORE_ASSETS].get(id) as IDBRequest<StoredAsset | undefined>
      return new Promise<StoredAsset | undefined>((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
    })
    return Promise.all(requests)
  }).then((arr) => arr.filter((a): a is StoredAsset => !!a))
}

export function deleteAsset(id: string): Promise<undefined> {
  return withStore(STORE_ASSETS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export function getAllAssets(): Promise<StoredAsset[]> {
  return withStore(STORE_ASSETS, 'readonly', (s) => s.getAll() as IDBRequest<StoredAsset[]>)
}

// —— blobs（存 ArrayBuffer）——
export interface StoredBlob {
  id: string
  buffer: ArrayBuffer
  mime: string
}

export function putBlob(blob: StoredBlob): Promise<IDBValidKey> {
  return withStore(STORE_BLOBS, 'readwrite', (s) => s.put(blob))
}

export function getBlob(id: string): Promise<StoredBlob | undefined> {
  return withStore(STORE_BLOBS, 'readonly', (s) => s.get(id) as IDBRequest<StoredBlob | undefined>)
}

export function deleteBlob(id: string): Promise<undefined> {
  return withStore(STORE_BLOBS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export function getAllBlobs(): Promise<StoredBlob[]> {
  return withStore(STORE_BLOBS, 'readonly', (s) => s.getAll() as IDBRequest<StoredBlob[]>)
}

// —— covers（存 dataUrl 字符串）——
export interface StoredCover {
  id: string
  dataUrl: string
}

export function putCover(cover: StoredCover): Promise<IDBValidKey> {
  return withStore(STORE_COVERS, 'readwrite', (s) => s.put(cover))
}

export function getCover(id: string): Promise<StoredCover | undefined> {
  return withStore(STORE_COVERS, 'readonly', (s) => s.get(id) as IDBRequest<StoredCover | undefined>)
}

export function deleteCover(id: string): Promise<undefined> {
  return withStore(STORE_COVERS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export function getAllCovers(): Promise<StoredCover[]> {
  return withStore(STORE_COVERS, 'readonly', (s) => s.getAll() as IDBRequest<StoredCover[]>)
}

export interface TaskResultWrite {
  task: VideoTask
  video?: StoredBlob
  covers?: StoredCover[]
}

export function putTaskResult({ task, video, covers = [] }: TaskResultWrite): Promise<void> {
  const storeNames = [STORE_TASKS]
  if (video) storeNames.push(STORE_BLOBS)
  if (covers.length) storeNames.push(STORE_COVERS)
  return withTransaction(storeNames, 'readwrite', (stores) => {
    if (video) stores[STORE_BLOBS].put(video)
    for (const cover of covers) stores[STORE_COVERS].put(cover)
    stores[STORE_TASKS].put(toStorable(task))
  }).then(() => undefined)
}

export interface ImportedDataWrite {
  tasks: VideoTask[]
  assets: StoredAsset[]
  blobs: StoredBlob[]
  covers: StoredCover[]
}

export interface ContinueFrameWrite {
  blob: StoredBlob
  asset: StoredAsset
  task: VideoTask
}

export function putContinueFrame({ blob, asset, task }: ContinueFrameWrite): Promise<void> {
  return withTransaction([STORE_BLOBS, STORE_ASSETS, STORE_TASKS], 'readwrite', (stores) => {
    stores[STORE_BLOBS].put(blob)
    stores[STORE_ASSETS].put(toStorable(asset))
    stores[STORE_TASKS].put(toStorable(task))
  }).then(() => undefined)
}

export function putImportedData(data: ImportedDataWrite): Promise<void> {
  return withTransaction([STORE_TASKS, STORE_ASSETS, STORE_BLOBS, STORE_COVERS], 'readwrite', (stores) => {
    for (const task of data.tasks) stores[STORE_TASKS].put(toStorable(task))
    for (const asset of data.assets) stores[STORE_ASSETS].put(toStorable(asset))
    for (const blob of data.blobs) stores[STORE_BLOBS].put(blob)
    for (const cover of data.covers) stores[STORE_COVERS].put(cover)
  }).then(() => undefined)
}

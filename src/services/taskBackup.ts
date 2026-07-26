import type { StoredAsset, TaskStatus, VideoTask } from '@/types'
import {
  getAllAssets,
  getAllBlobs,
  getAllCovers,
  putImportedData,
  type StoredBlob,
  type StoredCover,
} from '@/db/repos'

const TASK_STATUSES = new Set<TaskStatus>(['queued', 'running', 'succeeded', 'failed', 'cancelled', 'expired'])
const BASE64_ENCODE_CHUNK_SIZE = 0x6000
const BASE64_DECODE_CHUNK_SIZE = 0x8000

interface BackupBlobV1 {
  id: string
  mime: string
  buffer: number[]
}

interface BackupBlobV2 {
  id: string
  mime: string
  base64: string
}

interface BackupRoot {
  version: 1 | 2
  tasks: unknown[]
  assets: unknown[]
  blobs: unknown[]
  covers: unknown[]
}

export interface ImportResult {
  imported: number
  skipped: number
  tasks: VideoTask[]
}

export async function exportTaskBackup(tasks: VideoTask[]): Promise<string> {
  const [assets, blobs, covers] = await Promise.all([getAllAssets(), getAllBlobs(), getAllCovers()])
  const encodedBlobs: BackupBlobV2[] = blobs.map((blob) => ({
    id: blob.id,
    mime: blob.mime,
    base64: arrayBufferToBase64(blob.buffer),
  }))
  return JSON.stringify({
    version: 2,
    exportedAt: Date.now(),
    tasks,
    assets,
    blobs: encodedBlobs,
    covers,
  })
}

export async function importTaskBackup(json: string, currentTasks: VideoTask[], importedError: string): Promise<ImportResult> {
  const parsed = parseRoot(json)
  const incomingTasks = parsed.tasks.map(validateTask)
  const incomingAssets = parsed.assets.map(validateAsset)
  const incomingCovers = parsed.covers.map(validateCover)
  const incomingBlobs = parsed.version === 1
    ? parsed.blobs.map(validateBlobV1).map(decodeBlobV1)
    : parsed.blobs.map(validateBlobV2).map(decodeBlobV2)

  const [existingAssets, existingBlobs, existingCovers] = await Promise.all([
    getAllAssets(),
    getAllBlobs(),
    getAllCovers(),
  ])
  const taskIds = new Set(currentTasks.map((task) => task.id))
  const assetIds = new Set(existingAssets.map((asset) => asset.id))
  const blobIds = new Set(existingBlobs.map((blob) => blob.id))
  const coverIds = new Set(existingCovers.map((cover) => cover.id))
  let skipped = 0

  const tasks: VideoTask[] = []
  for (const task of incomingTasks) {
    if (taskIds.has(task.id)) {
      skipped += 1
      continue
    }
    taskIds.add(task.id)
    tasks.push(normalizeImportedTask(task, importedError))
  }
  const assets = uniqueNew(incomingAssets, assetIds)
  const blobs = uniqueNew(incomingBlobs, blobIds)
  const covers = uniqueNew(incomingCovers, coverIds)

  await putImportedData({ tasks, assets, blobs, covers })
  return { imported: tasks.length, skipped, tasks }
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const parts: string[] = []
  for (let offset = 0; offset < bytes.length; offset += BASE64_ENCODE_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_ENCODE_CHUNK_SIZE)
    let binary = ''
    for (const byte of chunk) binary += String.fromCharCode(byte)
    parts.push(btoa(binary))
  }
  return parts.join('')
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/\s+/g, '')
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  const bytes = new Uint8Array(Math.max(0, Math.floor(normalized.length * 3 / 4) - padding))
  let byteOffset = 0
  try {
    for (let offset = 0; offset < normalized.length; offset += BASE64_DECODE_CHUNK_SIZE) {
      const binary = atob(normalized.slice(offset, offset + BASE64_DECODE_CHUNK_SIZE))
      for (let index = 0; index < binary.length; index += 1) bytes[byteOffset++] = binary.charCodeAt(index)
    }
  } catch (error) {
    throw new Error(`Invalid base64 blob: ${error instanceof Error ? error.message : String(error)}`)
  }
  return bytes.buffer
}

function parseRoot(json: string): BackupRoot {
  const value: unknown = JSON.parse(json)
  if (!isRecord(value)) throw new Error('Backup root must be an object')
  if (value.version !== 1 && value.version !== 2) throw new Error('Unsupported backup version')
  for (const key of ['tasks', 'assets', 'blobs', 'covers'] as const) {
    if (!Array.isArray(value[key])) throw new Error(`Backup field ${key} must be an array`)
  }
  return value as unknown as BackupRoot
}

function validateTask(value: unknown): VideoTask {
  if (!isRecord(value)) throw new Error('Invalid task record')
  if (!isNonEmptyString(value.id) || typeof value.prompt !== 'string') throw new Error('Invalid task identity')
  if (!TASK_STATUSES.has(value.status as TaskStatus)) throw new Error(`Invalid task status for ${value.id}`)
  if (!Number.isFinite(value.createdAt) || !isRecord(value.params) || !Array.isArray(value.assetIds)) {
    throw new Error(`Invalid task fields for ${value.id}`)
  }
  return { ...(value as unknown as VideoTask), assetIds: [...value.assetIds] }
}

function validateAsset(value: unknown): StoredAsset {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)) throw new Error('Invalid asset record')
  if (!isNonEmptyString(value.mime) || !Number.isFinite(value.size) || !Number.isFinite(value.createdAt)) {
    throw new Error(`Invalid asset fields for ${value.id}`)
  }
  return { ...(value as unknown as StoredAsset) }
}

function validateCover(value: unknown): StoredCover {
  if (!isRecord(value) || !isNonEmptyString(value.id) || typeof value.dataUrl !== 'string') throw new Error('Invalid cover record')
  return { id: value.id, dataUrl: value.dataUrl }
}

function validateBlobV1(value: unknown): BackupBlobV1 {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.mime) || !Array.isArray(value.buffer)) {
    throw new Error('Invalid v1 blob record')
  }
  if (value.buffer.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    throw new Error(`Invalid byte array for ${value.id}`)
  }
  return { id: value.id, mime: value.mime, buffer: value.buffer as number[] }
}

function validateBlobV2(value: unknown): BackupBlobV2 {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.mime) || typeof value.base64 !== 'string') {
    throw new Error('Invalid v2 blob record')
  }
  return { id: value.id, mime: value.mime, base64: value.base64 }
}

function decodeBlobV1(blob: BackupBlobV1): StoredBlob {
  return { id: blob.id, mime: blob.mime, buffer: Uint8Array.from(blob.buffer).buffer }
}

function decodeBlobV2(blob: BackupBlobV2): StoredBlob {
  return { id: blob.id, mime: blob.mime, buffer: base64ToArrayBuffer(blob.base64) }
}

function normalizeImportedTask(task: VideoTask, importedError: string): VideoTask {
  const active = task.status === 'running' || task.status === 'queued' || task.recoverable
  return {
    ...task,
    status: active ? 'failed' : task.status,
    error: active ? task.error || importedError : task.error,
    recoverable: false,
    remoteStatus: active ? undefined : task.remoteStatus,
    progress: active ? undefined : task.progress,
    finishedAt: active ? Date.now() : task.finishedAt,
  }
}

function uniqueNew<T extends { id: string }>(values: T[], existing: Set<string>): T[] {
  const output: T[] = []
  for (const value of values) {
    if (existing.has(value.id)) continue
    existing.add(value.id)
    output.push(value)
  }
  return output
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

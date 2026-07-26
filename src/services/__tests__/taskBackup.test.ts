import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoTask } from '@/types'
import { defaultParams } from '@/config/options'

const db = vi.hoisted(() => ({
  getAllAssets: vi.fn(),
  getAllBlobs: vi.fn(),
  getAllCovers: vi.fn(),
  putImportedData: vi.fn(),
}))

vi.mock('@/db/repos', () => db)

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  exportTaskBackup,
  importTaskBackup,
} from '@/services/taskBackup'

describe('task backup v2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.getAllAssets.mockResolvedValue([])
    db.getAllBlobs.mockResolvedValue([])
    db.getAllCovers.mockResolvedValue([])
    db.putImportedData.mockResolvedValue(undefined)
  })

  it('roundtrips ArrayBuffer through base64', () => {
    const input = Uint8Array.from([0, 1, 2, 127, 128, 255]).buffer
    const output = base64ToArrayBuffer(arrayBufferToBase64(input))
    expect([...new Uint8Array(output)]).toEqual([0, 1, 2, 127, 128, 255])
  })

  it('roundtrips data across base64 chunk boundaries', () => {
    const input = Uint8Array.from({ length: 40_000 }, (_, index) => index % 251)
    const output = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(input.buffer)))
    expect(output).toEqual(input)
  })

  it('exports version 2 blobs as base64', async () => {
    db.getAllBlobs.mockResolvedValue([{ id: 'blob-1', mime: 'video/mp4', buffer: Uint8Array.from([1, 2, 3]).buffer }])
    const json = await exportTaskBackup([makeTask({ id: 'task-1' })])
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(2)
    expect(parsed.blobs[0]).toEqual({ id: 'blob-1', mime: 'video/mp4', base64: 'AQID' })
  })

  it('imports legacy version 1 byte arrays', async () => {
    const json = JSON.stringify({
      version: 1,
      tasks: [makeTask({ id: 'legacy', status: 'running', recoverable: true })],
      assets: [],
      blobs: [{ id: 'blob-1', mime: 'video/mp4', buffer: [1, 2, 255] }],
      covers: [],
    })
    const result = await importTaskBackup(json, [], 'not resumable')
    expect(result.imported).toBe(1)
    expect(result.tasks[0]).toMatchObject({ status: 'failed', recoverable: false, error: 'not resumable' })
    expect(db.putImportedData).toHaveBeenCalledWith(expect.objectContaining({
      blobs: [expect.objectContaining({ id: 'blob-1' })],
    }))
  })

  it('rejects invalid records before writing', async () => {
    const json = JSON.stringify({ version: 2, tasks: [{ id: '', status: 'bad' }], assets: [], blobs: [], covers: [] })
    await expect(importTaskBackup(json, [], 'not resumable')).rejects.toThrow()
    expect(db.putImportedData).not.toHaveBeenCalled()
  })
})

function makeTask(overrides: Partial<VideoTask>): VideoTask {
  return {
    id: 'task',
    prompt: 'prompt',
    params: defaultParams(),
    assetIds: [],
    providerId: 'provider',
    providerKind: 'seedance',
    status: 'succeeded',
    recoverable: false,
    error: null,
    createdAt: 1,
    finishedAt: null,
    elapsed: null,
    ...overrides,
  }
}

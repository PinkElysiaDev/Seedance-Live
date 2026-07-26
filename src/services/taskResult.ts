import type { VideoTask } from '@/types'
import type { ProxyConfig } from '@/types'
import type { PollResult } from '@/provider/types'
import { generateId } from '@/lib/id'
import { captureCover } from '@/lib/video'
import { blobToDataUrl, isHttpUrl } from '@/lib/blob'
import { applyProxy } from '@/net/proxy'
import { log } from '@/lib/logger'
import { putTaskResult, type StoredBlob, type StoredCover } from '@/db/repos'

async function fetchBlob(url: string, signal: AbortSignal, proxy?: ProxyConfig): Promise<Blob | null> {
  const targetUrl = proxy ? applyProxy(url, proxy) : url
  try {
    const response = await fetch(targetUrl, { signal })
    if (!response.ok) return null
    return await response.blob()
  } catch (error) {
    if (signal.aborted) throw error
    return null
  }
}

async function downloadVideo(url: string, signal: AbortSignal, proxy?: ProxyConfig): Promise<Blob | null> {
  const blob = await fetchBlob(url, signal, proxy)
  if (!blob || blob.size === 0) return null
  // 类型白名单：video/*、octet-stream（未知二进制）、空字符串（服务端未声明）
  if (!blob.type.startsWith('video/') && blob.type !== 'application/octet-stream' && blob.type !== '') return null
  return blob
}

export interface SaveTaskResultOptions {
  task: VideoTask
  result: Pick<PollResult, 'videoUrl' | 'lastFrameUrl'>
  signal: AbortSignal
  noVideoUrlMessage: string
  proxy?: ProxyConfig
}

export interface SavedTaskResult {
  task: VideoTask
  videoDownloaded: boolean
  videoSize: number
}

export async function saveTaskResult(options: SaveTaskResultOptions): Promise<SavedTaskResult> {
  const { task, result, signal, proxy } = options
  if (!result.videoUrl) throw new Error(options.noVideoUrlMessage)

  const covers: StoredCover[] = []
  let video: StoredBlob | undefined
  let videoBlobId: string | undefined
  let coverImageId: string | undefined
  let lastFrameImageId: string | undefined

  const videoBlob = await downloadVideo(result.videoUrl, signal, proxy)
  if (videoBlob) {
    videoBlobId = generateId()
    video = {
      id: videoBlobId,
      buffer: await videoBlob.arrayBuffer(),
      mime: videoBlob.type || 'video/mp4',
    }
    try {
      coverImageId = generateId()
      covers.push({ id: coverImageId, dataUrl: await captureCover(videoBlob) })
    } catch (error) {
      coverImageId = undefined
      log.warn('poll', 'Video cover capture failed', error instanceof Error ? error.message : String(error), task.id)
    }
  }

  if (result.lastFrameUrl && isHttpUrl(result.lastFrameUrl)) {
    const lastFrameBlob = await fetchBlob(result.lastFrameUrl, signal, proxy)
    if (lastFrameBlob) {
      lastFrameImageId = generateId()
      covers.push({ id: lastFrameImageId, dataUrl: await blobToDataUrl(lastFrameBlob) })
    }
  }

  const savedTask: VideoTask = {
    ...task,
    status: 'succeeded',
    recoverable: false,
    error: null,
    videoBlobId,
    videoUrl: result.videoUrl,
    coverImageId,
    lastFrameImageId,
    finishedAt: Date.now(),
    elapsed: Date.now() - task.createdAt,
  }
  await putTaskResult({ task: savedTask, video, covers })
  return { task: savedTask, videoDownloaded: !!video, videoSize: videoBlob?.size ?? 0 }
}

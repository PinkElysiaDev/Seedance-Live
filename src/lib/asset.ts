import type { AssetKind, AssetRole, StoredAsset } from '@/types'
import { genId } from './id'
import { hashBlob, blobToArrayBuffer, blobToDataUrl, isDirectUrl } from './blob'
import { probeVideo, probeAudio, type VideoMeta } from './video'
import { putBlob, putAsset, getBlob, type StoredBlob } from '@/db/repos'

// 角色 → kind 映射
export function roleKind(role: AssetRole): AssetKind {
  if (role === 'referenceVideo') return 'video'
  if (role === 'referenceAudio') return 'audio'
  return 'image'
}

export function kindFromMime(mime: string): AssetKind {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'image'
}

// 校验某角色的素材是否被允许（互斥由 Composer 层保证，这里只校验类型）
export function fileMatchesRole(file: File, role: AssetRole): boolean {
  const kind = kindFromMime(file.type)
  return kind === roleKind(role)
}

// 入库一个本地文件，返回 StoredAsset
export async function ingestFile(file: File, role: AssetRole): Promise<StoredAsset> {
  const kind = roleKind(role)
  const mime = file.type || guessMime(file.name, kind)
  const blobId = await hashBlob(file)

  // 探测元信息
  let width: number | undefined
  let height: number | undefined
  let durationMs: number | undefined
  if (kind === 'video') {
    try {
      const meta: VideoMeta = await probeVideo(file)
      width = meta.width
      height = meta.height
      durationMs = meta.durationMs
    } catch {
      // 忽略探测失败
    }
  } else if (kind === 'audio') {
    try {
      const { durationMs: d } = await probeAudio(file)
      durationMs = d
    } catch {
      // 忽略
    }
  }

  // 存 ArrayBuffer 到 blobs store（去重：同 hash 复用）
  const buffer = await blobToArrayBuffer(file)
  const stored: StoredBlob = { id: blobId, buffer, mime }
  await putBlob(stored)

  const asset: StoredAsset = {
    id: genId(),
    role,
    kind,
    blobId,
    name: file.name,
    mime,
    size: file.size,
    width,
    height,
    durationMs,
    createdAt: Date.now(),
  }
  await putAsset(asset)
  return asset
}

// 从公网 URL 创建素材引用（不下载，提交时直传）
export async function ingestUrl(url: string, role: AssetRole, name = ''): Promise<StoredAsset> {
  const kind = roleKind(role)
  const asset: StoredAsset = {
    id: genId(),
    role,
    kind,
    blobId: '',           // 无本地 blob
    name: name || url.slice(url.lastIndexOf('/') + 1) || 'remote',
    mime: guessMime(name || url, kind),
    size: 0,
    sourceUrl: url,
    createdAt: Date.now(),
  }
  await putAsset(asset)
  return asset
}

// 解析素材为提交给 API 的 URL：公网/asset:// 直传，否则取本地 blob 转 dataUrl
export async function resolveAssetForApi(asset: StoredAsset): Promise<string> {
  if (asset.sourceUrl && isDirectUrl(asset.sourceUrl)) return asset.sourceUrl
  if (!asset.blobId) throw new Error(`素材 ${asset.name} 无可用的 URL 或本地数据`)
  const stored = await getBlob(asset.blobId)
  if (!stored) throw new Error(`素材 ${asset.name} 的本地数据已丢失`)
  const blob = new Blob([stored.buffer], { type: stored.mime })
  return blobToDataUrl(blob)
}

function guessMime(name: string, kind: AssetKind): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (kind === 'video') {
    if (ext === 'mov') return 'video/quicktime'
    return 'video/mp4'
  }
  if (kind === 'audio') {
    if (ext === 'wav') return 'audio/wav'
    return 'audio/mpeg'
  }
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

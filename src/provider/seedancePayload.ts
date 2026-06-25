import type { AssetRole, StoredAsset, VideoParams } from '@/types'
import { resolveAssetForApi } from '@/lib/asset'

// 角色 → 火山 content 数组里的 role 字符串
function roleToApiRole(role: AssetRole): string {
  switch (role) {
    case 'firstFrame': return 'first_frame'
    case 'lastFrame': return 'last_frame'
    case 'referenceImage': return 'reference_image'
    case 'referenceVideo': return 'reference_video'
    case 'referenceAudio': return 'reference_audio'
  }
}

// 参考素材编号前缀（沿用 infinite-canvas buildSeedancePromptText，按类型独立编号）
export function buildPromptText(prompt: string, assets: StoredAsset[]): string {
  const text = prompt.trim()
  if (!assets.length) return text
  const counters = { image: 0, video: 0, audio: 0 }
  const labels = assets.map((a) => {
    const key = a.kind === 'image' ? 'image' : a.kind === 'video' ? 'video' : 'audio'
    counters[key] += 1
    const kindLabel = key === 'image' ? '图片' : key === 'video' ? '视频' : '音频'
    return `${kindLabel}${counters[key]}`
  })
  return `参考素材编号：${labels.join('、')}。请按这些编号理解提示词中的图片、视频和音频引用。\n\n${text}`
}

// content 数组中素材的 type 与字段名
function assetContentEntry(role: AssetRole) {
  if (role === 'referenceVideo') return { type: 'video_url', field: 'video_url' }
  if (role === 'referenceAudio') return { type: 'audio_url', field: 'audio_url' }
  return { type: 'image_url', field: 'image_url' }
}

// 构造火山原生 content 数组风格的请求体
export async function buildSeedancePayload(
  params: VideoParams,
  prompt: string,
  assets: StoredAsset[],
): Promise<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = []
  const text = buildPromptText(prompt, assets)
  content.push({ type: 'text', text })

  for (const asset of assets) {
    const url = await resolveAssetForApi(asset)
    const { type, field } = assetContentEntry(asset.role)
    content.push({ type, [field]: { url }, role: roleToApiRole(asset.role) })
  }

  const payload: Record<string, unknown> = {
    model: params.model,
    content,
    ratio: params.ratio,
    resolution: params.resolution,
    duration: params.duration,
    generate_audio: params.generateAudio,
    watermark: params.watermark,
  }
  if (params.seed !== undefined && params.seed !== null) {
    payload.seed = params.seed
  }
  if (params.returnLastFrame) {
    payload.return_last_frame = true
  }
  if (params.webSearch) {
    payload.tools = [{ type: 'web_search' }]
  }
  return payload
}

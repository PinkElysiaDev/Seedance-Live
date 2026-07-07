import type { SeedanceModel, VideoRatio, VideoResolution } from '@/types'

// 模型元数据：能力与限制，供 Provider 与 UI 共用
export interface ModelMeta {
  id: SeedanceModel
  label: string
  supportsAssetUrl: boolean   // asset:// 仅 2.0/2.0-fast
  maxResolution: VideoResolution
  supportsFirstLastFrame: boolean
  fast: boolean
  face: boolean
}

export const MODEL_META: Record<SeedanceModel, ModelMeta> = {
  'doubao-seedance-2.0': {
    id: 'doubao-seedance-2.0',
    label: 'Seedance 2.0',
    supportsAssetUrl: true,
    maxResolution: '1080p',
    supportsFirstLastFrame: true,
    fast: false,
    face: false,
  },
  'doubao-seedance-2.0-fast': {
    id: 'doubao-seedance-2.0-fast',
    label: 'Seedance 2.0 Fast',
    supportsAssetUrl: true,
    maxResolution: '720p',
    supportsFirstLastFrame: true,
    fast: true,
    face: false,
  },
  'doubao-seedance-2.0-face': {
    id: 'doubao-seedance-2.0-face',
    label: 'Seedance 2.0 Face',
    supportsAssetUrl: false,
    maxResolution: '1080p',
    supportsFirstLastFrame: true,
    fast: false,
    face: true,
  },
  'doubao-seedance-2.0-fast-face': {
    id: 'doubao-seedance-2.0-fast-face',
    label: 'Seedance 2.0 Fast Face',
    supportsAssetUrl: false,
    maxResolution: '720p',
    supportsFirstLastFrame: true,
    fast: true,
    face: true,
  },
}

export const MODEL_LIST: ModelMeta[] = Object.values(MODEL_META)

// 参考素材数量与体积限制（沿用 infinite-canvas 已验证值）
export const SEEDANCE_REFERENCE_LIMITS = {
  images: 9,
  videos: 3,
  audios: 3,
  imageMaxBytes: 30 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024,
  audioMaxBytes: 15 * 1024 * 1024,
  // 参考视频：单条时长 2–15s，总时长 ≤15s，宽高 300–6000px
  videoMinDurationMs: 2000,
  videoMaxDurationMs: 15000,
  videoTotalMaxDurationMs: 15000,
  audioTotalMaxDurationMs: 15000,
}

/** 返回模型支持的分辨率列表（fast 系列上限 720p，故不含 1080p）。 */
export function resolutionsForModel(model: SeedanceModel): VideoResolution[] {
  const meta = MODEL_META[model]
  if (meta.maxResolution === '1080p') return ['480p', '720p', '1080p', '4K']
  return ['480p', '720p', '4K']
}

/** 返回模型支持的画幅比例（adaptive 仅非 face 模型可用）。 */
export function ratiosForModel(model: SeedanceModel): VideoRatio[] {
  const base: VideoRatio[] = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
  return MODEL_META[model].face ? base : [...base, 'adaptive']
}

// 比例 → 撑高用的 paddingBottom 百分比，实现基于宽度的自适应高度
const RATIO_PADDING_TOP: Record<VideoRatio, string> = {
  '16:9': '56.25%',
  '9:16': '177.77%',
  '1:1': '100%',
  '4:3': '75%',
  '3:4': '133.33%',
  '21:9': '42.85%',
  adaptive: '56.25%',
}

/** 将视频比例转换为 padding-top 百分比，用于按宽度自适应高度的缩略图容器。 */
export function ratioToPaddingTop(ratio: VideoRatio): string {
  return RATIO_PADDING_TOP[ratio] ?? '56.25%'
}

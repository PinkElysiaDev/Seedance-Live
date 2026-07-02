import type { AssetRole, StoredAsset, VideoParams } from '@/types'
import { MODEL_META, SEEDANCE_REFERENCE_LIMITS } from '@/config/models'
import { PROMPT_MAX } from '@/config/options'

// 互斥与限制校验，返回错误列表（空数组表示通过）
export function validateTask(params: VideoParams, prompt: string, assets: StoredAsset[]): string[] {
  const errors: string[] = []
  const meta = MODEL_META[params.model]
  const p = prompt.trim()

  if (!p) errors.push('提示词不能为空')
  if (p.length > PROMPT_MAX) errors.push(`提示词不能超过 ${PROMPT_MAX} 字符`)

  // 素材相关错误（伴随素材状态，可实时展示）
  errors.push(...validateAssets(assets))

  // 模型分辨率限制
  const allowed = meta.maxResolution === '1080p' ? ['480p', '720p', '1080p', '4K'] : ['480p', '720p', '4K']
  if (!allowed.includes(params.resolution)) errors.push(`${meta.label} 不支持 ${params.resolution}`)

  // 时长
  if (params.duration < 4 || params.duration > 15) errors.push('时长需在 4–15 秒之间')

  return errors
}

// 仅校验伴随素材状态的错误（数量/体积/时长/互斥/配合），用于实时提示
export function validateAssets(assets: StoredAsset[]): string[] {
  const errors: string[] = []

  // 分组
  const byRole = (role: AssetRole) => assets.filter((a) => a.role === role)
  const images = byRole('referenceImage')
  const videos = byRole('referenceVideo')
  const audios = byRole('referenceAudio')
  const firstFrame = byRole('firstFrame')
  const lastFrame = byRole('lastFrame')

  // 数量
  if (images.length > SEEDANCE_REFERENCE_LIMITS.images) errors.push(`参考图最多 ${SEEDANCE_REFERENCE_LIMITS.images} 张`)
  if (videos.length > SEEDANCE_REFERENCE_LIMITS.videos) errors.push(`参考视频最多 ${SEEDANCE_REFERENCE_LIMITS.videos} 个`)
  if (audios.length > SEEDANCE_REFERENCE_LIMITS.audios) errors.push(`参考音频最多 ${SEEDANCE_REFERENCE_LIMITS.audios} 个`)

  // 体积
  if (images.some((a) => a.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes)) errors.push('参考图不能超过 30MB')
  if (videos.some((a) => a.size > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes)) errors.push('参考视频不能超过 50MB')
  if (audios.some((a) => a.size > SEEDANCE_REFERENCE_LIMITS.audioMaxBytes)) errors.push('参考音频不能超过 15MB')

  // 参考视频时长
  let totalVideoMs = 0
  for (const v of videos) {
    if (v.durationMs != null) {
      if (v.durationMs < SEEDANCE_REFERENCE_LIMITS.videoMinDurationMs || v.durationMs > SEEDANCE_REFERENCE_LIMITS.videoMaxDurationMs) {
        errors.push('参考视频单条时长需在 2–15 秒之间')
      }
      totalVideoMs += v.durationMs
    }
  }
  if (totalVideoMs > SEEDANCE_REFERENCE_LIMITS.videoTotalMaxDurationMs) errors.push('参考视频总时长不能超过 15 秒')

  // 参考音频总时长
  const totalAudioMs = audios.reduce((s, a) => s + (a.durationMs ?? 0), 0)
  if (totalAudioMs > SEEDANCE_REFERENCE_LIMITS.audioTotalMaxDurationMs) errors.push('参考音频总时长不能超过 15 秒')

  // 互斥：首尾帧启用时禁用参考视频/音频
  if ((firstFrame.length || lastFrame.length) && (videos.length || audios.length)) {
    errors.push('首尾帧与参考视频/音频不能同时使用')
  }

  // 参考音频必须配合参考图或参考视频
  if (audios.length && !images.length && !videos.length && !firstFrame.length && !lastFrame.length) {
    errors.push('参考音频需配合参考图或参考视频使用')
  }

  return errors
}

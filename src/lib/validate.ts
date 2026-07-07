import type { AssetRole, StoredAsset, VideoParams } from '@/types'
import { MODEL_META, SEEDANCE_REFERENCE_LIMITS } from '@/config/models'
import { PROMPT_MAX } from '@/config/options'
import { useI18nStore } from '@/stores/i18n'

// 互斥与限制校验，返回错误列表（空数组表示通过）
export function validateTask(params: VideoParams, prompt: string, assets: StoredAsset[]): string[] {
  const { t } = useI18nStore()
  const errors: string[] = []
  const meta = MODEL_META[params.model]
  const p = prompt.trim()

  if (!p) errors.push(t('validate.promptEmpty'))
  if (p.length > PROMPT_MAX) errors.push(t('validate.promptTooLong', { n: PROMPT_MAX }))

  // 素材相关错误（伴随素材状态，可实时展示）
  errors.push(...validateAssets(assets))

  // 模型分辨率限制
  const allowed = meta.maxResolution === '1080p' ? ['480p', '720p', '1080p', '4K'] : ['480p', '720p', '4K']
  if (!allowed.includes(params.resolution)) errors.push(t('validate.modelResolution', { label: meta.label, res: params.resolution }))

  // 时长
  if (params.duration < 4 || params.duration > 15) errors.push(t('validate.durationRange'))

  return errors
}

// 仅校验伴随素材状态的错误（数量/体积/时长/互斥/配合），用于实时提示
export function validateAssets(assets: StoredAsset[]): string[] {
  const { t } = useI18nStore()
  const errors: string[] = []

  // 分组
  const byRole = (role: AssetRole) => assets.filter((a) => a.role === role)
  const images = byRole('referenceImage')
  const videos = byRole('referenceVideo')
  const audios = byRole('referenceAudio')
  const firstFrame = byRole('firstFrame')
  const lastFrame = byRole('lastFrame')

  // 数量
  if (images.length > SEEDANCE_REFERENCE_LIMITS.images) errors.push(t('validate.imagesMax', { n: SEEDANCE_REFERENCE_LIMITS.images }))
  if (videos.length > SEEDANCE_REFERENCE_LIMITS.videos) errors.push(t('validate.videosMax', { n: SEEDANCE_REFERENCE_LIMITS.videos }))
  if (audios.length > SEEDANCE_REFERENCE_LIMITS.audios) errors.push(t('validate.audiosMax', { n: SEEDANCE_REFERENCE_LIMITS.audios }))

  // 体积
  if (images.some((a) => a.size > SEEDANCE_REFERENCE_LIMITS.imageMaxBytes)) errors.push(t('validate.imageSize'))
  if (videos.some((a) => a.size > SEEDANCE_REFERENCE_LIMITS.videoMaxBytes)) errors.push(t('validate.videoSize'))
  if (audios.some((a) => a.size > SEEDANCE_REFERENCE_LIMITS.audioMaxBytes)) errors.push(t('validate.audioSize'))

  // 参考视频时长
  let totalVideoMs = 0
  for (const v of videos) {
    if (v.durationMs != null) {
      if (v.durationMs < SEEDANCE_REFERENCE_LIMITS.videoMinDurationMs || v.durationMs > SEEDANCE_REFERENCE_LIMITS.videoMaxDurationMs) {
        errors.push(t('validate.videoDuration'))
      }
      totalVideoMs += v.durationMs
    }
  }
  if (totalVideoMs > SEEDANCE_REFERENCE_LIMITS.videoTotalMaxDurationMs) errors.push(t('validate.videoTotalDuration'))

  // 参考音频总时长
  const totalAudioMs = audios.reduce((s, a) => s + (a.durationMs ?? 0), 0)
  if (totalAudioMs > SEEDANCE_REFERENCE_LIMITS.audioTotalMaxDurationMs) errors.push(t('validate.audioTotalDuration'))

  // 互斥：首尾帧启用时禁用参考视频/音频
  if ((firstFrame.length || lastFrame.length) && (videos.length || audios.length)) {
    errors.push(t('validate.frameMutex'))
  }

  // 参考音频必须配合参考图或参考视频
  if (audios.length && !images.length && !videos.length && !firstFrame.length && !lastFrame.length) {
    errors.push(t('validate.audioNeedsCompanion'))
  }

  return errors
}

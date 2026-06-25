import type { SeedanceModel, VideoParams } from '@/types'
import { MODEL_META } from './models'

export const DURATION_MIN = 4
export const DURATION_MAX = 15

export const PROMPT_MAX = 4000
export const PROMPT_SUGGEST = 500

export function defaultParams(model: SeedanceModel = 'doubao-seedance-2.0'): VideoParams {
  const meta = MODEL_META[model]
  return {
    model,
    ratio: '16:9',
    duration: 5,
    resolution: meta.maxResolution === '1080p' ? '720p' : '720p',
    seed: undefined,
    generateAudio: false,
    watermark: false,
    returnLastFrame: false,
    webSearch: false,
  }
}

// 默认轮询参数
export const DEFAULT_POLL_INTERVAL_SEC = 5
// 轮询按总耗时封顶（视频生成本就慢，不再按固定次数误杀）
export const POLL_MAX_DURATION_SEC = 60 * 60        // 60 分钟
export const POLL_LOG_EVERY_SEC = 30                 // 每 30 秒记一次 running 心跳日志
export const RECOVER_DELAY_MS = 10_000
export const RECOVER_MAX_ATTEMPTS = 12

// 默认请求超时（秒）；submit 单次请求可较长
export const DEFAULT_TIMEOUT_SEC = 60
export const SUBMIT_TIMEOUT_SEC = 300

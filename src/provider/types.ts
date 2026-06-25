import type { ProviderProfile, ProxyConfig, StoredAsset, VideoTask } from '@/types'

export interface SubmitContext {
  task: VideoTask
  assets: StoredAsset[]           // 已解析的素材
  profile: ProviderProfile
  proxy?: ProxyConfig
  signal: AbortSignal
  timeoutSec?: number             // submit 单次请求超时
  onEnqueued: (remoteTaskId: string) => void
  onProgress?: (p: number) => void
}

export type PollStatus = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired'

export interface PollResult {
  status: PollStatus
  progress?: number
  videoUrl?: string
  coverUrl?: string
  lastFrameUrl?: string
  error?: string
  details?: Record<string, unknown>
}

export interface VideoProvider {
  submit(ctx: SubmitContext): Promise<{ remoteTaskId: string }>
  poll(profile: ProviderProfile, remoteTaskId: string, signal: AbortSignal, proxy?: ProxyConfig): Promise<PollResult>
  cancel?(profile: ProviderProfile, remoteTaskId: string, signal: AbortSignal, proxy?: ProxyConfig): Promise<void>
}

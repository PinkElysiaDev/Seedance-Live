// 领域类型定义

// 模型标识
export type SeedanceModel =
  | 'doubao-seedance-2.0'
  | 'doubao-seedance-2.0-fast'
  | 'doubao-seedance-2.0-face'
  | 'doubao-seedance-2.0-fast-face'

// 素材角色
export type AssetRole = 'firstFrame' | 'lastFrame' | 'referenceImage' | 'referenceVideo' | 'referenceAudio'
export type AssetKind = 'image' | 'video' | 'audio'

// 比例
export type VideoRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9' | 'adaptive'
export type VideoResolution = '480p' | '720p' | '1080p'

// 已入库的素材（blob 数据另存 db.blobs，这里只持引用）
export interface StoredAsset {
  id: string
  role: AssetRole
  kind: AssetKind
  blobId: string          // 指向 db.blobs
  name: string
  mime: string
  size: number
  width?: number
  height?: number
  durationMs?: number
  // 若素材来自公网 URL 或 asset://，提交时直传而不转 dataUrl
  sourceUrl?: string
  createdAt: number
}

// 生成参数（字段名对齐火山官方）
export interface VideoParams {
  model: SeedanceModel
  ratio: VideoRatio
  duration: number        // 4–15
  resolution: VideoResolution
  seed?: number
  generateAudio: boolean
  watermark: boolean
  returnLastFrame: boolean
  webSearch: boolean
}

// 任务状态（对齐 Seedance 原生枚举）
export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired'

export interface VideoTask {
  id: string
  prompt: string
  params: VideoParams
  assetIds: string[]              // 关联素材 id
  // provider
  providerId: string              // profile id
  providerKind: 'seedance' | 'custom'
  // 远程任务
  remoteTaskId?: string
  remoteStatus?: string
  progress?: number               // 0–100
  // 结果
  videoBlobId?: string            // 下载后的本地 blob
  videoUrl?: string               // 远程临时 URL（可能过期，仅 fallback）
  coverImageId?: string           // 首帧截图
  lastFrameImageId?: string       // 续帧用末帧
  cost?: number
  // 状态
  status: TaskStatus
  recoverable: boolean            // 网络中断后可继续轮询
  error: string | null
  errorDetails?: Record<string, unknown>
  createdAt: number
  finishedAt: number | null
  elapsed: number | null
  // 续帧链
  parentTaskId?: string
}

// 完全自定义接口的请求模板
export interface CustomTemplate {
  // 提交
  submitUrl: string                 // 可含 {{baseUrl}}，或完整 URL
  submitMethod: 'POST' | 'GET' | 'PUT' | 'DELETE'
  submitHeaders: Record<string, string>   // 值可含 {{apiKey}}
  submitBody: string                // JSON 模板文本，含 {{prompt}} 等占位
  // 轮询
  pollUrl: string                   // 含 {{taskId}}
  pollMethod: 'POST' | 'GET'
  pollHeaders: Record<string, string>
  // 响应提取
  taskIdPath: string
  statusPath: string
  successValues: string[]
  failureValues: string[]
  videoUrlPath: string
  lastFrameUrlPath?: string
  errorPath?: string
  progressPath?: string
  pollIntervalSec: number
}

// 供应商 profile
export interface ProviderProfile {
  id: string
  name: string
  kind: 'seedance' | 'custom'
  baseUrl: string
  apiKey: string
  timeout: number                 // 秒
  model?: string                  // 模型名覆盖（custom 经 {{model}} 注入；seedance 覆盖 params.model）
  custom?: CustomTemplate
}

export type ProxyMode = 'path' | 'query'

export interface ProxyConfig {
  enabled: boolean
  url: string                     // 用户自备代理地址
  mode: ProxyMode
}

export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface AppSettings {
  profiles: ProviderProfile[]
  activeProfileId: string
  proxy: ProxyConfig
  // 通用偏好
  clearComposerAfterSubmit: boolean
  defaultModel: SeedanceModel
  pollIntervalSec: number         // 官方 provider 轮询间隔
  notifyOnComplete: boolean
  verboseLogs: boolean            // 详细日志开关
  llmConfig?: LlmConfig           // AI 辅助解析用大模型
}

// HTTP 错误类型，供 store 判断是否可恢复
export type HttpErrorKind = 'network' | 'timeout' | 'http' | 'cors' | 'abort'

export class HttpError extends Error {
  kind: HttpErrorKind
  status?: number
  constructor(message: string, kind: HttpErrorKind, status?: number) {
    super(message)
    this.name = 'HttpError'
    this.kind = kind
    this.status = status
  }
}

// 判断错误是否可恢复（网络/超时 → 后续可继续轮询）
export function isRecoverableError(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.kind === 'network' || err.kind === 'timeout' || err.kind === 'cors'
  }
  return false
}

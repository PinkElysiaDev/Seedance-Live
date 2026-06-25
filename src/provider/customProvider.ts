import type { CustomTemplate, ProviderProfile, ProxyConfig, StoredAsset } from '@/types'
import { httpFetch } from '@/net/httpClient'
import { getByPath } from '@/lib/path'
import { renderTemplate, type TemplateVars } from '@/lib/template'
import { resolveAssetForApi } from '@/lib/asset'
import { log } from '@/lib/logger'
import type { PollResult, SubmitContext, VideoProvider } from './types'

// 把素材分组解析为 URL/dataUrl 数组，用于模板 vars
async function resolveAssetArrays(assets: StoredAsset[]): Promise<{
  images: string[]
  firstFrameImages: string[]
  lastFrameImages: string[]
  referenceImages: string[]
  referenceVideos: string[]
  referenceAudios: string[]
}> {
  const byRole = (role: StoredAsset['role']) => assets.filter((a) => a.role === role)
  const resolveAll = (arr: StoredAsset[]) => Promise.all(arr.map((a) => resolveAssetForApi(a).catch(() => null))).then((r) => r.filter((v): v is string => !!v))

  const [firstFrameImages, lastFrameImages, referenceImages, referenceVideos, referenceAudios] = await Promise.all([
    resolveAll(byRole('firstFrame')),
    resolveAll(byRole('lastFrame')),
    resolveAll(byRole('referenceImage')),
    resolveAll(byRole('referenceVideo')),
    resolveAll(byRole('referenceAudio')),
  ])
  return {
    images: [...firstFrameImages, ...lastFrameImages, ...referenceImages],
    firstFrameImages,
    lastFrameImages,
    referenceImages,
    referenceVideos,
    referenceAudios,
  }
}

function buildVars(ctx: SubmitContext, arrays: Awaited<ReturnType<typeof resolveAssetArrays>>): TemplateVars {
  const p = ctx.task.params
  return {
    prompt: ctx.task.prompt,
    model: ctx.profile.model ?? p.model,
    ratio: p.ratio,
    resolution: p.resolution,
    duration: p.duration,
    seed: p.seed,
    generateAudio: p.generateAudio,
    watermark: p.watermark,
    returnLastFrame: p.returnLastFrame,
    webSearch: p.webSearch,
    baseUrl: ctx.profile.baseUrl,
    apiKey: ctx.profile.apiKey,
    ...arrays,
  }
}

function renderHeaders(headers: Record<string, string>, vars: TemplateVars): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = renderTemplate(v, vars, 'raw')
  }
  return out
}

// progress 兼容数字与 "100%" 字符串
export function parseProgress(raw: unknown): number | undefined {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n)) return n
  }
  return undefined
}

// URL 去重连续斜杠，但保留协议头 https://
export function normalizeUrl(url: string): string {
  return url.replace(/([^:])\/{2,}/g, '$1/')
}

export const customProvider: VideoProvider = {
  async submit(ctx: SubmitContext): Promise<{ remoteTaskId: string }> {
    const { task, assets, profile, proxy, signal } = ctx
    const tpl = profile.custom as CustomTemplate | undefined
    if (!tpl) throw new Error('自定义接口缺少请求模板')

    const arrays = await resolveAssetArrays(assets)

    if (arrays.images.length > 0 && !/\{\{\s*(images|firstFrameImages|lastFrameImages|referenceImages)\s*\}\}/.test(tpl.submitBody)) {
      log.warn('submit', `检测到 ${arrays.images.length} 张图片素材，但 body 模板未引用 {{images}}，图片将不会传给 API。请在 body 中添加 "images": {{images}}`, undefined, task.id)
    }

    const vars = buildVars(ctx, arrays)
    const url = normalizeUrl(renderTemplate(tpl.submitUrl, vars, 'raw'))
    const headers = renderHeaders(tpl.submitHeaders, vars)
    const body = renderTemplate(tpl.submitBody, vars, 'json')

    const bodyPreview = JSON.stringify(safeParseJson(body)).replace(/data:[^",}\]]+/g, 'data:…(redacted)')
    log.info('submit', `提交自定义任务 → ${url}`, { body: bodyPreview }, task.id)

    const res = await httpFetch<unknown>(url, {
      method: tpl.submitMethod,
      headers,
      body,
      timeoutSec: ctx.timeoutSec ?? profile.timeout,
      signal,
      proxy,
      logCategory: 'submit',
      taskId: task.id,
    })

    log.debug('submit', '提交原始响应', res, task.id)

    const taskId = getByPath(res, tpl.taskIdPath)
    if (typeof taskId !== 'string' || !taskId) {
      log.error('submit', '提交响应未包含任务 ID', { path: tpl.taskIdPath, response: res }, task.id)
      throw new Error('提交响应未包含任务 ID')
    }
    log.info('submit', `已入队 taskId=${taskId}`, undefined, task.id)
    ctx.onEnqueued(taskId)
    return { remoteTaskId: taskId }
  },

  async poll(
    profile: ProviderProfile,
    remoteTaskId: string,
    signal: AbortSignal,
    proxy?: ProxyConfig,
  ): Promise<PollResult> {
    const tpl = profile.custom as CustomTemplate | undefined
    if (!tpl) throw new Error('自定义接口缺少请求模板')

    const vars: TemplateVars = {
      prompt: '', model: profile.model ?? '', ratio: '', resolution: '', duration: 0,
      generateAudio: false, watermark: false, returnLastFrame: false, webSearch: false,
      images: [], firstFrameImages: [], lastFrameImages: [], referenceImages: [], referenceVideos: [], referenceAudios: [],
      baseUrl: profile.baseUrl, apiKey: profile.apiKey, taskId: remoteTaskId,
    }
    const url = normalizeUrl(renderTemplate(tpl.pollUrl, vars, 'raw'))
    const headers = renderHeaders(tpl.pollHeaders, vars)

    const res = await httpFetch<unknown>(url, {
      method: tpl.pollMethod,
      headers,
      timeoutSec: profile.timeout,
      signal,
      proxy,
      logCategory: 'poll',
    })

    log.debug('poll', '轮询原始响应', res)

    const statusRaw = getByPath(res, tpl.statusPath)
    const status = String(statusRaw ?? '').toLowerCase()
    log.info('poll', `状态提取：statusPath="${tpl.statusPath}" → raw=${JSON.stringify(statusRaw)} → normalized="${status}"`)
    if (tpl.successValues.some((v) => v.toLowerCase() === status)) {
      const videoUrl = getByPath(res, tpl.videoUrlPath)
      if (typeof videoUrl !== 'string' || !videoUrl) {
        log.error('poll', '任务成功但未返回视频 URL', { path: tpl.videoUrlPath, response: res })
        return { status: 'failed', error: '任务成功但未返回视频 URL' }
      }
      const lastFrameUrl = tpl.lastFrameUrlPath ? (getByPath(res, tpl.lastFrameUrlPath) as string | undefined) : undefined
      log.info('poll', `任务成功 videoUrl=${videoUrl.slice(0, 80)}`, undefined)
      return { status: 'succeeded', videoUrl, lastFrameUrl }
    }
    if (tpl.failureValues.some((v) => v.toLowerCase() === status)) {
      const errMsg = tpl.errorPath ? (getByPath(res, tpl.errorPath) as string | undefined) : undefined
      const details: Record<string, unknown> = {}
      const raw = res as Record<string, unknown>
      if (raw.quota_refunded != null) details.quota_refunded = raw.quota_refunded
      if (raw.progress != null) details.progress = raw.progress
      if (raw.created_at) details.created_at = raw.created_at
      if (raw.updated_at) details.updated_at = raw.updated_at
      if (raw.status) details.remote_status = raw.status
      if (raw.error != null) details.error = raw.error
      log.warn('poll', `任务失败 status=${status}`, { error: errMsg, response: JSON.stringify(res) })
      return { status: 'failed', error: errMsg || `视频生成${status || '失败'}`, details: Object.keys(details).length > 0 ? details : undefined }
    }
    const progressRaw = tpl.progressPath ? getByPath(res, tpl.progressPath) : undefined
    return { status: 'running', progress: parseProgress(progressRaw) }
  },
}

function safeParseJson(s: string): unknown {
  try { return JSON.parse(s) } catch { return s }
}

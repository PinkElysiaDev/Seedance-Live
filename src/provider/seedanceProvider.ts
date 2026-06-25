import type { ProviderProfile, ProxyConfig, VideoParams } from '@/types'
import { httpFetch, buildApiUrl } from '@/net/httpClient'
import { buildSeedancePayload } from './seedancePayload'
import { log } from '@/lib/logger'
import type { PollResult, SubmitContext, VideoProvider } from './types'

// 火山 Seedance 响应里的任务对象
interface SeedanceTask {
  id?: string
  task_id?: string
  status?: string
  error?: { code?: string; message?: string } | null
  content?: { video_url?: string; last_frame_url?: string } | null
}

// 从提交响应里取 task id（兼容多种包装）
function extractTaskId(payload: unknown): string {
  if (payload == null) throw new Error('提交响应为空')
  const obj = payload as Record<string, unknown>
  const direct = (obj.id ?? obj.task_id) as string | undefined
  if (direct) return direct
  const inner = (obj.data ?? obj.result) as Record<string, unknown> | undefined
  const innerId = inner ? ((inner.id ?? inner.task_id) as string | undefined) : undefined
  if (innerId) return innerId
  throw new Error('提交响应未包含任务 ID')
}

function parseTask(payload: unknown): SeedanceTask {
  const obj = payload as Record<string, unknown>
  // 兼容 { data: {...} } 包装
  const inner = (obj.data ?? obj.result ?? obj) as SeedanceTask
  return inner
}

function authHeaders(profile: ProviderProfile, json = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${profile.apiKey}`,
  }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

export const seedanceProvider: VideoProvider = {
  async submit(ctx: SubmitContext): Promise<{ remoteTaskId: string }> {
    const { task, assets, profile, proxy, signal } = ctx
    // model 覆盖：profile.model 优先
    const effectiveParams = { ...task.params, model: (profile.model || task.params.model) as VideoParams['model'] }
    const payload = await buildSeedancePayload(effectiveParams, task.prompt, assets)
    const url = buildApiUrl(profile.baseUrl, '/contents/generations/tasks')
    log.info('submit', `提交火山原生任务 → ${url}`, { model: effectiveParams.model, prompt: task.prompt.slice(0, 80) }, task.id)
    const res = await httpFetch<unknown>(url, {
      method: 'POST',
      headers: authHeaders(profile),
      body: JSON.stringify(payload),
      timeoutSec: ctx.timeoutSec ?? profile.timeout,
      signal,
      proxy,
      logCategory: 'submit',
      taskId: task.id,
    })
    log.debug('submit', '提交原始响应', res, task.id)
    const remoteTaskId = extractTaskId(res)
    log.info('submit', `已入队 taskId=${remoteTaskId}`, undefined, task.id)
    ctx.onEnqueued(remoteTaskId)
    return { remoteTaskId }
  },

  async poll(
    profile: ProviderProfile,
    remoteTaskId: string,
    signal: AbortSignal,
    proxy?: ProxyConfig,
  ): Promise<PollResult> {
    const url = buildApiUrl(profile.baseUrl, `/contents/generations/tasks/${encodeURIComponent(remoteTaskId)}`)
    const res = await httpFetch<unknown>(url, {
      method: 'GET',
      headers: authHeaders(profile, false),
      timeoutSec: profile.timeout,
      signal,
      proxy,
      logCategory: 'poll',
    })
    log.debug('poll', '轮询原始响应', res)
    const task = parseTask(res)
    const status = (task.status ?? '').toLowerCase()
    if (status === 'succeeded') {
      const videoUrl = task.content?.video_url
      if (!videoUrl) {
        log.error('poll', '任务成功但未返回视频 URL', res)
        return { status: 'failed', error: '任务成功但未返回视频 URL' }
      }
      log.info('poll', `任务成功 videoUrl=${videoUrl.slice(0, 80)}`, undefined)
      return {
        status: 'succeeded',
        videoUrl,
        lastFrameUrl: task.content?.last_frame_url,
      }
    }
    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      log.warn('poll', `任务${status}`, { error: task.error?.message })
      return { status: status as PollResult['status'], error: task.error?.message || `视频生成${status}` }
    }
    // queued / running / 未知
    return { status: 'running' }
  },
}

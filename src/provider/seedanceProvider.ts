import type { ProviderProfile, ProxyConfig, VideoParams } from '@/types'
import { httpFetch, buildApiUrl } from '@/net/httpClient'
import { buildSeedancePayload } from './seedancePayload'
import { log } from '@/lib/logger'
import { useI18nStore } from '@/stores/i18n'
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
  const { t } = useI18nStore()
  if (payload == null) throw new Error(t('error.emptySubmitResponse'))
  const obj = payload as Record<string, unknown>
  const direct = (obj.id ?? obj.task_id) as string | undefined
  if (direct) return direct
  const inner = (obj.data ?? obj.result) as Record<string, unknown> | undefined
  const innerId = inner ? ((inner.id ?? inner.task_id) as string | undefined) : undefined
  if (innerId) return innerId
  throw new Error(t('error.noTaskIdInResponse'))
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
    const { t } = useI18nStore()
    const { task, assets, profile, proxy, signal } = ctx
    // model 覆盖：profile.model 优先
    const effectiveParams = { ...task.params, model: (profile.model || task.params.model) as VideoParams['model'] }
    const payload = await buildSeedancePayload(effectiveParams, task.prompt, assets)
    const url = buildApiUrl(profile.baseUrl, '/contents/generations/tasks')
    log.info('submit', t('log.submitVolcano', { url }), { model: effectiveParams.model, prompt: task.prompt.slice(0, 80) }, task.id)
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
    log.debug('submit', t('log.rawSubmitResponse'), res, task.id)
    const remoteTaskId = extractTaskId(res)
    log.info('submit', t('log.enqueuedLocal', { id: remoteTaskId }), undefined, task.id)
    ctx.onEnqueued(remoteTaskId)
    return { remoteTaskId }
  },

  async poll(
    profile: ProviderProfile,
    remoteTaskId: string,
    signal: AbortSignal,
    proxy?: ProxyConfig,
  ): Promise<PollResult> {
    const { t } = useI18nStore()
    const url = buildApiUrl(profile.baseUrl, `/contents/generations/tasks/${encodeURIComponent(remoteTaskId)}`)
    const res = await httpFetch<unknown>(url, {
      method: 'GET',
      headers: authHeaders(profile, false),
      timeoutSec: profile.timeout,
      signal,
      proxy,
      logCategory: 'poll',
    })
    log.debug('poll', t('log.rawPollResponse'), res)
    const task = parseTask(res)
    const status = (task.status ?? '').toLowerCase()
    if (status === 'succeeded') {
      const videoUrl = task.content?.video_url
      if (!videoUrl) {
        log.error('poll', t('error.noVideoUrl'), res)
        return { status: 'failed', error: t('error.noVideoUrl') }
      }
      log.info('poll', t('log.successVideoUrl', { url: videoUrl.slice(0, 80) }), undefined)
      return {
        status: 'succeeded',
        videoUrl,
        lastFrameUrl: task.content?.last_frame_url,
      }
    }
    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      log.warn('poll', t('log.taskStatus', { status }), { error: task.error?.message })
      return { status: status as PollResult['status'], error: task.error?.message || t('error.genFailed', { status }) }
    }
    // queued / running / 未知
    return { status: 'running' }
  },
}

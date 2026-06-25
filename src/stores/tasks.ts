import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { VideoTask, StoredAsset } from '@/types'
import { genId } from '@/lib/id'
import { isRecoverableError, type ProxyConfig } from '@/types'
import { resolveProvider } from '@/provider/resolve'
import type { SubmitContext } from '@/provider/types'
import { validateTask } from '@/lib/validate'
import { captureCover } from '@/lib/video'
import { blobToDataUrl, isHttpUrl, dataUrlToBlob } from '@/lib/blob'
import {
  putTask,
  getAllTasks,
  deleteTask as dbDeleteTask,
  putBlob,
  putCover,
  putAsset,
  getAssets,
  getBlob,
  getCover,
  deleteBlob,
  deleteCover,
  getAllAssets,
  getAllBlobs,
  getAllCovers,
} from '@/db/repos'
import {
  POLL_MAX_DURATION_SEC,
  POLL_LOG_EVERY_SEC,
  SUBMIT_TIMEOUT_SEC,
  RECOVER_DELAY_MS,
  RECOVER_MAX_ATTEMPTS,
} from '@/config/options'
import { log } from '@/lib/logger'
import { useSettingsStore } from './settings'
import { useComposerStore } from './composer'

// 模块级调度状态
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const abortControllers = new Map<string, AbortController>()
const recoverAttempts = new Map<string, number>()

function clearTimer(taskId: string) {
  const t = timers.get(taskId)
  if (t) {
    clearTimeout(t)
    timers.delete(taskId)
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      timers.delete('__sleep')
      resolve()
    }, ms)
    timers.set('__sleep', t)
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(t)
        reject(new Error('aborted'))
      }, { once: true })
    }
  })
}

// 下载远程视频为 Blob（CORS 失败则返回 null，调用方保留远程 URL 兜底）
async function downloadVideoBlob(url: string, signal: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('video/') && blob.size === 0) return null
    return blob
  } catch {
    return null
  }
}

async function downloadImageCover(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const blob = await res.blob()
    return blobToDataUrl(blob)
  } catch {
    return null
  }
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<VideoTask[]>([])
  const initialized = ref(false)

  function findTask(id: string): VideoTask | undefined {
    return tasks.value.find((t) => t.id === id)
  }

  async function updateTask(id: string, patch: Partial<VideoTask>) {
    const idx = tasks.value.findIndex((t) => t.id === id)
    if (idx < 0) return
    tasks.value[idx] = { ...tasks.value[idx], ...patch }
    await putTask(tasks.value[idx])
  }

  // —— 提交 ——
  async function submitTask(): Promise<{ ok: boolean; error?: string; taskId?: string }> {
    const composer = useComposerStore()
    const settings = useSettingsStore()
    const profile = settings.activeProfile
    if (!profile) return { ok: false, error: '未选择供应商配置' }
    if (!profile.apiKey.trim()) return { ok: false, error: '请先在设置中填写 API Key' }

    const errors = validateTask(composer.params, composer.prompt, composer.assets)
    if (errors.length) return { ok: false, error: errors[0] }

    const task: VideoTask = {
      id: genId(),
      prompt: composer.prompt.trim(),
      params: { ...composer.params },
      assetIds: [...composer.assetIds],
      providerId: profile.id,
      providerKind: profile.kind,
      status: 'queued',
      recoverable: false,
      error: null,
      createdAt: Date.now(),
      finishedAt: null,
      elapsed: null,
    }
    tasks.value.unshift(task)
    try {
      await putTask(task)
    } catch (err) {
      // 入库失败（如 IndexedDB 序列化问题）：回滚内存、记日志、上报
      tasks.value = tasks.value.filter((t) => t.id !== task.id)
      const msg = `任务持久化失败：${errMessage(err)}`
      log.error('task', msg, undefined, task.id)
      return { ok: false, error: msg }
    }

    if (settings.settings.clearComposerAfterSubmit) composer.clearAfterSubmit()

    void executeTask(task.id)
    return { ok: true, taskId: task.id }
  }

  // —— 执行：提交 + 进入轮询 ——
  async function executeTask(taskId: string) {
    const settings = useSettingsStore()
    const task = findTask(taskId)
    if (!task) return
    const profile = settings.settings.profiles.find((p) => p.id === task.providerId) ?? settings.activeProfile
    const provider = resolveProvider(profile)
    const proxy: ProxyConfig | undefined = settings.proxy.enabled ? settings.proxy : undefined

    const controller = new AbortController()
    abortControllers.set(taskId, controller)

    // 先记日志，再做状态更新：即使后续步骤崩溃，至少留有提交开始的痕迹
    log.info('submit', `开始提交任务（${profile.kind}）`, { profile: profile.name, model: profile.model || task.params.model, prompt: task.prompt.slice(0, 60) }, taskId)
    try {
      await updateTask(taskId, { status: 'running', error: null })
    } catch (err) {
      log.error('submit', `状态更新失败：${errMessage(err)}`, undefined, taskId)
    }

    const assets = await getAssets(task.assetIds)
    const ctx: SubmitContext = {
      task,
      assets,
      profile,
      proxy,
      signal: controller.signal,
      timeoutSec: SUBMIT_TIMEOUT_SEC,
      onEnqueued: async (remoteTaskId) => {
        log.info('submit', `任务已入队 remoteTaskId=${remoteTaskId}`, undefined, taskId)
        await updateTask(taskId, { remoteTaskId, recoverable: false, remoteStatus: 'queued' })
      },
    }

    try {
      await provider.submit(ctx)
      await startPolling(taskId)
    } catch (err) {
      if (controller.signal.aborted) {
        log.info('submit', '提交被取消', undefined, taskId)
        return
      }
      const msg = errMessage(err)
      if (isRecoverableError(err)) {
        log.warn('submit', `提交遇到可恢复错误：${msg}，将稍后重试`, undefined, taskId)
        await markRecoverable(taskId, msg)
        scheduleRecover(taskId)
      } else {
        log.error('submit', `提交失败：${msg}`, undefined, taskId)
        await updateTask(taskId, {
          status: 'failed',
          error: msg,
          finishedAt: Date.now(),
          elapsed: Date.now() - task.createdAt,
        })
      }
    }
  }

  // —— 轮询 ——
  async function startPolling(taskId: string) {
    const settings = useSettingsStore()
    const task = findTask(taskId)
    if (!task || !task.remoteTaskId) {
      log.warn('poll', `无法启动轮询：任务不存在或无 remoteTaskId`, { taskId }, taskId)
      return
    }
    const profile = settings.settings.profiles.find((p) => p.id === task.providerId) ?? settings.activeProfile
    const provider = resolveProvider(profile)
    const proxy: ProxyConfig | undefined = settings.proxy.enabled ? settings.proxy : undefined
    const controller = abortControllers.get(taskId) ?? new AbortController()
    abortControllers.set(taskId, controller)

    const intervalSec =
      profile.kind === 'custom' && profile.custom?.pollIntervalSec
        ? profile.custom.pollIntervalSec
        : settings.settings.pollIntervalSec
    const maxDurationMs = POLL_MAX_DURATION_SEC * 1000
    const startedAt = Date.now()
    let lastHeartbeat = 0
    log.info('poll', `开始轮询 remoteTaskId=${task.remoteTaskId}（间隔 ${intervalSec}s，上限 ${POLL_MAX_DURATION_SEC}s）`, undefined, taskId)

    while (true) {
      if (controller.signal.aborted) {
        log.info('poll', '轮询被取消', undefined, taskId)
        return
      }
      const elapsedMs = Date.now() - startedAt
      if (elapsedMs > maxDurationMs) {
        log.error('poll', `轮询超时（已 ${Math.round(elapsedMs / 1000)}s 超过上限 ${POLL_MAX_DURATION_SEC}s）`, undefined, taskId)
        await updateTask(taskId, {
          status: 'failed',
          error: `视频生成超时（轮询 ${Math.round(elapsedMs / 1000)}s 未完成）`,
          finishedAt: Date.now(),
          elapsed: Date.now() - (findTask(taskId)?.createdAt ?? Date.now()),
        })
        return
      }
      try {
        const result = await provider.poll(profile, task.remoteTaskId, controller.signal, proxy)
        if (result.status === 'succeeded') {
          log.info('poll', '轮询返回成功，开始下载视频', undefined, taskId)
          await finalizeSuccess(taskId, result, controller.signal)
          return
        }
        if (result.status === 'failed' || result.status === 'cancelled' || result.status === 'expired') {
          log.warn('poll', `轮询返回终态：${result.status}`, { error: result.error }, taskId)
          await updateTask(taskId, {
            status: result.status,
            error: result.error ?? `视频生成${result.status}`,
            errorDetails: result.details,
            finishedAt: Date.now(),
            elapsed: Date.now() - (findTask(taskId)?.createdAt ?? Date.now()),
          })
          return
        }
        // running：更新状态，定期心跳日志
        await updateTask(taskId, { remoteStatus: result.status, progress: result.progress })
        const now = Date.now()
        if (now - lastHeartbeat >= POLL_LOG_EVERY_SEC * 1000) {
          lastHeartbeat = now
          log.info('poll', `仍在生成中（已轮询 ${Math.round((now - startedAt) / 1000)}s）`, { remoteStatus: result.status, progress: result.progress }, taskId)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        const msg = errMessage(err)
        if (isRecoverableError(err)) {
          log.warn('poll', `轮询遇到可恢复错误：${msg}，标记为可恢复`, undefined, taskId)
          await markRecoverable(taskId, msg)
          scheduleRecover(taskId)
          return
        }
        // 非 recoverable 错误（如 HTTP 4xx/5xx）：记录后继续轮询，直到总时长耗尽
        log.warn('poll', `轮询请求出错（将继续重试）：${msg}`, undefined, taskId)
      }
      try {
        await sleep(intervalSec * 1000, controller.signal)
      } catch {
        return // aborted
      }
    }
  }

  // 成功收尾：下载视频 blob + 生成 cover + 下载末帧
  async function finalizeSuccess(
    taskId: string,
    result: { videoUrl?: string; lastFrameUrl?: string; coverUrl?: string },
    signal: AbortSignal,
  ) {
    const task = findTask(taskId)
    if (!task) return
    if (!result.videoUrl) {
      await updateTask(taskId, { status: 'failed', error: '任务成功但未返回视频 URL', finishedAt: Date.now() })
      return
    }
    let videoBlobId: string | undefined
    let coverImageId: string | undefined
    let lastFrameImageId: string | undefined
    const fallbackUrl = result.videoUrl

    log.info('poll', `开始下载视频 ${fallbackUrl?.slice(0, 80)}`, undefined, taskId)
    const blob = await downloadVideoBlob(result.videoUrl, signal)
    if (blob) {
      const blobId = genId()
      await putBlob({ id: blobId, buffer: await blob.arrayBuffer(), mime: blob.type || 'video/mp4' })
      videoBlobId = blobId
      log.info('poll', `视频已下载并入库（${blob.size}B）`, undefined, taskId)
      try {
        const cover = await captureCover(blob)
        const coverId = genId()
        await putCover({ id: coverId, dataUrl: cover })
        coverImageId = coverId
      } catch (err) {
        log.warn('poll', `封面截图失败（不影响结果）：${errMessage(err)}`, undefined, taskId)
      }
    } else {
      // 下载失败（常见为 CORS），保留远程 URL 兜底并记日志
      log.warn('poll', `视频下载失败（可能 CORS），保留远程 URL 兜底（有时效，请尽快下载）`, { url: fallbackUrl }, taskId)
    }
    // 末帧续帧图
    if (result.lastFrameUrl) {
      if (isHttpUrl(result.lastFrameUrl)) {
        const coverDataUrl = await downloadImageCover(result.lastFrameUrl, signal)
        if (coverDataUrl) {
          const coverId = genId()
          await putCover({ id: coverId, dataUrl: coverDataUrl })
          lastFrameImageId = coverId
        }
      }
    }

    await updateTask(taskId, {
      status: 'succeeded',
      videoBlobId,
      videoUrl: videoBlobId ? fallbackUrl : fallbackUrl,
      coverImageId,
      lastFrameImageId,
      finishedAt: Date.now(),
      elapsed: Date.now() - task.createdAt,
    })

    const settings = useSettingsStore()
    if (settings.settings.notifyOnComplete && 'Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification('视频生成完成', { body: task.prompt.slice(0, 60) })
        }
      } catch {
        // 忽略
      }
    }
  }

  async function markRecoverable(taskId: string, error: string) {
    log.warn('task', `任务标记为可恢复：${error}`, undefined, taskId)
    await updateTask(taskId, { status: 'running', recoverable: true, error })
  }

  // —— 恢复调度 ——
  function scheduleRecover(taskId: string) {
    clearTimer(taskId)
    const attempts = (recoverAttempts.get(taskId) ?? 0) + 1
    recoverAttempts.set(taskId, attempts)
    if (attempts > RECOVER_MAX_ATTEMPTS) {
      log.error('task', `多次重连失败（${attempts}次），放弃`, undefined, taskId)
      recoverAttempts.delete(taskId)
      void updateTask(taskId, {
        status: 'failed',
        error: '多次重连失败，请检查网络或代理后重试',
        recoverable: false,
        finishedAt: Date.now(),
      })
      return
    }
    log.info('task', `${RECOVER_DELAY_MS / 1000}s 后重试轮询（第 ${attempts}/${RECOVER_MAX_ATTEMPTS} 次）`, undefined, taskId)
    const t = setTimeout(() => {
      timers.delete(taskId)
      void startPolling(taskId)
    }, RECOVER_DELAY_MS)
    timers.set(taskId, t)
  }

  // —— 取消 ——
  async function cancelTask(taskId: string) {
    log.info('task', `取消任务`, undefined, taskId)
    const controller = abortControllers.get(taskId)
    controller?.abort()
    abortControllers.delete(taskId)
    clearTimer(taskId)
    recoverAttempts.delete(taskId)
    await updateTask(taskId, { status: 'cancelled', finishedAt: Date.now(), recoverable: false })
  }

  // —— 重试 ——
  async function retryTask(taskId: string) {
    const task = findTask(taskId)
    if (!task) return
    log.info('task', `重试任务`, undefined, taskId)
    clearTimer(taskId)
    recoverAttempts.delete(taskId)
    abortControllers.delete(taskId)
    await updateTask(taskId, {
      status: 'queued',
      error: null,
      recoverable: false,
      remoteTaskId: undefined,
      remoteStatus: undefined,
      progress: undefined,
      finishedAt: null,
      elapsed: null,
      createdAt: Date.now(),
    })
    void executeTask(taskId)
  }

  // —— 删除 ——
  async function removeTask(taskId: string) {
    await cancelTask(taskId)
    const task = findTask(taskId)
    if (task) {
      // 级联清理 blob/cover
      if (task.videoBlobId) await deleteBlob(task.videoBlobId)
      if (task.coverImageId) await deleteCover(task.coverImageId)
      if (task.lastFrameImageId) await deleteCover(task.lastFrameImageId)
    }
    tasks.value = tasks.value.filter((t) => t.id !== taskId)
    await dbDeleteTask(taskId)
  }

  // —— 续帧：用 parent 的末帧作为新任务首帧 ——
  async function continueFromTask(parentId: string): Promise<{ ok: boolean; error?: string; taskId?: string }> {
    const parent = findTask(parentId)
    if (!parent) return { ok: false, error: '源任务不存在' }
    if (!parent.lastFrameImageId) return { ok: false, error: '源任务未生成末帧，无法续帧' }

    // 取末帧 cover dataUrl，转成 asset 作为新任务首帧
    const cover = await getCover(parent.lastFrameImageId)
    if (!cover) return { ok: false, error: '末帧数据已丢失' }
    // 把末帧 dataUrl 落成 blob + asset
    const blob = await dataUrlToBlob(cover.dataUrl)
    const blobId = genId()
    await putBlob({ id: blobId, buffer: await blob.arrayBuffer(), mime: blob.type || 'image/png' })
    const assetId = genId()
    await putAsset({
      id: assetId,
      role: 'firstFrame',
      kind: 'image',
      blobId,
      name: `续帧-${parentId.slice(0, 8)}.png`,
      mime: blob.type || 'image/png',
      size: blob.size,
      createdAt: Date.now(),
    })

    // 用 composer 草稿参数 + parent 参数创建新任务
    const composer = useComposerStore()
    const task: VideoTask = {
      id: genId(),
      prompt: composer.prompt.trim() || parent.prompt,
      params: { ...parent.params, returnLastFrame: true },
      assetIds: [assetId],
      providerId: parent.providerId,
      providerKind: parent.providerKind,
      status: 'queued',
      recoverable: false,
      error: null,
      createdAt: Date.now(),
      finishedAt: null,
      elapsed: null,
      parentTaskId: parentId,
    }
    tasks.value.unshift(task)
    await putTask(task)
    void executeTask(task.id)
    return { ok: true, taskId: task.id }
  }

  // —— 初始化：从 DB 加载并恢复未完成任务 ——
  async function initTasks() {
    if (initialized.value) return
    const all = await getAllTasks()
    all.sort((a, b) => b.createdAt - a.createdAt)
    tasks.value = all
    initialized.value = true
    log.info('task', `初始化：加载 ${all.length} 个任务`, {
      running: all.filter((t) => t.status === 'running').length,
      queued: all.filter((t) => t.status === 'queued').length,
      succeeded: all.filter((t) => t.status === 'succeeded').length,
      failed: all.filter((t) => t.status === 'failed').length,
    })

    for (const t of all) {
      // 有 remoteTaskId 且处于活跃态（running/queued/recoverable）：恢复轮询
      if (t.remoteTaskId && (t.status === 'running' || t.status === 'queued' || t.recoverable)) {
        log.info('task', `恢复轮询任务 ${t.id}（status=${t.status}, remoteTaskId=${t.remoteTaskId}）`, undefined, t.id)
        // 确保状态为 running 以便 UI 显示
        if (t.status === 'queued') await updateTask(t.id, { status: 'running' })
        setTimeout(() => void startPolling(t.id), 0)
      } else if (t.status === 'running' || t.status === 'queued') {
        // 活跃但无 remoteTaskId（submit 阶段刷新中断）：无法恢复，明确标记
        log.warn('task', `任务 ${t.id} 在提交阶段被刷新中断（无 remoteTaskId），标记为失败`, undefined, t.id)
        await updateTask(t.id, {
          status: 'failed',
          error: '提交阶段被刷新中断，请重试',
          recoverable: false,
          finishedAt: Date.now(),
        })
      }
    }
  }

  // —— 取可播放视频 URL ——
  async function resolveVideoUrl(task: VideoTask): Promise<string | null> {
    if (task.videoBlobId) {
      const stored = await getBlob(task.videoBlobId)
      if (stored) {
        const blob = new Blob([stored.buffer], { type: stored.mime })
        return URL.createObjectURL(blob)
      }
    }
    return task.videoUrl ?? null
  }

  async function resolveCoverUrl(task: VideoTask): Promise<string | null> {
    if (task.coverImageId) {
      const cover = await getCover(task.coverImageId)
      if (cover) return cover.dataUrl
    }
    return null
  }

  async function resolveLastFrameUrl(task: VideoTask): Promise<string | null> {
    if (task.lastFrameImageId) {
      const cover = await getCover(task.lastFrameImageId)
      if (cover) return cover.dataUrl
    }
    return null
  }

  // 续帧链：给定任务，返回从最早祖先到该任务、再到其后代的完整链路（按时间正序）
  function getTaskChain(taskId: string): VideoTask[] {
    const byId = new Map(tasks.value.map((t) => [t.id, t]))
    // 向上追溯祖先
    const ancestors: VideoTask[] = []
    let cur = byId.get(taskId)
    while (cur?.parentTaskId) {
      const parent = byId.get(cur.parentTaskId)
      if (!parent) break
      ancestors.unshift(parent)
      cur = parent
    }
    // 向下递归后代（BFS，按 createdAt 排序）
    const descendants: VideoTask[] = []
    const queue: string[] = [taskId]
    while (queue.length) {
      const id = queue.shift()!
      const children = tasks.value
        .filter((t) => t.parentTaskId === id)
        .sort((a, b) => a.createdAt - b.createdAt)
      for (const c of children) {
        descendants.push(c)
        queue.push(c.id)
      }
    }
    const self = byId.get(taskId)
    return [...ancestors, ...(self ? [self] : []), ...descendants]
  }

  // —— 数据导出：tasks + 素材/blobs/covers ——
  async function exportData(): Promise<string> {
    const [assets, blobs, covers] = await Promise.all([getAllAssets(), getAllBlobs(), getAllCovers()])
    // ArrayBuffer 无法 JSON 序列化，转 number[]
    const blobsSerializable = blobs.map((b) => ({
      id: b.id,
      mime: b.mime,
      buffer: Array.from(new Uint8Array(b.buffer)),
    }))
    const payload = {
      version: 1,
      exportedAt: Date.now(),
      tasks: tasks.value,
      assets,
      blobs: blobsSerializable,
      covers,
    }
    return JSON.stringify(payload)
  }

  // —— 数据导入 ——
  async function importData(json: string): Promise<{ count: number }> {
    const data = JSON.parse(json) as {
      tasks?: VideoTask[]
      assets?: StoredAsset[]
      blobs?: Array<{ id: string; buffer: number[]; mime: string }>
      covers?: Array<{ id: string; dataUrl: string }>
    }
    const incomingTasks = Array.isArray(data.tasks) ? data.tasks : []
    const existingIds = new Set(tasks.value.map((t) => t.id))
    let count = 0
    for (const t of incomingTasks) {
      if (existingIds.has(t.id)) continue
      // 运行中的任务无法恢复轮询，标记为失败
      if (t.status === 'running') {
        t.status = 'failed'
        t.error = t.error || '导入的任务无法恢复轮询'
      }
      t.recoverable = false
      await putTask(t)
      tasks.value.push(t)
      count++
    }
    for (const a of data.assets ?? []) await putAsset(a)
    for (const b of data.blobs ?? []) {
      const buffer = new ArrayBuffer(b.buffer.length)
      new Uint8Array(buffer).set(b.buffer)
      await putBlob({ id: b.id, buffer, mime: b.mime })
    }
    for (const c of data.covers ?? []) await putCover(c)
    tasks.value.sort((a, b) => b.createdAt - a.createdAt)
    return { count }
  }

  return {
    tasks,
    initialized,
    submitTask,
    executeTask,
    cancelTask,
    retryTask,
    removeTask,
    continueFromTask,
    initTasks,
    resolveVideoUrl,
    resolveCoverUrl,
    resolveLastFrameUrl,
    getTaskChain,
    exportData,
    importData,
    updateTask,
  }
})

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

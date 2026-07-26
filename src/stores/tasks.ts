import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'
import type { ProxyConfig, StoredAsset, VideoTask } from '@/types'
import { generateId } from '@/lib/id'
import { validateTask } from '@/lib/validate'
import { dataUrlToBlob } from '@/lib/blob'
import {
  deleteBlob,
  deleteCover,
  deleteAsset,
  deleteTask as dbDeleteTask,
  getAsset,
  getAllTasks,
  getBlob,
  getCover,
  putContinueFrame,
  putTask,
} from '@/db/repos'
import { StorageError } from '@/db/index'
import { createTaskRunner } from '@/scheduler/taskRunner'
import { exportTaskBackup, importTaskBackup } from '@/services/taskBackup'
import { log } from '@/lib/logger'
import { useI18nStore } from './i18n'
import { useSettingsStore } from './settings'
import { useComposerStore } from './composer'
import { useToastStore } from './toast'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<VideoTask[]>([])
  const isInitialized = ref(false)
  const { t: tr } = useI18nStore()
  const toast = useToastStore()
  let lastStorageToastAt = 0

  function findTask(id: string): VideoTask | undefined {
    return tasks.value.find((task) => task.id === id)
  }

  function replaceTask(task: VideoTask) {
    const index = tasks.value.findIndex((item) => item.id === task.id)
    if (index >= 0) tasks.value[index] = task
  }

  async function updateTask(id: string, patch: Partial<VideoTask>) {
    const current = findTask(id)
    if (!current) return
    const next = { ...current, ...patch }
    await putTask(next)
    replaceTask(next)
  }

  function notifyStorageError(error: unknown) {
    if (!(error instanceof StorageError)) return
    const now = Date.now()
    if (now - lastStorageToastAt < 3000) return
    lastStorageToastAt = now
    const key = error.kind === 'quota' ? 'toast.storageQuota' : 'toast.storageUnavailable'
    toast.show(tr(key), 'error', 7000)
    log.error('task', tr(key), error.message)
  }

  function getProfile(task: VideoTask) {
    const settings = useSettingsStore()
    return settings.settings.profiles.find((profile) => profile.id === task.providerId) ?? settings.activeProfile
  }

  function getProxy(): ProxyConfig | undefined {
    const settings = useSettingsStore()
    return settings.proxy.enabled ? settings.proxy : undefined
  }

  function notifySucceeded(task: VideoTask) {
    const settings = useSettingsStore()
    if (!settings.settings.notifyOnComplete || !('Notification' in window)) return
    try {
      if (Notification.permission === 'granted') {
        new Notification(tr('notify.title'), { body: task.prompt.slice(0, 60) })
      }
    } catch {
      // 浏览器拒绝通知时不影响任务状态。
    }
  }

  const runner = createTaskRunner({
    getTask: findTask,
    patchTask: updateTask,
    replaceTask,
    getProfile,
    getProxy,
    getPollIntervalSec: () => useSettingsStore().settings.pollIntervalSec,
    translate: tr,
    onStorageError: notifyStorageError,
    onSucceeded: notifySucceeded,
  })
  onScopeDispose(() => runner.dispose())

  async function submitTask(): Promise<{ ok: boolean; error?: string; taskId?: string }> {
    const composer = useComposerStore()
    const settings = useSettingsStore()
    const profile = settings.activeProfile
    if (!profile) return { ok: false, error: tr('error.noProvider') }
    if (!profile.apiKey.trim()) return { ok: false, error: tr('error.apiKeyMissing') }

    const errors = validateTask(composer.params, composer.prompt, composer.assets)
    if (errors.length) return { ok: false, error: errors[0] }

    const task: VideoTask = {
      id: generateId(),
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
    } catch (error) {
      tasks.value = tasks.value.filter((item) => item.id !== task.id)
      notifyStorageError(error)
      const message = tr('error.persistFailed', { msg: errorMessage(error) })
      return { ok: false, error: message }
    }

    if (settings.settings.clearComposerAfterSubmit) composer.clearAfterSubmit()
    void runner.execute(task.id)
    return { ok: true, taskId: task.id }
  }

  async function cancelTask(taskId: string) {
    const task = findTask(taskId)
    if (!task) return
    runner.cancel(taskId)
    const cancelled: VideoTask = {
      ...task,
      status: 'cancelled',
      recoverable: false,
      finishedAt: Date.now(),
    }
    replaceTask(cancelled)
    try {
      await putTask(cancelled)
    } catch (error) {
      notifyStorageError(error)
    }
  }

  async function retryTask(taskId: string) {
    const task = findTask(taskId)
    if (!task) return
    runner.reset(taskId)
    const retried: VideoTask = {
      ...task,
      status: 'queued',
      error: null,
      errorDetails: undefined,
      recoverable: false,
      remoteTaskId: undefined,
      remoteStatus: undefined,
      progress: undefined,
      finishedAt: null,
      elapsed: null,
      createdAt: Date.now(),
    }
    try {
      await putTask(retried)
    } catch (error) {
      notifyStorageError(error)
    }
    replaceTask(retried)
    void runner.execute(taskId)
  }

  async function removeTask(taskId: string) {
    runner.cancel(taskId)
    const task = findTask(taskId)
    if (task) {
      if (task.videoBlobId) await deleteBlob(task.videoBlobId)
      if (task.coverImageId) await deleteCover(task.coverImageId)
      if (task.lastFrameImageId) await deleteCover(task.lastFrameImageId)
      // 清理输入素材：仅删除不被其他任务引用的
      const otherAssetIds = new Set(
        tasks.value.filter((t) => t.id !== taskId).flatMap((t) => t.assetIds),
      )
      for (const assetId of task.assetIds) {
        if (otherAssetIds.has(assetId)) continue
        const asset = await getAsset(assetId)
        if (asset?.blobId) await deleteBlob(asset.blobId)
        await deleteAsset(assetId)
      }
    }
    await dbDeleteTask(taskId)
    tasks.value = tasks.value.filter((item) => item.id !== taskId)
  }

  async function clearAllTasks(): Promise<{ removed: number; failed: number }> {
    let removed = 0
    let failed = 0
    for (const task of [...tasks.value]) {
      try {
        await removeTask(task.id)
        removed += 1
      } catch (error) {
        failed += 1
        notifyStorageError(error)
      }
    }
    return { removed, failed }
  }

  async function continueFromTask(parentId: string): Promise<{ ok: boolean; error?: string; taskId?: string }> {
    const parent = findTask(parentId)
    if (!parent) return { ok: false, error: tr('error.continueSourceMissing') }
    if (!parent.lastFrameImageId) return { ok: false, error: tr('error.continueNoLastFrame') }

    try {
      const cover = await getCover(parent.lastFrameImageId)
      if (!cover) return { ok: false, error: tr('error.continueCoverLost') }
      const blob = await dataUrlToBlob(cover.dataUrl)
      const blobId = generateId()
      const assetId = generateId()
      const asset: StoredAsset = {
        id: assetId,
        role: 'firstFrame',
        kind: 'image',
        blobId,
        name: `续帧-${parentId.slice(0, 8)}.png`,
        mime: blob.type || 'image/png',
        size: blob.size,
        createdAt: Date.now(),
      }

      const composer = useComposerStore()
      const task: VideoTask = {
        id: generateId(),
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

      await putContinueFrame({
        blob: { id: blobId, buffer: await blob.arrayBuffer(), mime: blob.type || 'image/png' },
        asset,
        task,
      })
      tasks.value.unshift(task)
      void runner.execute(task.id)
      return { ok: true, taskId: task.id }
    } catch (error) {
      notifyStorageError(error)
      return { ok: false, error: errorMessage(error) }
    }
  }

  async function initTasks() {
    if (isInitialized.value) return
    const all = await getAllTasks()
    all.sort((left, right) => right.createdAt - left.createdAt)
    tasks.value = all
    isInitialized.value = true

    for (const task of all) {
      if (task.remoteTaskId && (task.status === 'running' || task.status === 'queued' || task.recoverable)) {
        if (task.status === 'queued') await updateTask(task.id, { status: 'running' })
        setTimeout(() => void runner.resumePolling(task.id), 0)
      } else if (task.status === 'running' || task.status === 'queued') {
        await updateTask(task.id, {
          status: 'failed',
          error: tr('error.submitInterrupted'),
          recoverable: false,
          finishedAt: Date.now(),
        })
      }
    }
  }

  async function resolveVideoUrl(task: VideoTask): Promise<string | null> {
    if (task.videoBlobId) {
      const stored = await getBlob(task.videoBlobId)
      if (stored) return URL.createObjectURL(new Blob([stored.buffer], { type: stored.mime }))
    }
    return task.videoUrl ?? null
  }

  async function resolveCoverDataUrl(id?: string): Promise<string | null> {
    if (!id) return null
    return (await getCover(id))?.dataUrl ?? null
  }

  function getTaskChain(taskId: string): VideoTask[] {
    const byId = new Map(tasks.value.map((task) => [task.id, task]))
    const ancestors: VideoTask[] = []
    let current = byId.get(taskId)
    const visited = new Set<string>()
    while (current?.parentTaskId && !visited.has(current.parentTaskId)) {
      visited.add(current.parentTaskId)
      const parent = byId.get(current.parentTaskId)
      if (!parent) break
      ancestors.unshift(parent)
      current = parent
    }
    const descendants: VideoTask[] = []
    const queue = [taskId]
    while (queue.length) {
      const id = queue.shift()!
      const children = tasks.value
        .filter((task) => task.parentTaskId === id && !visited.has(task.id))
        .sort((left, right) => left.createdAt - right.createdAt)
      for (const child of children) {
        visited.add(child.id)
        descendants.push(child)
        queue.push(child.id)
      }
    }
    const self = byId.get(taskId)
    return [...ancestors, ...(self ? [self] : []), ...descendants]
  }

  async function exportData(): Promise<string> {
    return exportTaskBackup(tasks.value)
  }

  async function importData(json: string): Promise<{ imported: number; skipped: number }> {
    try {
      const result = await importTaskBackup(json, tasks.value, tr('error.importedNotResumable'))
      tasks.value.push(...result.tasks)
      tasks.value.sort((left, right) => right.createdAt - left.createdAt)
      return { imported: result.imported, skipped: result.skipped }
    } catch (error) {
      notifyStorageError(error)
      throw error
    }
  }

  return {
    tasks,
    isInitialized,
    submitTask,
    cancelTask,
    retryTask,
    removeTask,
    clearAllTasks,
    continueFromTask,
    initTasks,
    resolveVideoUrl,
    resolveCoverUrl: (task: VideoTask) => resolveCoverDataUrl(task.coverImageId),
    resolveLastFrameUrl: (task: VideoTask) => resolveCoverDataUrl(task.lastFrameImageId),
    getTaskChain,
    exportData,
    importData,
    updateTask,
  }
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

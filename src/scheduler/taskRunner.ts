import type { ProviderProfile, ProxyConfig, VideoTask } from '@/types'
import { isRecoverableError } from '@/types'
import type { SubmitContext } from '@/provider/types'
import { resolveProvider } from '@/provider/resolve'
import { getAssets } from '@/db/repos'
import { saveTaskResult } from '@/services/taskResult'
import { log } from '@/lib/logger'
import {
  POLL_LOG_EVERY_SEC,
  POLL_MAX_DURATION_SEC,
  RECOVER_DELAY_MS,
  RECOVER_MAX_ATTEMPTS,
  SUBMIT_TIMEOUT_SEC,
} from '@/config/options'

export interface TaskRunnerDependencies {
  getTask: (taskId: string) => VideoTask | undefined
  patchTask: (taskId: string, patch: Partial<VideoTask>) => Promise<void>
  replaceTask: (task: VideoTask) => void
  getProfile: (task: VideoTask) => ProviderProfile
  getProxy: () => ProxyConfig | undefined
  getPollIntervalSec: () => number
  translate: (key: string, params?: Record<string, string | number>) => string
  onStorageError: (error: unknown) => void
  onSucceeded: (task: VideoTask) => void
}

export interface TaskRunner {
  execute: (taskId: string) => Promise<void>
  resumePolling: (taskId: string) => Promise<void>
  cancel: (taskId: string) => void
  reset: (taskId: string) => void
  dispose: () => void
}

export function createTaskRunner(deps: TaskRunnerDependencies): TaskRunner {
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const controllers = new Map<string, AbortController>()
  const recoverAttempts = new Map<string, number>()
  const activeRuns = new Map<string, symbol>()
  const tr = deps.translate

  function clearTimer(taskId: string) {
    const timer = timers.get(taskId)
    if (timer) clearTimeout(timer)
    timers.delete(taskId)
  }

  function clearController(taskId: string, abort: boolean) {
    const controller = controllers.get(taskId)
    if (abort) controller?.abort()
    controllers.delete(taskId)
  }

  function releaseController(taskId: string, controller: AbortController) {
    if (controllers.get(taskId) === controller) controllers.delete(taskId)
  }

  function cleanupTerminal(taskId: string) {
    clearTimer(taskId)
    clearController(taskId, false)
    recoverAttempts.delete(taskId)
  }

  function newController(taskId: string): AbortController {
    clearController(taskId, true)
    const controller = new AbortController()
    controllers.set(taskId, controller)
    return controller
  }

  async function execute(taskId: string) {
    if (activeRuns.has(taskId)) return
    const initialTask = deps.getTask(taskId)
    if (!initialTask) return
    const runToken = Symbol(taskId)
    activeRuns.set(taskId, runToken)
    clearTimer(taskId)
    const controller = newController(taskId)
    const profile = deps.getProfile(initialTask)
    const provider = resolveProvider(profile)

    log.info('submit', tr('log.submitStarted', { kind: profile.kind }), {
      profile: profile.name,
      model: profile.model || initialTask.params.model,
      prompt: initialTask.prompt.slice(0, 60),
    }, taskId)

    try {
      await deps.patchTask(taskId, { status: 'running', error: null })
      const task = deps.getTask(taskId)
      if (!task || controller.signal.aborted) return
      const assets = await getAssets(task.assetIds)
      const context: SubmitContext = {
        task,
        assets,
        profile,
        proxy: deps.getProxy(),
        signal: controller.signal,
        timeoutSec: SUBMIT_TIMEOUT_SEC,
        onEnqueued: async (remoteTaskId) => {
          if (controller.signal.aborted) return
          log.info('submit', tr('log.enqueued', { id: remoteTaskId }), undefined, taskId)
          await deps.patchTask(taskId, { remoteTaskId, recoverable: false, remoteStatus: 'queued' })
        },
      }
      await provider.submit(context)
      await pollLoop(taskId, controller)
    } catch (error) {
      if (controller.signal.aborted) return
      const currentTask = deps.getTask(taskId)
      const message = errorMessage(error)
      if (isRecoverableError(error) && currentTask?.remoteTaskId) {
        await markRecoverable(taskId, message)
        scheduleRecover(taskId)
      } else {
        log.error('submit', tr('log.submitFailed', { msg: message }), undefined, taskId)
        await deps.patchTask(taskId, {
          status: 'failed',
          error: message,
          recoverable: false,
          finishedAt: Date.now(),
          elapsed: Date.now() - (currentTask?.createdAt ?? Date.now()),
        })
        cleanupTerminal(taskId)
      }
    } finally {
      if (activeRuns.get(taskId) === runToken) activeRuns.delete(taskId)
      releaseController(taskId, controller)
    }
  }

  async function resumePolling(taskId: string) {
    if (activeRuns.has(taskId)) return
    const task = deps.getTask(taskId)
    if (!task?.remoteTaskId) return
    const runToken = Symbol(taskId)
    activeRuns.set(taskId, runToken)
    clearTimer(taskId)
    const controller = newController(taskId)
    try {
      await pollLoop(taskId, controller)
    } finally {
      if (activeRuns.get(taskId) === runToken) activeRuns.delete(taskId)
      releaseController(taskId, controller)
    }
  }

  async function pollLoop(taskId: string, controller: AbortController) {
    const initialTask = deps.getTask(taskId)
    if (!initialTask?.remoteTaskId) {
      log.warn('poll', tr('log.pollCannotStart'), { taskId }, taskId)
      return
    }
    const profile = deps.getProfile(initialTask)
    const provider = resolveProvider(profile)
    const intervalSec = profile.kind === 'custom' && profile.custom?.pollIntervalSec
      ? profile.custom.pollIntervalSec
      : undefined
    const pollIntervalSec = intervalSec ?? deps.getPollIntervalSec()
    const startedAt = Date.now()
    let lastHeartbeat = 0
    log.info('poll', tr('log.pollStarted', {
      id: initialTask.remoteTaskId,
      interval: pollIntervalSec,
      max: POLL_MAX_DURATION_SEC,
    }), undefined, taskId)

    while (!controller.signal.aborted) {
      const currentTask = deps.getTask(taskId)
      if (!currentTask || currentTask.status === 'cancelled' || !currentTask.remoteTaskId) return
      const elapsedMs = Date.now() - startedAt
      if (elapsedMs > POLL_MAX_DURATION_SEC * 1000) {
        await deps.patchTask(taskId, {
          status: 'failed',
          error: tr('error.timeout', { n: Math.round(elapsedMs / 1000) }),
          recoverable: false,
          finishedAt: Date.now(),
          elapsed: Date.now() - currentTask.createdAt,
        })
        cleanupTerminal(taskId)
        return
      }

      try {
        const result = await provider.poll(profile, currentTask.remoteTaskId, controller.signal, deps.getProxy())
        if (controller.signal.aborted) return
        recoverAttempts.delete(taskId)
        if (result.status === 'succeeded') {
          const latestTask = deps.getTask(taskId)
          if (!latestTask || latestTask.status === 'cancelled') return
          try {
            const saved = await saveTaskResult({
              task: latestTask,
              result,
              signal: controller.signal,
              noVideoUrlMessage: tr('error.noVideoUrl'),
              proxy: deps.getProxy(),
            })
            // 取消竞态说明：saveTaskResult 通过原子事务将 task 状态写入 DB 为 succeeded。
            // 若此后检测到取消信号，DB 中保留 succeeded（任务确实已完成并持久化），
            // 但本次不更新内存状态。下次页面加载时 initTasks 会从 DB 恢复为 succeeded。
            // 这是正确行为：远端任务已完成、视频已下载，取消操作来得太晚。
            if (controller.signal.aborted || deps.getTask(taskId)?.status === 'cancelled') return
            deps.replaceTask(saved.task)
            if (saved.videoDownloaded) log.info('poll', tr('log.videoDownloaded', { n: saved.videoSize }), undefined, taskId)
            else log.warn('poll', tr('log.videoDownloadFailed'), { url: result.videoUrl }, taskId)
            deps.onSucceeded(saved.task)
          } catch (error) {
            if (controller.signal.aborted) return
            deps.onStorageError(error)
            const failedTask: VideoTask = {
              ...latestTask,
              status: 'failed',
              error: errorMessage(error),
              recoverable: false,
              finishedAt: Date.now(),
              elapsed: Date.now() - latestTask.createdAt,
            }
            deps.replaceTask(failedTask)
            try { await deps.patchTask(taskId, failedTask) } catch { /* 存储不可用时仅保留内存状态 */ }
          }
          cleanupTerminal(taskId)
          return
        }
        if (result.status === 'failed' || result.status === 'cancelled' || result.status === 'expired') {
          await deps.patchTask(taskId, {
            status: result.status,
            error: result.error ?? tr('error.genFailed', { status: result.status }),
            errorDetails: result.details,
            recoverable: false,
            finishedAt: Date.now(),
            elapsed: Date.now() - currentTask.createdAt,
          })
          cleanupTerminal(taskId)
          return
        }
        await deps.patchTask(taskId, { remoteStatus: result.status, progress: result.progress, recoverable: false })
        const now = Date.now()
        if (now - lastHeartbeat >= POLL_LOG_EVERY_SEC * 1000) {
          lastHeartbeat = now
          log.info('poll', tr('log.pollRunning', { n: Math.round((now - startedAt) / 1000) }), {
            remoteStatus: result.status,
            progress: result.progress,
          }, taskId)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        const message = errorMessage(error)
        if (isRecoverableError(error)) {
          await markRecoverable(taskId, message)
          scheduleRecover(taskId)
          return
        }
        log.warn('poll', tr('log.pollErrorRetry', { msg: message }), undefined, taskId)
      }

      try {
        await sleep(pollIntervalSec * 1000, controller.signal)
      } catch {
        return
      }
    }
  }

  async function markRecoverable(taskId: string, error: string) {
    await deps.patchTask(taskId, { status: 'running', recoverable: true, error })
  }

  function scheduleRecover(taskId: string) {
    clearTimer(taskId)
    const attempts = (recoverAttempts.get(taskId) ?? 0) + 1
    recoverAttempts.set(taskId, attempts)
    if (attempts > RECOVER_MAX_ATTEMPTS) {
      recoverAttempts.delete(taskId)
      void deps.patchTask(taskId, {
        status: 'failed',
        error: tr('error.recoverExhausted'),
        recoverable: false,
        finishedAt: Date.now(),
      }).finally(() => cleanupTerminal(taskId))
      return
    }
    const timer = setTimeout(() => {
      timers.delete(taskId)
      void resumePolling(taskId)
    }, RECOVER_DELAY_MS)
    timers.set(taskId, timer)
  }

  function cancel(taskId: string) {
    clearTimer(taskId)
    clearController(taskId, true)
    recoverAttempts.delete(taskId)
    activeRuns.delete(taskId)
  }

  function reset(taskId: string) {
    cancel(taskId)
  }

  function dispose() {
    for (const taskId of new Set([...timers.keys(), ...controllers.keys()])) cancel(taskId)
  }

  return { execute, resumePolling, cancel, reset, dispose }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }, { once: true })
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

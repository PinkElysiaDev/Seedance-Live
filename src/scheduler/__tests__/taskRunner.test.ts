import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoTask } from '@/types'
import { HttpError } from '@/types'
import { defaultParams } from '@/config/options'

const mocks = vi.hoisted(() => ({
  provider: { submit: vi.fn(), poll: vi.fn() },
  getAssets: vi.fn(),
  saveTaskResult: vi.fn(),
}))

vi.mock('@/provider/resolve', () => ({ resolveProvider: () => mocks.provider }))
vi.mock('@/db/repos', () => ({ getAssets: mocks.getAssets }))
vi.mock('@/services/taskResult', () => ({ saveTaskResult: mocks.saveTaskResult }))
vi.mock('@/lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

import { createTaskRunner } from '@/scheduler/taskRunner'

describe('task runner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    mocks.getAssets.mockResolvedValue([])
  })

  it('submits, polls and stores a successful task', async () => {
    const state = createState(makeTask({ status: 'queued' }))
    mocks.provider.submit.mockImplementation(async (context) => {
      await context.onEnqueued('remote-1')
      return { remoteTaskId: 'remote-1' }
    })
    mocks.provider.poll.mockResolvedValue({ status: 'succeeded', videoUrl: 'video-url' })
    mocks.saveTaskResult.mockImplementation(async ({ task }) => ({
      task: { ...task, status: 'succeeded', videoUrl: 'video-url' },
      videoDownloaded: true,
      videoSize: 3,
    }))

    await state.runner.execute('task-1')

    expect(mocks.provider.submit).toHaveBeenCalledTimes(1)
    expect(mocks.provider.poll.mock.calls[0][1]).toBe('remote-1')
    expect(state.task.status).toBe('succeeded')
  })

  it('does not resubmit a network failure without remote id', async () => {
    const state = createState(makeTask({ status: 'queued' }))
    mocks.provider.submit.mockRejectedValue(new HttpError('offline', 'network'))

    await state.runner.execute('task-1')

    expect(mocks.provider.submit).toHaveBeenCalledTimes(1)
    expect(state.task).toMatchObject({ status: 'failed', recoverable: false })
    expect(state.task.remoteTaskId).toBeUndefined()
  })

  it('refreshes remote id inside the polling loop', async () => {
    const state = createState(makeTask({ remoteTaskId: 'remote-old' }), 0)
    mocks.provider.poll
      .mockImplementationOnce(async () => {
        state.task = { ...state.task, remoteTaskId: 'remote-new' }
        return { status: 'running' }
      })
      .mockResolvedValueOnce({ status: 'failed', error: 'done' })

    await state.runner.resumePolling('task-1')

    expect(mocks.provider.poll.mock.calls.map((call) => call[1])).toEqual(['remote-old', 'remote-new'])
  })

  it('cancels an in-flight poll', async () => {
    const state = createState(makeTask({ remoteTaskId: 'remote-1' }))
    mocks.provider.poll.mockImplementation((_profile, _id, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new HttpError('aborted', 'abort')), { once: true })
    }))

    const polling = state.runner.resumePolling('task-1')
    await Promise.resolve()
    state.runner.cancel('task-1')
    await polling

    expect(mocks.provider.poll).toHaveBeenCalledTimes(1)
  })

  it('recovers polling with the same remote id', async () => {
    vi.useFakeTimers()
    const state = createState(makeTask({ remoteTaskId: 'remote-1' }), 0)
    mocks.provider.poll
      .mockRejectedValueOnce(new HttpError('offline', 'network'))
      .mockResolvedValueOnce({ status: 'failed', error: 'remote failed' })

    await state.runner.resumePolling('task-1')
    await vi.advanceTimersByTimeAsync(10_000)

    expect(mocks.provider.poll.mock.calls.map((call) => call[1])).toEqual(['remote-1', 'remote-1'])
    vi.useRealTimers()
  })

  it('does not apply a saved success after cancellation', async () => {
    const state = createState(makeTask({ remoteTaskId: 'remote-1' }))
    let finishSave!: (value: { task: VideoTask; videoDownloaded: boolean; videoSize: number }) => void
    mocks.provider.poll.mockResolvedValue({ status: 'succeeded', videoUrl: 'video-url' })
    mocks.saveTaskResult.mockImplementation(({ task }) => new Promise((resolve) => {
      finishSave = resolve
      void task
    }))

    const polling = state.runner.resumePolling('task-1')
    await vi.waitFor(() => expect(mocks.saveTaskResult).toHaveBeenCalled())
    state.task = { ...state.task, status: 'cancelled' }
    state.runner.cancel('task-1')
    finishSave({ task: { ...state.task, status: 'succeeded' }, videoDownloaded: true, videoSize: 1 })
    await polling

    expect(state.task.status).toBe('cancelled')
  })
})

function createState(initialTask: VideoTask, pollIntervalSec = 1) {
  let task = initialTask
  const runner = createTaskRunner({
    getTask: () => task,
    patchTask: async (_id, patch) => { task = { ...task, ...patch } },
    replaceTask: (next) => { task = next },
    getProfile: () => ({ id: 'provider', name: 'provider', kind: 'seedance', baseUrl: '', apiKey: 'key', timeout: 1 }),
    getProxy: () => undefined,
    getPollIntervalSec: () => pollIntervalSec,
    translate: (key) => key,
    onStorageError: vi.fn(),
    onSucceeded: vi.fn(),
  })
  return {
    runner,
    get task() { return task },
    set task(next: VideoTask) { task = next },
  }
}

function makeTask(overrides: Partial<VideoTask>): VideoTask {
  return {
    id: 'task-1', prompt: 'prompt', params: defaultParams(), assetIds: [],
    providerId: 'provider', providerKind: 'seedance', status: 'running', recoverable: false,
    error: null, createdAt: Date.now(), finishedAt: null, elapsed: null,
    ...overrides,
  }
}

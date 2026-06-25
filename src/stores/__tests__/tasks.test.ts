import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTasksStore } from '@/stores/tasks'
import type { VideoTask } from '@/types'
import { defaultParams } from '@/config/options'

function makeTask(overrides: Partial<VideoTask>): VideoTask {
  return {
    id: 't',
    prompt: 'x',
    params: { ...defaultParams() },
    assetIds: [],
    providerId: 'p',
    providerKind: 'seedance',
    status: 'succeeded',
    recoverable: false,
    error: null,
    createdAt: 0,
    finishedAt: null,
    elapsed: null,
    ...overrides,
  }
}

describe('getTaskChain', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('单任务返回自身', () => {
    const tasks = useTasksStore()
    const t = makeTask({ id: 'a' })
    // 直接灌入内存（不经 DB）
    ;(tasks as unknown as { tasks: VideoTask[] }).tasks = [t]
    expect(tasks.getTaskChain('a').map((x) => x.id)).toEqual(['a'])
  })

  it('向上追溯祖先链', () => {
    const tasks = useTasksStore()
    const a = makeTask({ id: 'a', createdAt: 1 })
    const b = makeTask({ id: 'b', parentTaskId: 'a', createdAt: 2 })
    const c = makeTask({ id: 'c', parentTaskId: 'b', createdAt: 3 })
    ;(tasks as unknown as { tasks: VideoTask[] }).tasks = [c, b, a]
    expect(tasks.getTaskChain('c').map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('向下包含后代', () => {
    const tasks = useTasksStore()
    const a = makeTask({ id: 'a', createdAt: 1 })
    const b = makeTask({ id: 'b', parentTaskId: 'a', createdAt: 2 })
    const c = makeTask({ id: 'c', parentTaskId: 'a', createdAt: 3 })
    const d = makeTask({ id: 'd', parentTaskId: 'b', createdAt: 4 })
    ;(tasks as unknown as { tasks: VideoTask[] }).tasks = [a, b, c, d]
    const chain = tasks.getTaskChain('a').map((x) => x.id)
    expect(chain[0]).toBe('a')
    // b、c、d 都应在后代中
    expect(chain).toEqual(expect.arrayContaining(['b', 'c', 'd']))
  })
})

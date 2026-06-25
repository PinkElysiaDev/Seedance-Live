import { describe, it, expect } from 'vitest'
import { reactive, toRaw } from 'vue'
import { toStorable } from '@/db/repos'
import type { VideoTask } from '@/types'
import { defaultParams } from '@/config/options'

describe('toStorable', () => {
  it('普通对象原样深拷贝', () => {
    const task: VideoTask = {
      id: 't1', prompt: 'p', params: { ...defaultParams() }, assetIds: ['a1'],
      providerId: 'p', providerKind: 'seedance', status: 'queued', recoverable: false,
      error: null, createdAt: 1, finishedAt: null, elapsed: null,
    }
    const out = toStorable(task)
    expect(out).toEqual(task)
    expect(out).not.toBe(task) // 是拷贝不是同一引用
    expect(out.params).not.toBe(task.params)
  })

  it('reactive Proxy 脱壳为可结构化克隆的普通对象', () => {
    const task: VideoTask = {
      id: 't1', prompt: 'p', params: { ...defaultParams() }, assetIds: ['a1'],
      providerId: 'p', providerKind: 'custom', status: 'running', recoverable: false,
      error: null, createdAt: 1, finishedAt: null, elapsed: null,
    }
    const proxy = reactive(task)
    // Proxy 不能直接 structuredClone
    expect(() => structuredClone(proxy)).toThrow()
    // toStorable 能脱壳
    const out = toStorable(proxy)
    expect(out.id).toBe('t1')
    expect(out.status).toBe('running')
    // 结果应是普通对象，可再次 structuredClone（模拟 IDB put）
    expect(() => structuredClone(out)).not.toThrow()
    expect(toRaw(out)).toBe(out) // 已是普通对象
  })

  it('嵌套 reactive Proxy（params/数组）也脱壳，可 structuredClone', () => {
    // 模拟 Pinia deep reactive：嵌套对象也是 Proxy
    const proxy = reactive({
      id: 't1',
      params: { model: 'doubao-seedance-2.0' as never, ratio: '16:9' },
      assetIds: ['a', 'b'],
    })
    // toStorable（JSON 方案）能彻底脱壳所有层 Proxy
    const out = toStorable(proxy) as { id: string; params: { model: string }; assetIds: string[] }
    expect(out.params.model).toBe('doubao-seedance-2.0')
    expect(out.assetIds).toEqual(['a', 'b'])
    // 结果是纯普通对象，可再次 structuredClone（模拟 IDB put，真实浏览器对 Proxy 会失败，对纯对象不会）
    expect(() => structuredClone(out)).not.toThrow()
    expect(toRaw(out.params)).toBe(out.params)
  })

  it('嵌套数组也脱壳', () => {
    const proxy = reactive({ id: 'x', assetIds: ['a', 'b'], nested: { k: [1, 2] } })
    const out = toStorable(proxy) as { id: string; assetIds: string[]; nested: { k: number[] } }
    expect(out.assetIds).toEqual(['a', 'b'])
    expect(toRaw(out.assetIds)).toBe(out.assetIds)
    expect(toRaw(out.nested)).toBe(out.nested)
    expect(toRaw(out.nested.k)).toBe(out.nested.k)
  })
})

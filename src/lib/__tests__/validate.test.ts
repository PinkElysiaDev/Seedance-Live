import { describe, it, expect } from 'vitest'
import { validateTask } from '@/lib/validate'
import { defaultParams } from '@/config/options'
import type { StoredAsset, VideoParams } from '@/types'

function asset(overrides: Partial<StoredAsset>): StoredAsset {
  return {
    id: 'a1',
    role: 'referenceImage',
    kind: 'image',
    blobId: 'b1',
    name: 'x.png',
    mime: 'image/png',
    size: 100,
    createdAt: 0,
    ...overrides,
  }
}

describe('validateTask', () => {
  it('基本文生视频通过', () => {
    const params: VideoParams = { ...defaultParams() }
    expect(validateTask(params, '一只猫在奔跑', [])).toEqual([])
  })

  it('空提示词报错', () => {
    expect(validateTask(defaultParams(), '   ', [])).toContain('提示词不能为空')
  })

  it('首尾帧与参考视频互斥', () => {
    const params = defaultParams()
    const assets = [
      asset({ id: '1', role: 'firstFrame' }),
      asset({ id: '2', role: 'referenceVideo', kind: 'video', mime: 'video/mp4', durationMs: 3000 }),
    ]
    const errors = validateTask(params, 'test', assets)
    expect(errors.some((e) => e.includes('不能同时使用'))).toBe(true)
  })

  it('fast 模型不支持 1080p', () => {
    const params: VideoParams = { ...defaultParams('doubao-seedance-2.0-fast'), resolution: '1080p' }
    const errors = validateTask(params, 'x', [])
    expect(errors.some((e) => e.includes('不支持 1080p'))).toBe(true)
  })

  it('参考音频必须配合参考图或视频', () => {
    const params = defaultParams()
    const assets = [asset({ id: '1', role: 'referenceAudio', kind: 'audio', mime: 'audio/mpeg' })]
    const errors = validateTask(params, 'x', assets)
    expect(errors.some((e) => e.includes('配合参考图或参考视频'))).toBe(true)
  })

  it('参考视频超量', () => {
    const params = defaultParams()
    const assets = Array.from({ length: 4 }, (_, i) =>
      asset({ id: String(i), role: 'referenceVideo', kind: 'video', mime: 'video/mp4', durationMs: 3000 }),
    )
    const errors = validateTask(params, 'x', assets)
    expect(errors.some((e) => e.includes('参考视频最多 3 个'))).toBe(true)
  })
})

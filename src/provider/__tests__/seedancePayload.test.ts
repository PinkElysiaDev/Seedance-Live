import { describe, it, expect } from 'vitest'
import { buildSeedancePayload, buildPromptText } from '@/provider/seedancePayload'
import { defaultParams } from '@/config/options'
import type { StoredAsset } from '@/types'

function urlAsset(overrides: Partial<StoredAsset>): StoredAsset {
  return {
    id: 'a1',
    role: 'referenceImage',
    kind: 'image',
    blobId: '',
    name: 'x.png',
    mime: 'image/png',
    size: 0,
    sourceUrl: 'https://cdn.example.com/x.png',
    createdAt: 0,
    ...overrides,
  }
}

describe('buildPromptText', () => {
  it('无素材直接返回 prompt', () => {
    expect(buildPromptText('一只猫', [])).toBe('一只猫')
  })

  it('有素材拼接编号前缀', () => {
    const text = buildPromptText('奔跑', [
      urlAsset({ role: 'referenceImage' }),
      urlAsset({ role: 'referenceVideo', kind: 'video' }),
    ])
    expect(text).toContain('参考素材编号：图片1、视频1')
    expect(text).toContain('奔跑')
  })
})

describe('buildSeedancePayload', () => {
  it('文生视频构造 content 数组', async () => {
    const params = { ...defaultParams(), generateAudio: true, watermark: true, seed: 42 }
    const payload = await buildSeedancePayload(params, '一只猫', [])
    expect(payload.model).toBe('doubao-seedance-2.0')
    expect(payload.ratio).toBe('16:9')
    expect(payload.resolution).toBe('720p')
    expect(payload.duration).toBe(5)
    expect(payload.generate_audio).toBe(true)
    expect(payload.watermark).toBe(true)
    expect(payload.seed).toBe(42)
    const content = payload.content as Array<Record<string, unknown>>
    expect(content[0]).toEqual({ type: 'text', text: '一只猫' })
  })

  it('参考素材带 role', async () => {
    const params = defaultParams()
    const payload = await buildSeedancePayload(params, 'test', [
      urlAsset({ role: 'firstFrame' }),
      urlAsset({ role: 'referenceVideo', kind: 'video' }),
      urlAsset({ role: 'referenceAudio', kind: 'audio' }),
    ])
    const content = payload.content as Array<Record<string, unknown>>
    // text + 3 素材
    expect(content.length).toBe(4)
    expect(content[1].role).toBe('first_frame')
    expect(content[1].type).toBe('image_url')
    expect(content[2].type).toBe('video_url')
    expect(content[2].role).toBe('reference_video')
    expect(content[3].type).toBe('audio_url')
    expect(content[3].role).toBe('reference_audio')
  })

  it('returnLastFrame 与 webSearch 开关', async () => {
    const params = { ...defaultParams(), returnLastFrame: true, webSearch: true }
    const payload = await buildSeedancePayload(params, 'x', [])
    expect(payload.return_last_frame).toBe(true)
    expect(payload.tools).toEqual([{ type: 'web_search' }])
  })
})

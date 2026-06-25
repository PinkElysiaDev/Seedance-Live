import { describe, it, expect } from 'vitest'
import { parseProgress, normalizeUrl } from '@/provider/customProvider'
import { migrateProfile } from '@/stores/settings'

describe('parseProgress', () => {
  it('数字直接返回', () => {
    expect(parseProgress(50)).toBe(50)
  })
  it('百分比字符串取数字', () => {
    expect(parseProgress('100%')).toBe(100)
    expect(parseProgress('42%')).toBe(42)
  })
  it('无效返回 undefined', () => {
    expect(parseProgress('abc')).toBeUndefined()
    expect(parseProgress(undefined)).toBeUndefined()
  })
})

describe('normalizeUrl', () => {
  it('去重连续斜杠但保留协议头', () => {
    expect(normalizeUrl('https://api.apilio.ai//v2/videos')).toBe('https://api.apilio.ai/v2/videos')
  })
  it('多处双斜杠都去重', () => {
    expect(normalizeUrl('https://h.com//a//b')).toBe('https://h.com/a/b')
  })
  it('无双斜杠不变', () => {
    expect(normalizeUrl('https://h.com/v2/x')).toBe('https://h.com/v2/x')
  })
})

describe('migrateProfile 旧 CustomMapping → CustomTemplate', () => {
  it('旧格式迁移为模板', () => {
    const old = {
      id: 'p1', name: 'old', kind: 'custom' as const, baseUrl: 'https://x.com', apiKey: 'k', timeout: 60,
      custom: {
        submitPath: '/v1/videos/generations',
        pollPath: '/v1/tasks/{task_id}',
        taskIdPath: 'data.task_id',
        statusPath: 'data.status',
        successValues: ['completed'],
        failureValues: ['failed'],
        videoUrlPath: 'data.result.videos[0].url',
        progressPath: 'data.progress',
        payloadStyle: 'flat',
        pollIntervalSec: 5,
      },
    }
    const out = migrateProfile(old as never)
    expect(out.custom?.submitUrl).toBe('{{baseUrl}}/v1/videos/generations')
    expect(out.custom?.pollUrl).toBe('{{baseUrl}}/v1/tasks/{{taskId}}')
    expect(out.custom?.submitBody).toContain('{{prompt}}')
    expect(out.custom?.taskIdPath).toBe('data.task_id')
    expect(out.custom?.successValues).toEqual(['completed'])
    expect(out.custom?.pollIntervalSec).toBe(5)
  })

  it('已是新格式保持不变', () => {
    const fresh = {
      id: 'p2', name: 'new', kind: 'custom' as const, baseUrl: '', apiKey: '', timeout: 60, model: 'm',
      custom: {
        submitUrl: '{{baseUrl}}/x', submitMethod: 'POST', submitHeaders: {}, submitBody: '{}',
        pollUrl: '{{baseUrl}}/x/{{taskId}}', pollMethod: 'GET', pollHeaders: {},
        taskIdPath: 'id', statusPath: 'status', successValues: ['success'], failureValues: ['failure'],
        videoUrlPath: 'data.output', pollIntervalSec: 3,
      },
    }
    const out = migrateProfile(fresh as never)
    expect(out.custom?.submitUrl).toBe('{{baseUrl}}/x')
    expect(out.model).toBe('m')
  })

  it('custom 缺 custom 补默认', () => {
    const out = migrateProfile({ id: 'p3', name: 'n', kind: 'custom', baseUrl: '', apiKey: '', timeout: 60 } as never)
    expect(out.custom?.submitBody).toContain('{{prompt}}')
  })
})

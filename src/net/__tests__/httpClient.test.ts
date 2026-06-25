import { describe, it, expect } from 'vitest'
import { buildApiUrl } from '@/net/httpClient'
import { applyProxy } from '@/net/proxy'
import type { ProxyConfig } from '@/types'

describe('buildApiUrl', () => {
  it('裸 baseUrl 补 /v1', () => {
    expect(buildApiUrl('https://ark.cn-beijing.volces.com', '/contents/generations/tasks'))
      .toBe('https://ark.cn-beijing.volces.com/v1/contents/generations/tasks')
  })

  it('已含 /api/v3 不再追加', () => {
    expect(buildApiUrl('https://ark.cn-beijing.volces.com/api/v3', '/contents/generations/tasks'))
      .toBe('https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks')
  })

  it('已含 /api/plan/v3 不再追加', () => {
    expect(buildApiUrl('https://ark.cn-beijing.volces.com/api/plan/v3', '/x')).toBe('https://ark.cn-beijing.volces.com/api/plan/v3/x')
  })

  it('去除尾部斜杠', () => {
    expect(buildApiUrl('https://h.com/v1/', '/x')).toBe('https://h.com/v1/x')
  })
})

describe('applyProxy', () => {
  const disabled: ProxyConfig = { enabled: false, url: '', mode: 'query' }

  it('未启用时原样返回', () => {
    expect(applyProxy('https://a.com/x', disabled)).toBe('https://a.com/x')
  })

  it('query 模式', () => {
    const p: ProxyConfig = { enabled: true, url: 'https://proxy.workers.dev', mode: 'query' }
    expect(applyProxy('https://a.com/x', p)).toBe('https://proxy.workers.dev?target=' + encodeURIComponent('https://a.com/x'))
  })

  it('path 模式', () => {
    const p: ProxyConfig = { enabled: true, url: 'https://proxy.workers.dev/', mode: 'path' }
    expect(applyProxy('https://a.com/x', p)).toBe('https://proxy.workers.dev/' + encodeURIComponent('https://a.com/x'))
  })
})

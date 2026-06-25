import { describe, it, expect } from 'vitest'
import { redactHeaders } from '@/lib/logger'

describe('redactHeaders', () => {
  it('Authorization 值脱敏', () => {
    const out = redactHeaders({ Authorization: 'Bearer sk-secret-123', 'Content-Type': 'application/json' })
    expect(out?.Authorization).toBe('Bearer ***')
    expect(out?.['Content-Type']).toBe('application/json')
  })

  it('大小写不敏感', () => {
    expect(redactHeaders({ authorization: 'Bearer xxx' })?.authorization).toBe('Bearer ***')
  })

  it('无 Authorization 原样返回', () => {
    const out = redactHeaders({ 'X-Custom': 'v' })
    expect(out?.['X-Custom']).toBe('v')
    expect(out?.Authorization).toBeUndefined()
  })

  it('undefined 入参', () => {
    expect(redactHeaders(undefined)).toBeUndefined()
  })
})

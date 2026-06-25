import { describe, it, expect } from 'vitest'
import { parseLLMJson } from '@/lib/llmClient'

describe('parseLLMJson', () => {
  it('解析围栏 JSON', () => {
    const content = '好的，结果如下：\n```json\n{"model":"veo3","submit":{"url":"/x"}}\n```\n完毕'
    expect(parseLLMJson(content)).toEqual({ model: 'veo3', submit: { url: '/x' } })
  })

  it('解析裸 JSON', () => {
    expect(parseLLMJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('解析带前后解释文字的裸 JSON', () => {
    expect(parseLLMJson('这是结果 {"a":1,"b":[1,2]} 好的')).toEqual({ a: 1, b: [1, 2] })
  })

  it('无围栏且嵌套对象', () => {
    const c = '```{"submit":{"body":"{\\"prompt\\":\\"{{prompt}}\\"}"}}```'
    const o = parseLLMJson(c) as { submit: { body: string } }
    expect(o.submit.body).toBe('{"prompt":"{{prompt}}"}')
  })
})

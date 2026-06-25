import { describe, it, expect } from 'vitest'
import { renderTemplate, type TemplateVars } from '@/lib/template'

const vars: TemplateVars = {
  prompt: '一只猫',
  model: 'doubao-seedance-1-0-pro-250528',
  ratio: '16:9',
  resolution: '720p',
  duration: 5,
  seed: 42,
  generateAudio: true,
  watermark: false,
  returnLastFrame: false,
  webSearch: false,
  images: ['https://a.com/1.png', 'data:image/png;base64,xxx'],
  firstFrameImages: ['https://a.com/1.png'],
  lastFrameImages: [],
  referenceImages: [],
  referenceVideos: [],
  referenceAudios: [],
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-123',
  taskId: 'task-abc',
}

describe('renderTemplate json mode', () => {
  it('带引号字符串占位（容错，去重引号）', () => {
    expect(renderTemplate('"{{prompt}}"', vars, 'json')).toBe('"一只猫"')
  })

  it('不带引号字符串占位也加引号', () => {
    expect(renderTemplate('{{prompt}}', vars, 'json')).toBe('"一只猫"')
  })

  it('数组占位直接插入为合法 JSON', () => {
    const out = renderTemplate('{"images": {{images}}}', vars, 'json')
    expect(JSON.parse(out).images).toEqual(vars.images)
  })

  it('带引号数组占位也正确（容错）', () => {
    const out = renderTemplate('{"images": "{{images}}"}', vars, 'json')
    expect(JSON.parse(out).images).toEqual(vars.images)
  })

  it('数字与布尔占位', () => {
    const out = renderTemplate('{"duration": {{duration}}, "seed": {{seed}}, "audio": {{generateAudio}}}', vars, 'json')
    const o = JSON.parse(out)
    expect(o.duration).toBe(5)
    expect(o.seed).toBe(42)
    expect(o.audio).toBe(true)
  })

  it('完整 gpt-best 风格 body 渲染合法', () => {
    const tpl = `{"prompt":"{{prompt}}","model":"{{model}}","images":{{images}},"ratio":"{{ratio}}","resolution":"{{resolution}}"}`
    const out = renderTemplate(tpl, vars, 'json')
    const o = JSON.parse(out)
    expect(o.prompt).toBe('一只猫')
    expect(o.model).toBe('doubao-seedance-1-0-pro-250528')
    expect(o.images).toEqual(vars.images)
    expect(o.ratio).toBe('16:9')
  })
})

describe('renderTemplate raw mode', () => {
  it('URL 中 taskId 编码', () => {
    expect(renderTemplate('{{baseUrl}}/v2/videos/generations/{{taskId}}', vars, 'raw'))
      .toBe('https://api.example.com/v2/videos/generations/task-abc')
  })

  it('header 中 apiKey 注入', () => {
    expect(renderTemplate('Bearer {{apiKey}}', vars, 'raw')).toBe('Bearer sk-123')
  })
})

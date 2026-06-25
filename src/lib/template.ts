// 请求模板渲染：{{var}} 占位符替换

export type TemplateMode = 'json' | 'raw'

export interface TemplateVars {
  prompt: string
  model: string
  ratio: string
  resolution: string
  duration: number
  seed?: number
  generateAudio: boolean
  watermark: boolean
  returnLastFrame: boolean
  webSearch: boolean
  images: string[]                 // 全部图片（首尾帧+参考图），已解析 URL/dataUrl
  firstFrameImages: string[]
  lastFrameImages: string[]
  referenceImages: string[]
  referenceVideos: string[]
  referenceAudios: string[]
  baseUrl: string
  apiKey: string
  taskId?: string
}

// 渲染模板字符串
// mode='json'：占位符（含可选两侧引号）替换为 JSON.stringify(value)，保证输出合法 JSON
//   容错：{{var}} 与 "{{var}}" 都能正确渲染（字符串自动加引号，数组/数字/布尔直接插入）
// mode='raw' ：替换为原始字符串；{{taskId}} 做 encodeURIComponent
export function renderTemplate(template: string, vars: TemplateVars, mode: TemplateMode): string {
  if (mode === 'json') {
    // 匹配可选前导引号 + 占位符 + 可选后导引号，整体替换为 JSON 值
    return template.replace(/"?\{\{\s*([\w.]+)\s*\}\}"?/g, (_full, key: string) => {
      const value = resolveVar(vars, key)
      return JSON.stringify(value ?? null)
    })
  }
  // raw
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_full, key: string) => {
    const value = resolveVar(vars, key)
    if (value === undefined) return ''
    if (key === 'taskId' && typeof value === 'string') return encodeURIComponent(value)
    return String(value)
  })
}

function resolveVar(vars: TemplateVars, key: string): unknown {
  switch (key) {
    case 'prompt': return vars.prompt
    case 'model': return vars.model
    case 'ratio': return vars.ratio
    case 'resolution': return vars.resolution
    case 'duration': return vars.duration
    case 'seed': return vars.seed
    case 'generateAudio': return vars.generateAudio
    case 'watermark': return vars.watermark
    case 'returnLastFrame': return vars.returnLastFrame
    case 'webSearch': return vars.webSearch
    case 'images': return vars.images
    case 'firstFrameImages': return vars.firstFrameImages
    case 'lastFrameImages': return vars.lastFrameImages
    case 'referenceImages': return vars.referenceImages
    case 'referenceVideos': return vars.referenceVideos
    case 'referenceAudios': return vars.referenceAudios
    case 'baseUrl': return vars.baseUrl
    case 'apiKey': return vars.apiKey
    case 'taskId': return vars.taskId
    default: return undefined
  }
}

// 可用变量速查（供 UI 展示）
export const TEMPLATE_VARS: Array<{ name: string; desc: string }> = [
  { name: '{{prompt}}', desc: '提示词（原始文本）' },
  { name: '{{model}}', desc: '模型名（profile.model）' },
  { name: '{{ratio}}', desc: '比例，如 16:9' },
  { name: '{{resolution}}', desc: '分辨率，如 720p' },
  { name: '{{duration}}', desc: '时长（秒）' },
  { name: '{{seed}}', desc: '随机种子（可空）' },
  { name: '{{generateAudio}}', desc: '是否生成音频（true/false）' },
  { name: '{{watermark}}', desc: '是否加水印（true/false）' },
  { name: '{{returnLastFrame}}', desc: '是否返回末帧（true/false）' },
  { name: '{{webSearch}}', desc: '是否联网搜索（true/false）' },
  { name: '{{images}}', desc: '全部图片 URL/dataUrl 数组' },
  { name: '{{firstFrameImages}}', desc: '首帧图片数组' },
  { name: '{{lastFrameImages}}', desc: '尾帧图片数组' },
  { name: '{{referenceImages}}', desc: '参考图数组' },
  { name: '{{referenceVideos}}', desc: '参考视频数组' },
  { name: '{{referenceAudios}}', desc: '参考音频数组' },
  { name: '{{baseUrl}}', desc: 'Base URL' },
  { name: '{{apiKey}}', desc: 'API Key（用于 header）' },
  { name: '{{taskId}}', desc: '轮询任务 ID（用于轮询 URL）' },
]

// 新建 custom profile 预置 body 模板（3 个可直接填字段）
export const DEFAULT_CUSTOM_BODY = `{
  "prompt": "{{prompt}}",
  "model": "{{model}}",
  "images": {{images}}
}`

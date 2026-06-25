import type { LlmMessage } from '@/lib/llmClient'

// 系统提示词：让 LLM 从视频生成 API 文档提取自定义请求模板
export const SYSTEM_PROMPT = `你是一个 API 集成助手。用户会提供某个视频生成 API 的文档（文本或截图），你需要从中提取请求配置，输出严格 JSON。

可用占位符变量（在 URL / header 值 / body 模板中使用）：
- {{prompt}}：用户提示词（文本）
- {{model}}：模型名
- {{ratio}}：宽高比，如 16:9
- {{resolution}}：分辨率，如 720p
- {{duration}}：时长（秒，数字）
- {{seed}}：随机种子（可空）
- {{generateAudio}} / {{watermark}} / {{returnLastFrame}} / {{webSearch}}：布尔 true/false
- {{images}}：全部图片的 URL/dataUrl 数组
- {{firstFrameImages}} / {{lastFrameImages}} / {{referenceImages}}：分类图片数组
- {{referenceVideos}} / {{referenceAudios}}：参考视频/音频数组
- {{baseUrl}}：用户配置的 Base URL
- {{apiKey}}：API Key（用于 header）
- {{taskId}}：任务 ID（仅轮询 URL 用）

路径语法：用点号和数组下标，例如 data.result.videos[0].url、task_id、status、data.output。

输出 JSON schema（仅输出 JSON，不要解释）：
{
  "model": "文档中的默认模型 id",
  "submit": {
    "url": "提交 URL，可用 {{baseUrl}}；完整路径如 {{baseUrl}}/v2/videos/generations",
    "method": "POST",
    "headers": { "Content-Type": "application/json", "Authorization": "Bearer {{apiKey}}" },
    "body": "提交请求体的 JSON 字符串，用上述占位符；数组用 {{images}} 形式直接插入（不要加引号），字符串用 \"{{prompt}}\" 形式"
  },
  "poll": {
    "url": "轮询 URL，含 {{taskId}}，如 {{baseUrl}}/v2/videos/generations/{{taskId}}",
    "method": "GET",
    "headers": { "Authorization": "Bearer {{apiKey}}" }
  },
  "response": {
    "taskIdPath": "提交响应中任务 id 的路径，如 task_id",
    "statusPath": "轮询响应中状态的路径，如 status",
    "successValues": ["成功状态值，小写，如 success"],
    "failureValues": ["失败状态值，小写，如 failure"],
    "videoUrlPath": "结果视频 URL 的路径，如 data.output",
    "lastFrameUrlPath": "末帧 URL 路径（无则省略）",
    "errorPath": "错误信息路径，如 fail_reason（无则省略）",
    "progressPath": "进度路径（无则省略）"
  },
  "pollIntervalSec": 3,
  "notes": "简短说明"
}

注意：
- 状态值统一取小写。
- body 必须是合法 JSON 字符串（占位符替换后仍合法）：字符串值用 \"{{var}}\"，数组/数字/布尔用 {{var}} 直接插入。
- 若文档无某字段（如末帧、进度），对应路径省略该键。
- 【重要】body 中**必须**包含图片字段：若文档中有 images / image_url / image 等图片相关参数，body 里必须写 "images": {{images}}（不加引号，它是数组）。即使文档标注为可选，也必须包含此字段，因为用户可能会上传首帧/尾帧/参考图。若文档确实完全不支持图片输入，才可省略。
- 仅输出 JSON。`

export function buildUserMessage(docText?: string, images?: string[]): LlmMessage {
  const content: LlmMessage['content'] = []
  if (docText && docText.trim()) {
    // 截断过长文本
    const text = docText.length > 16000 ? docText.slice(0, 16000) + '\n…（已截断）' : docText
    content.push({ type: 'text', text })
  }
  if (images && images.length) {
    for (const img of images) {
      content.push({ type: 'image_url', image_url: { url: img } })
    }
  }
  if (!content.length) {
    content.push({ type: 'text', text: '（无内容）' })
  }
  return { role: 'user', content }
}

// LLM 输出结构（解析后）
export interface AiParsedConfig {
  model?: string
  submit?: { url?: string; method?: string; headers?: Record<string, string>; body?: string }
  poll?: { url?: string; method?: string; headers?: Record<string, string> }
  response?: {
    taskIdPath?: string
    statusPath?: string
    successValues?: string[]
    failureValues?: string[]
    videoUrlPath?: string
    lastFrameUrlPath?: string
    errorPath?: string
    progressPath?: string
  }
  pollIntervalSec?: number
  notes?: string
}

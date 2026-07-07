import type { LlmConfig, ProxyConfig } from '@/types'
import { httpFetch } from '@/net/httpClient'
import { useI18nStore } from '@/stores/i18n'

export type LlmMessageContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: LlmMessageContent
}

// 调用 OpenAI 兼容 chat completions，返回 choices[0].message.content
export async function callLLM(
  cfg: LlmConfig,
  messages: LlmMessage[],
  opts?: { signal?: AbortSignal; proxy?: ProxyConfig },
): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const res = await httpFetch<{ choices?: Array<{ message?: { content?: string } }> }>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0 }),
    timeoutSec: 120,
    signal: opts?.signal,
    proxy: opts?.proxy,
    logCategory: 'ai',
  })
  const content = res.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error(useI18nStore().t('error.llmNoContent'))
  return content
}

// 从 ```json 围栏或裸 JSON 中提取并解析
export function parseLLMJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : content
  // 找到第一个 { 到最后一个 }，容错前后解释文字
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(raw.slice(start, end + 1))
  }
  return JSON.parse(raw)
}

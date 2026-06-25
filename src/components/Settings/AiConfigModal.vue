<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/common/Modal.vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { callLLM, parseLLMJson } from '@/lib/llmClient'
import { httpFetch } from '@/net/httpClient'
import { SYSTEM_PROMPT, buildUserMessage, type AiParsedConfig } from '@/config/llmPrompt'
import { log } from '@/lib/logger'
import { blobToDataUrl } from '@/lib/blob'
import type { CustomTemplate, ProviderProfile } from '@/types'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; applied: [] }>()

const settings = useSettingsStore()
const toast = useToastStore()

const mode = ref<'text' | 'image' | 'url'>('text')
const docText = ref('')
const docUrl = ref('')
const images = ref<string[]>([])
const loading = ref(false)
const parsed = ref<AiParsedConfig | null>(null)
const rawContent = ref('')

async function onPickImages(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  for (const file of Array.from(input.files)) {
    const dataUrl = await blobToDataUrl(file)
    images.value.push(dataUrl)
  }
  input.value = ''
}
function removeImage(i: number) {
  images.value.splice(i, 1)
}

async function fetchUrlContent(): Promise<string> {
  // 经 proxy 抓取 URL 文本
  const proxy = settings.proxy.enabled ? settings.proxy : undefined
  const txt = await httpFetch<string>(docUrl.value, { method: 'GET', responseType: 'text', proxy, logCategory: 'ai', timeoutSec: 30 })
  return typeof txt === 'string' ? txt : String(txt)
}

async function parse() {
  const cfg = settings.settings.llmConfig
  if (!cfg?.baseUrl || !cfg?.apiKey || !cfg?.model) {
    toast.show('请先在「AI 辅助」tab 配置 LLM', 'error')
    return
  }
  loading.value = true
  parsed.value = null
  rawContent.value = ''
  try {
    let text = ''
    if (mode.value === 'text') text = docText.value
    else if (mode.value === 'url') text = await fetchUrlContent()
    const imgs = mode.value === 'image' ? images.value : undefined

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      buildUserMessage(text, imgs),
    ]
    log.info('ai', 'AI 解析请求', { mode: mode.value, textLen: text.length, images: imgs?.length ?? 0 })
    const content = await callLLM(cfg, messages, { proxy: settings.proxy.enabled ? settings.proxy : undefined })
    rawContent.value = content
    log.debug('ai', 'AI 原始返回', content)
    const obj = parseLLMJson(content) as AiParsedConfig
    parsed.value = obj
    log.info('ai', 'AI 解析完成', obj)
    toast.show('解析完成，请检查后应用', 'success')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    toast.show(`解析失败：${msg}`, 'error')
    log.error('ai', 'AI 解析失败', msg)
  } finally {
    loading.value = false
  }
}

function apply() {
  const p = parsed.value
  if (!p || !settings.activeProfile) return
  if (!p.submit?.url || !p.submit?.body || !p.response?.taskIdPath || !p.response?.statusPath || !p.response?.videoUrlPath) {
    toast.show('解析结果缺少必填字段，请手动补全', 'error')
    return
  }
  const tpl: CustomTemplate = {
    submitUrl: p.submit.url,
    submitMethod: 'POST',
    submitHeaders: p.submit.headers ?? { 'Content-Type': 'application/json', Authorization: 'Bearer {{apiKey}}' },
    submitBody: p.submit.body,
    pollUrl: p.poll?.url ?? '',
    pollMethod: (p.poll?.method === 'POST' ? 'POST' : 'GET'),
    pollHeaders: p.poll?.headers ?? { Authorization: 'Bearer {{apiKey}}' },
    taskIdPath: p.response.taskIdPath,
    statusPath: p.response.statusPath,
    successValues: p.response.successValues ?? ['success'],
    failureValues: p.response.failureValues ?? ['failure'],
    videoUrlPath: p.response.videoUrlPath,
    lastFrameUrlPath: p.response.lastFrameUrlPath,
    errorPath: p.response.errorPath,
    progressPath: p.response.progressPath,
    pollIntervalSec: p.pollIntervalSec ?? 3,
  }
  const patch: Partial<ProviderProfile> = { custom: tpl }
  if (p.model) patch.model = p.model
  settings.upsertProfile({ ...settings.activeProfile, ...patch })
  emit('applied')
}
</script>

<template>
  <Modal :show="props.show" title="✨ AI 解析文档" width="680px" @close="emit('close')">
    <div class="space-y-3">
      <p class="text-xs text-gray-400">粘贴站点 API 文档内容、上传文档截图，或填文档 URL（经代理抓取）。将调用你在「AI 辅助」配置的大模型生成自定义请求模板。</p>

      <div class="flex gap-1">
        <button v-for="t in [{k:'text',l:'粘贴内容'},{k:'image',l:'上传截图'},{k:'url',l:'文档 URL'}]" :key="t.k"
          class="rounded-lg px-3 py-1.5 text-xs"
          :class="mode === t.k ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'"
          @click="mode = t.k as typeof mode">{{ t.l }}</button>
      </div>

      <textarea v-if="mode === 'text'" v-model="docText" rows="6" placeholder="粘贴 API 文档（endpoint / 请求体 / 响应体 / 状态枚举 / 字段路径）…" class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs" />
      <div v-else-if="mode === 'image'" class="space-y-2">
        <input type="file" accept="image/*" multiple class="text-xs" @change="onPickImages" />
        <div class="flex flex-wrap gap-2">
          <div v-for="(img, i) in images" :key="i" class="relative">
            <img :src="img" class="h-24 w-auto rounded border border-gray-200" />
            <button class="absolute -right-1 -top-1 rounded-full bg-red-500 px-1 text-xs text-white" @click="removeImage(i)">✕</button>
          </div>
        </div>
      </div>
      <div v-else>
        <input v-model="docUrl" placeholder="https://docs.example.com/api/..." class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        <p class="mt-1 text-xs text-gray-400">需在「代理」中启用代理才能跨域抓取；失败请改用粘贴内容或截图。</p>
      </div>

      <button class="rounded-lg bg-blue-500 px-4 py-1.5 text-sm text-white hover:bg-blue-600 disabled:opacity-50" :disabled="loading" @click="parse">
        {{ loading ? '解析中…' : '解析' }}
      </button>

      <div v-if="parsed" class="rounded-lg border border-gray-200 p-3 text-xs">
        <div class="mb-2 font-medium text-gray-600">解析预览</div>
        <div class="space-y-1 text-gray-700">
          <div>模型：{{ parsed.model || '—' }}</div>
          <div>提交 URL：{{ parsed.submit?.url || '—' }}</div>
          <div>提交 body：<pre class="mt-1 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-[11px]">{{ parsed.submit?.body }}</pre></div>
          <div>轮询 URL：{{ parsed.poll?.url || '—' }}</div>
          <div>taskId 路径：{{ parsed.response?.taskIdPath || '—' }}</div>
          <div>状态路径：{{ parsed.response?.statusPath || '—' }}</div>
          <div>成功值：{{ parsed.response?.successValues?.join(', ') || '—' }} / 失败值：{{ parsed.response?.failureValues?.join(', ') || '—' }}</div>
          <div>视频 URL 路径：{{ parsed.response?.videoUrlPath || '—' }}</div>
          <div v-if="parsed.notes">备注：{{ parsed.notes }}</div>
        </div>
        <button class="mt-3 rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700" @click="apply">应用到当前自定义源</button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/common/Modal.vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { useI18nStore } from '@/stores/i18n'
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
const { t } = useI18nStore()

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
    toast.show(t('toast.aiConfigLlmFirst'), 'error')
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
    log.info('ai', t('log.aiParseRequest'), { mode: mode.value, textLen: text.length, images: imgs?.length ?? 0 })
    const content = await callLLM(cfg, messages, { proxy: settings.proxy.enabled ? settings.proxy : undefined })
    rawContent.value = content
    log.debug('ai', t('log.aiRawResponse'), content)
    const obj = parseLLMJson(content) as AiParsedConfig
    parsed.value = obj
    log.info('ai', t('log.aiParsedDone'), obj)
    toast.show(t('toast.aiParsed'), 'success')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    toast.show(t('toast.aiParseFailed', { msg }), 'error')
    log.error('ai', t('log.aiParseFailed'), msg)
  } finally {
    loading.value = false
  }
}

function apply() {
  const p = parsed.value
  if (!p || !settings.activeProfile) return
  if (!p.submit?.url || !p.submit?.body || !p.response?.taskIdPath || !p.response?.statusPath || !p.response?.videoUrlPath) {
    toast.show(t('toast.aiMissingFields'), 'error')
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
  <Modal :show="props.show" title="✨ AI_PARSE_MODULE //" width="680px" @close="emit('close')">
    <div class="space-y-4">
      <p class="font-mono text-[10px] text-gray-500 leading-relaxed border-l-2 border-ak-400 pl-2">
        // {{ t('notice.aiPasteHint') }}
      </p>

      <div class="flex gap-1 border border-gray-800 bg-ak-dark p-1 w-fit">
        <button v-for="tab in [{k:'text',key:'ai.tabText'},{k:'image',key:'ai.tabImage'},{k:'url',key:'ai.tabUrl'}]" :key="tab.k"
          class="px-4 py-1.5 font-mono text-[10px] transition"
          :class="mode === tab.k ? 'bg-ak-400 text-ak-darker font-bold shadow-[0_0_8px_rgba(0,229,255,0.4)]' : 'text-gray-500 hover:text-white'"
          @click="mode = tab.k as typeof mode">> {{ t(tab.key) }}</button>
      </div>

      <textarea v-if="mode === 'text'" v-model="docText" rows="6" :placeholder="t('ai.placeholderPaste')" class="w-full bg-ak-dark border border-gray-800 text-white font-mono text-xs p-3 focus:border-ak-400 outline-none" />

      <div v-else-if="mode === 'image'" class="space-y-3 p-4 border border-dashed border-gray-800 bg-ak-dark/50">
        <input type="file" accept="image/*" multiple class="text-[10px] font-mono text-gray-400 file:bg-ak-dark file:border file:border-gray-800 file:text-ak-400 file:px-3 file:py-1 hover:file:bg-ak-gray transition-colors" @change="onPickImages" />
        <div class="flex flex-wrap gap-2">
          <div v-for="(img, i) in images" :key="i" class="relative group">
            <img :src="img" class="h-24 w-auto object-cover border border-gray-800 group-hover:border-ak-400 transition-colors" />
            <button class="absolute -right-1 -top-1 bg-red-950/85 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-ak-darker px-1 text-[10px] font-mono transition-colors" @click="removeImage(i)">✕</button>
          </div>
        </div>
      </div>

      <div v-else>
        <input v-model="docUrl" placeholder="https://docs.example.com/api/..." class="w-full bg-ak-dark border border-gray-800 text-white font-mono text-xs px-3 py-2 focus:border-ak-400 outline-none" />
        <p class="mt-1 font-mono text-[10px] text-gray-600">// {{ t('notice.aiUrlProxyHint') }}</p>
      </div>

      <button class="relative bg-white text-ak-darker hover:bg-ak-400 hover:shadow-[0_0_20px_rgba(0,229,255,0.45)] font-sans italic font-bold text-sm tracking-widest pl-10 pr-8 py-3 transition flex items-center group disabled:opacity-50 disabled:grayscale disabled:hover:bg-white disabled:hover:shadow-none" :disabled="loading" @click="parse">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-4 bg-ak-darker group-hover:h-2 transition-[height] duration-300"></span>
        {{ loading ? t('ai.processing') : t('ai.initiateParse') }}
      </button>

      <div v-if="parsed" class="border border-ak-400/30 bg-ak-darker p-4 mt-4">
        <div class="font-mono text-[10px] font-bold text-ak-400 border-b border-gray-800 pb-1 mb-3">{{ t('ai.resultPreview') }} //</div>
        <div class="space-y-1.5 font-mono text-[10px] text-gray-400">
          <div><span class="text-gray-600">{{ t('ai.fieldModel') }}:</span> <span class="text-white">{{ parsed.model || 'N/A' }}</span></div>
          <div><span class="text-gray-600">{{ t('form.submitUrl') }}:</span> <span class="text-white">{{ parsed.submit?.url || 'N/A' }}</span></div>
          <div class="pt-1"><span class="text-gray-600 block mb-1">{{ t('ai.fieldSubmitBody') }}:</span><pre class="max-h-32 overflow-auto bg-ak-dark border border-gray-800 p-2 text-ak-400">{{ parsed.submit?.body }}</pre></div>
          <div class="pt-2"><span class="text-gray-600">{{ t('form.pollUrl') }}:</span> <span class="text-white">{{ parsed.poll?.url || 'N/A' }}</span></div>
          <div><span class="text-gray-600">{{ t('form.taskIdPath') }}:</span> <span class="text-white">{{ parsed.response?.taskIdPath || 'N/A' }}</span></div>
          <div><span class="text-gray-600">{{ t('form.statusPath') }}:</span> <span class="text-white">{{ parsed.response?.statusPath || 'N/A' }}</span></div>
          <div><span class="text-gray-600">{{ t('form.successValues') }}:</span> <span class="text-white">{{ parsed.response?.successValues?.join(', ') || 'N/A' }}</span></div>
          <div><span class="text-gray-600">{{ t('form.failureValues') }}:</span> <span class="text-white">{{ parsed.response?.failureValues?.join(', ') || 'N/A' }}</span></div>
          <div><span class="text-gray-600">{{ t('form.videoUrlPath') }}:</span> <span class="text-white">{{ parsed.response?.videoUrlPath || 'N/A' }}</span></div>
          <div v-if="parsed.notes" class="text-ak-400 mt-2 border-l-2 border-ak-400 pl-2">{{ t('ai.fieldNote') }}: {{ parsed.notes }}</div>
        </div>
        <button class="mt-4 border border-teal-500/50 bg-teal-950/20 text-teal-400 px-4 py-2 font-mono text-xs hover:bg-teal-400 hover:text-ak-darker transition-colors" @click="apply">> {{ t('ai.applyToProfile') }}</button>
      </div>
    </div>
  </Modal>
</template>

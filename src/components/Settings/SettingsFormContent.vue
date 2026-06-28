<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { useTasksStore } from '@/stores/tasks'
import { useLogsStore } from '@/stores/logs'
import { httpFetch, buildApiUrl } from '@/net/httpClient'
import { TEMPLATE_VARS } from '@/lib/template'
import { log } from '@/lib/logger'
import AiConfigModal from './AiConfigModal.vue'

const props = defineProps<{ tab: 'provider' | 'proxy' | 'ai' | 'general' }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const toast = useToastStore()
const tasks = useTasksStore()
const logs = useLogsStore()

const profile = ref(settings.activeProfile)
const showAiModal = ref(false)

const submitHeaders = computed<{ k: string; v: string }[]>(() => {
  const h = profile.value?.custom?.submitHeaders
  return h ? Object.entries(h).map(([k, v]) => ({ k, v })) : []
})
const pollHeaders = computed<{ k: string; v: string }[]>(() => {
  const h = profile.value?.custom?.pollHeaders
  return h ? Object.entries(h).map(([k, v]) => ({ k, v })) : []
})

function ensureProfileSync() {
  profile.value = settings.activeProfile
}

function patch(patch: Partial<NonNullable<typeof profile.value>>) {
  if (!profile.value) return
  settings.upsertProfile({ ...profile.value, ...patch })
  ensureProfileSync()
}

function patchCustom(patch: Partial<NonNullable<typeof profile.value>['custom']>) {
  if (!profile.value || !profile.value.custom) return
  settings.upsertProfile({ ...profile.value, custom: { ...profile.value.custom, ...patch } })
  ensureProfileSync()
}

function headersToObject(arr: { k: string; v: string }[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { k, v } of arr) if (k.trim()) out[k.trim()] = v
  return out
}

function updateSubmitHeaderField() {
  if (!profile.value?.custom) return
  patchCustom({ submitHeaders: headersToObject(submitHeaders.value) })
}
function updatePollHeaderField() {
  if (!profile.value?.custom) return
  patchCustom({ pollHeaders: headersToObject(pollHeaders.value) })
}
function addSubmitHeader() {
  if (!profile.value?.custom) return
  patchCustom({ submitHeaders: { ...profile.value.custom.submitHeaders, '': '' } })
}
function addPollHeader() {
  if (!profile.value?.custom) return
  patchCustom({ pollHeaders: { ...profile.value.custom.pollHeaders, '': '' } })
}
function delSubmitHeader(key: string) {
  if (!profile.value?.custom) return
  const next = { ...profile.value.custom.submitHeaders }
  delete next[key]
  patchCustom({ submitHeaders: next })
}
function delPollHeader(key: string) {
  if (!profile.value?.custom) return
  const next = { ...profile.value.custom.pollHeaders }
  delete next[key]
  patchCustom({ pollHeaders: next })
}

function addSeedance() { settings.addProfile('seedance'); ensureProfileSync() }
function addCustom() { settings.addProfile('custom'); ensureProfileSync() }
function removeCurrent() { if (profile.value) { settings.removeProfile(profile.value.id); ensureProfileSync() } }
function selectProfile(id: string) { settings.setActiveProfile(id); ensureProfileSync() }

async function testConnection() {
  const p = profile.value
  if (!p?.apiKey.trim()) { toast.show('请先填写 API Key', 'error'); return }
  toast.show('测试中…', 'info')
  try {
    let url: string
    if (p.kind === 'seedance') {
      url = buildApiUrl(p.baseUrl, '/contents/generations/tasks/__test__')
    } else {
      const rendered = (p.custom?.pollUrl ?? '')
        .replace(/\{\{baseUrl\}\}/g, p.baseUrl.replace(/\/+$/, ''))
        .replace(/\{\{taskId\}\}/g, '__test__')
        .replace(/\{\{apiKey\}\}/g, p.apiKey)
      url = /^https?:\/\//.test(rendered)
        ? rendered
        : `${p.baseUrl.replace(/\/+$/, '')}/${rendered.replace(/^\//, '')}`
    }
    await httpFetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${p.apiKey}` },
      timeoutSec: p.timeout,
      proxy: settings.proxy.enabled ? settings.proxy : undefined,
      logCategory: 'test',
    })
    toast.show('连接成功', 'success')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/40[04]|not.?found|task_id/i.test(msg))
      toast.show('连接成功（鉴权通过）', 'success')
    else if (/40[13]|unauthorized|forbidden|auth/i.test(msg))
      toast.show('鉴权失败，请检查 API Key', 'error')
    else { toast.show('连接失败，详见调试日志', 'error'); log.error('test', '连接失败', msg) }
  }
}

async function testProxy() {
  const p = settings.proxy
  if (!p.enabled || !p.url) { toast.show('请先启用代理并填写地址', 'error'); return }
  toast.show('代理配置已保存，可用「测试连接」验证', 'success')
}

function patchLlm(patch: Partial<NonNullable<typeof settings.settings.llmConfig>>) {
  const cur = settings.settings.llmConfig ?? { baseUrl: '', apiKey: '', model: '' }
  settings.update({ llmConfig: { ...cur, ...patch } })
}
async function testLlm() {
  const cfg = settings.settings.llmConfig
  if (!cfg?.baseUrl || !cfg?.apiKey || !cfg?.model) { toast.show('请填全 LLM 配置', 'error'); return }
  toast.show('LLM 测试中…', 'info')
  try {
    await httpFetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      timeoutSec: 30,
      proxy: settings.proxy.enabled ? settings.proxy : undefined,
      logCategory: 'ai',
    })
    toast.show('LLM 连通', 'success')
  } catch (err) {
    toast.show('LLM 连接失败，详见调试日志', 'error')
    log.error('ai', 'LLM 测试失败', err instanceof Error ? err.message : String(err))
  }
}

function onAiApplied() {
  showAiModal.value = false
  ensureProfileSync()
  toast.show('已应用 AI 解析结果，请检查后保存', 'success')
}

function clearAllTasks() {
  if (!confirm('确定清空所有任务历史？此操作不可撤销。')) return
  tasks.tasks.slice().forEach((t) => void tasks.removeTask(t.id))
  toast.show('已清空任务', 'success')
}

const importInput = ref<HTMLInputElement | null>(null)
async function exportData() {
  try {
    const json = await tasks.exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seedance-live-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.show('已导出', 'success')
  } catch (err) {
    toast.show(`导出失败：${err instanceof Error ? err.message : String(err)}`, 'error')
  }
}
function importData() { importInput.value?.click() }
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const res = await tasks.importData(text)
    toast.show(`已导入 ${res.count} 个任务`, 'success')
  } catch (err) {
    toast.show(`导入失败：${err instanceof Error ? err.message : String(err)}`, 'error')
  }
  input.value = ''
}
</script>

<template>
  <div>
    <!-- 供应商 -->
    <div v-if="props.tab === 'provider'" class="space-y-6">
      <div class="flex flex-wrap items-center gap-3 bg-tactical-900/80 p-3 clip-chamfer border border-tactical-700">
        <select
          :value="settings.activeProfile?.id"
          class="flex-1 min-w-[200px] bg-tactical-800 border border-tactical-600 text-elysia-100 font-mono text-sm px-3 py-2 clip-chamfer outline-none focus:border-elysia-400 transition-colors"
          @change="selectProfile(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in settings.settings.profiles" :key="p.id" :value="p.id" class="bg-tactical-900">{{ p.name }} [{{ p.kind === 'seedance' ? 'OFFICIAL' : 'CUSTOM' }}]</option>
        </select>
        <button class="bg-tactical-800 border border-tactical-600 text-gray-400 hover:border-elysia-400 hover:text-elysia-300 font-mono text-xs px-4 py-2 clip-chamfer transition-colors shadow-sm" @click="addSeedance">+ ADD_OFFICIAL</button>
        <button class="bg-tactical-800 border border-tactical-600 text-gray-400 hover:border-elysia-400 hover:text-elysia-300 font-mono text-xs px-4 py-2 clip-chamfer transition-colors shadow-sm" @click="addCustom">+ ADD_CUSTOM</button>
        <button class="bg-red-900/20 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-tactical-900 font-mono text-xs px-4 py-2 clip-chamfer transition-colors shadow-sm" @click="removeCurrent">PURGE</button>
      </div>

      <template v-if="profile">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="block">
            <span class="text-xs font-mono text-gray-500 block mb-1.5 ml-1">PROFILE_NAME //</span>
            <input :value="profile.name" class="w-full bg-tactical-900/80 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patch({ name: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block">
            <span class="text-xs font-mono text-gray-500 block mb-1.5 ml-1">BASE_ENDPOINT_URL //</span>
            <input :value="profile.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" class="w-full bg-tactical-900/80 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patch({ baseUrl: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block md:col-span-2">
            <span class="text-xs font-mono text-gray-500 block mb-1.5 ml-1">AUTH_TOKEN (API_KEY) //</span>
            <input :value="profile.apiKey" type="password" placeholder="Bearer token" class="w-full bg-tactical-900/80 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patch({ apiKey: ($event.target as HTMLInputElement).value })" />
          </label>
          <label v-if="profile.kind === 'custom'" class="block md:col-span-2">
            <span class="text-xs font-mono text-gray-500 block mb-1.5 ml-1">MODEL_OVERRIDE //</span>
            <input :value="profile.model" placeholder="e.g. doubao-seedance-1-0-pro-250528" class="w-full bg-tactical-900/80 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patch({ model: ($event.target as HTMLInputElement).value })" />
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-4 pt-4 border-t border-tactical-700 mt-4">
          <button class="bg-gradient-to-r from-elysia-600 to-elysia-400 text-white font-sans italic font-bold text-sm tracking-widest px-6 py-2.5 clip-chamfer hover:from-elysia-500 hover:to-elysia-300 shadow-[0_0_15px_rgba(255,135,178,0.4)] transition-all flex items-center gap-2 group" @click="testConnection">
             <div class="w-2 h-2 bg-white rounded-full group-hover:animate-ping"></div>
             INITIATE_TEST_SEQ
          </button>
          <button v-if="profile.kind === 'custom'" class="border border-elysia-400/50 bg-elysia-400/10 text-elysia-300 font-mono text-sm px-6 py-2.5 clip-chamfer hover:bg-elysia-400 hover:text-tactical-900 transition-colors flex items-center gap-2" @click="showAiModal = true">
            <span class="animate-pulse">✨</span> AI_PARSE_DOCS
          </button>
          <span class="text-xs font-mono text-gray-500 ml-auto border border-tactical-700 bg-tactical-900 px-3 py-1 clip-chamfer-reverse">{{ profile.kind === 'seedance' ? '// OFFICIAL VOLCENGINE MODE' : '// CUSTOM TEMPLATE MODE' }}</span>
        </div>

        <!-- 自定义模板 -->
        <div v-if="profile.kind === 'custom' && profile.custom" class="mt-8 space-y-6 border-l-2 border-elysia-400/50 bg-tactical-900/30 p-5 clip-chamfer shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
          <div class="space-y-4">
            <div class="flex items-center gap-3 border-b border-elysia-400/20 pb-2">
               <div class="w-2 h-2 bg-elysia-500 rotate-45 shadow-[0_0_8px_#FF5090]"></div>
               <div class="text-sm font-sans italic font-bold text-elysia-300 tracking-widest">SUBMIT_CFG //</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label class="block md:col-span-2">
                <span class="text-xs font-mono text-gray-500 block mb-1">SUBMIT_URL</span>
                <input :value="profile.custom.submitUrl" class="w-full bg-tactical-800 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ submitUrl: ($event.target as HTMLInputElement).value })" />
              </label>
              <label class="block">
                <span class="text-xs font-mono text-gray-500 block mb-1">HTTP_METHOD</span>
                <select :value="profile.custom.submitMethod" class="w-full bg-tactical-800 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @change="patchCustom({ submitMethod: ($event.target as HTMLSelectElement).value as 'POST' })">
                  <option value="POST">POST</option>
                </select>
              </label>
            </div>
            <div class="bg-tactical-800/50 p-3 clip-chamfer border border-tactical-700">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-mono text-gray-400">HEADERS_PAYLOAD //</span>
                <button class="text-xs font-mono text-elysia-400 hover:text-elysia-300 flex items-center gap-1" @click="addSubmitHeader"><span class="text-lg leading-none">+</span> ADD_HEADER</button>
              </div>
              <div class="space-y-2">
                <div v-for="h in submitHeaders" :key="h.k" class="flex gap-2 items-center">
                  <input :value="h.k" placeholder="Key" class="w-1/3 bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="h.k = ($event.target as HTMLInputElement).value; updateSubmitHeaderField()" />
                  <input :value="h.v" placeholder="Value" class="flex-1 bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="h.v = ($event.target as HTMLInputElement).value; updateSubmitHeaderField()" />
                  <button class="w-8 h-8 flex items-center justify-center text-red-500 bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-white clip-chamfer transition-colors" @click="delSubmitHeader(h.k)">✕</button>
                </div>
              </div>
            </div>
            <label class="block">
              <span class="text-xs font-mono text-gray-500 block mb-1">BODY_TEMPLATE (JSON format) //</span>
              <textarea :value="profile.custom.submitBody" rows="8" class="w-full bg-tactical-800 border border-tactical-600 text-elysia-300 font-mono text-xs p-4 clip-chamfer focus:border-elysia-400 outline-none transition-colors shadow-inner" @input="patchCustom({ submitBody: ($event.target as HTMLTextAreaElement).value })" />
            </label>
          </div>

          <div class="space-y-4 pt-4 border-t border-tactical-700">
            <div class="flex items-center gap-3 border-b border-elysia-400/20 pb-2">
               <div class="w-2 h-2 bg-elysia-300 rotate-45 shadow-[0_0_8px_#FF94B8]"></div>
               <div class="text-sm font-sans italic font-bold text-elysia-300 tracking-widest">POLL_CFG //</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label class="block md:col-span-2">
                <span class="text-xs font-mono text-gray-500 block mb-1">POLL_URL</span>
                <input :value="profile.custom.pollUrl" class="w-full bg-tactical-800 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ pollUrl: ($event.target as HTMLInputElement).value })" />
              </label>
              <label class="block">
                <span class="text-xs font-mono text-gray-500 block mb-1">HTTP_METHOD</span>
                <select :value="profile.custom.pollMethod" class="w-full bg-tactical-800 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @change="patchCustom({ pollMethod: ($event.target as HTMLSelectElement).value as 'GET' })">
                  <option value="GET">GET</option>
                </select>
              </label>
            </div>
            <div class="bg-tactical-800/50 p-3 clip-chamfer border border-tactical-700">
              <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-mono text-gray-400">HEADERS_PAYLOAD //</span>
                <button class="text-xs font-mono text-elysia-400 hover:text-elysia-300 flex items-center gap-1" @click="addPollHeader"><span class="text-lg leading-none">+</span> ADD_HEADER</button>
              </div>
              <div class="space-y-2">
                <div v-for="h in pollHeaders" :key="h.k" class="flex gap-2 items-center">
                  <input :value="h.k" placeholder="Key" class="w-1/3 bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="h.k = ($event.target as HTMLInputElement).value; updatePollHeaderField()" />
                  <input :value="h.v" placeholder="Value" class="flex-1 bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="h.v = ($event.target as HTMLInputElement).value; updatePollHeaderField()" />
                  <button class="w-8 h-8 flex items-center justify-center text-red-500 bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-white clip-chamfer transition-colors" @click="delPollHeader(h.k)">✕</button>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-4 pt-4 border-t border-tactical-700">
             <div class="flex items-center gap-3 border-b border-elysia-400/20 pb-2">
               <div class="w-2 h-2 bg-elysia-400 rotate-45 shadow-[0_0_8px_#FF87B2]"></div>
               <div class="text-sm font-sans italic font-bold text-elysia-300 tracking-widest">RESPONSE_EXTRACTION_PATHS //</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">TASK_ID_PATH</span><input :value="profile.custom.taskIdPath" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ taskIdPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">STATUS_PATH</span><input :value="profile.custom.statusPath" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ statusPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">SUCCESS_VALUES (CSV)</span><input :value="profile.custom.successValues.join(',')" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ successValues: ($event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean) })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">FAILURE_VALUES (CSV)</span><input :value="profile.custom.failureValues.join(',')" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ failureValues: ($event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean) })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">VIDEO_URL_PATH</span><input :value="profile.custom.videoUrlPath" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ videoUrlPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">LAST_FRAME_URL_PATH</span><input :value="profile.custom.lastFrameUrlPath ?? ''" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ lastFrameUrlPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">ERROR_PATH</span><input :value="profile.custom.errorPath ?? ''" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ errorPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">PROGRESS_PATH</span><input :value="profile.custom.progressPath ?? ''" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ progressPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="bg-tactical-800/30 p-2 border border-tactical-700 clip-chamfer hover:border-elysia-400/50 transition-colors"><span class="text-[10px] font-mono text-gray-500 block mb-1">POLL_INTERVAL_SEC</span><input type="number" :value="profile.custom.pollIntervalSec" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1.5 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchCustom({ pollIntervalSec: Number(($event.target as HTMLInputElement).value) })" /></label>
            </div>

            <details class="bg-tactical-900/80 p-3 clip-chamfer border border-tactical-600 group mt-4">
              <summary class="cursor-pointer font-mono text-xs text-elysia-400 font-bold flex items-center gap-2 select-none">
                <span class="text-lg leading-none group-open:rotate-90 transition-transform">></span> VIEW_AVAILABLE_VARIABLES
              </summary>
              <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono text-gray-400 p-2 border-t border-tactical-700">
                <div v-for="v in TEMPLATE_VARS" :key="v.name" class="flex flex-col gap-1">
                  <span class="text-elysia-300 font-bold">{{ v.name }}</span>
                  <span class="opacity-80">{{ v.desc }}</span>
                </div>
              </div>
            </details>
          </div>
        </div>
      </template>
    </div>

    <!-- 代理 -->
    <div v-else-if="props.tab === 'proxy'" class="space-y-6 max-w-2xl">
      <div
        class="flex items-center justify-between p-4 md:p-6 clip-chamfer cursor-pointer transition-all duration-300 border-2"
        :class="settings.proxy.enabled ? 'border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_20px_rgba(255,135,178,0.2)]' : 'border-tactical-700 bg-tactical-900/80 hover:border-elysia-400/50'"
        @click="settings.setProxy({ enabled: !settings.proxy.enabled })"
      >
        <div class="flex flex-col gap-1">
          <span class="font-sans italic font-bold text-lg tracking-widest uppercase" :class="settings.proxy.enabled ? 'text-elysia-300' : 'text-gray-500'">ENABLE_PROXY_ROUTING</span>
          <span class="font-mono text-[10px] text-gray-500">SYS.NET.PROXY_OVERRIDE</span>
        </div>
        <div class="w-8 h-8 border border-tactical-600 flex items-center justify-center rotate-45 transition-all duration-300" :class="settings.proxy.enabled ? 'border-elysia-400 shadow-[0_0_15px_rgba(255,135,178,0.5)]' : ''">
           <span class="w-4 h-4 transition-all duration-300" :class="settings.proxy.enabled ? 'bg-elysia-400 shadow-[0_0_10px_#FF87B2]' : 'bg-tactical-800'"></span>
        </div>
      </div>

      <div class="bg-tactical-800/30 p-4 border-l-2 border-tactical-600">
        <p class="font-mono text-xs text-gray-400 leading-relaxed">
          <span class="text-elysia-500 font-bold">// NOTICE:</span> 官方接口浏览器直连通常会被 CORS 拦截，需自备代理转发。代理脚本示例见 docs/proxy.md。
        </p>
      </div>

      <div class="space-y-4 p-5 bg-tactical-800/50 border border-tactical-700 clip-chamfer-lg relative">
        <div class="absolute inset-0 bg-sakura-pattern opacity-5 pointer-events-none"></div>
        <label class="block relative z-10">
          <span class="font-mono text-xs text-elysia-300 block mb-2 tracking-wider">PROXY_ENDPOINT_URL //</span>
          <input :value="settings.proxy.url" placeholder="https://your-proxy.workers.dev" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-3 clip-chamfer focus:border-elysia-400 outline-none transition-colors shadow-inner" @input="settings.setProxy({ url: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="block relative z-10">
          <span class="font-mono text-xs text-elysia-300 block mb-2 tracking-wider">REWRITE_STRATEGY //</span>
          <select :value="settings.proxy.mode" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-3 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @change="settings.setProxy({ mode: ($event.target as HTMLSelectElement).value as 'path' | 'query' })">
            <option value="query">QUERY_PARAM (?target=URL)</option>
            <option value="path">PATH_APPEND (/URL)</option>
          </select>
        </label>
      </div>

      <button class="bg-gradient-to-r from-elysia-600 to-elysia-400 text-white font-sans italic font-bold text-sm tracking-widest px-8 py-3 clip-chamfer-lg hover:from-elysia-500 hover:to-elysia-300 shadow-[0_0_20px_rgba(255,135,178,0.4)] transition-all mt-4 flex items-center gap-2 group" @click="testProxy">
        <span class="w-1.5 h-4 bg-white group-hover:h-1.5 transition-all duration-300"></span>
        APPLY_PROXY_CFG
      </button>
    </div>

    <!-- AI 辅助 -->
    <div v-else-if="props.tab === 'ai'" class="space-y-6 max-w-2xl">
      <div class="bg-tactical-800/30 p-4 border-l-2 border-elysia-400/50 clip-chamfer">
        <p class="font-mono text-xs text-gray-300 leading-relaxed flex items-start gap-2">
          <span class="text-elysia-400 animate-pulse mt-0.5">✨</span>
          <span>配置大模型 API（OpenAI 兼容），用于在自定义源「AI 解析文档」时自动生成请求模板。支持具有 Vision 能力的模型。</span>
        </p>
      </div>

      <div class="space-y-4 p-5 bg-tactical-800/50 border border-tactical-700 clip-chamfer-lg relative">
        <div class="absolute inset-0 bg-sakura-pattern opacity-5 pointer-events-none"></div>
        <label class="block relative z-10">
          <span class="font-mono text-xs text-elysia-300 block mb-2 tracking-wider">LLM_BASE_URL //</span>
          <input :value="settings.settings.llmConfig?.baseUrl ?? ''" placeholder="https://api.openai.com/v1" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-3 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchLlm({ baseUrl: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="block relative z-10">
          <span class="font-mono text-xs text-elysia-300 block mb-2 tracking-wider">AUTH_TOKEN (API_KEY) //</span>
          <input :value="settings.settings.llmConfig?.apiKey ?? ''" type="password" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-3 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchLlm({ apiKey: ($event.target as HTMLInputElement).value })" />
        </label>
        <label class="block relative z-10">
          <span class="font-mono text-xs text-elysia-300 block mb-2 tracking-wider">MODEL_ID (Requires Vision) //</span>
          <input :value="settings.settings.llmConfig?.model ?? ''" placeholder="gpt-4o / glm-4v" class="w-full bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-4 py-3 clip-chamfer focus:border-elysia-400 outline-none transition-colors" @input="patchLlm({ model: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>

      <button class="bg-gradient-to-r from-elysia-600 to-elysia-400 text-white font-sans italic font-bold text-sm tracking-widest px-8 py-3 clip-chamfer-lg hover:from-elysia-500 hover:to-elysia-300 shadow-[0_0_20px_rgba(255,135,178,0.4)] transition-all flex items-center gap-3 group" @click="testLlm">
        <div class="w-3 h-3 border-2 border-white rotate-45 group-hover:bg-white transition-colors"></div>
        TEST_LLM_LINK
      </button>

      <div class="pt-6 mt-6 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-tactical-600 before:to-transparent">
        <div
          class="flex items-center justify-between p-4 md:p-5 clip-chamfer cursor-pointer transition-all duration-300 border-2"
          :class="settings.settings.verboseLogs ? 'border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_15px_rgba(255,135,178,0.15)]' : 'border-tactical-700 bg-tactical-900/80 hover:border-elysia-400/50'"
          @click="settings.update({ verboseLogs: !settings.settings.verboseLogs }); logs.setVerbose(!settings.settings.verboseLogs)"
        >
          <div class="flex flex-col gap-1">
            <span class="font-sans italic font-bold text-sm tracking-widest uppercase" :class="settings.settings.verboseLogs ? 'text-elysia-300' : 'text-gray-400'">VERBOSE_LOGGING</span>
            <span class="font-mono text-[10px] text-gray-500">关闭后仅记录 warn/error 级别日志</span>
          </div>
          <div class="w-6 h-6 border border-tactical-600 flex items-center justify-center rotate-45 transition-all duration-300" :class="settings.settings.verboseLogs ? 'border-elysia-400' : ''">
             <span class="w-3 h-3 transition-all duration-300" :class="settings.settings.verboseLogs ? 'bg-elysia-400 shadow-[0_0_8px_#FF87B2]' : 'bg-tactical-800'"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 通用 -->
    <div v-else class="space-y-6 max-w-2xl">

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          class="flex flex-col justify-between p-4 md:p-5 clip-chamfer cursor-pointer transition-all duration-300 border-2 min-h-[100px]"
          :class="settings.settings.clearComposerAfterSubmit ? 'border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_15px_rgba(255,135,178,0.15)]' : 'border-tactical-700 bg-tactical-900/80 hover:border-elysia-400/50'"
          @click="settings.update({ clearComposerAfterSubmit: !settings.settings.clearComposerAfterSubmit })"
        >
          <div class="flex justify-between items-start mb-4">
             <span class="font-sans italic font-bold text-sm tracking-widest uppercase" :class="settings.settings.clearComposerAfterSubmit ? 'text-elysia-300' : 'text-gray-400'">AUTO_CLEAR_INPUT</span>
             <div class="w-4 h-4 border border-tactical-600 flex items-center justify-center rotate-45 transition-all duration-300" :class="settings.settings.clearComposerAfterSubmit ? 'border-elysia-400' : ''">
               <span class="w-2 h-2 transition-all duration-300" :class="settings.settings.clearComposerAfterSubmit ? 'bg-elysia-400 shadow-[0_0_8px_#FF87B2]' : 'bg-tactical-800'"></span>
            </div>
          </div>
          <span class="font-mono text-[10px] text-gray-500">提交后自动清空编辑器内容</span>
        </div>

        <div
          class="flex flex-col justify-between p-4 md:p-5 clip-chamfer cursor-pointer transition-all duration-300 border-2 min-h-[100px]"
          :class="settings.settings.notifyOnComplete ? 'border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_15px_rgba(255,135,178,0.15)]' : 'border-tactical-700 bg-tactical-900/80 hover:border-elysia-400/50'"
          @click="settings.update({ notifyOnComplete: !settings.settings.notifyOnComplete })"
        >
          <div class="flex justify-between items-start mb-4">
             <span class="font-sans italic font-bold text-sm tracking-widest uppercase" :class="settings.settings.notifyOnComplete ? 'text-elysia-300' : 'text-gray-400'">DESKTOP_NOTIFY</span>
             <div class="w-4 h-4 border border-tactical-600 flex items-center justify-center rotate-45 transition-all duration-300" :class="settings.settings.notifyOnComplete ? 'border-elysia-400' : ''">
               <span class="w-2 h-2 transition-all duration-300" :class="settings.settings.notifyOnComplete ? 'bg-elysia-400 shadow-[0_0_8px_#FF87B2]' : 'bg-tactical-800'"></span>
            </div>
          </div>
          <span class="font-mono text-[10px] text-gray-500">任务完成时发送系统通知</span>
        </div>
      </div>

      <label class="block bg-tactical-800/50 border border-tactical-700 p-5 clip-chamfer-lg">
        <span class="font-mono text-xs text-elysia-300 block mb-3 tracking-wider">OFFICIAL_POLL_INTERVAL (SEC) //</span>
        <div class="flex items-center gap-3">
           <input type="number" :value="settings.settings.pollIntervalSec" class="w-32 bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-lg px-4 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors text-center" @input="settings.update({ pollIntervalSec: Number(($event.target as HTMLInputElement).value) })" />
           <span class="text-xs font-mono text-gray-500">SECONDS_DELAY</span>
        </div>
      </label>

      <div class="pt-6 mt-6 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-tactical-600 before:to-transparent">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-3 h-3 bg-elysia-500 clip-chamfer-reverse shadow-[0_0_8px_#FF5090]"></div>
          <div class="font-sans italic font-bold text-lg text-elysia-400 tracking-widest uppercase">DATA_MANAGEMENT //</div>
        </div>

        <p class="font-mono text-xs text-gray-500 mb-4 bg-tactical-800/30 p-3 border-l-2 border-tactical-600">
          导出包含任务、素材、视频与封面，可作为备份或迁移到其他设备。
        </p>

        <div class="flex flex-wrap gap-4">
          <button class="flex-1 min-w-[140px] bg-tactical-800 border border-tactical-500 text-gray-300 hover:border-elysia-400 hover:text-elysia-300 hover:bg-tactical-800/80 font-mono text-sm px-4 py-3 clip-chamfer transition-all duration-300 flex flex-col items-center gap-1 group" @click="exportData">
            <span class="text-lg group-hover:-translate-y-1 transition-transform">↓</span>
            EXPORT_DB
          </button>
          <button class="flex-1 min-w-[140px] bg-tactical-800 border border-tactical-500 text-gray-300 hover:border-elysia-400 hover:text-elysia-300 hover:bg-tactical-800/80 font-mono text-sm px-4 py-3 clip-chamfer transition-all duration-300 flex flex-col items-center gap-1 group" @click="importData">
            <span class="text-lg group-hover:-translate-y-1 transition-transform">↑</span>
            IMPORT_DB
          </button>
          <button class="w-full md:w-auto bg-red-900/20 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white font-mono text-sm px-6 py-3 clip-chamfer transition-all duration-300 flex flex-col items-center gap-1 group" @click="clearAllTasks">
            <span class="text-lg group-hover:scale-110 transition-transform">⚠</span>
            PURGE_ALL_TASKS
          </button>
        </div>
        <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="onImportFile" />
      </div>
    </div>

    <AiConfigModal :show="showAiModal" @close="showAiModal = false" @applied="onAiApplied" />
  </div>
</template>
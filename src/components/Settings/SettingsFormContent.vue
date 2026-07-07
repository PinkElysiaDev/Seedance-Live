<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { useTasksStore } from '@/stores/tasks'
import { useLogsStore } from '@/stores/logs'
import { useI18nStore } from '@/stores/i18n'
import { httpFetch, buildApiUrl } from '@/net/httpClient'
import { TEMPLATE_VARS } from '@/lib/template'
import { log } from '@/lib/logger'
import AiConfigModal from './AiConfigModal.vue'
import ToggleRow from './ToggleRow.vue'

const props = defineProps<{ tab: 'provider' | 'proxy' | 'ai' | 'general' }>()
const emit = defineEmits<{ close: [] }>()

const { t, tBilingual } = useI18nStore()

const settings = useSettingsStore()
const toast = useToastStore()
const tasks = useTasksStore()
const logs = useLogsStore()

const profile = ref(settings.activeProfile)
const isAiModalOpen = ref(false)

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

function patchProfile(patch: Partial<NonNullable<typeof profile.value>>) {
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
  if (!p?.apiKey.trim()) { toast.show(t('toast.fillApiKey'), 'error'); return }
  toast.show(t('toast.testing'), 'info')
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
    toast.show(t('toast.connSuccess'), 'success')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/40[04]|not.?found|task_id/i.test(msg))
      toast.show(t('toast.connAuthed'), 'success')
    else if (/40[13]|unauthorized|forbidden|auth/i.test(msg))
      toast.show(t('toast.authFailed'), 'error')
    else { toast.show(t('toast.connFailed'), 'error'); log.error('test', '连接失败', msg) }
  }
}

async function testProxy() {
  const p = settings.proxy
  if (!p.enabled || !p.url) { toast.show(t('toast.enableProxyFirst'), 'error'); return }
  toast.show(t('toast.proxySaved'), 'success')
}

function patchLlm(patch: Partial<NonNullable<typeof settings.settings.llmConfig>>) {
  const cur = settings.settings.llmConfig ?? { baseUrl: '', apiKey: '', model: '' }
  settings.update({ llmConfig: { ...cur, ...patch } })
}

// verbose 开关需同时写设置与日志 store
function toggleVerbose(enabled: boolean) {
  settings.update({ verboseLogs: enabled })
  logs.setVerbose(enabled)
}
async function testLlm() {
  const cfg = settings.settings.llmConfig
  if (!cfg?.baseUrl || !cfg?.apiKey || !cfg?.model) { toast.show(t('toast.fillLlmConfig'), 'error'); return }
  toast.show(t('toast.llmTesting'), 'info')
  try {
    await httpFetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      timeoutSec: 30,
      proxy: settings.proxy.enabled ? settings.proxy : undefined,
      logCategory: 'ai',
    })
    toast.show(t('toast.llmConnected'), 'success')
  } catch (err) {
    toast.show(t('toast.llmFailed'), 'error')
    log.error('ai', 'LLM 测试失败', err instanceof Error ? err.message : String(err))
  }
}

function onAiApplied() {
  isAiModalOpen.value = false
  ensureProfileSync()
  toast.show(t('toast.aiApplied'), 'success')
}

function clearAllTasks() {
  if (!confirm(t('confirm.clearAllTasks'))) return
  tasks.tasks.slice().forEach((task) => void tasks.removeTask(task.id))
  toast.show(t('toast.tasksCleared'), 'success')
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
    toast.show(t('toast.exported'), 'success')
  } catch (err) {
    toast.show(t('toast.exportFailed', { msg: err instanceof Error ? err.message : String(err) }), 'error')
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
    toast.show(t('toast.imported', { n: res.count }), 'success')
  } catch (err) {
    toast.show(t('toast.importFailed', { msg: err instanceof Error ? err.message : String(err) }), 'error')
  }
  input.value = ''
}
</script>

<template>
  <div>
    <!-- 供应商 -->
    <div v-if="props.tab === 'provider'" class="space-y-6">
      <div class="flex flex-wrap items-center gap-3 bg-ak-dark border border-gray-800 p-3">
        <select
          :value="settings.activeProfile?.id"
          class="flex-1 min-w-[200px] bg-ak-darker border border-gray-800 text-white font-mono text-sm px-3 py-2 outline-none focus:border-ak-400 focus:shadow-[0_0_8px_rgba(0,229,255,0.3)] transition"
          @change="selectProfile(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in settings.settings.profiles" :key="p.id" :value="p.id" class="bg-ak-darker">{{ p.name }} [{{ p.kind === 'seedance' ? t('form.officialMode') : t('form.customTemplateMode') }}]</option>
        </select>
        <button class="bg-ak-dark border border-gray-800 text-gray-400 hover:border-ak-400 hover:text-ak-400 font-mono text-xs px-4 py-2 transition-colors shadow-sm" @click="addSeedance">+ {{ t('form.addOfficial') }}</button>
        <button class="bg-ak-dark border border-gray-800 text-gray-400 hover:border-ak-400 hover:text-ak-400 font-mono text-xs px-4 py-2 transition-colors shadow-sm" @click="addCustom">+ {{ t('form.addCustom') }}</button>
        <button class="bg-red-950/20 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-ak-darker font-mono text-xs px-4 py-2 transition-colors shadow-sm" @click="removeCurrent">{{ t('form.purge') }}</button>
      </div>

      <template v-if="profile">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <label class="block flex flex-col gap-2">
            <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.profileName') }} //</span>
            <input :value="profile.name" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="patchProfile({ name: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block flex flex-col gap-2">
            <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.baseEndpointUrl') }} //</span>
            <input :value="profile.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="patchProfile({ baseUrl: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block md:col-span-2 flex flex-col gap-2">
            <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.authToken') }} //</span>
            <input :value="profile.apiKey" type="password" placeholder="Bearer token" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="patchProfile({ apiKey: ($event.target as HTMLInputElement).value })" />
          </label>
          <label v-if="profile.kind === 'custom'" class="block md:col-span-2 flex flex-col gap-2">
            <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.modelOverride') }} //</span>
            <input :value="profile.model" placeholder="e.g. doubao-seedance-1-0-pro-250528" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="patchProfile({ model: ($event.target as HTMLInputElement).value })" />
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-4 pt-6 border-t border-gray-800 mt-6">
          <button class="relative bg-white text-ak-darker hover:bg-ak-400 hover:shadow-[0_0_20px_rgba(0,229,255,0.45)] font-sans italic font-bold text-sm tracking-widest pl-10 pr-8 py-3 transition flex items-center group" @click.prevent="testConnection">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-4 bg-ak-darker group-hover:h-2 transition-[height] duration-300"></span>
            {{ t('form.initiateTestSeq') }}
          </button>
          <button v-if="profile.kind === 'custom'" class="relative border border-ak-400/50 bg-ak-400/10 text-ak-400 font-mono text-sm pl-10 pr-6 py-2.5 hover:bg-ak-400 hover:text-ak-darker transition-colors flex items-center group" @click.prevent="isAiModalOpen = true">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 animate-pulse">✨</span>
            {{ t('form.aiParseDocs') }}
          </button>
          <span class="text-xs font-mono text-gray-500 ml-auto border border-gray-800 bg-ak-darker px-3 py-1">{{ profile.kind === 'seedance' ? `// ${t('form.officialMode')}` : `// ${t('form.customTemplateMode')}` }}</span>
        </div>

        <!-- 自定义模板 -->
        <div v-if="profile.kind === 'custom' && profile.custom" class="mt-8 space-y-8 border-l-2 border-ak-400/50 bg-ak-darker/30 p-6 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
          <div class="space-y-6">
            <div class="flex items-center gap-3 border-b border-ak-400/20 pb-2">
               <div class="w-2 h-2 bg-ak-400 shadow-[0_0_8px_rgba(0,229,255,0.4)]"></div>
               <div class="text-sm font-sans italic font-bold text-ak-400 tracking-widest">{{ t('form.submitCfg') }} //</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <label class="block md:col-span-2 flex flex-col gap-2">
                <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.submitUrl') }}</span>
                <input :value="profile.custom.submitUrl" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition-colors" @input="patchCustom({ submitUrl: ($event.target as HTMLInputElement).value })" />
              </label>
              <label class="block flex flex-col gap-2">
                <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.httpMethod') }}</span>
                <select :value="profile.custom.submitMethod" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 outline-none transition-colors" @change="patchCustom({ submitMethod: ($event.target as HTMLSelectElement).value as 'POST' })">
                  <option value="POST" class="bg-ak-darker">POST</option>
                </select>
              </label>
            </div>
            <div class="bg-ak-dark/50 p-4 border-l border-gray-800">
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-mono text-gray-500">{{ t('form.headersPayload') }} //</span>
                <button class="text-xs font-mono text-ak-400 hover:text-white flex items-center gap-1" @click="addSubmitHeader"><span class="text-lg leading-none">+</span> {{ t('form.addHeader') }}</button>
              </div>
              <div class="space-y-3">
                <div v-for="h in submitHeaders" :key="h.k" class="flex gap-4 items-end border-b border-dashed border-gray-800 pb-3">
                  <div class="w-1/3 flex flex-col">
                    <input :value="h.k" placeholder="Key" class="w-full bg-transparent text-white font-mono text-sm outline-none placeholder-gray-600 focus:text-ak-400 transition-colors" @input="h.k = ($event.target as HTMLInputElement).value; updateSubmitHeaderField()" />
                  </div>
                  <div class="flex-1 flex flex-col border-l border-gray-800 pl-4">
                    <input :value="h.v" placeholder="Value" class="w-full bg-transparent text-white font-mono text-sm outline-none placeholder-gray-600 focus:text-ak-400 transition-colors" @input="h.v = ($event.target as HTMLInputElement).value; updateSubmitHeaderField()" />
                  </div>
                  <button class="text-gray-500 hover:text-red-500 font-mono text-sm px-2 pb-0.5 transition-colors" :title="t('form.deleteHeader')" @click="delSubmitHeader(h.k)">[-]</button>
                </div>
              </div>
            </div>
            <label class="block flex flex-col gap-2">
              <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.bodyTemplate') }} //</span>
              <textarea :value="profile.custom.submitBody" rows="8" class="w-full bg-ak-dark/80 border border-gray-800 text-ak-400 font-mono text-xs p-4 focus:border-ak-400 outline-none transition-colors shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]" @input="patchCustom({ submitBody: ($event.target as HTMLTextAreaElement).value })" />
            </label>
          </div>

          <div class="space-y-6 pt-6 border-t border-gray-800">
            <div class="flex items-center gap-3 border-b border-ak-400/20 pb-2">
               <div class="w-2 h-2 bg-ak-400 shadow-[0_0_8px_rgba(0,229,255,0.4)]"></div>
               <div class="text-sm font-sans italic font-bold text-ak-400 tracking-widest">{{ t('form.pollCfg') }} //</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <label class="block md:col-span-2 flex flex-col gap-2">
                <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.pollUrl') }}</span>
                <input :value="profile.custom.pollUrl" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition-colors" @input="patchCustom({ pollUrl: ($event.target as HTMLInputElement).value })" />
              </label>
              <label class="block flex flex-col gap-2">
                <span class="text-xs font-mono text-ak-400 block tracking-wider">{{ t('form.httpMethod') }}</span>
                <select :value="profile.custom.pollMethod" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 outline-none transition-colors" @change="patchCustom({ pollMethod: ($event.target as HTMLSelectElement).value as 'GET' })">
                  <option value="GET" class="bg-ak-darker">GET</option>
                </select>
              </label>
            </div>
            <div class="bg-ak-dark/50 p-4 border-l border-gray-800">
              <div class="flex items-center justify-between mb-4">
                <span class="text-xs font-mono text-gray-500">{{ t('form.headersPayload') }} //</span>
                <button class="text-xs font-mono text-ak-400 hover:text-white flex items-center gap-1" @click="addPollHeader"><span class="text-lg leading-none">+</span> {{ t('form.addHeader') }}</button>
              </div>
              <div class="space-y-3">
                <div v-for="h in pollHeaders" :key="h.k" class="flex gap-4 items-end border-b border-dashed border-gray-800 pb-3">
                  <div class="w-1/3 flex flex-col">
                    <input :value="h.k" placeholder="Key" class="w-full bg-transparent text-white font-mono text-sm outline-none placeholder-gray-600 focus:text-ak-400 transition-colors" @input="h.k = ($event.target as HTMLInputElement).value; updatePollHeaderField()" />
                  </div>
                  <div class="flex-1 flex flex-col border-l border-gray-800 pl-4">
                    <input :value="h.v" placeholder="Value" class="w-full bg-transparent text-white font-mono text-sm outline-none placeholder-gray-600 focus:text-ak-400 transition-colors" @input="h.v = ($event.target as HTMLInputElement).value; updatePollHeaderField()" />
                  </div>
                  <button class="text-gray-500 hover:text-red-500 font-mono text-sm px-2 pb-0.5 transition-colors" :title="t('form.deleteHeader')" @click="delPollHeader(h.k)">[-]</button>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-6 pt-6 border-t border-gray-800">
             <div class="flex items-center gap-3 border-b border-ak-400/20 pb-2">
               <div class="w-2 h-2 bg-ak-400 shadow-[0_0_8px_rgba(0,229,255,0.4)]"></div>
               <div class="text-sm font-sans italic font-bold text-ak-400 tracking-widest">{{ t('form.responsePaths') }} //</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.taskIdPath') }}</span><input :value="profile.custom.taskIdPath" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ taskIdPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.statusPath') }}</span><input :value="profile.custom.statusPath" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ statusPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.successValues') }}</span><input :value="profile.custom.successValues.join(',')" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ successValues: ($event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean) })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.failureValues') }}</span><input :value="profile.custom.failureValues.join(',')" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ failureValues: ($event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean) })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.videoUrlPath') }}</span><input :value="profile.custom.videoUrlPath" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ videoUrlPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.lastFrameUrlPath') }}</span><input :value="profile.custom.lastFrameUrlPath ?? ''" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ lastFrameUrlPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.errorPath') }}</span><input :value="profile.custom.errorPath ?? ''" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ errorPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ tBilingual('form.progressPath') }}</span><input :value="profile.custom.progressPath ?? ''" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ progressPath: ($event.target as HTMLInputElement).value })" /></label>
              <label class="flex flex-col gap-2"><span class="text-[10px] font-mono text-gray-500 block tracking-wider">{{ t('form.pollIntervalSec') }}</span><input type="number" :value="profile.custom.pollIntervalSec" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-1.5 focus:border-ak-400 outline-none transition-colors" @input="patchCustom({ pollIntervalSec: Number(($event.target as HTMLInputElement).value) })" /></label>
            </div>

            <details class="bg-ak-darker/80 p-4 border-l border-gray-800 group mt-4">
              <summary class="cursor-pointer font-mono text-xs text-ak-400 font-bold flex items-center gap-2 select-none">
                <span class="text-lg leading-none group-open:rotate-90 transition-transform">></span> {{ t('form.viewVariables') }}
              </summary>
              <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono text-gray-400 pt-4 border-t border-gray-800">
                <div v-for="v in TEMPLATE_VARS" :key="v.name" class="flex flex-col gap-1">
                  <span class="text-ak-400 font-bold">{{ v.name }}</span>
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
      <ToggleRow
        :label="t('form.enableProxyRouting')"
        hint="SYS.NET.PROXY_OVERRIDE"
        label-class="text-lg"
        inactive-class="text-gray-500"
        :model-value="settings.proxy.enabled"
        @update:model-value="settings.setProxy({ enabled: $event })"
      />

      <div class="bg-ak-dark/30 p-4 border-l-2 border-gray-800">
        <p class="font-mono text-xs text-gray-400 leading-relaxed">
          <span class="text-ak-400 font-bold">// NOTICE:</span> {{ t('notice.cors') }}
        </p>
      </div>

      <div class="space-y-6 p-6 bg-ak-dark/50 border border-gray-800">
        <div class="flex flex-col gap-2">
          <span class="font-mono text-xs text-ak-400 tracking-wider">{{ t('form.proxyEndpointUrl') }} //</span>
          <input :value="settings.proxy.url" placeholder="https://your-proxy.workers.dev" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="settings.setProxy({ url: ($event.target as HTMLInputElement).value })" />
        </div>
        <div class="flex flex-col gap-2">
          <span class="font-mono text-xs text-ak-400 tracking-wider">{{ t('form.rewriteStrategy') }} //</span>
          <select :value="settings.proxy.mode" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 outline-none transition" @change="settings.setProxy({ mode: ($event.target as HTMLSelectElement).value as 'path' | 'query' })">
            <option value="query" class="bg-ak-darker">{{ t('form.proxyQuery') }}</option>
            <option value="path" class="bg-ak-darker">{{ t('form.proxyPath') }}</option>
          </select>
        </div>
      </div>

      <button class="relative bg-white text-ak-darker hover:bg-ak-400 hover:shadow-[0_0_20px_rgba(0,229,255,0.45)] font-sans italic font-bold text-sm tracking-widest pl-10 pr-8 py-3 transition flex items-center group mt-4" @click="testProxy">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-4 bg-ak-darker group-hover:h-2 transition-[height] duration-300"></span>
        {{ t('form.applyProxyCfg') }}
      </button>
    </div>

    <!-- AI 辅助 -->
    <div v-else-if="props.tab === 'ai'" class="space-y-6 max-w-2xl">
      <div class="bg-ak-dark/30 p-4 border-l-2 border-ak-400/50">
        <p class="font-mono text-xs text-gray-300 leading-relaxed flex items-start gap-2">
          <span class="text-ak-400 animate-pulse mt-0.5">✨</span>
          <span>{{ t('notice.aiAssist') }}</span>
        </p>
      </div>

      <div class="space-y-6 p-6 bg-ak-dark/50 border border-gray-800">
        <div class="flex flex-col gap-2">
          <span class="font-mono text-xs text-ak-400 tracking-wider">{{ t('form.llmBaseUrl') }} //</span>
          <input :value="settings.settings.llmConfig?.baseUrl ?? ''" placeholder="https://api.openai.com/v1" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="patchLlm({ baseUrl: ($event.target as HTMLInputElement).value })" />
        </div>
        <div class="flex flex-col gap-2">
          <span class="font-mono text-xs text-ak-400 tracking-wider">{{ t('form.authToken') }} //</span>
          <input :value="settings.settings.llmConfig?.apiKey ?? ''" type="password" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="patchLlm({ apiKey: ($event.target as HTMLInputElement).value })" />
        </div>
        <div class="flex flex-col gap-2">
          <span class="font-mono text-xs text-ak-400 tracking-wider">{{ t('form.modelIdVision') }} //</span>
          <input :value="settings.settings.llmConfig?.model ?? ''" placeholder="gpt-4o / glm-4v" class="w-full bg-ak-dark border-b border-gray-800 text-white font-mono text-sm py-2 focus:border-ak-400 focus:shadow-[0_4px_6px_-4px_rgba(0,229,255,0.2)] outline-none transition" @input="patchLlm({ model: ($event.target as HTMLInputElement).value })" />
        </div>
      </div>

      <button class="relative bg-white text-ak-darker hover:bg-ak-400 hover:shadow-[0_0_20px_rgba(0,229,255,0.45)] font-sans italic font-bold text-sm tracking-widest pl-10 pr-8 py-3 transition flex items-center group" @click.prevent="testLlm">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 w-1 h-4 bg-ak-darker group-hover:h-2 transition-[height] duration-300"></span>
        {{ t('form.testLlmLink') }}
      </button>

      <div class="pt-6 mt-6 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-ak-400/30 before:to-transparent">
        <ToggleRow
          :label="t('form.verboseLogging')"
          :hint="t('hint.verboseLog')"
          :model-value="settings.settings.verboseLogs"
          @update:model-value="toggleVerbose"
        />
      </div>
    </div>

    <!-- 通用 -->
    <div v-else class="space-y-6 max-w-2xl">

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ToggleRow
          :label="t('form.autoClearInput')"
          :hint="t('hint.clearComposer')"
          :model-value="settings.settings.clearComposerAfterSubmit"
          @update:model-value="settings.update({ clearComposerAfterSubmit: $event })"
        />

        <ToggleRow
          :label="t('form.desktopNotify')"
          :hint="t('hint.notify')"
          :model-value="settings.settings.notifyOnComplete"
          @update:model-value="settings.update({ notifyOnComplete: $event })"
        />
      </div>

      <div class="space-y-6 p-6 bg-ak-dark/50 border border-gray-800">
        <div class="flex flex-col gap-2">
          <span class="font-mono text-xs text-ak-400 tracking-wider">{{ t('form.officialPollInterval') }} //</span>
          <div class="flex items-center gap-2">
            <div class="flex items-center bg-ak-dark border-b border-gray-800 focus-within:border-ak-400 transition-colors">
              <button class="text-gray-500 hover:text-ak-400 transition-colors px-2 py-2 flex items-center" @click="settings.update({ pollIntervalSec: Math.max(1, (settings.settings.pollIntervalSec || 1) - 1) })" title="DECREMENT" aria-label="decrement">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" /></svg>
              </button>
              <input type="number" :value="settings.settings.pollIntervalSec" class="no-spin w-20 bg-transparent text-white font-mono text-sm py-2 focus:outline-none text-center" @input="settings.update({ pollIntervalSec: Number(($event.target as HTMLInputElement).value) })" />
              <button class="text-gray-500 hover:text-ak-400 transition-colors px-2 py-2 flex items-center" @click="settings.update({ pollIntervalSec: (settings.settings.pollIntervalSec || 0) + 1 })" title="INCREMENT" aria-label="increment">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7" /></svg>
              </button>
            </div>
            <span class="font-mono text-xs text-gray-500">{{ t('form.secondsDelay') }}</span>
          </div>
        </div>
      </div>

      <div class="pt-6 mt-6 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-ak-400/30 before:to-transparent">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-1 h-6 bg-ak-400 shadow-[0_0_8px_rgba(0,229,255,0.4)]"></div>
          <div class="font-sans italic font-bold text-lg text-ak-400 tracking-widest uppercase">{{ t('form.dataManagement') }} //</div>
        </div>

        <p class="font-mono text-xs text-gray-500 mb-6 border-l-2 border-ak-400/50 pl-3">
          {{ t('notice.exportData') }}
        </p>

        <div class="flex flex-wrap gap-4">
          <button class="flex-1 min-w-[140px] bg-ak-dark border border-gray-800 text-gray-300 hover:border-ak-400 hover:text-ak-400 hover:bg-ak-darker font-mono text-sm px-4 py-3 transition-colors duration-300 flex flex-col items-center gap-1 group" @click="exportData">
            <span class="text-lg group-hover:-translate-y-1 transition-transform">↓</span>
            {{ t('form.exportDb') }}
          </button>
          <button class="flex-1 min-w-[140px] bg-ak-dark border border-gray-800 text-gray-300 hover:border-ak-400 hover:text-ak-400 hover:bg-ak-darker font-mono text-sm px-4 py-3 transition-colors duration-300 flex flex-col items-center gap-1 group" @click="importData">
            <span class="text-lg group-hover:-translate-y-1 transition-transform">↑</span>
            {{ t('form.importDb') }}
          </button>
          <button class="w-full md:w-auto bg-red-950/20 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm px-6 py-3 transition-colors duration-300 flex flex-col items-center gap-1 group" @click="clearAllTasks">
            <span class="text-lg group-hover:scale-110 transition-transform">⚠</span>
            {{ t('form.purgeAllTasks') }}
          </button>
        </div>
        <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="onImportFile" />
      </div>
    </div>

    <AiConfigModal :show="isAiModalOpen" @close="isAiModalOpen = false" @applied="onAiApplied" />
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from '@/components/common/Modal.vue'
import { useSettingsStore } from '@/stores/settings'
import { useToastStore } from '@/stores/toast'
import { useTasksStore } from '@/stores/tasks'
import { useLogsStore } from '@/stores/logs'
import { httpFetch, buildApiUrl } from '@/net/httpClient'
import { TEMPLATE_VARS } from '@/lib/template'
import { log } from '@/lib/logger'
import AiConfigModal from './AiConfigModal.vue'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const settings = useSettingsStore()
const toast = useToastStore()
const tasks = useTasksStore()
const logs = useLogsStore()
const tab = ref<'provider' | 'proxy' | 'ai' | 'general'>('provider')

const profile = ref(settings.activeProfile)
const showAiModal = ref(false)

// headers 编辑：转数组便于增删
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

// —— AI 辅助 tab ——
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

// AI 解析结果应用
function onAiApplied() {
  showAiModal.value = false
  ensureProfileSync()
  toast.show('已应用 AI 解析结果，请检查后保存', 'success')
}

// —— 通用 ——
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
  <Modal :show="props.show" title="设置" width="780px" @close="emit('close')">
    <div class="flex gap-4">
      <div class="flex w-28 flex-col gap-1 border-r border-gray-100 pr-3 text-sm">
        <button
          v-for="t in [{k:'provider',l:'供应商'},{k:'proxy',l:'代理'},{k:'ai',l:'AI 辅助'},{k:'general',l:'通用'}]"
          :key="t.k"
          class="rounded-lg px-3 py-2 text-left"
          :class="tab === t.k ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'"
          @click="tab = t.k as typeof tab"
        >{{ t.l }}</button>
      </div>

      <div class="flex-1">
        <!-- 供应商 -->
        <div v-if="tab === 'provider'" class="space-y-3">
          <div class="flex items-center gap-2">
            <select
              :value="settings.activeProfile?.id"
              class="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              @change="selectProfile(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="p in settings.settings.profiles" :key="p.id" :value="p.id">{{ p.name }}（{{ p.kind === 'seedance' ? '官方' : '自定义' }}）</option>
            </select>
            <button class="rounded-lg border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50" @click="addSeedance">+ 官方</button>
            <button class="rounded-lg border border-gray-300 px-2 py-1.5 text-xs hover:bg-gray-50" @click="addCustom">+ 自定义</button>
            <button class="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50" @click="removeCurrent">删除</button>
          </div>

          <template v-if="profile">
            <label class="block">
              <span class="text-xs text-gray-500">名称</span>
              <input :value="profile.name" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="patch({ name: ($event.target as HTMLInputElement).value })" />
            </label>
            <label class="block">
              <span class="text-xs text-gray-500">Base URL</span>
              <input :value="profile.baseUrl" placeholder="https://ark.cn-beijing.volces.com/api/v3" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="patch({ baseUrl: ($event.target as HTMLInputElement).value })" />
            </label>
            <label class="block">
              <span class="text-xs text-gray-500">API Key</span>
              <input :value="profile.apiKey" type="password" placeholder="Bearer token" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="patch({ apiKey: ($event.target as HTMLInputElement).value })" />
            </label>
            <label v-if="profile.kind === 'custom'" class="block">
              <span class="text-xs text-gray-500">模型名称（提交时作为 <code v-pre>{{model}}</code> 注入）</span>
              <input :value="profile.model" placeholder="如 doubao-seedance-1-0-pro-250528" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="patch({ model: ($event.target as HTMLInputElement).value })" />
            </label>
            <div class="flex items-center gap-2">
              <button class="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600" @click="testConnection">测试连接</button>
              <button v-if="profile.kind === 'custom'" class="rounded-lg border border-blue-300 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50" @click="showAiModal = true">✨ AI 解析文档</button>
              <span class="text-xs text-gray-400">{{ profile.kind === 'seedance' ? '官方接口，固定 content-array 格式' : '模板化自定义接口' }}</span>
            </div>

            <!-- 自定义模板 -->
            <div v-if="profile.kind === 'custom' && profile.custom" class="space-y-3 rounded-lg border border-gray-200 p-3">
              <div class="text-xs font-medium text-gray-600">提交配置</div>
              <label class="block">
                <span class="text-xs text-gray-500">提交 URL（可含 <code v-pre>{{baseUrl}}</code>）</span>
                <input :value="profile.custom.submitUrl" class="mt-1 w-full rounded border border-gray-300 px-1.5 py-1 text-xs" @input="patchCustom({ submitUrl: ($event.target as HTMLInputElement).value })" />
              </label>
              <label class="block">
                <span class="text-xs text-gray-500">提交方法</span>
                <select :value="profile.custom.submitMethod" class="mt-1 w-32 rounded border border-gray-300 px-1.5 py-1 text-xs" @change="patchCustom({ submitMethod: ($event.target as HTMLSelectElement).value as 'POST' })">
                  <option value="POST">POST</option>
                </select>
              </label>
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-500">提交 Headers</span>
                  <button class="text-xs text-blue-600" @click="addSubmitHeader">+ 添加</button>
                </div>
                <div v-for="h in submitHeaders" :key="h.k" class="mt-1 flex gap-1">
                  <input :value="h.k" placeholder="Header 名" class="w-1/3 rounded border border-gray-300 px-1.5 py-1 text-xs" @input="h.k = ($event.target as HTMLInputElement).value; updateSubmitHeaderField()" />
                  <input :value="h.v" placeholder="值，可含 {{apiKey}}" class="flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs" @input="h.v = ($event.target as HTMLInputElement).value; updateSubmitHeaderField()" />
                  <button class="text-xs text-red-500" @click="delSubmitHeader(h.k)">✕</button>
                </div>
              </div>
              <label class="block">
                <span class="text-xs text-gray-500">提交 Body 模板（JSON，含 <code v-pre>{{prompt}}</code> 等占位）</span>
                <textarea :value="profile.custom.submitBody" rows="6" class="mt-1 w-full rounded border border-gray-300 px-1.5 py-1 font-mono text-xs" @input="patchCustom({ submitBody: ($event.target as HTMLTextAreaElement).value })" />
              </label>

              <div class="border-t border-gray-100 pt-2 text-xs font-medium text-gray-600">轮询配置</div>
              <label class="block">
                <span class="text-xs text-gray-500">轮询 URL（含 <code v-pre>{{taskId}}</code>）</span>
                <input :value="profile.custom.pollUrl" class="mt-1 w-full rounded border border-gray-300 px-1.5 py-1 text-xs" @input="patchCustom({ pollUrl: ($event.target as HTMLInputElement).value })" />
              </label>
              <label class="block">
                <span class="text-xs text-gray-500">轮询方法</span>
                <select :value="profile.custom.pollMethod" class="mt-1 w-32 rounded border border-gray-300 px-1.5 py-1 text-xs" @change="patchCustom({ pollMethod: ($event.target as HTMLSelectElement).value as 'GET' })">
                  <option value="GET">GET</option>
                </select>
              </label>
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-500">轮询 Headers</span>
                  <button class="text-xs text-blue-600" @click="addPollHeader">+ 添加</button>
                </div>
                <div v-for="h in pollHeaders" :key="h.k" class="mt-1 flex gap-1">
                  <input :value="h.k" placeholder="Header 名" class="w-1/3 rounded border border-gray-300 px-1.5 py-1 text-xs" @input="h.k = ($event.target as HTMLInputElement).value; updatePollHeaderField()" />
                  <input :value="h.v" placeholder="值，可含 {{apiKey}}" class="flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs" @input="h.v = ($event.target as HTMLInputElement).value; updatePollHeaderField()" />
                  <button class="text-xs text-red-500" @click="delPollHeader(h.k)">✕</button>
                </div>
              </div>

              <div class="border-t border-gray-100 pt-2 text-xs font-medium text-gray-600">响应提取（字段路径，如 data.output）</div>
              <div class="grid grid-cols-2 gap-2">
                <label class="text-xs">task id 路径<input :value="profile.custom.taskIdPath" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ taskIdPath: ($event.target as HTMLInputElement).value })" /></label>
                <label class="text-xs">状态路径<input :value="profile.custom.statusPath" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ statusPath: ($event.target as HTMLInputElement).value })" /></label>
                <label class="text-xs">成功值（逗号分隔）<input :value="profile.custom.successValues.join(',')" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ successValues: ($event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean) })" /></label>
                <label class="text-xs">失败值（逗号分隔）<input :value="profile.custom.failureValues.join(',')" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ failureValues: ($event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean) })" /></label>
                <label class="text-xs">视频 URL 路径<input :value="profile.custom.videoUrlPath" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ videoUrlPath: ($event.target as HTMLInputElement).value })" /></label>
                <label class="text-xs">末帧 URL 路径<input :value="profile.custom.lastFrameUrlPath ?? ''" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ lastFrameUrlPath: ($event.target as HTMLInputElement).value })" /></label>
                <label class="text-xs">错误路径<input :value="profile.custom.errorPath ?? ''" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ errorPath: ($event.target as HTMLInputElement).value })" /></label>
                <label class="text-xs">进度路径<input :value="profile.custom.progressPath ?? ''" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ progressPath: ($event.target as HTMLInputElement).value })" /></label>
                <label class="text-xs">轮询间隔(秒)<input type="number" :value="profile.custom.pollIntervalSec" class="mt-0.5 w-full rounded border border-gray-300 px-1.5 py-1" @input="patchCustom({ pollIntervalSec: Number(($event.target as HTMLInputElement).value) })" /></label>
              </div>

              <details class="rounded bg-gray-50 p-2">
                <summary class="cursor-pointer text-xs text-gray-500">可用变量速查</summary>
                <div class="mt-2 grid grid-cols-2 gap-1 text-xs text-gray-600">
                  <div v-for="v in TEMPLATE_VARS" :key="v.name"><code>{{ v.name }}</code> {{ v.desc }}</div>
                </div>
              </details>
            </div>
          </template>
        </div>

        <!-- 代理 -->
        <div v-else-if="tab === 'proxy'" class="space-y-3">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" :checked="settings.proxy.enabled" @change="settings.setProxy({ enabled: ($event.target as HTMLInputElement).checked })" />
            启用代理（绕过 CORS）
          </label>
          <p class="text-xs text-gray-400">官方接口浏览器直连通常会被 CORS 拦截，需自备代理转发。代理脚本示例见 docs/proxy.md。</p>
          <label class="block">
            <span class="text-xs text-gray-500">代理地址</span>
            <input :value="settings.proxy.url" placeholder="https://your-proxy.workers.dev" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="settings.setProxy({ url: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">改写模式</span>
            <select :value="settings.proxy.mode" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @change="settings.setProxy({ mode: ($event.target as HTMLSelectElement).value as 'path' | 'query' })">
              <option value="query">query（?target=URL）</option>
              <option value="path">path（/URL）</option>
            </select>
          </label>
          <button class="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600" @click="testProxy">保存代理配置</button>
        </div>

        <!-- AI 辅助 -->
        <div v-else-if="tab === 'ai'" class="space-y-3">
          <p class="text-xs text-gray-400">配置你自己的大模型 API（OpenAI 兼容），用于在自定义源「✨ AI 解析文档」时读取站点文档自动生成请求模板。文档内容会发送给所配 LLM。</p>
          <label class="block">
            <span class="text-xs text-gray-500">LLM Base URL</span>
            <input :value="settings.settings.llmConfig?.baseUrl ?? ''" placeholder="https://api.openai.com/v1" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="patchLlm({ baseUrl: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">API Key</span>
            <input :value="settings.settings.llmConfig?.apiKey ?? ''" type="password" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="patchLlm({ apiKey: ($event.target as HTMLInputElement).value })" />
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">模型名（需支持 vision 才能读截图）</span>
            <input :value="settings.settings.llmConfig?.model ?? ''" placeholder="gpt-4o / glm-4v 等" class="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" @input="patchLlm({ model: ($event.target as HTMLInputElement).value })" />
          </label>
          <button class="rounded-lg bg-blue-500 px-3 py-1.5 text-xs text-white hover:bg-blue-600" @click="testLlm">测试 LLM 连接</button>
          <label class="flex items-center justify-between pt-2 text-sm">
            <span>详细日志</span>
            <input type="checkbox" :checked="settings.settings.verboseLogs" @change="settings.update({ verboseLogs: ($event.target as HTMLInputElement).checked }); logs.setVerbose(($event.target as HTMLInputElement).checked)" />
          </label>
          <p class="text-xs text-gray-400">关闭后仅记录 warn/error。</p>
        </div>

        <!-- 通用 -->
        <div v-else class="space-y-3">
          <label class="flex items-center justify-between text-sm">
            <span>提交后清空输入区</span>
            <input type="checkbox" :checked="settings.settings.clearComposerAfterSubmit" @change="settings.update({ clearComposerAfterSubmit: ($event.target as HTMLInputElement).checked })" />
          </label>
          <label class="flex items-center justify-between text-sm">
            <span>生成完成桌面通知</span>
            <input type="checkbox" :checked="settings.settings.notifyOnComplete" @change="settings.update({ notifyOnComplete: ($event.target as HTMLInputElement).checked })" />
          </label>
          <label class="block text-sm">
            <span class="text-xs text-gray-500">官方轮询间隔（秒）</span>
            <input type="number" :value="settings.settings.pollIntervalSec" class="mt-1 w-32 rounded-lg border border-gray-300 px-2 py-1.5" @input="settings.update({ pollIntervalSec: Number(($event.target as HTMLInputElement).value) })" />
          </label>
          <hr class="border-gray-100" />
          <div class="flex flex-wrap gap-2">
            <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50" @click="exportData">导出数据</button>
            <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50" @click="importData">导入数据</button>
            <button class="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" @click="clearAllTasks">清空所有任务历史</button>
          </div>
          <p class="text-xs text-gray-400">导出包含任务、素材、视频与封面，可作为备份或迁移到其他设备。</p>
          <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="onImportFile" />
        </div>
      </div>
    </div>

    <AiConfigModal :show="showAiModal" @close="showAiModal = false" @applied="onAiApplied" />
  </Modal>
</template>

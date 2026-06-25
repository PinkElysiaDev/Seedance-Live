<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from './Modal.vue'
import { useLogsStore, type LogCategory, type LogLevel } from '@/stores/logs'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: [] }>()

const logs = useLogsStore()
const expanded = ref<Set<number>>(new Set())
const levelFilter = ref<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']))
const catFilter = ref<'all' | LogCategory>('all')
const keyword = ref('')

const CATEGORIES: Array<{ v: 'all' | LogCategory; l: string }> = [
  { v: 'all', l: '全部' },
  { v: 'submit', l: '提交' },
  { v: 'poll', l: '轮询' },
  { v: 'http', l: 'HTTP' },
  { v: 'task', l: '任务' },
  { v: 'test', l: '测试' },
  { v: 'ai', l: 'AI' },
  { v: 'settings', l: '设置' },
]

const filtered = computed(() => {
  return logs.entries.filter((e) => {
    if (!levelFilter.value.has(e.level)) return false
    if (catFilter.value !== 'all' && e.category !== catFilter.value) return false
    if (keyword.value.trim()) {
      const kw = keyword.value.trim().toLowerCase()
      if (!e.message.toLowerCase().includes(kw) && !JSON.stringify(e.data ?? '').toLowerCase().includes(kw)) return false
    }
    return true
  })
})

function toggleLevel(l: LogLevel) {
  if (levelFilter.value.has(l)) levelFilter.value.delete(l)
  else levelFilter.value.add(l)
  levelFilter.value = new Set(levelFilter.value)
}
function toggleExpand(id: number) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
}
function copyAll() {
  const text = logs.entries
    .map((e) => `[${new Date(e.ts).toLocaleTimeString()}] [${e.level}] [${e.category}] ${e.message}${e.data != null ? '\n' + JSON.stringify(e.data, null, 2) : ''}`)
    .join('\n\n')
  navigator.clipboard.writeText(text)
}
function exportJson() {
  const blob = new Blob([JSON.stringify(logs.entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `seedance-logs-${Date.now()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const levelColor: Record<LogLevel, string> = {
  debug: 'text-gray-400',
  info: 'text-gray-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
}
</script>

<template>
  <Modal :show="props.show" title="调试日志" width="820px" @close="emit('close')">
    <div class="space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="keyword" placeholder="搜索…" class="flex-1 rounded border border-gray-300 px-2 py-1 text-xs" />
        <select v-model="catFilter" class="rounded border border-gray-300 px-2 py-1 text-xs">
          <option v-for="c in CATEGORIES" :key="c.v" :value="c.v">{{ c.l }}</option>
        </select>
        <div class="flex gap-1 text-xs">
          <button v-for="l in (['debug','info','warn','error'] as LogLevel[])" :key="l"
            class="rounded px-2 py-1"
            :class="levelFilter.has(l) ? 'bg-gray-700 text-white' : 'border border-gray-300 text-gray-400'"
            @click="toggleLevel(l)">{{ l }}</button>
        </div>
        <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="logs.clear">清空</button>
        <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="copyAll">复制</button>
        <button class="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50" @click="exportJson">导出</button>
      </div>

      <div class="max-h-[60vh] space-y-1 overflow-auto rounded border border-gray-100 bg-gray-50 p-2">
        <div v-if="!filtered.length" class="py-8 text-center text-xs text-gray-400">暂无日志</div>
        <div v-for="e in filtered" :key="e.id" class="rounded bg-white px-2 py-1 text-xs">
          <div class="flex cursor-pointer items-center gap-2" @click="toggleExpand(e.id)">
            <span class="text-gray-300">{{ new Date(e.ts).toLocaleTimeString() }}</span>
            <span class="rounded bg-gray-100 px-1 text-[10px] text-gray-500">{{ e.category }}</span>
            <span :class="levelColor[e.level]" class="font-medium">{{ e.level }}</span>
            <span class="flex-1 truncate text-gray-700">{{ e.message }}</span>
            <span v-if="e.data != null" class="text-gray-300">▾</span>
          </div>
          <pre v-if="expanded.has(e.id) && e.data != null" class="mt-1 max-h-60 overflow-auto rounded bg-gray-900 p-2 text-[11px] text-green-300">{{ JSON.stringify(e.data, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </Modal>
</template>

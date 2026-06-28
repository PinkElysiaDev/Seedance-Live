<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from './Modal.vue'
import { useLogsStore, type LogCategory, type LogLevel } from '@/stores/logs'

const props = defineProps<{ show: boolean, isView?: boolean }>()
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
  debug: 'text-gray-500',
  info: 'text-elysia-300',
  warn: 'text-yellow-500',
  error: 'text-red-500',
}
</script>

<template>
  <template v-if="props.isView">
    <div class="h-full flex flex-col space-y-4">
      <div class="flex flex-wrap items-center gap-3 p-3 bg-tactical-800/80 clip-chamfer border border-tactical-700">
        <input v-model="keyword" placeholder="SEARCH_LOGS..." class="flex-1 min-w-[200px] bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors" />
        <select v-model="catFilter" class="bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-sm px-3 py-2 clip-chamfer focus:border-elysia-400 outline-none transition-colors">
          <option v-for="c in CATEGORIES" :key="c.v" :value="c.v">{{ c.l.toUpperCase() }}</option>
        </select>
        <div class="flex gap-1.5 text-xs font-mono bg-tactical-900 p-1 clip-chamfer border border-tactical-700">
          <button v-for="l in (['debug','info','warn','error'] as LogLevel[])" :key="l"
            class="px-4 py-1.5 clip-chamfer transition-all duration-300"
            :class="levelFilter.has(l) ? 'bg-elysia-400 text-tactical-900 font-bold shadow-[0_0_10px_rgba(255,135,178,0.5)]' : 'text-gray-500 hover:text-elysia-300 hover:bg-tactical-800'"
            @click="toggleLevel(l)">{{ l.toUpperCase() }}</button>
        </div>
        <div class="flex gap-2">
          <button class="bg-tactical-900 border border-tactical-600 text-gray-400 hover:text-elysia-300 hover:border-elysia-400/50 px-4 py-2 text-xs font-mono clip-chamfer transition-colors shadow-sm" @click="logs.clear">> CLEAR</button>
          <button class="bg-tactical-900 border border-tactical-600 text-gray-400 hover:text-elysia-300 hover:border-elysia-400/50 px-4 py-2 text-xs font-mono clip-chamfer transition-colors shadow-sm" @click="copyAll">> COPY</button>
          <button class="bg-tactical-900 border border-tactical-600 text-gray-400 hover:text-elysia-300 hover:border-elysia-400/50 px-4 py-2 text-xs font-mono clip-chamfer transition-colors shadow-sm" @click="exportJson">> EXPORT</button>
        </div>
      </div>

      <div class="flex-1 overflow-auto bg-tactical-900 border border-elysia-400/30 p-4 clip-chamfer-lg relative group shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
        <div class="absolute inset-0 bg-sakura-pattern opacity-5 pointer-events-none"></div>
        <div v-if="!filtered.length" class="h-full flex flex-col items-center justify-center text-sm font-mono text-gray-600">
           <div class="w-12 h-12 border-2 border-dashed border-tactical-600 rounded-full flex items-center justify-center mb-4 animate-[spin_3s_linear_infinite]">
             <div class="w-2 h-2 bg-tactical-500 rounded-full"></div>
           </div>
           <span class="mb-2 text-elysia-500/80 font-bold tracking-widest">>> NO_LOG_ENTRIES_FOUND <<</span>
           <span class="text-xs">SYSTEM_IDLE // AWAITING_COMMAND</span>
        </div>
        <div v-for="e in filtered" :key="e.id" class="mb-2 bg-tactical-800/60 border-l-2 border-t border-b border-r border-tactical-700 border-l-transparent p-2 text-sm font-mono clip-chamfer hover:border-l-elysia-400 hover:bg-tactical-800 transition-all duration-200 relative z-10 group/item">
          <div class="flex cursor-pointer items-start gap-3" @click="toggleExpand(e.id)">
            <span class="text-gray-500 text-xs min-w-[70px] pt-0.5">{{ new Date(e.ts).toLocaleTimeString() }}</span>
            <span class="bg-tactical-900 border border-tactical-600 px-1.5 py-0.5 text-[10px] text-gray-400 uppercase tracking-wider min-w-[60px] text-center">{{ e.category }}</span>
            <span :class="levelColor[e.level]" class="font-bold text-xs uppercase min-w-[50px] pt-0.5">{{ e.level }}</span>
            <span class="flex-1 text-elysia-50/90 leading-relaxed group-hover/item:text-white transition-colors" :class="{'truncate': !expanded.has(e.id)}">{{ e.message }}</span>
            <span v-if="e.data != null" class="text-elysia-400 text-xs pt-0.5 whitespace-nowrap opacity-50 group-hover/item:opacity-100 transition-opacity">
              {{ expanded.has(e.id) ? '[-] COLLAPSE' : '[+] EXPAND' }}
            </span>
          </div>
          <pre v-if="expanded.has(e.id) && e.data != null" class="mt-3 ml-[150px] max-h-96 overflow-auto bg-tactical-900 border border-tactical-700 p-3 text-xs text-elysia-300 clip-chamfer break-all whitespace-pre-wrap shadow-inner">{{ JSON.stringify(e.data, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </template>
  <Modal v-else :show="props.show" title="SYS_LOGS //" width="820px" @close="emit('close')">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="keyword" placeholder="SEARCH_LOGS..." class="flex-1 bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1 clip-chamfer focus:border-elysia-400 outline-none" />
        <select v-model="catFilter" class="bg-tactical-900 border border-tactical-600 text-elysia-50 font-mono text-xs px-2 py-1 clip-chamfer focus:border-elysia-400 outline-none">
          <option v-for="c in CATEGORIES" :key="c.v" :value="c.v">{{ c.l.toUpperCase() }}</option>
        </select>
        <div class="flex gap-1 text-[10px] font-mono">
          <button v-for="l in (['debug','info','warn','error'] as LogLevel[])" :key="l"
            class="px-3 py-1 clip-chamfer transition-colors"
            :class="levelFilter.has(l) ? 'bg-elysia-400 text-tactical-900 font-bold shadow-[0_0_8px_rgba(255,135,178,0.4)]' : 'bg-tactical-800 border border-tactical-600 text-gray-500 hover:text-elysia-300 hover:border-elysia-400/50'"
            @click="toggleLevel(l)">{{ l.toUpperCase() }}</button>
        </div>
        <button class="bg-tactical-800 border border-tactical-600 text-gray-400 hover:text-elysia-300 hover:border-elysia-400/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="logs.clear">CLEAR</button>
        <button class="bg-tactical-800 border border-tactical-600 text-gray-400 hover:text-elysia-300 hover:border-elysia-400/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="copyAll">COPY</button>
        <button class="bg-tactical-800 border border-tactical-600 text-gray-400 hover:text-elysia-300 hover:border-elysia-400/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="exportJson">EXPORT</button>
      </div>

      <div class="max-h-[60vh] space-y-1 overflow-auto bg-tactical-900/50 border border-elysia-400/20 p-2 clip-chamfer relative group">
        <div class="absolute inset-0 bg-sakura-pattern opacity-10 pointer-events-none"></div>
        <div v-if="!filtered.length" class="py-8 flex flex-col items-center justify-center text-[10px] font-mono text-gray-600">
           <span class="mb-1 text-elysia-500 font-bold">>> NO_LOG_ENTRIES <<</span>
           <span>SYSTEM IDLE</span>
        </div>
        <div v-for="e in filtered" :key="e.id" class="bg-tactical-800/80 border border-tactical-700 p-1.5 text-xs font-mono clip-chamfer hover:border-elysia-400/40 transition-colors relative z-10">
          <div class="flex cursor-pointer items-center gap-2" @click="toggleExpand(e.id)">
            <span class="text-gray-500 text-[10px]">{{ new Date(e.ts).toLocaleTimeString() }}</span>
            <span class="bg-tactical-900 border border-tactical-600 px-1 text-[10px] text-gray-400 uppercase">{{ e.category }}</span>
            <span :class="levelColor[e.level]" class="font-bold text-[10px] uppercase">{{ e.level }}</span>
            <span class="flex-1 truncate text-elysia-50">{{ e.message }}</span>
            <span v-if="e.data != null" class="text-elysia-400 text-[10px]">> VIEW</span>
          </div>
          <pre v-if="expanded.has(e.id) && e.data != null" class="mt-2 max-h-60 overflow-auto bg-tactical-900 border border-tactical-700 p-2 text-[10px] text-elysia-300 clip-chamfer break-all whitespace-pre-wrap">{{ JSON.stringify(e.data, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </Modal>
</template>

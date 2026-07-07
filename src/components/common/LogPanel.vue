<script setup lang="ts">
import { ref, computed } from 'vue'
import Modal from './Modal.vue'
import VirtualLogList from './VirtualLogList.vue'
import { useLogsStore, type LogCategory, type LogLevel } from '@/stores/logs'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{ show: boolean, isView?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const logs = useLogsStore()
const { t } = useI18nStore()
const expanded = ref<Set<number>>(new Set())
const levelFilter = ref<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']))
const catFilter = ref<'all' | LogCategory>('all')
const keyword = ref('')

const CATEGORIES = computed<Array<{ value: 'all' | LogCategory; label: string }>>(() => [
  { value: 'all', label: t('log.catAll') },
  { value: 'submit', label: t('log.catSubmit') },
  { value: 'poll', label: t('log.catPoll') },
  { value: 'http', label: 'HTTP' },
  { value: 'task', label: t('log.catTask') },
  { value: 'test', label: t('log.catTest') },
  { value: 'ai', label: t('log.catAi') },
  { value: 'settings', label: t('log.catSettings') },
])

const filtered = computed(() => {
  return logs.entries.filter((e) => {
    if (!levelFilter.value.has(e.level)) return false
    if (catFilter.value !== 'all' && e.category !== catFilter.value) return false
    if (keyword.value.trim()) {
      const kw = keyword.value.trim().toLowerCase()
      if (!e.message.toLowerCase().includes(kw) && !(e.dataText ?? '').toLowerCase().includes(kw)) return false
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
  info: 'text-ak-400',
  warn: 'text-yellow-500',
  error: 'text-red-500',
}

// 各级别计数
const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']
const levelCount = computed(() => {
  const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 }
  for (const e of logs.entries) counts[e.level]++
  return counts
})
const allCount = computed(() => logs.entries.length)

// 全选
function selectAllLevels() {
  levelFilter.value = new Set(['debug', 'info', 'warn', 'error'])
}
// chip active：级别在 levelFilter 中
function isLevelActive(l: LogLevel) {
  return levelFilter.value.has(l)
}

// VERBOSE 同步到 settings（与设置页一致）
import { useSettingsStore } from '@/stores/settings'
const settings = useSettingsStore()
function toggleVerbose() {
  const enabled = !logs.isVerbose
  logs.setVerbose(enabled)
  settings.update({ verboseLogs: enabled })
}
</script>

<template>
  <template v-if="props.isView">
    <div class="h-full flex flex-col gap-4">
      <!-- 筛选芯片行：ALL / DEBUG / INFO / WARN / ERROR（带计数，可点击筛选） -->
      <!-- 筛选芯片 + VERBOSE 开关同一行 -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          class="group flex items-center gap-2 px-3 py-2 border font-mono text-xs transition-colors duration-300 hover:border-ak-400/40"
          :class="levelFilter.size === 4 ? 'border-gray-700 bg-ak-dark/80 text-ak-400' : 'border-gray-800 bg-ak-dark/40 text-gray-600 hover:text-gray-300'"
          @click="selectAllLevels"
        >
          <span class="w-1.5 h-1.5 rounded-full transition"
            :class="levelFilter.size === 4 ? 'bg-ak-400 shadow-[0_0_10px_rgba(0,229,255,0.9)] animate-[lamp-breathe_2s_ease-in-out_infinite]' : 'bg-gray-600'"></span>
          <span class="tracking-widest uppercase font-bold">ALL</span>
          <span class="text-[10px] opacity-70">{{ allCount }}</span>
        </button>
        <button
          v-for="l in LEVELS"
          :key="l"
          class="group flex items-center gap-2 px-3 py-2 border font-mono text-xs transition-colors duration-300 hover:border-ak-400/40"
          :class="isLevelActive(l) ? 'border-gray-700 bg-ak-dark/80' : 'border-gray-800 bg-ak-dark/40 hover:bg-ak-gray/30'"
          @click="l === 'error' && levelFilter.size === 1 && levelFilter.has('error') ? selectAllLevels() : toggleLevel(l)"
        >
          <span class="w-1.5 h-1.5 rounded-full transition"
            :class="[
              isLevelActive(l)
                ? (l === 'debug' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]' : l === 'info' ? 'bg-ak-400 shadow-[0_0_10px_rgba(0,229,255,0.9)]' : l === 'warn' ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.9)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]') + ' animate-[lamp-breathe_2s_ease-in-out_infinite]'
                : 'bg-gray-600'
            ]"></span>
          <span class="tracking-widest uppercase font-bold" :class="isLevelActive(l) ? levelColor[l] : 'text-gray-600'">{{ l.toUpperCase() }}</span>
          <span class="text-[10px] opacity-70" :class="isLevelActive(l) ? levelColor[l] : 'text-gray-700'">{{ levelCount[l] }}</span>
        </button>

        <!-- verbose_log 开关（固定宽度，紧跟 ERROR 芯片，设计语言不变） -->
        <div
          class="flex items-center justify-between w-[190px] flex-shrink-0 px-3 py-2 border bg-ak-dark/50 hover:border-ak-400/40 transition-colors duration-300 cursor-pointer relative"
          :class="logs.isVerbose ? 'border-gray-700' : 'border-gray-800'"
          @click="toggleVerbose"
        >
          <span class="font-sans italic font-bold text-[11px] tracking-widest transition-colors" :class="logs.isVerbose ? 'text-ak-400' : 'text-gray-500'">verbose_log</span>
          <div class="flex items-center gap-2">
            <span class="font-sans text-[10px] tracking-wider font-bold transition-colors w-[52px] text-right" :class="logs.isVerbose ? 'text-ak-400' : 'text-gray-600'">
              {{ logs.isVerbose ? 'ACTIVE' : 'INACTIVE' }}
            </span>
            <div class="w-1 h-4 bg-ak-400 transition duration-300" :class="logs.isVerbose ? 'opacity-100 shadow-[0_0_8px_#00E5FF] animate-[line-breathe_2s_ease-in-out_infinite]' : 'opacity-20'"></div>
          </div>
        </div>
      </div>

      <!-- 搜索/分类/操作工具栏 -->
      <div class="flex flex-wrap items-center gap-3 p-3 bg-ak-dark/80 border border-gray-800 relative">
        <div class="absolute top-0 left-0 w-3 h-3 border-t border-l border-ak-400/50 pointer-events-none"></div>
        <input v-model="keyword" :placeholder="t('log.searchLogs')" class="flex-1 min-w-[200px] bg-ak-darker border border-gray-800 text-white font-mono text-sm px-3 py-2 focus:border-ak-400 outline-none transition-colors placeholder-gray-600" />
        <select v-model="catFilter" class="bg-ak-darker border border-gray-800 text-white font-mono text-sm px-3 py-2 focus:border-ak-400 outline-none transition-colors cursor-pointer">
          <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label.toUpperCase() }}</option>
        </select>
        <div class="flex gap-2">
          <button class="bg-ak-darker border border-gray-800 text-gray-400 hover:text-ak-400 hover:border-ak-400/50 px-3 py-2 text-xs font-mono transition-colors" @click="logs.clear">&gt; {{ t('log.clear') }}</button>
          <button class="bg-ak-darker border border-gray-800 text-gray-400 hover:text-ak-400 hover:border-ak-400/50 px-3 py-2 text-xs font-mono transition-colors" @click="copyAll">&gt; {{ t('log.copy') }}</button>
          <button class="bg-ak-darker border border-gray-800 text-gray-400 hover:text-ak-400 hover:border-ak-400/50 px-3 py-2 text-xs font-mono transition-colors" @click="exportJson">&gt; {{ t('log.export') }}</button>
        </div>
      </div>

      <!-- 日志列表 -->
      <div class="flex-1 min-h-0 relative">
        <VirtualLogList :items="filtered" :estimate-size="40" :gap="6" class="h-full overflow-auto bg-ak-dark/60 border border-gray-800 p-4 relative shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]">
          <template #decorations>
            <!-- 扫描线装饰 -->
            <div class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(0,229,255,0.015)_3px,rgba(0,229,255,0.015)_4px)]"></div>
          </template>

          <template #empty>
            <div class="h-full flex flex-col items-center justify-center text-sm font-mono text-gray-600 relative z-10">
              <div class="relative w-20 h-20 flex items-center justify-center mb-6">
                <!-- 呼吸光圈（三层错相） -->
                <div class="absolute inset-0 border border-ak-400/40 rounded-full animate-[terminal-breathe_3s_ease-in-out_infinite]"></div>
                <div class="absolute inset-0 border border-ak-400/40 rounded-full animate-[terminal-breathe_3s_ease-in-out_infinite_1s]"></div>
                <div class="absolute inset-0 border border-ak-400/40 rounded-full animate-[terminal-breathe_3s_ease-in-out_infinite_2s]"></div>
                <!-- 旋转外环（虚线） -->
                <div class="absolute inset-1 border-t border-ak-400/30 border-r border-transparent border-b border-transparent border-l rounded-full animate-[terminal-ring-spin_6s_linear_infinite]"></div>
                <!-- 中心核心（脉动） -->
                <div class="w-2.5 h-2.5 bg-ak-400 rounded-full animate-[terminal-core_2s_ease-in-out_infinite]"></div>
              </div>
              <span class="mb-2 text-ak-400/80 font-bold tracking-widest">&gt;&gt; {{ t('log.noEntries') }} &lt;&lt;</span>
              <span class="text-xs tracking-widest text-gray-700">{{ t('log.systemIdle') }}</span>
            </div>
          </template>

          <template #row="{ item: e }">
            <div class="bg-ak-darker/60 border border-gray-800 border-l-2 p-2 text-sm font-mono hover:bg-ak-darker transition-colors duration-200 relative z-10 group/item"
              :class="expanded.has(e.id) ? 'border-l-ak-400' : 'border-l-transparent hover:border-l-ak-400/60'">
              <div class="flex cursor-pointer items-start gap-3" @click="toggleExpand(e.id)">
                <span class="text-gray-600 text-xs min-w-[70px] pt-0.5">{{ new Date(e.ts).toLocaleTimeString() }}</span>
                <span class="bg-ak-dark border border-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400 uppercase tracking-wider min-w-[56px] text-center">{{ e.category }}</span>
                <span :class="levelColor[e.level]" class="font-bold text-xs uppercase min-w-[46px] pt-0.5">{{ e.level }}</span>
                <span class="flex-1 text-gray-300 leading-relaxed group-hover/item:text-white transition-colors" :class="{'truncate': !expanded.has(e.id)}">{{ e.message }}</span>
                <span v-if="e.data != null" class="text-ak-400 text-xs pt-0.5 whitespace-nowrap opacity-50 group-hover/item:opacity-100 transition-opacity">
                  {{ expanded.has(e.id) ? t('log.collapse') : t('log.expand') }}
                </span>
              </div>
              <pre v-if="expanded.has(e.id) && e.data != null" class="mt-3 ml-[150px] max-h-96 overflow-auto bg-ak-dark border border-ak-400/20 p-3 text-xs text-ak-400 break-all whitespace-pre-wrap shadow-[inset_0_0_15px_rgba(0,229,255,0.05)]">{{ JSON.stringify(e.data, null, 2) }}</pre>
            </div>
          </template>
        </VirtualLogList>
      </div>
    </div>
  </template>
  <Modal v-else :show="props.show" title="SYS_LOGS //" width="820px" @close="emit('close')">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="keyword" :placeholder="t('log.searchLogs')" class="flex-1 bg-ak-dark border border-gray-800 text-white font-mono text-xs px-2 py-1 clip-chamfer focus:border-ak-400 outline-none" />
        <select v-model="catFilter" class="bg-ak-dark border border-gray-800 text-white font-mono text-xs px-2 py-1 clip-chamfer focus:border-ak-400 outline-none">
          <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label.toUpperCase() }}</option>
        </select>
        <div class="flex gap-1 text-[10px] font-mono">
          <button v-for="l in (['debug','info','warn','error'] as LogLevel[])" :key="l"
            class="px-3 py-1 clip-chamfer transition-colors"
            :class="levelFilter.has(l) ? 'bg-ak-400 text-ak-darker font-bold shadow-[0_0_8px_rgba(0,229,255,0.4)]' : 'bg-ak-dark border border-gray-800 text-gray-500 hover:text-white hover:border-ak-400/50'"
            @click="toggleLevel(l)">{{ l.toUpperCase() }}</button>
        </div>
        <button class="bg-ak-dark border border-gray-800 text-gray-400 hover:text-ak-400 hover:border-ak-400/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="logs.clear">{{ t('log.clear') }}</button>
        <button class="bg-ak-dark border border-gray-800 text-gray-400 hover:text-ak-400 hover:border-ak-400/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="copyAll">{{ t('log.copy') }}</button>
        <button class="bg-ak-dark border border-gray-800 text-gray-400 hover:text-ak-400 hover:border-ak-400/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="exportJson">{{ t('log.export') }}</button>
      </div>

      <VirtualLogList :items="filtered" :estimate-size="30" :gap="4" class="max-h-[60vh] overflow-auto bg-ak-dark/50 border border-ak-400/20 p-2 clip-chamfer relative group">
        <template #empty>
          <div class="py-8 flex flex-col items-center justify-center text-[10px] font-mono text-gray-600">
             <span class="mb-1 text-ak-400 font-bold">>> {{ t('log.noEntries') }} <<</span>
             <span>{{ t('log.systemIdle') }}</span>
          </div>
        </template>
        <template #row="{ item: e }">
          <div class="bg-ak-darker/80 border border-gray-800 p-1.5 text-xs font-mono clip-chamfer hover:border-ak-400/40 transition-colors relative z-10">
            <div class="flex cursor-pointer items-center gap-2" @click="toggleExpand(e.id)">
              <span class="text-gray-500 text-[10px]">{{ new Date(e.ts).toLocaleTimeString() }}</span>
              <span class="bg-ak-dark border border-gray-800 px-1 text-[10px] text-gray-400 uppercase">{{ e.category }}</span>
              <span :class="levelColor[e.level]" class="font-bold text-[10px] uppercase">{{ e.level }}</span>
              <span class="flex-1 truncate text-gray-300">{{ e.message }}</span>
              <span v-if="e.data != null" class="text-ak-400 text-[10px]">{{ t('log.view') }}</span>
            </div>
            <pre v-if="expanded.has(e.id) && e.data != null" class="mt-2 max-h-60 overflow-auto bg-ak-dark border border-gray-800 p-2 text-[10px] text-ak-400 clip-chamfer break-all whitespace-pre-wrap">{{ JSON.stringify(e.data, null, 2) }}</pre>
          </div>
        </template>
      </VirtualLogList>
    </div>
  </Modal>
</template>

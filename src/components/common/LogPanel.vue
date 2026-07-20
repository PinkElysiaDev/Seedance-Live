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
  debug: 'text-th-text-muted',
  info: 'text-th-accent',
  warn: 'text-th-warning',
  error: 'text-th-error',
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
          class="group flex items-center gap-2 px-3 py-2 border font-mono text-xs transition-colors duration-300 hover:border-th-accent/40"
          :class="levelFilter.size === 4 ? 'border-th-border bg-th-bg-panel/80 text-th-accent' : 'border-th-border bg-th-bg-panel/40 text-th-text-muted hover:text-th-text-secondary'"
          @click="selectAllLevels"
        >
          <span class="w-1.5 h-1.5 rounded-full transition animate-[lamp-breathe_2s_ease-in-out_infinite]"
            :class="levelFilter.size === 4 ? 'bg-th-accent shadow-[0_0_10px_rgba(var(--th-accent-rgb),0.9)]' : 'bg-th-text-muted'"></span>
          <span class="tracking-widest uppercase font-bold">ALL</span>
          <span class="text-[10px] opacity-70">{{ allCount }}</span>
        </button>
        <button
          v-for="l in LEVELS"
          :key="l"
          class="group flex items-center gap-2 px-3 py-2 border font-mono text-xs transition-colors duration-300 hover:border-th-accent/40"
          :class="isLevelActive(l) ? 'border-th-border bg-th-bg-panel/80' : 'border-th-border bg-th-bg-panel/40 hover:bg-th-bg-elevated/30'"
          @click="l === 'error' && levelFilter.size === 1 && levelFilter.has('error') ? selectAllLevels() : toggleLevel(l)"
        >
          <span class="w-1.5 h-1.5 rounded-full transition"
            :class="[
              isLevelActive(l)
                ? (l === 'debug' ? 'bg-th-text-primary shadow-[0_0_8px_rgba(var(--th-accent-rgb),0.7)]' : l === 'info' ? 'bg-th-accent shadow-[0_0_10px_rgba(var(--th-accent-rgb),0.9)]' : l === 'warn' ? 'bg-th-warning shadow-[0_0_10px_rgba(var(--th-warning-rgb),0.9)]' : 'bg-th-error shadow-[0_0_10px_rgba(var(--th-error-rgb),0.9)]') + ' animate-[lamp-breathe_2s_ease-in-out_infinite]'
                : 'bg-th-text-muted'
            ]"></span>
          <span class="tracking-widest uppercase font-bold" :class="isLevelActive(l) ? levelColor[l] : 'text-th-text-muted'">{{ l.toUpperCase() }}</span>
          <span class="text-[10px] opacity-70" :class="isLevelActive(l) ? levelColor[l] : 'text-th-text-muted'">{{ levelCount[l] }}</span>
        </button>

        <!-- verbose_log 开关（固定宽度，紧跟 ERROR 芯片，设计语言不变） -->
        <div
          class="flex items-center justify-between w-[190px] flex-shrink-0 px-3 py-2 border bg-th-bg-panel/50 hover:border-th-accent/40 transition-colors duration-300 cursor-pointer relative"
          :class="logs.isVerbose ? 'border-th-border' : 'border-th-border'"
          @click="toggleVerbose"
        >
          <span class="font-sans italic font-bold text-[11px] tracking-widest transition-colors" :class="logs.isVerbose ? 'text-th-accent' : 'text-th-text-muted'">verbose_log</span>
          <div class="flex items-center gap-2">
            <span class="font-sans text-[10px] tracking-wider font-bold transition-colors w-[52px] text-right" :class="logs.isVerbose ? 'text-th-accent' : 'text-th-text-muted'">
              {{ logs.isVerbose ? 'ACTIVE' : 'INACTIVE' }}
            </span>
            <div class="w-1 h-4 bg-th-accent transition duration-300" :class="logs.isVerbose ? 'opacity-100 shadow-[0_0_8px_rgba(var(--th-accent-rgb),0.9)] animate-[line-breathe_2s_ease-in-out_infinite]' : 'opacity-20'"></div>
          </div>
        </div>
      </div>

      <!-- 搜索/分类/操作工具栏 -->
      <div class="flex flex-wrap items-center gap-3 p-3 bg-th-bg-panel/80 border border-th-border relative">
        <div class="absolute top-0 left-0 w-3 h-3 border-t border-l border-th-accent/50 pointer-events-none"></div>
        <input v-model="keyword" :placeholder="t('log.searchLogs')" class="flex-1 min-w-[200px] bg-th-bg-base border border-th-border text-th-text-primary font-mono text-sm px-3 py-2 focus:border-th-accent outline-none transition-colors placeholder-th-text-muted" />
        <select v-model="catFilter" class="bg-th-bg-base border border-th-border text-th-text-primary font-mono text-sm px-3 py-2 focus:border-th-accent outline-none transition-colors cursor-pointer">
          <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label.toUpperCase() }}</option>
        </select>
        <div class="flex gap-2">
          <button class="bg-th-bg-base border border-th-border text-th-text-secondary hover:text-th-accent hover:border-th-accent/50 px-3 py-2 text-xs font-mono transition-colors" @click="logs.clear">&gt; {{ t('log.clear') }}</button>
          <button class="bg-th-bg-base border border-th-border text-th-text-secondary hover:text-th-accent hover:border-th-accent/50 px-3 py-2 text-xs font-mono transition-colors" @click="copyAll">&gt; {{ t('log.copy') }}</button>
          <button class="bg-th-bg-base border border-th-border text-th-text-secondary hover:text-th-accent hover:border-th-accent/50 px-3 py-2 text-xs font-mono transition-colors" @click="exportJson">&gt; {{ t('log.export') }}</button>
        </div>
      </div>

      <!-- 日志列表 -->
      <div class="flex-1 min-h-0 relative">
        <VirtualLogList :items="filtered" :estimate-size="40" :gap="6" class="h-full overflow-auto bg-th-bg-panel/60 border border-th-border p-4 relative" :style="{ boxShadow: 'inset 0 0 30px var(--th-overlay)' }">
          <template #decorations>
            <!-- 扫描线装饰 -->
            <div class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,var(--th-scanline)_3px,var(--th-scanline)_4px)]"></div>
          </template>

          <template #empty>
            <div class="h-full flex flex-col items-center justify-center text-sm font-mono text-th-text-muted relative z-10">
              <div class="relative w-20 h-20 flex items-center justify-center mb-6">
                <!-- 呼吸光圈（三层错相） -->
                <div class="absolute inset-0 border border-th-accent/40 rounded-full animate-[terminal-breathe_3s_ease-in-out_infinite]"></div>
                <div class="absolute inset-0 border border-th-accent/40 rounded-full animate-[terminal-breathe_3s_ease-in-out_infinite_1s]"></div>
                <div class="absolute inset-0 border border-th-accent/40 rounded-full animate-[terminal-breathe_3s_ease-in-out_infinite_2s]"></div>
                <!-- 旋转外环（虚线） -->
                <div class="absolute inset-1 border-t border-th-accent/30 border-r border-transparent border-b border-transparent border-l rounded-full animate-[terminal-ring-spin_6s_linear_infinite]"></div>
                <!-- 中心核心（脉动） -->
                <div class="w-2.5 h-2.5 bg-th-accent rounded-full animate-[terminal-core_2s_ease-in-out_infinite]"></div>
              </div>
              <span class="mb-2 text-th-accent/80 font-bold tracking-widest">&gt;&gt; {{ t('log.noEntries') }} &lt;&lt;</span>
              <span class="text-xs tracking-widest text-th-text-muted">{{ t('log.systemIdle') }}</span>
            </div>
          </template>

          <template #row="{ item: e }">
            <div class="bg-th-bg-base/60 border border-th-border border-l-2 p-2 text-sm font-mono hover:bg-th-bg-base transition-colors duration-200 relative z-10 group/item"
              :class="expanded.has(e.id) ? 'border-l-th-accent' : 'border-l-transparent hover:border-l-th-accent/60'">
              <div class="flex cursor-pointer items-start gap-3" @click="toggleExpand(e.id)">
                <span class="text-th-text-muted text-xs min-w-[70px] pt-0.5">{{ new Date(e.ts).toLocaleTimeString() }}</span>
                <span class="bg-th-bg-panel border border-th-border px-1.5 py-0.5 text-[10px] text-th-text-secondary uppercase tracking-wider min-w-[56px] text-center">{{ e.category }}</span>
                <span :class="levelColor[e.level]" class="font-bold text-xs uppercase min-w-[46px] pt-0.5">{{ e.level }}</span>
                <span class="flex-1 text-th-text-secondary leading-relaxed group-hover/item:text-th-text-primary transition-colors" :class="{'truncate': !expanded.has(e.id)}">{{ e.message }}</span>
                <span v-if="e.data != null" class="text-th-accent text-xs pt-0.5 whitespace-nowrap opacity-50 group-hover/item:opacity-100 transition-opacity">
                  {{ expanded.has(e.id) ? t('log.collapse') : t('log.expand') }}
                </span>
              </div>
              <pre v-if="expanded.has(e.id) && e.data != null" class="mt-3 ml-[150px] max-h-96 overflow-auto bg-th-bg-panel border border-th-accent/20 p-3 text-xs text-th-accent break-all whitespace-pre-wrap" :style="{ boxShadow: 'inset 0 0 15px var(--th-accent-glow)' }">{{ JSON.stringify(e.data, null, 2) }}</pre>
            </div>
          </template>
        </VirtualLogList>
      </div>
    </div>
  </template>
  <Modal v-else :show="props.show" title="SYS_LOGS //" width="820px" @close="emit('close')">
    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="keyword" :placeholder="t('log.searchLogs')" class="flex-1 bg-th-bg-panel border border-th-border text-th-text-primary font-mono text-xs px-2 py-1 clip-chamfer focus:border-th-accent outline-none" />
        <select v-model="catFilter" class="bg-th-bg-panel border border-th-border text-th-text-primary font-mono text-xs px-2 py-1 clip-chamfer focus:border-th-accent outline-none">
          <option v-for="c in CATEGORIES" :key="c.value" :value="c.value">{{ c.label.toUpperCase() }}</option>
        </select>
        <div class="flex gap-1 text-[10px] font-mono">
          <button v-for="l in (['debug','info','warn','error'] as LogLevel[])" :key="l"
            class="px-3 py-1 clip-chamfer transition-colors"
            :class="levelFilter.has(l) ? 'bg-th-accent text-th-on-accent font-bold shadow-[0_0_8px_rgba(var(--th-accent-rgb),0.4)]' : 'bg-th-bg-panel border border-th-border text-th-text-muted hover:text-th-text-primary hover:border-th-accent/50'"
            @click="toggleLevel(l)">{{ l.toUpperCase() }}</button>
        </div>
        <button class="bg-th-bg-panel border border-th-border text-th-text-secondary hover:text-th-accent hover:border-th-accent/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="logs.clear">{{ t('log.clear') }}</button>
        <button class="bg-th-bg-panel border border-th-border text-th-text-secondary hover:text-th-accent hover:border-th-accent/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="copyAll">{{ t('log.copy') }}</button>
        <button class="bg-th-bg-panel border border-th-border text-th-text-secondary hover:text-th-accent hover:border-th-accent/50 px-3 py-1 text-[10px] font-mono clip-chamfer transition-colors" @click="exportJson">{{ t('log.export') }}</button>
      </div>

      <VirtualLogList :items="filtered" :estimate-size="30" :gap="4" class="max-h-[60vh] overflow-auto bg-th-bg-panel/50 border border-th-accent/20 p-2 clip-chamfer relative group">
        <template #empty>
          <div class="py-8 flex flex-col items-center justify-center text-[10px] font-mono text-th-text-muted">
             <span class="mb-1 text-th-accent font-bold">>> {{ t('log.noEntries') }} <<</span>
             <span>{{ t('log.systemIdle') }}</span>
          </div>
        </template>
        <template #row="{ item: e }">
          <div class="bg-th-bg-base/80 border border-th-border p-1.5 text-xs font-mono clip-chamfer hover:border-th-accent/40 transition-colors relative z-10">
            <div class="flex cursor-pointer items-center gap-2" @click="toggleExpand(e.id)">
              <span class="text-th-text-muted text-[10px]">{{ new Date(e.ts).toLocaleTimeString() }}</span>
              <span class="bg-th-bg-panel border border-th-border px-1 text-[10px] text-th-text-secondary uppercase">{{ e.category }}</span>
              <span :class="levelColor[e.level]" class="font-bold text-[10px] uppercase">{{ e.level }}</span>
              <span class="flex-1 truncate text-th-text-secondary">{{ e.message }}</span>
              <span v-if="e.data != null" class="text-th-accent text-[10px]">{{ t('log.view') }}</span>
            </div>
            <pre v-if="expanded.has(e.id) && e.data != null" class="mt-2 max-h-60 overflow-auto bg-th-bg-panel border border-th-border p-2 text-[10px] text-th-accent clip-chamfer break-all whitespace-pre-wrap">{{ JSON.stringify(e.data, null, 2) }}</pre>
          </div>
        </template>
      </VirtualLogList>
    </div>
  </Modal>
</template>

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogCategory = 'submit' | 'poll' | 'http' | 'task' | 'settings' | 'test' | 'ai'

export interface LogEntry {
  id: number
  ts: number
  level: LogLevel
  category: LogCategory
  message: string
  data?: unknown
  taskId?: string
}

const MAX_ENTRIES = 500
let seq = 1

export const useLogsStore = defineStore('logs', () => {
  const entries = ref<LogEntry[]>([])
  const verbose = ref(true)

  const unreadErrors = computed(() => {
    // 简化：最近一次打开面板后的 error 计数由 UI 维护；这里返回 error 总数供角标
    return entries.value.filter((e) => e.level === 'error').length
  })

  function push(level: LogLevel, category: LogCategory, message: string, data?: unknown, taskId?: string) {
    if (!verbose.value && level !== 'warn' && level !== 'error') return
    entries.value.unshift({ id: seq++, ts: Date.now(), level, category, message, data, taskId })
    if (entries.value.length > MAX_ENTRIES) entries.value.length = MAX_ENTRIES
  }

  function clear() {
    entries.value = []
  }

  function setVerbose(v: boolean) {
    verbose.value = v
  }

  return { entries, verbose, unreadErrors, push, clear, setVerbose }
})

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
  /** data 的 JSON 文本，搜索时用，避免在过滤 computed 里反复 stringify */
  dataText?: string
  taskId?: string
}

const MAX_ENTRIES = 500
let seq = 1

export const useLogsStore = defineStore('logs', () => {
  const entries = ref<LogEntry[]>([])
  const isVerbose = ref(true)

  const unreadErrors = computed(() => {
    // 简化：最近一次打开面板后的 error 计数由 UI 维护；这里返回 error 总数供角标
    return entries.value.filter((e) => e.level === 'error').length
  })

  function push(level: LogLevel, category: LogCategory, message: string, data?: unknown, taskId?: string) {
    if (!isVerbose.value && level !== 'warn' && level !== 'error') return
    // 预计算 dataText 供搜索匹配，避免 LogPanel 每次按键都对全部条目重新 stringify
    let dataText: string | undefined
    if (data != null) {
      try {
        dataText = JSON.stringify(data)
      } catch {
        dataText = String(data)
      }
    }
    entries.value.unshift({ id: seq++, ts: Date.now(), level, category, message, data, dataText, taskId })
    if (entries.value.length > MAX_ENTRIES) entries.value.length = MAX_ENTRIES
  }

  function clear() {
    entries.value = []
  }

  function setVerbose(enabled: boolean) {
    isVerbose.value = enabled
  }

  return { entries, isVerbose, unreadErrors, push, clear, setVerbose }
})

import { useLogsStore, type LogCategory, type LogLevel } from '@/stores/logs'

// 脱敏 headers：Authorization 值替换为 Bearer ***
export function redactHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (/^authorization$/i.test(k)) {
      out[k] = v.replace(/(Bearer\s+).+/, '$1***')
    } else {
      out[k] = v
    }
  }
  return out
}

// 直接用 store push；store 在 Pinia 初始化后可用。调用方都在组件/store 运行时，安全。
function push(level: LogLevel, category: LogCategory, message: string, data?: unknown, taskId?: string) {
  try {
    useLogsStore().push(level, category, message, data, taskId)
  } catch {
    // store 未初始化（极早期），降级 console
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](`[${category}] ${message}`, data ?? '')
  }
  // 镜像 console
  const fn = level === 'debug' ? console.log : level === 'warn' ? console.warn : level === 'error' ? console.error : console.info
  fn(`[${category}] ${message}`, data ?? '')
}

export const log = {
  debug: (category: LogCategory, message: string, data?: unknown, taskId?: string) => push('debug', category, message, data, taskId),
  info: (category: LogCategory, message: string, data?: unknown, taskId?: string) => push('info', category, message, data, taskId),
  warn: (category: LogCategory, message: string, data?: unknown, taskId?: string) => push('warn', category, message, data, taskId),
  error: (category: LogCategory, message: string, data?: unknown, taskId?: string) => push('error', category, message, data, taskId),
}

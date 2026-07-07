import { HttpError, type ProxyConfig } from '@/types'
import { DEFAULT_TIMEOUT_SEC } from '@/config/options'
import { applyProxy } from './proxy'
import { log, redactHeaders } from '@/lib/logger'
import { useI18nStore } from '@/stores/i18n'

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT'
  headers?: Record<string, string>
  body?: BodyInit
  timeoutSec?: number
  signal?: AbortSignal
  proxy?: ProxyConfig
  responseType?: 'json' | 'blob' | 'text'
  // 日志 category，默认 'http'
  logCategory?: 'http' | 'submit' | 'poll' | 'test' | 'ai'
  taskId?: string
}

// 火山方舟 baseUrl 归一化：已以 /api/plan/v3、/api/v3、/v1 结尾则不再追加
export function buildApiUrl(baseUrl: string, path: string): string {
  let b = baseUrl.trim().replace(/\/+$/, '')
  const lower = b.toLowerCase()
  if (!lower.endsWith('/api/plan/v3') && !lower.endsWith('/api/v3') && !lower.endsWith('/v1')) {
    b = `${b}/v1`
  }
  return `${b}${path}`
}

function linkAbortSignals(signal: AbortSignal, timeoutMs: number): { signal: AbortSignal; timer: ReturnType<typeof setTimeout> | null } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
  }
  return { signal: controller.signal, timer }
}

export async function httpFetch<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const { t } = useI18nStore()
  const method = opts.method ?? 'GET'
  const timeoutMs = (opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC) * 1000
  const targetUrl = opts.proxy ? applyProxy(url, opts.proxy) : url
  const cat = opts.logCategory ?? 'http'

  log.debug(cat, `${method} ${url}`, { method, url: targetUrl, headers: redactHeaders(opts.headers), body: bodyPreview(opts.body) }, opts.taskId)

  const { signal, timer } = linkAbortSignals(opts.signal ?? new AbortController().signal, timeoutMs)

  let res: Response
  try {
    res = await fetch(targetUrl, {
      method,
      headers: opts.headers,
      body: opts.body,
      signal,
      cache: 'no-store',
    })
  } catch (err) {
    clearTimer(timer)
    if (signal.aborted && signal.reason?.name === 'TimeoutError') {
      log.error(cat, t('http.logTimeout', { method, url }), undefined, opts.taskId)
      throw new HttpError(t('http.timeout'), 'timeout')
    }
    if (opts.signal?.aborted) {
      throw new HttpError(t('http.aborted'), 'abort')
    }
    log.error(cat, t('http.logNetworkError', { method, url }), err instanceof Error ? err.message : String(err), opts.taskId)
    throw new HttpError(err instanceof Error ? err.message : t('http.networkFailed'), 'network')
  }
  clearTimer(timer)

  if (!res.ok) {
    let detail = ''
    let raw: unknown
    try {
      const txt = await res.text()
      detail = txt ? `: ${txt.slice(0, 500)}` : ''
      try { raw = JSON.parse(txt) } catch { raw = txt.slice(0, 1000) }
    } catch {
      // 忽略
    }
    log.error(cat, `HTTP ${res.status} ${method} ${url}`, raw, opts.taskId)
    throw new HttpError(`HTTP ${res.status}${detail}`, 'http', res.status)
  }

  if (opts.responseType === 'blob') {
    const blob = await res.blob()
    log.debug(cat, t('http.logResponseBlob', { status: res.status, n: blob.size }), undefined, opts.taskId)
    return blob as unknown as T
  }
  if (opts.responseType === 'text') {
    const txt = await res.text()
    log.debug(cat, t('http.logResponse', { status: res.status }), txt.slice(0, 1000), opts.taskId)
    return txt as unknown as T
  }
  // 默认按 JSON 解析；若服务器返回非 JSON（如 HTML 错误页），兜底读取文本并抛带上下文的错误
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const txt = await res.text().catch(() => '')
    const preview = txt.slice(0, 500)
    log.error(cat, t('http.notJson', { ct: contentType || '未知' }), preview, opts.taskId)
    throw new HttpError(t('http.notJsonError', { status: res.status, preview }), 'http', res.status)
  }
  const json = await res.json()
  log.debug(cat, t('http.logResponse', { status: res.status }), json, opts.taskId)
  return json as T
}

function bodyPreview(body?: BodyInit): unknown {
  if (body == null) return undefined
  if (typeof body === 'string') {
    // 尝试解析为 JSON 美化，否则原样
    try { return JSON.parse(body) } catch { return body.slice(0, 1000) }
  }
  return '[binary body]'
}

function clearTimer(timer: ReturnType<typeof setTimeout> | null) {
  if (timer) clearTimeout(timer)
}

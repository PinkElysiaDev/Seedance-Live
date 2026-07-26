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
  retry?: RetryOptions
}

export interface RetryOptions {
  retries?: number
  backoffMs?: number
  maxBackoffMs?: number
  retryOn?: (status: number) => boolean
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

function linkAbortSignals(signal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal
  cleanup: () => void
} {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

export async function httpFetch<T = unknown>(url: string, opts: HttpOptions = {}): Promise<T> {
  const { t } = useI18nStore()
  const method = opts.method ?? 'GET'
  const timeoutMs = (opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC) * 1000
  const targetUrl = opts.proxy ? applyProxy(url, opts.proxy) : url
  const cat = opts.logCategory ?? 'http'

  log.debug(cat, `${method} ${url}`, { method, url: targetUrl, headers: redactHeaders(opts.headers), body: bodyPreview(opts.body) }, opts.taskId)

  const retry = method === 'GET' ? opts.retry : undefined
  const retries = Math.max(0, retry?.retries ?? 0)
  const retryOn = retry?.retryOn ?? defaultRetryOn
  let attempt = 0
  let res: Response

  while (true) {
    const linked = linkAbortSignals(opts.signal, timeoutMs)
    try {
      res = await fetch(targetUrl, {
        method,
        headers: opts.headers,
        body: opts.body,
        signal: linked.signal,
        cache: 'no-store',
      })
    } catch (err) {
      const timedOut = linked.signal.aborted && linked.signal.reason?.name === 'TimeoutError'
      linked.cleanup()
      if (opts.signal?.aborted) throw new HttpError(t('http.aborted'), 'abort')
      if (attempt < retries) {
        attempt += 1
        await waitForRetry(retryDelay(attempt, retry), opts.signal)
        continue
      }
      if (timedOut) {
        log.error(cat, `${t('http.logTimeout', { method, url })} (attempts: ${attempt + 1})`, undefined, opts.taskId)
        throw new HttpError(t('http.timeout'), 'timeout')
      }
      log.error(cat, `${t('http.logNetworkError', { method, url })} (attempts: ${attempt + 1})`, err instanceof Error ? err.message : String(err), opts.taskId)
      throw new HttpError(err instanceof Error ? err.message : t('http.networkFailed'), 'network')
    }
    linked.cleanup()

    if (!res.ok && attempt < retries && retryOn(res.status)) {
      attempt += 1
      const delay = retryAfterMs(res.headers.get('retry-after')) ?? retryDelay(attempt, retry)
      await waitForRetry(delay, opts.signal)
      continue
    }
    break
  }

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
    log.error(cat, `HTTP ${res.status} ${method} ${url} (attempts: ${attempt + 1})`, raw, opts.taskId)
    throw new HttpError(`HTTP ${res.status}${detail}`, 'http', res.status)
  }

  if (opts.responseType === 'blob') {
    const blob = await res.blob()
    log.debug(cat, t('http.logResponseBlob', { status: res.status, n: blob.size }), { attempts: attempt + 1 }, opts.taskId)
    return blob as unknown as T
  }
  if (opts.responseType === 'text') {
    const txt = await res.text()
    log.debug(cat, t('http.logResponse', { status: res.status }), { attempts: attempt + 1, body: txt.slice(0, 1000) }, opts.taskId)
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
  log.debug(cat, t('http.logResponse', { status: res.status }), attempt > 0 ? { attempts: attempt + 1, response: json } : json, opts.taskId)
  return json as T
}

function bodyPreview(body?: BodyInit): unknown {
  if (body == null) return undefined
  if (typeof body === 'string') {
    // 大 body（如含 base64 图片）截断，避免撑爆日志内存
    if (body.length > 2000) return `[body ${body.length} chars, truncated]`
    try { return JSON.parse(body) } catch { return body.slice(0, 1000) }
  }
  return '[binary body]'
}

function defaultRetryOn(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

function retryDelay(attempt: number, retry?: RetryOptions): number {
  const base = Math.max(0, retry?.backoffMs ?? 500)
  const max = Math.max(base, retry?.maxBackoffMs ?? 5000)
  const exponential = Math.min(max, base * 2 ** Math.max(0, attempt - 1))
  return Math.round(exponential * (0.8 + Math.random() * 0.4))
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(value)
  if (Number.isNaN(date)) return undefined
  return Math.max(0, date - Date.now())
}

function waitForRetry(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new HttpError('Request aborted', 'abort'))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new HttpError('Request aborted', 'abort'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

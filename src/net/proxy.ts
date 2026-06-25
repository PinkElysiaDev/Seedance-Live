import type { ProxyConfig } from '@/types'

// 代理启用时，把目标 URL 改写经代理转发，绕过 CORS
// mode='path'  → ${proxy.url}/${encodeURIComponent(targetUrl)}
// mode='query' → ${proxy.url}?target=${encodeURIComponent(targetUrl)}
export function applyProxy(targetUrl: string, proxy: ProxyConfig): string {
  if (!proxy.enabled || !proxy.url) return targetUrl
  const base = proxy.url.replace(/\/+$/, '')
  const encoded = encodeURIComponent(targetUrl)
  return proxy.mode === 'query' ? `${base}?target=${encoded}` : `${base}/${encoded}`
}

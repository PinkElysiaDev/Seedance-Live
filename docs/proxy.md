# 代理脚本示例（可选，用于绕过 CORS）

Seedance Live 是纯前端项目，浏览器直连火山方舟官方接口通常会被 CORS 拦截。
若你的中转商接口已开放 CORS，则无需代理；否则可自备一个代理转发服务，在「设置 → 代理」中填入地址启用。

代理只需做一件事：把前端发来的目标 URL（`?target=` 或路径形式）原样转发，并保留 `Authorization` 头。

## Cloudflare Workers 示例

```js
export default {
  async fetch(request) {
    const url = new URL(request.url)
    let target = url.searchParams.get('target')
    if (!target) {
      // path 模式：/https://...
      target = decodeURIComponent(url.pathname.replace(/^\//, ''))
    }
    if (!target) return new Response('missing target', { status: 400 })

    const headers = new Headers(request.headers)
    headers.delete('host')
    headers.delete('cf-connecting-ip')
    headers.delete('x-forwarded-for')

    const init = {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    }
    const res = await fetch(target, init)
    const respHeaders = new Headers(res.headers)
    respHeaders.set('Access-Control-Allow-Origin', '*')
    return new Response(res.body, { status: res.status, headers: respHeaders })
  },
}
```

部署后在「设置 → 代理」填入 `https://your-worker.workers.dev`，模式选 `query`（默认）。

## Vercel 示例（api/proxy.ts）

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const target = (req.query.target as string) || decodeURIComponent(req.url?.replace(/^\//, '') ?? '')
  if (!target) return res.status(400).send('missing target')

  const headers = new Headers(req.headers as Record<string, string>)
  headers.delete('host')
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method!) ? undefined : req,
  })
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(upstream.status)
  upstream.headers.forEach((v, k) => res.setHeader(k, v))
  const buf = Buffer.from(await upstream.arrayBuffer())
  res.send(buf)
}
```

## 安全提示

- 代理会转发你的 `Authorization` 头（含 API Key）。请只使用自己部署的代理，不要用来源不明的公共代理。
- 建议在代理中限制 `target` 仅允许 `ark.cn-beijing.volces.com` 等已知域名，避免被当作开放代理滥用。

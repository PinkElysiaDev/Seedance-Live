# Seedance-Live 后端逻辑层 Code Review

> 审查日期：2026-07-21
> 审查范围：`src/net/`、`src/provider/`、`src/db/`、`src/stores/tasks.ts`、`src/lib/`
> 审查人：AI Code Reviewer

---

## 1. 架构概述

Seedance-Live 是纯前端视频生成工作站，无传统服务端。其**网络层、Provider 层、数据库层、任务调度**构成等价于后端的完整业务逻辑栈：

```
┌─────────────────────────────────────────────────────────┐
│                    stores/tasks.ts                        │
│              任务调度（提交 → 轮询 → 恢复 → 续帧）         │
├──────────────┬──────────────────────┬────────────────────┤
│ provider/    │      net/            │      db/           │
│ API 适配层   │  HTTP 封装 + 代理     │  IndexedDB 封装    │
├──────────────┼──────────────────────┼────────────────────┤
│ lib/         │ validate / template / asset / blob / video │
└──────────────┴──────────────────────┴────────────────────┘
```

### 核心数据流

```
用户提交 → validateTask → putTask(IndexedDB)
         → executeTask → provider.submit(httpFetch) → remoteTaskId
         → startPolling → provider.poll(httpFetch) → status
         → finalizeSuccess → downloadBlob → putBlob → 完成
```

---

## 2. 设计优点

### 2.1 错误分类与可恢复性

`HttpError` 按 `kind` 区分 network/timeout/cors/http/abort，配合 `isRecoverableError()` 让任务调度精确决策是重试、等待还是终止。这比简单的 try-catch-retry 健壮得多。

### 2.2 Provider 抽象

```typescript
interface VideoProvider {
  submit(ctx: SubmitContext): Promise<{ remoteTaskId: string }>
  poll(profile, remoteTaskId, signal, proxy?): Promise<PollResult>
  cancel?(profile, remoteTaskId, signal, proxy?): Promise<void>
}
```

统一了火山引擎原生 API 和用户自定义 API 的巨大差异。新增 provider 只需实现两个方法。

### 2.3 Custom Provider 模板引擎

用户可自定义 URL/Header/Body 模板 + JSONPath 提取响应字段，实现了对任意视频生成 API 的适配，无需写代码。

### 2.4 Blob 去重

`hashBlob()` 使用 SHA-256 作为 blobId，同一文件无论添加几次都只存一份 ArrayBuffer。

### 2.5 续帧链追溯

`parentTaskId` + `getTaskChain()` 实现了视频续帧家族树的双向追溯（祖先 + 后代），支持 UI 展示完整生成谱系。

### 2.6 结构化日志

预计算 `dataText`（JSON 字符串），避免搜索过滤时对全部条目重复 `JSON.stringify`。

---

## 3. 问题发现

### 3.1 P0 — 正确性 / 健壮性

#### [B-01] IndexedDB 连接丢失无恢复机制

**位置**：`src/db/index.ts:13-36`

**现状**：`dbPromise` 一旦创建就永久缓存。当浏览器因存储清理、版本变更或用户手动清除数据导致连接关闭时，后续所有 `withStore` 调用会静默失败。

**影响**：用户清除浏览器数据后，任务状态持久化完全失效，但 UI 无感知。

**建议**：
```typescript
req.onsuccess = () => {
  const db = req.result
  db.onclose = () => { dbPromise = null }
  db.onversionchange = () => {
    db.close()
    dbPromise = null
  }
  resolve(db)
}
```

---

#### [B-02] getAssets N+1 事务问题

**位置**：`src/db/repos.ts:39-41`

**现状**：
```typescript
export function getAssets(ids: string[]): Promise<StoredAsset[]> {
  return Promise.all(ids.map((id) => getAsset(id)))
    .then((arr) => arr.filter((a): a is StoredAsset => !!a))
}
```

每个 id 独立开启一次 IndexedDB 事务（open transaction → get → close）。

**影响**：10 个素材 = 10 次事务开销。IndexedDB 事务创建不是零成本操作。

**建议**：
```typescript
export function getAssets(ids: string[]): Promise<StoredAsset[]> {
  return withStore(STORE_ASSETS, 'readonly', (store) => {
    return Promise.all(ids.map((id) => {
      return new Promise<StoredAsset | undefined>((resolve) => {
        const req = store.get(id)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(undefined)
      })
    }))
  }).then((arr) => arr.filter((a): a is StoredAsset => !!a))
}
```

> 注：需调整 `withStore` 签名以支持返回 Promise 而非单个 IDBRequest。

---

#### [B-03] 轮询循环中 task 引用过时

**位置**：`src/stores/tasks.ts:208-211`

**现状**：
```typescript
async function startPolling(taskId: string) {
  const task = findTask(taskId)          // ← 取一次快照
  if (!task || !task.remoteTaskId) { ... }
  // ... 以下整个 while(true) 循环都用这个 task 引用
}
```

`findTask` 返回的是数组中的引用，虽然 Vue reactive 下属性变更能反映，但 `updateTask` 实际上是用 spread 创建了新对象替换数组元素，旧引用就断开了。

**影响**：极端情况下（用户取消后快速重试），轮询可能使用过时的 remoteTaskId。

**建议**：循环体内关键路径重新获取最新 task 状态：
```typescript
while (true) {
  const currentTask = findTask(taskId)
  if (!currentTask || currentTask.status === 'cancelled') return
  // 用 currentTask.remoteTaskId 轮询
}
```

---

#### [B-04] importData 缺少输入校验

**位置**：`src/stores/tasks.ts:605-636`

**现状**：`JSON.parse(json)` 后直接按 `VideoTask[]` 类型使用，无任何运行时校验。

**影响**：
- 损坏的导出文件可写入不合法的任务记录，导致后续渲染/操作崩溃
- 恶意构造的文件可注入超大数据（如巨量 blob）撑爆存储

**建议**：
```typescript
function isValidTask(t: unknown): t is VideoTask {
  if (!t || typeof t !== 'object') return false
  const o = t as Record<string, unknown>
  return typeof o.id === 'string'
    && typeof o.prompt === 'string'
    && typeof o.status === 'string'
    && typeof o.createdAt === 'number'
    && o.params != null
}
```

---

#### [B-05] scheduleRecover 对无 remoteTaskId 的任务无效

**位置**：`src/stores/tasks.ts:367-388`

**现状**：`scheduleRecover` 内部统一调用 `startPolling(taskId)`。但 submit 阶段网络失败的任务没有 `remoteTaskId`，`startPolling` 会立刻因 `!task.remoteTaskId` 退出。

**影响**：submit 阶段网络中断的任务，recover 重试等同无操作，最终被 `RECOVER_MAX_ATTEMPTS` 耗尽后标记为 failed。

**建议**：
```typescript
function scheduleRecover(taskId: string) {
  // ...
  const t = setTimeout(() => {
    timers.delete(taskId)
    const task = findTask(taskId)
    if (task?.remoteTaskId) {
      void startPolling(taskId)
    } else {
      void executeTask(taskId)  // 重新走 submit
    }
  }, RECOVER_DELAY_MS)
  timers.set(taskId, t)
}
```

---

### 3.2 P1 — 性能

#### [P-01] exportData blob 序列化为 number[] 效率极低

**位置**：`src/stores/tasks.ts:587-601`

**现状**：
```typescript
const blobsSerializable = blobs.map((b) => ({
  id: b.id, mime: b.mime,
  buffer: Array.from(new Uint8Array(b.buffer)),  // ← number[]
}))
```

**影响**：一个 100MB 的视频 blob 会产生约 300MB 的 JSON 文本（每个字节平均 3 字符），导致导出极慢且内存暴涨。

**建议**：使用 base64 编码，体积减少约 2.5x：
```typescript
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}
```

或更进一步：导出为 zip 包（blob 作为独立文件），JSON 中只存引用。

---

#### [P-02] toStorable JSON roundtrip 开销

**位置**：`src/db/repos.ts:8-11`

**现状**：每次 `putTask` 都执行 `JSON.parse(JSON.stringify(raw))`。轮询期间每 5s 调用一次 `updateTask → putTask`。

**影响**：正常负载下可接受，但多任务并发时（如 5 个任务同时轮询），每秒约 1 次 roundtrip，对大 task 对象有额外 GC 压力。

**建议**：
```typescript
export function toStorable<T>(obj: T): T {
  const raw = toRaw(obj as unknown) as T
  // 现代浏览器均支持 structuredClone，且能处理 toRaw 后的纯对象
  try {
    return structuredClone(raw)
  } catch {
    return JSON.parse(JSON.stringify(raw))
  }
}
```

---

#### [P-03] 日志 unshift 触发全量响应式更新

**位置**：`src/stores/logs.ts:42`

**现状**：`entries.value.unshift(...)` 在 reactive array 头部插入，Vue 需要更新所有依赖该数组的计算属性和 watcher。

**影响**：500 条上限下影响有限，但每条日志都触发组件 re-render check。

**建议**：改为 `push` + UI 层倒序渲染（`computed(() => [...entries.value].reverse())`），或使用 `shallowRef` + 手动 `triggerRef()`。

---

#### [P-04] finalizeSuccess 多次独立事务

**位置**：`src/stores/tasks.ts:292-358`

**现状**：成功收尾依次调用 `putBlob` → `putCover` → `putTask`，每次各开一个独立事务。

**建议**：合并为单事务批量写入（需扩展 `withStore` 或新增跨 store 事务 API）。考虑到 IndexedDB 跨 objectStore 事务的支持，可以：
```typescript
export async function withMultiStore(
  storeNames: string[],
  mode: IDBTransactionMode,
  fn: (stores: Record<string, IDBObjectStore>) => void,
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode)
    const stores: Record<string, IDBObjectStore> = {}
    for (const name of storeNames) stores[name] = tx.objectStore(name)
    fn(stores)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
```

---

### 3.3 P2 — 可维护性 / 可测试性

#### [M-01] tasks store 职责过重

**位置**：`src/stores/tasks.ts`（660 行）

**现状**：单文件混合了：
- 任务 CRUD（`submitTask` / `removeTask` / `updateTask`）
- 网络调度（`executeTask` / `startPolling` / `scheduleRecover`）
- 下载逻辑（`downloadVideoBlob` / `downloadImageCover`）
- 桌面通知
- 数据导入/导出
- 续帧逻辑

**建议拆分**：
```
src/stores/tasks.ts          → 状态 + CRUD（~150 行）
src/scheduler/taskRunner.ts  → 调度引擎（submit/poll/recover）（~250 行）
src/stores/taskIO.ts         → 导入/导出（~80 行）
```

---

#### [M-02] 模块级 Map 难以测试

**位置**：`src/stores/tasks.ts:41-43`

**现状**：
```typescript
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const abortControllers = new Map<string, AbortController>()
const recoverAttempts = new Map<string, number>()
```

模块级变量在测试间无法 reset，导致测试隔离困难。

**建议**：移入 store factory 内部，或暴露 `_resetForTest()` 方法。

---

#### [M-03] useI18nStore() 高频重复调用

**位置**：`src/net/httpClient.ts`、`src/provider/*.ts`、`src/lib/validate.ts`

**现状**：几乎每个函数首行都调用 `const { t } = useI18nStore()`。

**影响**：功能上无问题（Pinia store 是单例），但增加了不必要的函数调用开销和代码噪声。

**建议**：在模块顶层取一次引用，或封装为 `t()` 直接导出：
```typescript
// lib/i18n.ts
import { useI18nStore } from '@/stores/i18n'
export const t = (...args: Parameters<ReturnType<typeof useI18nStore>['t']>) =>
  useI18nStore().t(...args)
```

---

#### [M-04] 缺少 HTTP 重试中间件

**位置**：`src/net/httpClient.ts`

**现状**：`httpFetch` 只做单次请求。5xx / 429 等瞬时错误全部上抛，由 tasks store 的 recover 机制以 10s 间隔重试。

**影响**：recover 是为网络中断设计的粗粒度重试（10s 间隔，最多 12 次），对服务端短暂过载（200ms 后恢复）响应过慢。

**建议**：
```typescript
export interface RetryOptions {
  retries?: number        // 默认 0（不重试）
  backoffMs?: number      // 默认 1000
  retryOn?: (status: number) => boolean  // 默认 status >= 500 || status === 429
}
```

---

### 3.4 P3 — 安全性

#### [S-01] API Key 明文存储于 localStorage

**位置**：`src/stores/settings.ts:150`

**现状**：整个 `AppSettings`（含 `profiles[].apiKey`）JSON.stringify 后直接存入 localStorage。

**影响**：任何 XSS 漏洞都能直接读取 API Key。虽然纯前端无完美解决方案，但当前零防护。

**建议**：
- 短期：settings 页面加安全提示，告知用户 API Key 的本地存储风险
- 中期：使用 Web Crypto API 对敏感字段做 AES-GCM 加密（密钥派生自用户 PIN）
- 可选：改用 sessionStorage（关闭标签页即清除），但牺牲持久性

---

#### [S-02] 模板注入边界 Case 缺少测试覆盖

**位置**：`src/lib/template.ts:34`

**现状**：`renderTemplate` 的 JSON 模式用正则 `/"?\{\{\s*([\w.]+)\s*\}\}"?/g` 匹配占位符后 `JSON.stringify(value)` 替换。设计上安全，但缺少针对 prompt 中包含 `}}`、`"`、`\n` 等边界字符的单元测试。

**建议**：补充边界测试用例：
```typescript
it('prompt 含 }} 不破坏模板', () => { ... })
it('prompt 含换行和引号正确转义', () => { ... })
it('未知变量替换为 null 而非 undefined', () => { ... })
```

---

## 4. 优化执行 Plan

### Phase 1 — 健壮性修复（建议立即执行）

| 序号 | 任务 | 对应问题 | 预估工作量 |
|------|------|----------|-----------|
| 1.1 | IndexedDB 连接恢复 + onclose 监听 | B-01 | 0.5h |
| 1.2 | getAssets 单事务批量查询 | B-02 | 1h |
| 1.3 | 轮询循环内刷新 task 引用 | B-03 | 0.5h |
| 1.4 | scheduleRecover 区分 submit/poll 恢复路径 | B-05 | 0.5h |
| 1.5 | importData 添加 schema 校验 | B-04 | 1h |

### Phase 2 — 性能优化

| 序号 | 任务 | 对应问题 | 预估工作量 |
|------|------|----------|-----------|
| 2.1 | exportData 改用 base64 编码 | P-01 | 1h |
| 2.2 | toStorable 优先使用 structuredClone | P-02 | 0.5h |
| 2.3 | 日志改 push + 倒序读取 | P-03 | 0.5h |
| 2.4 | finalizeSuccess 跨 store 批量事务 | P-04 | 1.5h |

### Phase 3 — 架构重构

| 序号 | 任务 | 对应问题 | 预估工作量 |
|------|------|----------|-----------|
| 3.1 | tasks store 拆分为 store + scheduler + IO | M-01 | 3h |
| 3.2 | httpClient 添加可选重试层 | M-04 | 1.5h |
| 3.3 | 模块级 Map 可测试化改造 | M-02 | 1h |
| 3.4 | i18n 调用封装简化 | M-03 | 0.5h |

### Phase 4 — 安全加固 & 测试补全

| 序号 | 任务 | 对应问题 | 预估工作量 |
|------|------|----------|-----------|
| 4.1 | API Key 加密存储或风险提示 | S-01 | 2h |
| 4.2 | 模板引擎边界测试补全 | S-02 | 1h |
| 4.3 | importData / exportData 集成测试 | B-04, P-01 | 1h |

---

## 5. 总结

Seedance-Live 的后端逻辑层设计清晰、分层合理，Provider 抽象和错误恢复机制是架构亮点。主要改进方向集中在：

1. **健壮性**：IndexedDB 连接恢复、轮询引用安全、恢复路径修正
2. **性能**：导出序列化优化、事务合并、日志数据结构改进
3. **可维护性**：tasks store 拆分、重试中间件、测试友好化

建议按 Phase 1 → 2 → 3 → 4 顺序逐步实施，每个 Phase 完成后运行现有测试套件确认无回归。

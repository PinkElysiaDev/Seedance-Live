// 轻量字段路径解析：getByPath(obj, 'data.result.videos[0].url')
// 自实现，不引入第三方

function parsePath(path: string): (string | number)[] {
  const tokens: (string | number)[] = []
  const parts = path.split('.')
  for (const part of parts) {
    // 处理 a[0][1] 形式
    const head = part.split('[')[0]
    if (head) tokens.push(head)
    const matches = part.match(/\[(\d+)\]/g)
    if (matches) {
      for (const m of matches) {
        tokens.push(Number(m.slice(1, -1)))
      }
    }
  }
  return tokens
}

export function getByPath(obj: unknown, path: string): unknown {
  if (obj == null) return undefined
  const tokens = parsePath(path)
  let cur: unknown = obj
  for (const t of tokens) {
    if (cur == null) return undefined
    cur = (cur as Record<string | number, unknown>)[t]
  }
  return cur
}

export function getAllByPath(obj: unknown, path: string): unknown[] {
  // path 末段若指向数组，展开所有元素取子路径
  const parentPath = path.includes('.') ? path.slice(0, path.lastIndexOf('.')) : ''
  const lastSeg = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : path
  const parent = parentPath ? getByPath(obj, parentPath) : obj
  if (Array.isArray(parent)) {
    return parent
      .map((item) => (item == null ? undefined : (item as Record<string, unknown>)[lastSeg]))
      .filter((v) => v !== undefined && v !== null)
  }
  const v = parent == null ? undefined : (parent as Record<string, unknown>)[lastSeg]
  return v === undefined || v === null ? [] : [v]
}

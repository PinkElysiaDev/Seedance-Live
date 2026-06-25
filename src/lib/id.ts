// id 生成
export function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // fallback
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

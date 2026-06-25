// 触发浏览器下载
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 延迟释放，避免下载未开始
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function saveUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  const blob = await res.blob()
  saveBlob(blob, filename)
}

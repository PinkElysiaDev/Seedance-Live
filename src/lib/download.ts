/** 用临时 object URL 触发浏览器下载指定 blob，延迟释放以确保下载开始。 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 先 fetch 远程 URL 为 blob 再下载（绕过跨域 download 属性失效问题）。 */
export async function saveUrl(url: string, filename: string): Promise<void> {
  const res = await fetch(url)
  const blob = await res.blob()
  saveBlob(blob, filename)
}

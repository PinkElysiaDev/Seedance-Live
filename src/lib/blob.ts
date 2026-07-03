// File/Blob/dataUrl/ArrayBuffer 互转 + 哈希

export function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer()
}

export function arrayBufferToBlob(buffer: ArrayBuffer, mime: string): Blob {
  return new Blob([buffer], { type: mime })
}

/** Blob → data:<mime>;base64,xxxx。 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((res) => res.blob())
}

export function isDataUrl(s: string): boolean {
  return typeof s === 'string' && s.startsWith('data:')
}

export function isHttpUrl(s: string): boolean {
  return typeof s === 'string' && /^https?:\/\//i.test(s)
}

export function isAssetUrl(s: string): boolean {
  return typeof s === 'string' && s.startsWith('asset://')
}

/** 公网 URL 或 asset:// 可直传，无需转 dataUrl。 */
export function isDirectUrl(s: string): boolean {
  return isHttpUrl(s) || isAssetUrl(s)
}

/**
 * 计算 blob 的 SHA-256 哈希，用于 blob 去重。
 * 不支持 subtle 时回退到 size+type 的粗略标识。
 */
export async function hashBlob(blob: Blob): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await blob.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // fallback：size + 首尾字节粗略哈希
  return `fallback-${blob.size}-${blob.type}`
}

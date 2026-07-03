/** 视频元信息：宽高与时长（毫秒）。 */
export interface VideoMeta {
  width: number
  height: number
  durationMs: number
}

/** 探测视频宽高与时长，失败时 reject。 */
export function probeVideo(blob: Blob): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = url
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
    }
    video.onloadedmetadata = () => {
      const meta = {
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        durationMs: Math.round((video.duration || 0) * 1000),
      }
      cleanup()
      resolve(meta)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('视频元信息读取失败'))
    }
  })
}

/**
 * 截取视频首帧作为封面，返回 dataUrl。
 * 跳到 0.1s 取帧避免全黑首帧，并按 maxW 等比缩小、以 quality 压缩为 webp。
 */
export function captureCover(blob: Blob, maxW = 640, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.src = url
    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
    }
    video.onloadeddata = () => {
      // 跳到 0.1s 取一帧，避免全黑首帧
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2)
    }
    video.onseeked = () => {
      try {
        const w = video.videoWidth
        const h = video.videoHeight
        if (!w || !h) {
          cleanup()
          reject(new Error('视频尺寸读取失败'))
          return
        }
        const scale = Math.min(1, maxW / w)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(w * scale))
        canvas.height = Math.max(1, Math.round(h * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          reject(new Error('canvas 2d 上下文不可用'))
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/webp', quality)
        cleanup()
        resolve(dataUrl)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('视频首帧截取失败'))
    }
  })
}

/** 探测音频时长（毫秒），失败时 reject。 */
export function probeAudio(blob: Blob): Promise<{ durationMs: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.src = url
    const cleanup = () => {
      URL.revokeObjectURL(url)
      audio.removeAttribute('src')
    }
    audio.onloadedmetadata = () => {
      const durationMs = Math.round((audio.duration || 0) * 1000)
      cleanup()
      resolve({ durationMs })
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('音频元信息读取失败'))
    }
  })
}

import { ref, watch, onUnmounted, type Ref } from 'vue'
import type { VideoTask } from '@/types'
import { useTasksStore } from '@/stores/tasks'
import { useComposerStore } from '@/stores/composer'
import { useToastStore } from '@/stores/toast'
import { saveUrl } from '@/lib/download'

/**
 * 加载任务的封面 / 视频 / 末帧 URL，并在重载与卸载时释放占用的 blob: URL。
 *
 * 监听任务 id、状态及各媒体 id 的变化自动重载——任务切换、状态推进、
 * 视频下载完成等场景都会触发对应媒体的刷新。
 *
 * @param getTask 返回当前任务的 getter（可为 undefined）
 */
export function useTaskMedia(getTask: () => VideoTask | undefined) {
  const tasks = useTasksStore()
  const videoUrl = ref<string | null>(null)
  const coverUrl = ref<string | null>(null)
  const lastFrameUrl = ref<string | null>(null)

  function revokeVideo() {
    if (videoUrl.value?.startsWith('blob:')) URL.revokeObjectURL(videoUrl.value)
  }

  async function loadMedia() {
    // 先释放上一轮的 blob: URL，避免每次重载都泄漏一个 object URL
    revokeVideo()
    videoUrl.value = null
    coverUrl.value = null
    lastFrameUrl.value = null
    const task = getTask()
    if (!task) return
    coverUrl.value = await tasks.resolveCoverUrl(task)
    if (task.status === 'succeeded') videoUrl.value = await tasks.resolveVideoUrl(task)
    if (task.lastFrameImageId) lastFrameUrl.value = await tasks.resolveLastFrameUrl(task)
  }

  watch(
    () => {
      const task = getTask()
      return [task?.id, task?.status, task?.videoBlobId, task?.coverImageId, task?.lastFrameImageId]
    },
    loadMedia,
    { immediate: true },
  )

  onUnmounted(revokeVideo)

  return { videoUrl, coverUrl, lastFrameUrl, reload: loadMedia }
}

/**
 * 任务操作集合：下载 / 重试 / 取消 / 删除 / 续帧 / 复用配置。
 *
 * 这些 action 只负责数据层动作与提示，不处理 UI 关闭——由调用方
 * （如详情弹窗）在动作完成后自行决定是否关闭。
 *
 * @param getTask 返回当前任务的 getter
 * @param videoUrl 已解析的可播放视频 URL（来自 useTaskMedia），下载时优先使用
 */
export function useTaskActions(getTask: () => VideoTask | undefined, videoUrl: Ref<string | null>) {
  const tasks = useTasksStore()
  const composer = useComposerStore()
  const toast = useToastStore()

  function downloadFilename() {
    return `seedance-${(getTask()?.id ?? '').slice(0, 8)}.mp4`
  }

  /** 下载视频：优先用已解析的 URL 锚点下载，否则回退远程 URL 走 fetch。 */
  async function download() {
    const task = getTask()
    if (!task) return
    const filename = downloadFilename()
    if (videoUrl.value) {
      const anchor = document.createElement('a')
      anchor.href = videoUrl.value
      anchor.download = filename
      anchor.click()
    } else if (task.videoUrl) {
      await saveUrl(task.videoUrl, filename)
    }
  }

  async function retry() {
    const task = getTask()
    if (!task) return
    await tasks.retryTask(task.id)
    toast.show('已重新提交', 'success')
  }

  async function cancel() {
    const task = getTask()
    if (!task) return
    await tasks.cancelTask(task.id)
  }

  async function remove() {
    const task = getTask()
    if (!task) return
    await tasks.removeTask(task.id)
  }

  /** 续帧：用当前任务的末帧作为新任务的首帧。 */
  async function continueFrame() {
    const task = getTask()
    if (!task) return
    const res = await tasks.continueFromTask(task.id)
    if (!res.ok) toast.show(res.error ?? '续帧失败', 'error')
    else toast.show('已创建续帧任务', 'success')
  }

  /** 复用任务的提示词与参数到输入区。 */
  function reuseConfig() {
    const task = getTask()
    if (!task) return
    composer.setPrompt(task.prompt)
    composer.patchParams({ ...task.params })
    toast.show('已载入配置到输入区', 'info')
  }

  return { download, retry, cancel, remove, continueFrame, reuseConfig }
}

import { ref, onUnmounted, watch } from 'vue'

/**
 * 每秒刷新一次 now，供运行中任务计时显示。
 * 仅在 isActive 为真时运行定时器，避免无运行任务时的空转。
 */
export function useTicker(isActive: () => boolean) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  function start() {
    if (timer) return
    timer = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }
  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  watch(
    () => isActive(),
    (active) => {
      if (active) start()
      else stop()
    },
    { immediate: true },
  )

  onUnmounted(stop)
  return now
}

import { ref, onUnmounted, watch } from 'vue'

// 每秒刷新一次 now，用于运行中任务计时显示
export function useTicker(active: () => boolean) {
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
    () => active(),
    (isActive) => {
      if (isActive) start()
      else stop()
    },
    { immediate: true },
  )

  onUnmounted(stop)
  return now
}

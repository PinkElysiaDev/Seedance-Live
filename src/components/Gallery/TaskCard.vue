<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import type { VideoTask } from '@/types'
import { useTasksStore } from '@/stores/tasks'
import { useComposerStore } from '@/stores/composer'
import { useToastStore } from '@/stores/toast'
import { useTicker } from '@/composables/useTicker'
import { MODEL_META } from '@/config/models'
import { saveUrl } from '@/lib/download'

const props = defineProps<{ task: VideoTask }>()
const emit = defineEmits<{ open: [] }>()
const tasks = useTasksStore()
const composer = useComposerStore()
const toast = useToastStore()

const coverUrl = ref<string | null>(null)
const videoUrl = ref<string | null>(null)

const isRunning = computed(
  () => props.task.status === 'running' || (props.task.status === 'failed' && props.task.recoverable),
)
const now = useTicker(() => isRunning.value)

const elapsedSec = computed(() => {
  if (!props.task.createdAt) return 0
  const end = props.task.finishedAt ?? now.value
  return Math.max(0, Math.floor((end - props.task.createdAt) / 1000))
})

async function loadMedia() {
  coverUrl.value = await tasks.resolveCoverUrl(props.task)
  if (props.task.status === 'succeeded') {
    videoUrl.value = await tasks.resolveVideoUrl(props.task)
  } else {
    videoUrl.value = null
  }
}

watch(() => [props.task.status, props.task.videoBlobId, props.task.coverImageId], loadMedia, { immediate: false })
onMounted(loadMedia)

const statusText = computed(() => {
  switch (props.task.status) {
    case 'queued': return '排队中'
    case 'running': return props.task.recoverable ? '重连中…' : '生成中…'
    case 'succeeded': return '完成'
    case 'failed': return '失败'
    case 'cancelled': return '已取消'
    case 'expired': return '已过期'
  }
})

const estimatedProgress = computed(() => {
  if (props.task.progress != null) return props.task.progress
  if (props.task.status !== 'running') return undefined
  const estimatedTotal = (props.task.params.duration ?? 5) * 50
  const pct = Math.min(95, Math.round((elapsedSec.value / estimatedTotal) * 100))
  return pct
})

const remoteHint = computed(() => {
  if (props.task.status !== 'running') return ''
  const parts: string[] = []
  if (props.task.progress != null) {
    parts.push(`${props.task.progress}%`)
  } else {
    parts.push('远端未返回进度')
  }
  parts.push(`${elapsedSec.value}s`)
  return parts.join(' · ')
})

const statusColor = computed(() => {
  switch (props.task.status) {
    case 'running': return 'text-violet-600'
    case 'succeeded': return 'text-green-600'
    case 'failed': case 'cancelled': case 'expired': return 'text-red-500'
    default: return 'text-gray-500'
  }
})

const modelLabel = computed(() => MODEL_META[props.task.params.model]?.label ?? props.task.params.model)

async function download() {
  if (videoUrl.value) {
    // 本地 blob URL 直接下载
    const a = document.createElement('a')
    a.href = videoUrl.value
    a.download = `seedance-${props.task.id.slice(0, 8)}.mp4`
    a.click()
  } else if (props.task.videoUrl) {
    await saveUrl(props.task.videoUrl, `seedance-${props.task.id.slice(0, 8)}.mp4`)
  }
}

async function retry() {
  await tasks.retryTask(props.task.id)
  toast.show('已重新提交', 'success')
}

async function cancel() {
  await tasks.cancelTask(props.task.id)
}

async function remove() {
  await tasks.removeTask(props.task.id)
}

async function continueFrame() {
  const res = await tasks.continueFromTask(props.task.id)
  if (!res.ok) toast.show(res.error ?? '续帧失败', 'error')
  else toast.show('已创建续帧任务', 'success')
}

// 复用配置：把该任务参数填回 composer
function reuseConfig() {
  composer.setPrompt(props.task.prompt)
  composer.patchParams({ ...props.task.params })
  toast.show('已载入配置到输入区', 'info')
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <div class="relative aspect-video cursor-pointer bg-black" @click="emit('open')">
      <video
        v-if="videoUrl && task.status === 'succeeded'"
        :src="videoUrl"
        controls
        class="h-full w-full object-contain"
        @click.stop="emit('open')"
      />
      <img v-else-if="coverUrl" :src="coverUrl" class="h-full w-full object-contain opacity-80" />
      <div v-else class="flex h-full items-center justify-center text-gray-500">
        <span class="text-sm">无预览</span>
      </div>

      <div v-if="isRunning" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <div class="flex items-center justify-between text-xs text-white">
          <span>{{ statusText }}</span>
          <span class="text-right text-[11px] text-white/80">{{ remoteHint }}</span>
        </div>
        <div v-if="estimatedProgress != null" class="mt-1 h-1 overflow-hidden rounded bg-white/30">
          <div class="h-full bg-violet-400 transition-all duration-1000" :style="{ width: `${estimatedProgress}%` }" />
        </div>
      </div>
    </div>

    <div class="p-3">
      <div class="mb-1 flex items-center justify-between">
        <span class="text-xs font-medium" :class="statusColor">{{ statusText }}</span>
        <span class="text-xs text-gray-400">{{ modelLabel }} · {{ task.params.ratio }} · {{ task.params.duration }}s</span>
      </div>
      <p class="line-clamp-2 text-sm text-gray-700" :title="task.prompt">{{ task.prompt || '（无提示词）' }}</p>
      <p v-if="task.error" class="mt-1 line-clamp-2 text-xs text-red-500">
        {{ task.error }}
        <span v-if="task.errorDetails?.quota_refunded" class="ml-1 text-green-600">（额度已退还）</span>
      </p>

      <div class="mt-2 flex flex-wrap gap-1.5 text-xs">
        <button v-if="isRunning" class="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50" @click="cancel">取消</button>
        <button v-if="task.status === 'succeeded'" class="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50" @click="download">下载</button>
        <button v-if="task.status === 'succeeded' && task.lastFrameImageId" class="rounded border border-violet-300 px-2 py-1 text-violet-600 hover:bg-violet-50" @click="continueFrame">续帧</button>
        <button class="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50" @click="reuseConfig">复用</button>
        <button v-if="task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired'" class="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50" @click="retry">重试</button>
        <button class="rounded border border-gray-300 px-2 py-1 text-red-500 hover:bg-red-50" @click="remove">删除</button>
      </div>
    </div>
  </div>
</template>

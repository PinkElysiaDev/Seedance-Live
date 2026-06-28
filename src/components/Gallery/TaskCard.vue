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
  <div class="flex flex-col border border-tactical-border glass-elysia clip-chamfer p-1 relative overflow-hidden group hover:border-elysia-400 transition-colors">
    <!-- 状态指示灯条 -->
    <div
      class="absolute left-0 top-0 bottom-0 w-1 transition-all"
      :class="{
        'bg-elysia-400 animate-pulse neon-glow-pink': isRunning,
        'bg-teal-400 shadow-[0_0_8px_#2dd4bf]': task.status === 'succeeded',
        'bg-red-500 shadow-[0_0_8px_#ef4444]': task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired',
        'bg-gray-500': task.status === 'queued'
      }"
    ></div>

    <div class="h-40 bg-gray-100 dark:bg-tactical-900 m-1 relative flex items-center justify-center border border-gray-300 dark:border-tactical-700 cursor-pointer overflow-hidden group-hover:border-elysia-400/50" @click="emit('open')">
      <video
        v-if="videoUrl && task.status === 'succeeded'"
        :src="videoUrl"
        controls
        class="h-full w-full object-contain"
        @click.stop="emit('open')"
      />
      <img v-else-if="coverUrl" :src="coverUrl" class="h-full w-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
      <div v-else class="flex flex-col h-full items-center justify-center text-elysia-500/50 dark:text-elysia-400/50">
        <span class="font-mono text-xs">{{ isRunning ? 'PROCESSING_CRYSTAL...' : 'NO_VISUAL_DATA' }}</span>
      </div>

      <div v-if="isRunning" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-100 dark:from-tactical-900 to-transparent p-2 border-t border-elysia-400/30">
        <div class="flex items-center justify-between font-mono text-[10px] text-gray-800 dark:text-elysia-50">
          <span>> {{ statusText }}</span>
          <span class="text-right opacity-80">{{ remoteHint }}</span>
        </div>
        <div v-if="estimatedProgress != null" class="mt-1 flex gap-0.5">
          <div
            v-for="i in 20" :key="i"
            class="h-1 flex-1 bg-elysia-400/20"
            :class="{ 'bg-elysia-400 neon-glow-pink': i * 5 <= estimatedProgress }"
          ></div>
        </div>
      </div>
    </div>

    <div class="p-2 flex flex-col gap-1 pl-3">
      <div class="flex justify-between items-center mb-1">
        <div class="font-mono text-[10px] truncate uppercase font-bold" :class="statusColor">SYS_STATUS: {{ statusText }} //</div>
        <span class="font-mono text-[10px] text-gray-600 dark:text-gray-500 border border-gray-300 dark:border-gray-700 px-1 bg-gray-100 dark:bg-tactical-900">{{ modelLabel }} · {{ task.params.ratio }} · {{ task.params.duration }}s</span>
      </div>
      <div class="font-sans text-sm text-gray-800 dark:text-elysia-50 line-clamp-2 leading-relaxed" :title="task.prompt">{{ task.prompt || 'NO_PROMPT_DATA' }}</div>

      <div v-if="task.error" class="mt-1 font-mono text-[10px] text-red-600 dark:text-red-400 border border-red-500/30 bg-red-100 dark:bg-red-900/20 px-2 py-1 line-clamp-2 clip-chamfer">
        ERR: {{ task.error }}
        <span v-if="task.errorDetails?.quota_refunded" class="text-elysia-600 dark:text-elysia-300 ml-1"> [QUOTA_REFUNDED]</span>
      </div>

      <div class="mt-2 flex flex-wrap gap-1">
        <button v-if="isRunning" class="font-mono text-[10px] border border-gray-400 dark:border-tactical-500 bg-gray-100 dark:bg-tactical-800 text-gray-600 dark:text-gray-400 px-2 py-1 hover:border-red-500 hover:text-red-500 transition-colors clip-chamfer" @click="cancel">ABORT</button>
        <button v-if="task.status === 'succeeded'" class="font-mono text-[10px] border border-elysia-400/50 bg-elysia-50 dark:bg-elysia-400/10 text-elysia-600 dark:text-elysia-300 px-2 py-1 hover:border-elysia-500 hover:bg-elysia-100 dark:hover:border-elysia-400 dark:hover:bg-elysia-400 dark:hover:text-tactical-900 transition-colors clip-chamfer" @click="download">DOWNLOAD</button>
        <button v-if="task.status === 'succeeded' && task.lastFrameImageId" class="font-mono text-[10px] border border-teal-500/50 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 px-2 py-1 hover:border-teal-600 hover:bg-teal-100 dark:hover:border-teal-400 dark:hover:bg-teal-400 dark:hover:text-tactical-900 transition-colors clip-chamfer" @click="continueFrame">CHAIN_FRAME</button>
        <button class="font-mono text-[10px] border border-gray-400 dark:border-tactical-500 bg-gray-100 dark:bg-tactical-800 text-gray-600 dark:text-gray-400 px-2 py-1 hover:border-elysia-500 hover:text-elysia-600 dark:hover:border-elysia-400 dark:hover:text-elysia-300 transition-colors clip-chamfer" @click="reuseConfig">CLONE_CFG</button>
        <button v-if="task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired'" class="font-mono text-[10px] border border-gray-400 dark:border-tactical-500 bg-gray-100 dark:bg-tactical-800 text-gray-600 dark:text-gray-400 px-2 py-1 hover:border-elysia-500 hover:text-elysia-600 dark:hover:border-elysia-400 dark:hover:text-elysia-300 transition-colors clip-chamfer" @click="retry">RETRY</button>
        <button class="font-mono text-[10px] border border-gray-400 dark:border-tactical-500 bg-gray-100 dark:bg-tactical-800 text-gray-600 dark:text-gray-400 px-2 py-1 hover:border-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:border-red-500 dark:hover:text-red-500 dark:hover:bg-red-900/20 transition-colors clip-chamfer ml-auto" @click="remove">DELETE</button>
      </div>
    </div>
  </div>
</template>

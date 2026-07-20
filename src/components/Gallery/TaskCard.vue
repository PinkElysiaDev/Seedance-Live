<script setup lang="ts">
import { computed } from 'vue'
import type { VideoTask } from '@/types'
import { useTicker } from '@/composables/useTicker'
import { useTaskMedia, useTaskActions } from '@/composables/useTaskItem'
import { MODEL_META, ratioToPaddingTop } from '@/config/models'

const props = defineProps<{ task: VideoTask }>()
const emit = defineEmits<{ open: [] }>()

const isRunning = computed(
  () => props.task.status === 'running' || (props.task.status === 'failed' && props.task.recoverable),
)
const now = useTicker(() => isRunning.value)

const { coverUrl, videoUrl } = useTaskMedia(() => props.task)
const { download, retry, cancel, remove, continueFrame, reuseConfig } = useTaskActions(() => props.task, videoUrl)

const elapsedSec = computed(() => {
  if (!props.task.createdAt) return 0
  const end = props.task.finishedAt ?? now.value
  return Math.max(0, Math.floor((end - props.task.createdAt) / 1000))
})

const statusText = computed(() => {
  switch (props.task.status) {
    case 'queued': return 'QUEUED'
    case 'running': return props.task.recoverable ? 'RECONNECTING' : 'RENDERING'
    case 'succeeded': return 'COMPLETED'
    case 'failed': return 'FAILED'
    case 'cancelled': return 'CANCELLED'
    case 'expired': return 'EXPIRED'
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
    parts.push('SYNCING')
  }
  parts.push(`${elapsedSec.value}s`)
  return parts.join(' · ')
})

const statusColor = computed(() => {
  switch (props.task.status) {
    case 'running': return 'bg-th-accent text-th-on-accent'
    case 'succeeded': return 'bg-th-text-primary text-th-on-accent'
    case 'failed': case 'cancelled': case 'expired': return 'bg-th-error text-th-on-accent'
    default: return 'bg-th-text-muted text-th-on-accent'
  }
})

const modelLabel = computed(() => MODEL_META[props.task.params.model]?.label ?? props.task.params.model)

// 基于请求比例计算 paddingTop，实现基于宽度的自适应高度
const aspectRatioPadding = computed(() => ratioToPaddingTop(props.task.params.ratio || '16:9'))
</script>

<template>
  <div class="flex flex-col w-full min-w-0 bg-th-bg-panel/50 border border-th-border relative group hover:border-th-accent transition-colors" :style="{ boxShadow: 'var(--th-shadow-card)' }">

    <!-- Thumbnail Area (自适应宽高比) -->
    <div
      class="w-full relative cursor-pointer overflow-hidden bg-th-bg-base"
      :style="{ paddingBottom: aspectRatioPadding }"
      @click="emit('open')"
    >
      <!-- Status Badge Top Left -->
      <div class="absolute top-0 left-0 z-20 font-sans font-bold text-[10px] px-2 py-1 uppercase tracking-widest" :class="statusColor">
        {{ statusText }}
      </div>

      <!-- 绝对定位撑满 padding 创造出来的盒子 -->
      <div class="absolute inset-0 flex items-center justify-center">
        <video
          v-if="videoUrl && task.status === 'succeeded'"
          :src="videoUrl"
          controls
          preload="metadata"
          class="h-full w-full object-cover relative z-10"
          @click.stop="emit('open')"
        />
        <img v-else-if="coverUrl" :src="coverUrl" loading="lazy" class="h-full w-full object-cover opacity-60 group-hover:opacity-100 transition-opacity group-hover:scale-105 duration-700 relative z-10" />
        <div v-else class="flex flex-col h-full items-center justify-center text-th-text-muted font-sans tracking-widest relative z-10">
          <span class="text-xs uppercase">{{ isRunning ? 'PROCESSING...' : 'NO_VISUAL_DATA' }}</span>
        </div>
      </div>

      <!-- Running Overlay -->
      <div v-if="isRunning" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-th-bg-base to-transparent p-3 border-t border-th-accent z-20">
        <div class="flex items-center justify-between font-sans text-[10px] text-th-accent tracking-widest uppercase font-bold">
          <span>{{ statusText }}</span>
          <span class="text-right">{{ remoteHint }}</span>
        </div>
        <div v-if="estimatedProgress != null" class="mt-2 w-full bg-th-border h-1 relative overflow-hidden">
          <div class="absolute top-0 left-0 h-full bg-th-accent transition-[width] duration-300" :style="{ width: `${estimatedProgress}%` }"></div>
        </div>
      </div>

      <!-- Hover Overlay -->
      <div v-if="!isRunning" class="absolute inset-0 bg-th-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
    </div>

    <!-- Details Area -->
    <div class="p-4 flex flex-col gap-2 relative">
      <div class="flex justify-between items-center mb-1">
        <span class="font-sans font-bold text-[10px] text-th-text-muted bg-th-bg-elevated px-1 tracking-widest uppercase border border-th-border">{{ modelLabel }} · {{ task.params.ratio }}</span>
      </div>
      <div class="font-sans text-sm text-th-text-secondary line-clamp-2 leading-relaxed tracking-wide" :title="task.prompt">{{ task.prompt || 'NO_PROMPT_DATA' }}</div>

      <div v-if="task.error" class="mt-2 font-mono text-[10px] text-th-error bg-th-error/15 px-2 py-1 line-clamp-2 border border-th-error/30">
        ERR: {{ task.error }}
        <span v-if="task.errorDetails?.quota_refunded" class="text-th-text-secondary ml-1"> [QUOTA_REFUNDED]</span>
      </div>

      <!-- Actions -->
      <div class="mt-4 flex flex-wrap gap-2">
        <button v-if="isRunning" class="font-sans font-bold text-[10px] tracking-widest uppercase border border-th-border bg-th-bg-elevated text-th-text-secondary px-3 py-1.5 hover:border-th-error hover:text-th-error transition-colors" @click="cancel">ABORT</button>
        <button v-if="task.status === 'succeeded'" class="font-sans font-bold text-[10px] tracking-widest uppercase bg-th-accent text-th-on-accent px-3 py-1.5 hover:bg-th-accent-dim transition-colors" @click="download">SAVE</button>
        <button v-if="task.status === 'succeeded' && task.lastFrameImageId" class="font-sans font-bold text-[10px] tracking-widest uppercase border border-th-accent bg-th-accent/10 text-th-accent px-3 py-1.5 hover:bg-th-accent hover:text-th-on-accent transition-colors" @click="continueFrame">CHAIN</button>
        <button class="font-sans font-bold text-[10px] tracking-widest uppercase border border-th-border bg-th-bg-elevated text-th-text-secondary px-3 py-1.5 hover:border-th-accent hover:text-th-accent transition-colors" @click="reuseConfig">CLONE</button>
        <button v-if="task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired'" class="font-sans font-bold text-[10px] tracking-widest uppercase border border-th-border bg-th-bg-elevated text-th-text-secondary px-3 py-1.5 hover:border-th-accent hover:text-th-accent transition-colors" @click="retry">RETRY</button>
        <button class="font-sans font-bold text-[10px] tracking-widest uppercase text-th-error px-2 py-1.5 hover:bg-th-error/15 transition-colors ml-auto" @click="remove">DEL</button>
      </div>
    </div>
  </div>
</template>
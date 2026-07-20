<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-3">
    <div
      v-for="item in toast.items"
      :key="item.id"
      class="pointer-events-auto w-fit max-w-lg relative overflow-hidden backdrop-blur-md transition animate-[slide-down_0.3s_cubic-bezier(0.25,1,0.2,1)_both] border"
      :style="{ backgroundColor: 'var(--th-bg-panel)' }"
      :class="{
        'border-th-text-muted': item.type === 'info',
        'border-th-error/50': item.type === 'error',
        'border-th-accent/50': item.type === 'success',
      }"
      @click="toast.dismiss(item.id)"
    >
      <!-- 左侧动态音频线装饰 (Equalizer Effect) 无分隔边框 -->
      <div class="absolute left-4 top-0 bottom-0 flex items-center justify-center gap-[3px]">
        <div class="w-1 h-3" :class="{ 'bg-th-text-muted': item.type === 'info', 'bg-th-error': item.type === 'error', 'bg-th-accent': item.type === 'success' }" style="animation: eq 0.8s ease-in-out infinite alternate 0.1s"></div>
        <div class="w-1 h-3" :class="{ 'bg-th-text-muted': item.type === 'info', 'bg-th-error': item.type === 'error', 'bg-th-accent': item.type === 'success' }" style="animation: eq 0.6s ease-in-out infinite alternate 0.3s"></div>
        <div class="w-1 h-3" :class="{ 'bg-th-text-muted': item.type === 'info', 'bg-th-error': item.type === 'error', 'bg-th-accent': item.type === 'success' }" style="animation: eq 1.0s ease-in-out infinite alternate 0s"></div>
      </div>

      <!-- 消息主体 -->
      <div class="pl-12 pr-6 py-3 flex flex-col justify-center min-h-[48px]">
        <div class="font-sans font-black text-[10px] tracking-widest uppercase mb-1"
          :class="{
            'text-th-text-secondary': item.type === 'info',
            'text-th-error': item.type === 'error',
            'text-th-accent': item.type === 'success',
          }">
          {{ item.type === 'info' ? 'SYS_INFO' : item.type === 'error' ? 'SYS_ERR_ALERT' : 'SYS_SUCCESS' }} //
        </div>
        <div class="font-mono text-xs tracking-wide text-th-text-primary break-words">
          {{ item.message }}
        </div>
      </div>

      <!-- 极细的底部进度条（可选装饰） -->
      <div class="absolute bottom-0 left-0 h-[2px] bg-current animate-[shrink-width_3s_linear_forwards]"
        :class="{
          'text-th-text-muted': item.type === 'info',
          'text-th-error': item.type === 'error',
          'text-th-accent': item.type === 'success',
        }"></div>
    </div>
  </div>
</template>

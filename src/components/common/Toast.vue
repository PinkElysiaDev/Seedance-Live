<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-6 z-50 flex flex-col items-center gap-3">
    <div
      v-for="item in toast.items"
      :key="item.id"
      class="pointer-events-auto w-fit max-w-lg relative overflow-hidden bg-ak-dark/95 border shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all animate-[slide-down_0.3s_cubic-bezier(0.25,1,0.2,1)_both]"
      :class="{
        'border-gray-600': item.type === 'info',
        'border-red-500/50': item.type === 'error',
        'border-ak-400/50': item.type === 'success',
      }"
      @click="toast.dismiss(item.id)"
    >
      <!-- 左侧动态音频线装饰 (Equalizer Effect) 无分隔边框 -->
      <div class="absolute left-4 top-0 bottom-0 flex items-center justify-center gap-[3px]">
        <div class="w-1 h-3" :class="{ 'bg-gray-500': item.type === 'info', 'bg-red-500': item.type === 'error', 'bg-ak-400': item.type === 'success' }" style="animation: eq 0.8s ease-in-out infinite alternate 0.1s"></div>
        <div class="w-1 h-3" :class="{ 'bg-gray-400': item.type === 'info', 'bg-red-400': item.type === 'error', 'bg-ak-300': item.type === 'success' }" style="animation: eq 0.6s ease-in-out infinite alternate 0.3s"></div>
        <div class="w-1 h-3" :class="{ 'bg-gray-600': item.type === 'info', 'bg-red-600': item.type === 'error', 'bg-ak-500': item.type === 'success' }" style="animation: eq 1.0s ease-in-out infinite alternate 0s"></div>
      </div>

      <!-- 消息主体 -->
      <div class="pl-12 pr-6 py-3 flex flex-col justify-center min-h-[48px]">
        <div class="font-sans font-black text-[10px] tracking-widest uppercase mb-1"
          :class="{
            'text-gray-400': item.type === 'info',
            'text-red-500': item.type === 'error',
            'text-ak-400': item.type === 'success',
          }">
          {{ item.type === 'info' ? 'SYS_INFO' : item.type === 'error' ? 'SYS_ERR_ALERT' : 'SYS_SUCCESS' }} //
        </div>
        <div class="font-mono text-xs tracking-wide text-white break-words">
          {{ item.message }}
        </div>
      </div>

      <!-- 极细的底部进度条（可选装饰） -->
      <div class="absolute bottom-0 left-0 h-[2px] bg-current animate-[shrink-width_3s_linear_forwards]"
        :class="{
          'text-gray-500': item.type === 'info',
          'text-red-500': item.type === 'error',
          'text-ak-400': item.type === 'success',
        }"></div>
    </div>
  </div>
</template>

<style scoped>
/* slide-down / eq / shrink-width keyframes 定义在全局 style.css，
   避免 scoped style 重命名后内联 style 与 Tailwind animate 类引用失效 */
</style>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { VideoTask } from '@/types'
import { useTasksStore } from '@/stores/tasks'
import { MODEL_META } from '@/config/models'

const props = defineProps<{
  chain: VideoTask[]
  activeId: string
}>()
const emit = defineEmits<{ select: [id: string] }>()

const tasks = useTasksStore()
const covers = ref<Record<string, string | null>>({})

async function loadCovers() {
  const next: Record<string, string | null> = {}
  for (const t of props.chain) {
    next[t.id] = await tasks.resolveCoverUrl(t)
  }
  covers.value = next
}
watch(() => props.chain, loadCovers, { immediate: true })
onUnmounted(() => {
  // 释放可能的 object URL（cover 是 dataUrl，无需释放）
})

function label(t: VideoTask): string {
  return MODEL_META[t.params.model]?.label ?? t.params.model
}

function statusDot(t: VideoTask): string {
  switch (t.status) {
    case 'running': return 'bg-violet-500'
    case 'succeeded': return 'bg-green-500'
    case 'failed': case 'cancelled': case 'expired': return 'bg-red-500'
    default: return 'bg-gray-400'
  }
}
</script>

<template>
  <div v-if="chain.length > 1" class="rounded-lg border border-gray-200 bg-gray-50 p-3">
    <div class="mb-2 text-xs font-medium text-gray-500">续帧链路（{{ chain.length }} 段）</div>
    <div class="flex items-center gap-2 overflow-x-auto pb-1">
      <template v-for="(t, i) in chain" :key="t.id">
        <button
          class="flex shrink-0 flex-col items-center gap-1 rounded-lg border p-1.5 transition"
          :class="t.id === activeId ? 'border-violet-500 bg-white shadow-sm' : 'border-gray-200 bg-white/60 hover:bg-white'"
          @click="emit('select', t.id)"
        >
          <div class="relative h-12 w-20 overflow-hidden rounded bg-black">
            <img v-if="covers[t.id]" :src="covers[t.id]!" class="h-full w-full object-cover opacity-90" />
            <span v-else class="flex h-full items-center justify-center text-[10px] text-gray-400">无预览</span>
            <span class="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full" :class="statusDot(t)" />
          </div>
          <span class="text-[10px] text-gray-500">{{ label(t) }}</span>
        </button>
        <span v-if="i < chain.length - 1" class="shrink-0 text-gray-300">→</span>
      </template>
    </div>
  </div>
</template>

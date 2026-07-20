<script setup lang="ts">
import { ref, watch } from 'vue'
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

function modelLabel(t: VideoTask): string {
  return MODEL_META[t.params.model]?.label ?? t.params.model
}

function statusDotClass(t: VideoTask): string {
  switch (t.status) {
    case 'running': return 'bg-th-accent shadow-[0_0_5px_rgba(var(--th-accent-rgb),0.9)]'
    case 'succeeded': return 'bg-th-success shadow-[0_0_5px_rgba(var(--th-success-rgb),0.9)]'
    case 'failed': case 'cancelled': case 'expired': return 'bg-th-error shadow-[0_0_5px_rgba(var(--th-error-rgb),0.9)]'
    default: return 'bg-th-text-muted'
  }
}
</script>

<template>
  <div v-if="chain.length > 1" class="border border-th-border bg-th-bg-panel/50 p-3 clip-chamfer">
    <div class="mb-2 text-[10px] font-mono font-bold text-th-accent uppercase">SYS_CHAIN_LINK // {{ chain.length }} SEGMENTS</div>
    <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <template v-for="(t, i) in chain" :key="t.id">
        <button
          class="flex shrink-0 flex-col items-center gap-1 clip-chamfer p-1.5 transition"
          :class="t.id === activeId ? 'border border-th-accent bg-th-accent/10 shadow-[0_0_8px_rgba(var(--th-accent-rgb),0.3)]' : 'border border-th-border bg-th-bg-base hover:border-th-accent/50'"
          @click="emit('select', t.id)"
        >
          <div class="relative h-12 w-20 overflow-hidden bg-th-bg-base border border-th-border">
            <img v-if="covers[t.id]" :src="covers[t.id]!" loading="lazy" class="h-full w-full object-cover opacity-80" />
            <span v-else class="flex h-full items-center justify-center text-[10px] font-mono text-th-text-muted">N/A</span>
            <span class="absolute right-0.5 top-0.5 h-1.5 w-1.5 rotate-45" :class="statusDotClass(t)" />
          </div>
          <span class="text-[9px] font-mono" :class="t.id === activeId ? 'text-th-accent' : 'text-th-text-muted'">{{ modelLabel(t) }}</span>
        </button>
        <span v-if="i < chain.length - 1" class="shrink-0 text-th-accent font-mono text-xs animate-pulse">>></span>
      </template>
    </div>
  </div>
</template>

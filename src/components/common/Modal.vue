<script setup lang="ts">
defineProps<{
  show: boolean
  title?: string
  width?: string
}>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-pop">
    <div v-if="show" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div class="absolute inset-0 backdrop-blur-sm" :style="{ backgroundColor: 'var(--th-overlay)' }" @click="emit('close')" />
      <div
        class="relative z-10 max-h-[90vh] w-full overflow-auto backdrop-blur-md border border-th-accent/20 clip-chamfer-lg"
        :style="{ backgroundColor: 'var(--th-bg-panel)', maxWidth: width || '640px', boxShadow: 'var(--th-shadow-panel)' }"
      >
        <div v-if="title" class="flex items-center justify-between border-b border-th-accent/20" :style="{ backgroundColor: 'var(--th-bg-base)' }">
          <div class="flex items-center gap-2 px-5 py-3">
            <span class="w-1.5 h-4 bg-th-accent clip-chamfer"></span>
            <h2 class="text-base font-sans italic font-bold text-th-text-primary uppercase tracking-widest">{{ title }}</h2>
          </div>
          <button class="font-mono text-th-text-muted hover:text-th-accent hover:scale-110 transition px-2" @click="emit('close')">[✕]</button>
        </div>
        <div class="p-5">
          <slot />
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

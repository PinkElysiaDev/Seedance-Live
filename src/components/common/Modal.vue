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
    <div v-if="show" class="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="emit('close')" />
      <div
        class="relative z-10 max-h-[90vh] w-full overflow-auto bg-ak-dark/95 backdrop-blur-md border border-ak-400/20 clip-chamfer-lg shadow-[0_0_30px_rgba(0,0,0,0.8)]"
        :style="width ? { maxWidth: width } : { maxWidth: '640px' }"
      >
        <div v-if="title" class="flex items-center justify-between border-b border-ak-400/20 bg-ak-darker px-5 py-3">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-4 bg-ak-400 clip-chamfer"></span>
            <h2 class="text-base font-sans italic font-bold text-white uppercase tracking-widest">{{ title }}</h2>
          </div>
          <button class="font-mono text-gray-500 hover:text-ak-400 hover:scale-110 transition-all px-2" @click="emit('close')">[✕]</button>
        </div>
        <div class="p-5">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

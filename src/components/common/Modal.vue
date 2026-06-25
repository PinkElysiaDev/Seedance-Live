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
      <div class="absolute inset-0 bg-black/50" @click="emit('close')" />
      <div
        class="relative z-10 max-h-[90vh] w-full overflow-auto rounded-xl bg-white shadow-2xl"
        :style="width ? { maxWidth: width } : { maxWidth: '640px' }"
      >
        <div v-if="title" class="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 class="text-base font-medium text-gray-900">{{ title }}</h2>
          <button class="text-gray-400 hover:text-gray-600" @click="emit('close')">✕</button>
        </div>
        <div class="p-5">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

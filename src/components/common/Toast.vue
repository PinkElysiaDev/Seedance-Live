<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2">
    <div
      v-for="item in toast.items"
      :key="item.id"
      class="pointer-events-auto max-w-md rounded-lg px-4 py-2 text-sm shadow-lg"
      :class="{
        'bg-gray-800 text-white': item.type === 'info',
        'bg-red-600 text-white': item.type === 'error',
        'bg-green-600 text-white': item.type === 'success',
      }"
      @click="toast.dismiss(item.id)"
    >
      {{ item.message }}
    </div>
  </div>
</template>

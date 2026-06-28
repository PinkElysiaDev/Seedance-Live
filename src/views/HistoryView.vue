<template>
  <div class="h-full relative bg-tactical-900 overflow-hidden flex">
    <!-- Giant HISTORY Background Text -->
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
      <span class="font-sans italic font-black text-[20vw] leading-none text-elysia-400 select-none">HISTORY</span>
    </div>

    <!-- Massive thumbnails / Task list (Left) -->
    <div class="flex-1 h-full p-8 overflow-y-auto z-10 relative">
      <TaskList />
    </div>

    <!-- Giant filtering buttons (Right) -->
    <div class="w-64 h-full border-l border-elysia-400/20 bg-tactical-800/80 p-6 flex flex-col gap-4 z-10 relative">
      <div class="font-sans italic font-bold text-elysia-400 text-xl mb-4 uppercase drop-shadow-[0_0_8px_rgba(255,135,178,0.5)]">
        FILTER_LOGS //
      </div>
      <button class="w-full bg-elysia-400/20 border border-elysia-400 text-elysia-100 font-sans italic font-bold py-4 text-left px-4 clip-chamfer hover:bg-elysia-400/30 transition-colors shadow-[0_0_10px_rgba(255,135,178,0.2)]">
        > ALL_TASKS
      </button>
      <button class="w-full bg-tactical-800 border border-tactical-700 text-gray-500 font-sans italic font-bold py-4 text-left px-4 clip-chamfer hover:border-elysia-400/50 hover:text-elysia-300 transition-colors">
        > SUCCESSFUL
      </button>
      <button class="w-full bg-tactical-800 border border-tactical-700 text-gray-500 font-sans italic font-bold py-4 text-left px-4 clip-chamfer hover:border-red-500/50 hover:text-red-400 transition-colors">
        > FAILED
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import TaskList from '@/components/Gallery/TaskList.vue'
</script>
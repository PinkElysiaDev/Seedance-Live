<template>
  <div class="h-full relative flex flex-col bg-tactical-900 overflow-hidden">
    <!-- Hacker console background -->
    <div class="absolute inset-0 bg-sakura-pattern opacity-10 pointer-events-none"></div>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-tactical-900/50 to-tactical-900 pointer-events-none z-0"></div>
    
    <div class="relative z-10 flex flex-col h-full p-4 md:p-6 gap-4">
      <div class="flex items-end justify-between border-b-2 border-elysia-400/30 pb-2">
        <h1 class="text-3xl md:text-4xl font-sans italic font-black text-elysia-400 drop-shadow-[0_0_12px_rgba(255,135,178,0.6)] uppercase tracking-wider flex items-center gap-3">
          <div class="h-8 w-4 bg-elysia-500 clip-chamfer-reverse shadow-[0_0_10px_#FF5090] animate-pulse"></div>
          TERMINAL_LOGS
        </h1>
        <div class="font-mono text-xs text-elysia-400/60 hidden md:block">
          [SYS.CORE.LOG.STREAM_ACTIVE]
        </div>
      </div>
      
      <div class="flex-1 min-h-0">
        <LogPanel :show="true" @close="" class="w-full h-full" is-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LogPanel from '@/components/common/LogPanel.vue'
</script>

<template>
  <div class="h-full relative flex flex-col bg-ak-darker overflow-hidden">
    <!-- Hacker console background -->
    <div class="absolute inset-0 bg-[url('/images/0FFFD6CE6535DD94DDA65146AFFD4F1E.png')] bg-cover bg-center opacity-[0.03] pointer-events-none mix-blend-screen"></div>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-ak-darker/80 to-ak-darker pointer-events-none z-0"></div>

    <div class="relative z-10 flex flex-col h-full p-8 gap-6">
      <div class="flex items-end justify-between border-b border-gray-800 pb-4">
        <h1 class="text-3xl md:text-5xl font-sans font-black text-white uppercase tracking-widest flex items-center gap-4">
          <span class="text-ak-400 font-light">SYS</span>TERMINAL
        </h1>
        <div class="font-sans text-sm tracking-[0.2em] text-gray-500 hidden md:flex items-center gap-2">
          <div class="w-12 h-px bg-gray-700"></div>
          [SYS.CORE.LOG.STREAM]
        </div>
      </div>

      <div class="flex-1 min-h-0 border border-gray-800 bg-black/50 backdrop-blur-sm p-1">
        <!-- Assuming LogPanel internally handles its own styling, we just provide a clean dark wrapper -->
        <LogPanel :show="true" @close="" class="w-full h-full" is-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LogPanel from '@/components/common/LogPanel.vue'
</script>
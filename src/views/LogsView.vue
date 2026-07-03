<template>
  <div class="h-full relative flex flex-col bg-ak-darker overflow-hidden mx-8">
    <!-- 刻印背景 -->
    <div class="absolute inset-0 bg-[url('/images/0FFFD6CE6535DD94DDA65146AFFD4F1E.png')] bg-cover bg-center opacity-[0.04] pointer-events-none mix-blend-screen"></div>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-ak-darker/80 to-ak-darker pointer-events-none z-0"></div>

    <!-- 右侧竖排大字装饰 -->
    <div class="pointer-events-none absolute -right-6 top-1/2 -translate-y-1/2 text-[110px] leading-none font-sans font-black text-white/[0.03] uppercase tracking-tighter select-none rotate-90 origin-center z-0">
      TERMINAL
    </div>

    <div class="relative z-10 flex flex-col h-full p-8 gap-6">
      <!-- 标题栏 -->
      <div class="relative flex items-end justify-between border-b border-gray-800 pb-4">
        <!-- 角标装饰 -->
        <div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-ak-400"></div>
        <h1 class="text-3xl md:text-5xl font-sans font-black text-white uppercase tracking-widest flex items-center gap-4 ml-6">
          <span class="text-ak-400 font-light">SYS</span>TERMINAL
        </h1>
        <div class="font-sans text-sm tracking-[0.2em] text-gray-500 hidden md:flex items-center gap-2">
          <div class="w-12 h-px bg-gray-700"></div>
          [SYS.CORE.LOG.STREAM]
        </div>
      </div>

      <!-- 主面板 -->
      <div class="flex-1 min-h-0 relative">
        <!-- 面板角标 -->
        <div class="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-ak-400/60 z-20 pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-ak-400/60 z-20 pointer-events-none"></div>
        <LogPanel :show="true" class="w-full h-full" is-view />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LogPanel from '@/components/common/LogPanel.vue'
</script>

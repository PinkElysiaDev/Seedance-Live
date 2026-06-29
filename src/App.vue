<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useLogsStore } from '@/stores/logs'
import GlobalBackground from '@/components/common/GlobalBackground.vue'

const tasks = useTasksStore()
const settings = useSettingsStore()
const logs = useLogsStore()

onMounted(async () => {
  logs.setVerbose(settings.settings.verboseLogs)
  await tasks.initTasks()
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
})

watch(() => settings.settings.verboseLogs, (v) => logs.setVerbose(v))
</script>

<template>
  <!-- Full-screen background managed in style.css on body -->
  <GlobalBackground />
  <div class="h-full overflow-hidden flex flex-col z-10 relative">
    <header class="sticky top-0 z-20 w-full pt-8 pb-4">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-8">
        <!-- Logo Area -->
        <div class="flex items-center gap-4">
          <img src="/images/E2EDDC5F82A3F30CBEC89604BC9C5945.png" class="h-10 w-auto object-contain opacity-90" alt="Logo" />
          <div class="flex flex-col">
            <span class="font-sans font-black text-2xl tracking-widest text-white uppercase leading-none">
              SEEDANCE <span class="text-ak-400 font-light">LIVE</span>
            </span>
          </div>
        </div>

        <!-- Navigation Area -->
        <div class="flex items-center gap-8">
          <router-link
            to="/"
            class="group relative flex flex-col items-center justify-center font-sans font-bold text-sm tracking-[0.2em] transition-all duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>INDEX</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">首页</span>
            <!-- Active Indicator Underline -->
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-all duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/history"
            class="group relative flex flex-col items-center justify-center font-sans font-bold text-sm tracking-[0.2em] transition-all duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>ARCHIVE</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">历史</span>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-all duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/settings"
            class="group relative flex flex-col items-center justify-center font-sans font-bold text-sm tracking-[0.2em] transition-all duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>SYSTEM</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">设置</span>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-all duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/logs"
            class="group relative flex flex-col items-center justify-center font-sans font-bold text-sm tracking-[0.2em] transition-all duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>TERMINAL</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">终端</span>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-all duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-7xl mx-auto overflow-hidden relative">
      <router-view v-slot="{ Component }">
        <transition name="fly-through" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>
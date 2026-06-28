<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useLogsStore } from '@/stores/logs'

const tasks = useTasksStore()
const settings = useSettingsStore()
const logs = useLogsStore()

onMounted(async () => {
  // 同步详细日志开关
  logs.setVerbose(settings.settings.verboseLogs)
  await tasks.initTasks()
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
})

watch(() => settings.settings.verboseLogs, (v) => logs.setVerbose(v))
</script>

<template>
  <div class="min-h-full bg-tactical-900">
    <header class="sticky top-0 z-20 border-b-2 border-elysia-400 bg-tactical-900/90 backdrop-blur glass-elysia">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <div class="flex items-center gap-3">
          <!-- 水晶棱镜装饰符 -->
          <div class="h-6 w-3 bg-elysia-400 clip-chamfer-reverse shadow-[0_0_8px_#FF87B2]"></div>
          <span class="font-sans italic font-black text-2xl tracking-wider text-elysia-50 uppercase drop-shadow-[0_0_8px_rgba(255,135,178,0.6)]">
            SEEDANCE <span class="text-elysia-400">SYNC_CORE</span>
          </span>
          <!-- 爱莉希雅特征副标题 -->
          <span class="ml-4 font-mono text-[10px] text-elysia-300 border border-elysia-400/50 px-2 py-0.5 rounded-full opacity-70 hidden sm:inline-block">
            [FLAWLESS_PROTOCOL_ENGAGED]
          </span>
        </div>
        <div class="flex items-center gap-3">
          <router-link
            to="/"
            class="relative px-4 py-1.5 font-sans italic font-bold text-sm tracking-wide transition-all duration-300 bg-tactical-800 text-gray-400 border border-tactical-border clip-chamfer hover:text-elysia-100 hover:border-elysia-400 hover:bg-elysia-400/10"
            active-class="text-elysia-400 border-elysia-400 bg-elysia-400/10 shadow-[0_0_8px_rgba(255,135,178,0.3)]"
          >
            >_ WORKBENCH
          </router-link>
          <router-link
            to="/history"
            class="relative px-4 py-1.5 font-sans italic font-bold text-sm tracking-wide transition-all duration-300 bg-tactical-800 text-gray-400 border border-tactical-border clip-chamfer hover:text-elysia-100 hover:border-elysia-400 hover:bg-elysia-400/10"
            active-class="text-elysia-400 border-elysia-400 bg-elysia-400/10 shadow-[0_0_8px_rgba(255,135,178,0.3)]"
          >
            // HISTORY
          </router-link>
          <router-link
            to="/settings"
            class="px-4 py-1.5 font-sans italic font-bold text-sm tracking-wide transition-all duration-300 bg-tactical-800 text-gray-400 border border-tactical-border clip-chamfer hover:text-elysia-100 hover:border-elysia-400 hover:bg-elysia-400/10"
            active-class="text-elysia-400 border-elysia-400 bg-elysia-400/10 shadow-[0_0_8px_rgba(255,135,178,0.3)]"
          >
            SYS_CFG
          </router-link>
          <router-link
            to="/logs"
            class="relative px-4 py-1.5 font-sans italic font-bold text-sm tracking-wide transition-all duration-300 bg-tactical-800 text-gray-400 border border-tactical-border clip-chamfer hover:text-elysia-100 hover:border-elysia-400 hover:bg-elysia-400/10"
            active-class="text-elysia-400 border-elysia-400 bg-elysia-400/10 shadow-[0_0_8px_rgba(255,135,178,0.3)]"
          >
            [ LOGS ]
          </router-link>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl h-[calc(100vh-64px)] overflow-hidden">
      <router-view v-slot="{ Component }">
        <transition name="fly-through" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

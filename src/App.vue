<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import Composer from '@/components/Composer/Composer.vue'
import TaskList from '@/components/Gallery/TaskList.vue'
import SettingsDialog from '@/components/Settings/SettingsDialog.vue'
import LogPanel from '@/components/common/LogPanel.vue'
import Toast from '@/components/common/Toast.vue'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useLogsStore } from '@/stores/logs'

const tasks = useTasksStore()
const settings = useSettingsStore()
const logs = useLogsStore()
const showSettings = ref(false)
const showLogs = ref(false)

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
  <div class="min-h-full bg-gray-50">
    <header class="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-gray-900">Seedance Live</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="relative rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            @click="showLogs = true"
          >
            📋 调试日志
          </button>
          <button
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            @click="showSettings = true"
          >
            ⚙ 设置
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl space-y-4 px-4 py-4">
      <Composer />
      <TaskList />
    </main>

    <SettingsDialog :show="showSettings" @close="showSettings = false" />
    <LogPanel :show="showLogs" @close="showLogs = false" />
    <Toast />
  </div>
</template>

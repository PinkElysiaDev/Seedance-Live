<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useLogsStore } from '@/stores/logs'
import { useComposerStore } from '@/stores/composer'
import GlobalBackground from '@/components/common/GlobalBackground.vue'
import Toast from '@/components/common/Toast.vue'

const tasks = useTasksStore()
const settings = useSettingsStore()
const logs = useLogsStore()
const composer = useComposerStore()
const route = useRoute()

// 布局用的首页标志：与路由解耦，仅在路由过渡"空档"（旧页已离场、新页未可见）切换。
// 避免 out-in 过渡期间 isHome 立即翻转导致 main 高度突变、旧页"放大再消失"。
const layoutIsHome = ref(route.path === '/')
function syncLayoutToRoute() {
  layoutIsHome.value = route.path === '/'
}

onMounted(async () => {
  logs.setVerbose(settings.settings.verboseLogs)
  // 并发：水合编辑器素材（刷新后恢复）+ 恢复未完成任务轮询
  await Promise.all([composer.initAssets(), tasks.initTasks()])
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
})

watch(() => settings.settings.verboseLogs, (v) => logs.setVerbose(v))
</script>

<template>
  <Toast />
  <!-- Full-screen background managed in style.css on body -->
  <GlobalBackground />
  <div class="h-full overflow-hidden flex flex-col z-10 relative">
    <header
      class="z-20 w-full pt-8 pb-4"
      :class="layoutIsHome ? 'absolute top-0 left-0' : 'sticky top-0'"
    >
      <div class="mx-auto flex max-w-7xl items-center justify-between px-8">
        <!-- Logo Area：所有页面常驻显示，位置不动 -->
        <div class="flex items-center gap-4 opacity-90">
          <img src="/images/E2EDDC5F82A3F30CBEC89604BC9C5945.png" class="logo-glow h-10 w-auto object-contain" alt="Logo" />
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
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>INDEX</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">首页</span>
            <!-- Active Indicator Underline -->
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/history"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>ARCHIVE</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">历史</span>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/settings"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>SYSTEM</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">设置</span>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/logs"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>TERMINAL</span>
            <span class="text-[10px] text-gray-500 font-normal mt-0.5 group-hover:text-ak-400">终端</span>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-ak-400 transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-7xl mx-auto overflow-hidden relative">
      <router-view v-slot="{ Component }">
        <transition
          name="fly-through"
          mode="out-in"
          @after-leave="syncLayoutToRoute"
          @before-enter="syncLayoutToRoute"
        >
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>
<script setup lang="ts">
import { onMounted, watch, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useLogsStore } from '@/stores/logs'
import { useComposerStore } from '@/stores/composer'
import { useI18nStore } from '@/stores/i18n'
import GlobalBackground from '@/components/common/GlobalBackground.vue'
import Toast from '@/components/common/Toast.vue'

const tasks = useTasksStore()
const settings = useSettingsStore()
const logs = useLogsStore()
const composer = useComposerStore()
// locale 必须经 storeToRefs 解构才能保持响应式：直接解构会拿到快照值，
// 导致语言切换键自身的文案不随点击刷新（item 1）。t/toggleLocale 是函数，可直接解构。
const i18n = useI18nStore()
const { locale } = storeToRefs(i18n)
const { t, toggleLocale } = i18n
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
        <!-- Logo Area：所有页面常驻显示，位置不动；语言切换紧贴标题右侧 -->
        <div class="flex items-center gap-4 opacity-90">
          <img src="/images/E2EDDC5F82A3F30CBEC89604BC9C5945.png" class="logo-glow h-10 w-auto object-contain" alt="Logo" />
          <span class="font-sans font-black text-2xl tracking-widest text-white uppercase leading-none">
            SEEDANCE <span class="text-ak-400 font-light">LIVE</span>
          </span>
          <!-- 语言切换：仅切换实用性文本，显示为方括号修饰风格，例如 [ 中 ] / [ EN ] -->
          <button
            class="ml-4 font-mono text-xs tracking-wider text-gray-500 hover:text-ak-400 transition-colors duration-300 translate-y-[2px]"
            :title="t('lang.toggle')"
            @click="toggleLocale"
          >
            [ {{ locale === 'zh' ? '中' : 'EN' }} ]
          </button>
        </div>

        <!-- Navigation Area -->
        <div class="flex items-center gap-8">
          <router-link
            to="/"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-gray-400 hover:text-white uppercase"
            active-class="!text-white"
          >
            <span>INDEX</span>
            <!-- 导航副标题为装饰性中文，与英文主标题构成双语标签，不随语言切换（item 2） -->
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
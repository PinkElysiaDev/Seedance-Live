<script setup lang="ts">
import { onMounted, watch, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useLogsStore } from '@/stores/logs'
import { useComposerStore } from '@/stores/composer'
import { useI18nStore } from '@/stores/i18n'
import { useThemeStore } from '@/stores/theme'
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
const theme = useThemeStore()
const route = useRoute()

// 布局用的首页标志：与路由解耦，仅在路由过渡"空档"（旧页已离场、新页未可见）切换。
// 避免 out-in 过渡期间 isHome 立即翻转导致 main 高度突变、旧页"放大再消失"。
const layoutIsHome = ref(route.path === '/')
function syncLayoutToRoute() {
  layoutIsHome.value = route.path === '/'
}

// ===== 主题切换动效 =====
const shockwave = ref(false)
const soak = ref(false)
const flash = ref(false)
const logoCharging = ref(false)
let effectTimer: number | undefined
const accentColor = computed(() => theme.accentColor)
const isLight = computed(() => theme.isLight)

function playThemeTransition() {
  if (!theme.transition) return
  // 清理上一次未完成的计时
  if (effectTimer) window.clearTimeout(effectTimer)
  // Logo 充能
  logoCharging.value = true
  // 冲击波 + 能量浸染
  shockwave.value = true
  soak.value = true
  // 浅色主题切换时叠加白光闪现，掩盖黑→白切换的突兀感
  if (isLight.value) flash.value = true
  effectTimer = window.setTimeout(() => {
    shockwave.value = false
    soak.value = false
    flash.value = false
    logoCharging.value = false
    effectTimer = undefined
  }, 800)
}

function onLogoClick() {
  theme.cycleTheme()
  playThemeTransition()
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
        <!-- Logo Area：点击 Logo 切换主题；白粉主题下 logo 为爱莉西雅刻印 -->
        <div class="flex items-center gap-4 opacity-90">
          <img
            :src="`/images/${theme.logoFile}`"
            class="logo-glow h-10 w-auto object-contain cursor-pointer transition-transform"
            :class="{ 'logo-charging': logoCharging }"
            :alt="t('theme.cycleTooltip')"
            :title="t('theme.cycleTooltip')"
            @click="onLogoClick"
          />
          <span class="font-sans font-black text-2xl tracking-widest text-th-text-primary uppercase leading-none">
            SEEDANCE <span class="text-th-accent font-light">LIVE</span>
          </span>
          <!-- 语言切换：仅切换实用性文本，显示为方括号修饰风格，例如 [ 中 ] / [ EN ] -->
          <button
            class="ml-4 font-mono text-xs tracking-wider text-th-text-muted hover:text-th-accent transition-colors duration-300 translate-y-[2px]"
            :title="t('lang.toggle')"
            @click="toggleLocale"
          >
            [ {{ locale === 'zh' ? '中' : 'EN' }} ]
          </button>
        </div>

        <!-- Navigation Area -->
        <div class="flex items-center gap-8 -translate-y-2">
          <router-link
            to="/"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-th-text-secondary hover:text-th-text-primary uppercase"
            active-class="!text-th-text-primary"
          >
            <span>{{ t('nav.index') }}</span>
            <!-- Active Indicator Underline -->
            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-th-accent transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/history"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-th-text-secondary hover:text-th-text-primary uppercase"
            active-class="!text-th-text-primary"
          >
            <span>{{ t('nav.archive') }}</span>
            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-th-accent transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/settings"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-th-text-secondary hover:text-th-text-primary uppercase"
            active-class="!text-th-text-primary"
          >
            <span>{{ t('nav.system') }}</span>
            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-th-accent transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
          </router-link>

          <router-link
            to="/logs"
            class="group relative flex flex-col items-center justify-center w-28 font-sans font-bold text-sm tracking-[0.2em] transition-colors duration-300 text-th-text-secondary hover:text-th-text-primary uppercase"
            active-class="!text-th-text-primary"
          >
            <span>{{ t('nav.terminal') }}</span>
            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 h-0.5 w-0 bg-th-accent transition-[width] duration-300 group-[.router-link-exact-active]:w-full"></div>
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

  <!-- 主题切换仪式动效 overlay -->
  <Teleport to="body">
    <!-- 能量浸染蒙版（主题色极淡） -->
    <div
      v-if="soak"
      class="theme-soak-overlay fixed inset-0 pointer-events-none z-[100]"
      :style="{ backgroundColor: accentColor }"
    ></div>
    <!-- 浅色主题白光闪现 -->
    <div
      v-if="flash"
      class="theme-flash-overlay fixed inset-0 pointer-events-none z-[101] bg-white"
    ></div>
    <!-- 冲击波环 -->
    <div
      v-if="shockwave"
      class="fixed inset-0 pointer-events-none z-[102] flex items-center justify-center"
    >
      <div
        class="theme-shockwave-ring"
        :style="{ '--th-accent': accentColor, '--th-accent-glow': accentColor }"
      ></div>
    </div>
  </Teleport>
</template>

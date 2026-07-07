<template>
  <div class="h-full flex overflow-hidden w-full relative">
    <!-- Split Screen Layout -->

    <!-- Left Side: Controls 贯穿式条幅（普通 flex 子项，位于 main 居中区域左侧 = 中间偏左，高度贯通） -->
    <div class="w-[450px] flex-shrink-0 h-full flex flex-col bg-ak-dark/95 backdrop-blur-md border-r border-gray-800 p-8 overflow-y-auto hide-scrollbar z-10 shadow-[10px_0_30px_rgba(0,0,0,0.85)] transition-shadow duration-500 ease-out hover:shadow-[14px_0_40px_rgba(0,0,0,0.9)]">

      <!-- 顶部留白：让出 header 浮层 brand 高度，标题统一由 App.vue header 显示 -->
      <div class="h-[72px] flex-shrink-0"></div>

      <!-- Top: Provider Selector Dropdown -->
      <div class="provider-dropdown-root mb-8 border-b border-gray-700 pb-4 relative">
        <div class="font-sans font-bold text-gray-500 tracking-widest text-xs mb-1 uppercase">{{ t('wb.currentProvider') }}</div>
        <div
          class="flex items-center justify-between group cursor-pointer hover:text-ak-400 transition-colors"
          @click="isProviderOpen = !isProviderOpen"
        >
          <span class="font-sans font-black text-white text-xl tracking-wider group-hover:text-ak-400 transition-colors uppercase truncate">
            <template v-if="activeProfile">{{ activeProfile.name }}</template>
            <template v-else>{{ noProvider ? 'NO_PROVIDER' : '' }}</template>
            // <span class="font-mono font-normal text-xs text-gray-500 group-hover:text-ak-400/80 transition-colors normal-case tracking-normal">{{ modelLabel }}</span>
          </span>
          <span class="font-mono text-gray-500 transition-transform" :class="{ 'rotate-180': isProviderOpen }">▼</span>
        </div>

        <!-- 渠道商切换下拉 -->
        <div
          v-if="isProviderOpen"
          class="absolute left-0 right-0 top-full mt-2 z-30 bg-ak-dark border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
        >
          <div class="px-4 py-2 font-sans font-bold text-gray-500 tracking-widest text-[10px] uppercase border-b border-gray-800">
            {{ t('wb.selectProvider') }}
          </div>
          <button
            v-for="p in settings.settings.profiles"
            :key="p.id"
            class="group relative flex items-center justify-between w-full text-left px-4 py-3 transition-colors"
            :class="p.id === activeProfile?.id ? 'bg-ak-400/10 text-ak-400' : 'text-gray-300 hover:bg-ak-gray hover:text-white'"
            @click="selectProvider(p.id)"
          >
            <span class="flex flex-col min-w-0">
              <span class="font-sans font-bold text-sm tracking-wider uppercase truncate">{{ p.name }}</span>
              <span class="font-mono text-[10px] text-gray-500 truncate">{{ p.kind === 'seedance' ? 'SEEDANCE' : 'CUSTOM' }} · {{ p.baseUrl || '—' }}</span>
            </span>
            <span v-if="p.id === activeProfile?.id" class="font-mono text-ak-400 ml-2">●</span>
          </button>
          <div v-if="!settings.settings.profiles.length" class="px-4 py-3 text-gray-600 font-mono text-xs">{{ t('wb.noProvidersConfigured') }}</div>
          <router-link
            to="/settings"
            class="block px-4 py-3 border-t border-gray-800 font-sans font-bold text-[10px] tracking-widest uppercase text-gray-400 hover:text-ak-400 transition-colors"
            @click="isProviderOpen = false"
          >
            + {{ t('wb.configureProviders') }}
          </router-link>
        </div>
      </div>

      <!-- Core Composer -->
      <Composer />

      <!-- Mode Toggles and Params are grouped here -->
      <div class="mt-8 space-y-6">

        <div class="flex flex-col gap-2">
           <div class="font-sans font-bold text-gray-500 tracking-widest text-xs uppercase">{{ t('wb.renderMode') }}</div>
           <div class="flex bg-ak-gray p-1 w-full gap-1">
             <button
               class="flex-1 py-2 font-sans font-bold text-xs tracking-wider transition-colors"
               :class="activeMode === 'REF_MODE' ? 'bg-ak-400 text-ak-darker' : 'text-gray-400 hover:text-white'"
               @click="composer.setActiveMode('REF_MODE')"
             >
               {{ t('wb.modeReference') }}
             </button>
             <button
               class="flex-1 py-2 font-sans font-bold text-xs tracking-wider transition-colors"
               :class="activeMode === 'KEYFRAME_MODE' ? 'bg-ak-400 text-ak-darker' : 'text-gray-400 hover:text-white'"
               @click="composer.setActiveMode('KEYFRAME_MODE')"
             >
               {{ t('wb.modeKeyframe') }}
             </button>
           </div>
        </div>

        <ParamPanel />
      </div>
    </div>

    <!-- Right Side: Preview & Assets -->
    <div class="flex-1 h-full relative flex flex-col items-center justify-center p-8 z-0 overflow-y-auto">

      <div class="relative z-10 w-full max-w-4xl flex flex-col gap-6 items-center">
        <!-- Asset Slots dynamically placed around preview based on mode -->
        <AssetSlots v-if="activeMode === 'REF_MODE'" :mode="activeMode" class="w-full max-w-2xl" />

        <!-- First Frame for Keyframe Mode -->
        <AssetSlots v-if="activeMode === 'KEYFRAME_MODE'" :mode="'KEYFRAME_MODE'" class="w-full max-w-2xl" />

        <!-- Center Preview Box -->
        <div class="w-full aspect-video border border-gray-600 relative group overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
          <!-- Decorative corners -->
          <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-ak-400 z-20"></div>
          <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-ak-400 z-20"></div>

          <!-- Idle State Summary Content -->
          <div v-if="!isRunning" class="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 p-8">
            <div class="w-16 h-1 bg-ak-400 mb-6"></div>
            <h2 class="font-sans font-black text-4xl text-white tracking-widest uppercase mb-4 text-center drop-shadow-md">
              {{ t('wb.waitingForData') }}
            </h2>
            <div class="flex gap-4 font-mono text-sm text-gray-400">
              <span class="bg-ak-gray px-2 py-1">{{ t('wb.mode') }}: {{ modeLabel }}</span>
              <span class="bg-ak-gray px-2 py-1">{{ t('wb.ratio') }}: {{ composer.params.ratio }}</span>
              <span class="bg-ak-gray px-2 py-1">{{ t('wb.res') }}: {{ composer.params.resolution }}</span>
              <span class="bg-ak-gray px-2 py-1">{{ t('wb.duration') }}: {{ composer.params.duration }}s</span>
            </div>

            <!-- 按需展示：仅当用户配置了对应项才出现 -->
            <div v-if="hasOptionalParams" class="mt-3 flex flex-wrap gap-4 font-mono text-sm text-gray-400 justify-center">
              <span v-if="composer.params.generateAudio" class="bg-ak-gray px-2 py-1">{{ t('wb.audioGen') }}</span>
              <span v-if="composer.params.returnLastFrame" class="bg-ak-gray px-2 py-1">{{ t('wb.lastFrame') }}</span>
              <span v-if="composer.params.watermark" class="bg-ak-gray px-2 py-1">{{ t('wb.watermark') }}</span>
              <span v-if="composer.params.seed != null" class="bg-ak-gray px-2 py-1">{{ t('wb.randSeed') }}: {{ composer.params.seed }}</span>
            </div>

            <div class="absolute bottom-6 left-6 font-sans text-xs text-gray-600 tracking-widest">
              [[ System Standby ]]
            </div>
          </div>

          <!-- Running State -->
          <div v-if="isRunning" class="absolute inset-0 flex flex-col items-center justify-center animate-[fade-in_1s_ease-out]">
            <div class="relative w-32 h-32 flex items-center justify-center mb-6">
              <!-- Animated rings -->
              <div class="absolute inset-0 border-2 border-ak-400 rounded-full animate-ping opacity-20"></div>
              <div class="absolute inset-4 border border-ak-400 rounded-full border-t-transparent animate-spin"></div>
              <div class="font-sans font-black text-ak-400 text-xl tracking-widest">PROG</div>
            </div>
            <div class="font-mono text-white tracking-widest text-sm">{{ t('wb.synchronizingCore') }}</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import Composer from '@/components/Composer/Composer.vue'
import AssetSlots from '@/components/Composer/AssetSlots.vue'
import ParamPanel from '@/components/Composer/ParamPanel.vue'
import { useComposerStore } from '@/stores/composer'
import { storeToRefs } from 'pinia'
import { useTasksStore } from '@/stores/tasks'
import { useSettingsStore } from '@/stores/settings'
import { useI18nStore } from '@/stores/i18n'
import { MODEL_META } from '@/config/models'
import type { SeedanceModel } from '@/types'

const composer = useComposerStore()
const tasksStore = useTasksStore()
const settings = useSettingsStore()
const { t } = useI18nStore()

// 渲染模式持久化在 composer store，跨页面保留；用 storeToRefs 保持响应式
const { activeMode } = storeToRefs(composer)

const isRunning = computed(() => tasksStore.tasks.some(t => t.status === 'running'))

// 渲染模式显示名（内部值 REF_MODE/KEYFRAME_MODE → 本地化文案）
const modeLabel = computed(() =>
  activeMode.value === 'KEYFRAME_MODE' ? t('wb.modeKeyframe') : t('wb.modeReference'),
)
const noProvider = computed(() => activeProfile.value == null)

// 当前渠道商与切换
const activeProfile = computed(() => settings.activeProfile)
// 当前配置的模型名称：优先 profile.model 覆盖，否则取 composer 选中的模型
const modelLabel = computed(() => {
  const override = activeProfile.value?.model
  if (override && override in MODEL_META) return MODEL_META[override as SeedanceModel].label
  if (override) return override
  return MODEL_META[composer.params.model]?.label ?? composer.params.model
})
const isProviderOpen = ref(false)

// 是否存在按需展示的可选配置（开关开启或 seed 已设）
const hasOptionalParams = computed(() =>
  composer.params.generateAudio ||
  composer.params.returnLastFrame ||
  composer.params.watermark ||
  composer.params.seed != null,
)

function selectProvider(id: string) {
  settings.setActiveProfile(id)
  isProviderOpen.value = false
}

// 点击下拉外部关闭
function onDocClick(e: MouseEvent) {
  if (!isProviderOpen.value) return
  const target = e.target as HTMLElement | null
  if (target && !target.closest('.provider-dropdown-root')) {
    isProviderOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; filter: blur(10px); }
  to { opacity: 1; filter: blur(0); }
}
</style>
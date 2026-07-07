<script setup lang="ts">
import { computed } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useSettingsStore } from '@/stores/settings'
import { resolutionsForModel, ratiosForModel } from '@/config/models'
import { DURATION_MIN, DURATION_MAX } from '@/config/options'
import type { VideoRatio, VideoResolution } from '@/types'

const composer = useComposerStore()
const settings = useSettingsStore()

const isCustom = computed(() => settings.activeProfile?.kind === 'custom')

const ALL_RATIOS: VideoRatio[] = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive']
const ALL_RESOLUTIONS: VideoResolution[] = ['480p', '720p', '1080p', '4K']

const resolutions = computed(() => (isCustom.value ? ALL_RESOLUTIONS : resolutionsForModel(composer.params.model)))
const ratios = computed(() => (isCustom.value ? ALL_RATIOS : ratiosForModel(composer.params.model)))

function randomizeSeed() {
  composer.patchParams({ seed: Math.floor(Math.random() * 1_000_000) })
}
function clearSeed() {
  composer.patchParams({ seed: undefined })
}
function stepSeed(delta: number) {
  const cur = composer.params.seed ?? 0
  const next = Math.max(0, cur + delta)
  composer.patchParams({ seed: next })
}
</script>

<template>
  <div class="flex flex-col gap-6 w-full">

    <!-- Row 1: Core Parameters Inline -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">

      <!-- Video Ratio -->
      <div class="flex flex-col">
        <div class="text-[10px] font-sans font-bold tracking-widest text-gray-500 mb-2 uppercase">ASPECT_RATIO</div>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="r in ratios"
            :key="r"
            class="font-mono text-xs px-3 py-1 transition-colors border border-transparent"
            :class="composer.params.ratio === r ? 'bg-ak-400 text-ak-darker font-bold' : 'bg-ak-gray text-gray-400 hover:text-white hover:border-ak-400/50'"
            @click="composer.patchParams({ ratio: r })"
          >
            {{ r }}
          </button>
        </div>
      </div>

      <!-- Video Resolution -->
      <div class="flex flex-col">
        <div class="text-[10px] font-sans font-bold tracking-widest text-gray-500 mb-2 uppercase">RESOLUTION</div>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="r in resolutions"
            :key="r"
            class="font-mono text-xs px-3 py-1 transition-colors border border-transparent"
            :class="composer.params.resolution === r ? 'bg-ak-400 text-ak-darker font-bold' : 'bg-ak-gray text-gray-400 hover:text-white hover:border-ak-400/50'"
            @click="composer.patchParams({ resolution: r })"
          >
            {{ r }}
          </button>
        </div>
      </div>

    </div>

    <!-- Duration Slider -->
    <div class="w-full">
      <div class="flex justify-between items-end mb-2">
        <span class="text-[10px] font-sans font-bold tracking-widest text-gray-500 uppercase">DURATION</span>
        <span class="text-xs font-mono text-ak-400 font-bold">{{ composer.params.duration }}s</span>
      </div>
      <input
        type="range"
        :min="DURATION_MIN"
        :max="DURATION_MAX"
        :value="composer.params.duration"
        class="w-full accent-ak-400 h-1 bg-gray-700 appearance-none outline-none cursor-pointer"
        @input="composer.patchParams({ duration: Number(($event.target as HTMLInputElement).value) })"
      />
    </div>

    <!-- Row 2: Switches and Seed -->
    <div class="flex flex-col gap-4 w-full border-t border-gray-800 pt-6">

      <!-- Switches: 三个开关同一行 -->
      <div class="grid grid-cols-3 gap-4 w-full">

        <!-- Audio Gen -->
        <button
          class="flex flex-col items-start gap-2 group"
          @click="composer.patchParams({ generateAudio: !composer.params.generateAudio })"
        >
          <div class="w-full h-1 bg-gray-800 relative overflow-hidden">
            <div class="absolute top-0 left-0 h-full bg-ak-400 transition-[width] duration-300" :class="composer.params.generateAudio ? 'w-full' : 'w-0'"></div>
          </div>
          <span class="font-sans font-bold text-xs tracking-wider uppercase transition-colors" :class="composer.params.generateAudio ? 'text-ak-400' : 'text-gray-500 group-hover:text-white'">AUDIO_GEN</span>
        </button>

        <!-- Return Last Frame -->
        <button
          class="flex flex-col items-start gap-2 group"
          @click="composer.patchParams({ returnLastFrame: !composer.params.returnLastFrame })"
        >
          <div class="w-full h-1 bg-gray-800 relative overflow-hidden">
            <div class="absolute top-0 left-0 h-full bg-ak-400 transition-[width] duration-300" :class="composer.params.returnLastFrame ? 'w-full' : 'w-0'"></div>
          </div>
          <span class="font-sans font-bold text-xs tracking-wider uppercase transition-colors" :class="composer.params.returnLastFrame ? 'text-ak-400' : 'text-gray-500 group-hover:text-white'">LAST_FRAME</span>
        </button>

        <!-- Watermark -->
        <button
          class="flex flex-col items-start gap-2 group"
          @click="composer.patchParams({ watermark: !composer.params.watermark })"
        >
          <div class="w-full h-1 bg-gray-800 relative overflow-hidden">
            <div class="absolute top-0 left-0 h-full bg-ak-400 transition-[width] duration-300" :class="composer.params.watermark ? 'w-full' : 'w-0'"></div>
          </div>
          <span class="font-sans font-bold text-xs tracking-wider uppercase transition-colors" :class="composer.params.watermark ? 'text-ak-400' : 'text-gray-500 group-hover:text-white'">WATERMARK</span>
        </button>
      </div>

      <!-- Seed Input: 单独占据一行 -->
      <div class="flex flex-col gap-2 w-full">
        <div class="w-full h-1 bg-gray-800 relative overflow-hidden">
          <div class="absolute top-0 left-0 h-full bg-ak-400 transition-[width] duration-300" :class="composer.params.seed != null ? 'w-full' : 'w-0'"></div>
        </div>
        <div class="flex items-center w-full gap-1 border-b border-gray-700 focus-within:border-ak-400 transition-colors">
          <input
            type="number"
            :value="composer.params.seed ?? ''"
            placeholder="RAND_SEED"
            class="no-spin flex-1 min-w-0 bg-transparent text-white font-mono text-xs py-1 outline-none placeholder-gray-600 transition-colors"
            @input="composer.patchParams({ seed: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
          />
          <!-- 自定义上下步进按钮 -->
          <div class="flex flex-col flex-shrink-0">
            <button class="text-gray-500 hover:text-ak-400 transition-colors leading-none px-1" @click="stepSeed(1)" title="INCREMENT" aria-label="increment">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button class="text-gray-500 hover:text-ak-400 transition-colors leading-none px-1" @click="stepSeed(-1)" title="DECREMENT" aria-label="decrement">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <!-- 骰子（随机种子）：明日方舟风格 SVG -->
          <button class="text-gray-500 hover:text-ak-400 transition-colors px-1 flex items-center" @click="randomizeSeed" title="GENERATE_RANDOM" aria-label="random">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke-width="2" />
              <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="16" cy="8" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="8" cy="16" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="16" cy="16" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button v-if="composer.params.seed != null" class="text-gray-500 hover:text-red-500 transition-colors px-1 flex items-center" @click="clearSeed" title="CLEAR" aria-label="clear">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
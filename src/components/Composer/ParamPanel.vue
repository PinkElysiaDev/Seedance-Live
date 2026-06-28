<script setup lang="ts">
import { computed } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useSettingsStore } from '@/stores/settings'
import { MODEL_LIST, resolutionsForModel, ratiosForModel } from '@/config/models'
import { DURATION_MIN, DURATION_MAX } from '@/config/options'
import type { VideoRatio, VideoResolution } from '@/types'

const composer = useComposerStore()
const settings = useSettingsStore()

// 自定义源：模型由 profile 决定，比例/分辨率不按模型钳制
const isCustom = computed(() => settings.activeProfile?.kind === 'custom')

const ALL_RATIOS: VideoRatio[] = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', 'adaptive']
const ALL_RESOLUTIONS: VideoResolution[] = ['480p', '720p', '1080p']

const resolutions = computed(() => (isCustom.value ? ALL_RESOLUTIONS : resolutionsForModel(composer.params.model)))
const ratios = computed(() => (isCustom.value ? ALL_RATIOS : ratiosForModel(composer.params.model)))

function randomSeed() {
  composer.patchParams({ seed: Math.floor(Math.random() * 1_000_000) })
}
function clearSeed() {
  composer.patchParams({ seed: undefined })
}
</script>

<template>
  <div class="space-y-4">
    <!-- Group 1: 核心参数 (CORE SPECS) -->
    <div class="flex flex-col gap-4 p-4 border border-gray-300 dark:border-tactical-border glass-elysia clip-chamfer-lg bg-crystal-grad">
      <div class="flex items-center justify-between border-b border-elysia-400/20 dark:border-elysia-400/20 pb-1">
        <span class="font-sans italic text-elysia-400 font-bold uppercase tracking-wider">CORE_SPECS //</span>
        <span class="w-1.5 h-1.5 bg-elysia-400 clip-chamfer shadow-[0_0_5px_#FF87B2] animate-pulse"></span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- 比例 -->
        <div>
          <div class="text-[10px] font-mono text-gray-500 mb-1">ASPECT_RATIO</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="r in ratios"
              :key="r"
              class="font-mono text-xs px-3 py-1 clip-chamfer transition-colors"
              :class="composer.params.ratio === r ? 'bg-elysia-400 text-tactical-900 font-bold shadow-[0_0_8px_rgba(255,135,178,0.4)]' : 'border border-elysia-400/30 text-gray-600 dark:text-gray-400 hover:text-elysia-600 dark:hover:text-elysia-300 hover:border-elysia-500 dark:hover:border-elysia-400/60 bg-gray-100 dark:bg-tactical-800'"
              @click="composer.patchParams({ ratio: r })"
            >
              {{ r }}
            </button>
          </div>
        </div>

        <!-- 分辨率 -->
        <div>
          <div class="text-[10px] font-mono text-gray-500 mb-1">RESOLUTION</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="r in resolutions"
              :key="r"
              class="font-mono text-xs px-3 py-1 clip-chamfer transition-colors"
              :class="composer.params.resolution === r ? 'bg-elysia-400 text-tactical-900 font-bold shadow-[0_0_8px_rgba(255,135,178,0.4)]' : 'border border-elysia-400/30 text-gray-600 dark:text-gray-400 hover:text-elysia-600 dark:hover:text-elysia-300 hover:border-elysia-500 dark:hover:border-elysia-400/60 bg-gray-100 dark:bg-tactical-800'"
              @click="composer.patchParams({ resolution: r })"
            >
              {{ r }}
            </button>
          </div>
        </div>

        <!-- 模型 (仅提示) -->
        <div v-if="isCustom">
          <div class="text-[10px] font-mono text-gray-500 mb-1">SYS_MODEL</div>
          <div class="font-mono text-xs text-elysia-400/60 p-1.5 border border-dashed border-elysia-400/30 clip-chamfer inline-block bg-gray-100/80 dark:bg-gray-200 dark:bg-tactical-900/50">
            {{ settings.activeProfile?.model || 'NO_OVERRIDE' }}
          </div>
        </div>
        <div v-else>
          <div class="text-[10px] font-mono text-gray-500 mb-1">SYS_MODEL</div>
          <select
            :value="composer.params.model"
            class="bg-gray-100 dark:bg-tactical-800 border border-elysia-400/40 text-gray-800 dark:text-gray-800 dark:text-elysia-100 font-mono text-xs px-2 py-1.5 clip-chamfer outline-none focus:border-elysia-400 focus:shadow-[0_0_5px_rgba(255,135,178,0.3)]"
            @change="composer.setModel(($event.target as HTMLSelectElement).value as never)"
          >
            <option v-for="m in MODEL_LIST" :key="m.id" :value="m.id" class="bg-white dark:bg-gray-200 dark:bg-tactical-900">{{ m.label }}</option>
          </select>
        </div>

        <!-- 时长 -->
        <div class="sm:col-span-2">
          <div class="flex justify-between items-end mb-1">
            <span class="text-[10px] font-mono text-gray-500">DURATION</span>
            <span class="text-xs font-mono text-elysia-300">{{ composer.params.duration }}s</span>
          </div>
          <input
            type="range"
            :min="DURATION_MIN"
            :max="DURATION_MAX"
            :value="composer.params.duration"
            class="w-full accent-elysia-400 h-1 bg-gray-300 dark:bg-tactical-700 appearance-none outline-none"
            @input="composer.patchParams({ duration: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </div>
    </div>

    <!-- Group 2: 辅助协议 (AUX PROTOCOLS) -->
    <div class="grid grid-cols-2 gap-3">
      <!-- 生成音频 -->
      <div
        class="flex items-center justify-between p-2.5 clip-chamfer cursor-pointer transition-colors"
        :class="composer.params.generateAudio ? 'border border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_12px_rgba(255,135,178,0.15)]' : 'border border-gray-300 dark:border-tactical-700 bg-gray-100 dark:bg-tactical-800 hover:border-elysia-400/50'"
        @click="composer.patchParams({ generateAudio: !composer.params.generateAudio })"
      >
        <span class="font-mono text-xs" :class="composer.params.generateAudio ? 'text-gray-800 dark:text-elysia-100' : 'text-gray-500'">AUDIO_GEN</span>
        <span class="w-2.5 h-2.5 clip-chamfer-reverse transition-all" :class="composer.params.generateAudio ? 'bg-elysia-400 neon-glow-pink' : 'bg-gray-200 dark:bg-tactical-900 border border-gray-600'"></span>
      </div>

      <!-- 返回末帧 -->
      <div
        class="flex items-center justify-between p-2.5 clip-chamfer cursor-pointer transition-colors"
        :class="composer.params.returnLastFrame ? 'border border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_12px_rgba(255,135,178,0.15)]' : 'border border-gray-300 dark:border-tactical-700 bg-gray-100 dark:bg-tactical-800 hover:border-elysia-400/50'"
        @click="composer.patchParams({ returnLastFrame: !composer.params.returnLastFrame })"
      >
        <span class="font-mono text-xs" :class="composer.params.returnLastFrame ? 'text-gray-800 dark:text-elysia-100' : 'text-gray-500'">RETURN_LAST_FRAME</span>
        <span class="w-2.5 h-2.5 clip-chamfer-reverse transition-all" :class="composer.params.returnLastFrame ? 'bg-elysia-400 neon-glow-pink' : 'bg-gray-200 dark:bg-tactical-900 border border-gray-600'"></span>
      </div>

      <!-- 联网搜索 -->
      <div
        class="flex items-center justify-between p-2.5 clip-chamfer cursor-pointer transition-colors"
        :class="composer.params.webSearch ? 'border border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_12px_rgba(255,135,178,0.15)]' : 'border border-gray-300 dark:border-tactical-700 bg-gray-100 dark:bg-tactical-800 hover:border-elysia-400/50'"
        @click="composer.patchParams({ webSearch: !composer.params.webSearch })"
      >
        <span class="font-mono text-xs" :class="composer.params.webSearch ? 'text-gray-800 dark:text-elysia-100' : 'text-gray-500'">WEB_SEARCH</span>
        <span class="w-2.5 h-2.5 clip-chamfer-reverse transition-all" :class="composer.params.webSearch ? 'bg-elysia-400 neon-glow-pink' : 'bg-gray-200 dark:bg-tactical-900 border border-gray-600'"></span>
      </div>

      <!-- 水印 -->
      <div
        class="flex items-center justify-between p-2.5 clip-chamfer cursor-pointer transition-colors"
        :class="composer.params.watermark ? 'border border-elysia-400 bg-elysia-400/10 shadow-[inset_0_0_12px_rgba(255,135,178,0.15)]' : 'border border-gray-300 dark:border-tactical-700 bg-gray-100 dark:bg-tactical-800 hover:border-elysia-400/50'"
        @click="composer.patchParams({ watermark: !composer.params.watermark })"
      >
        <span class="font-mono text-xs" :class="composer.params.watermark ? 'text-gray-800 dark:text-elysia-100' : 'text-gray-500'">WATERMARK</span>
        <span class="w-2.5 h-2.5 clip-chamfer-reverse transition-all" :class="composer.params.watermark ? 'bg-elysia-400 neon-glow-pink' : 'bg-gray-200 dark:bg-tactical-900 border border-gray-600'"></span>
      </div>

      <!-- Seed 独占一行 -->
      <div class="col-span-2 flex items-center gap-2 p-2 border border-gray-300 dark:border-tactical-700 bg-gray-100 dark:bg-tactical-800 clip-chamfer">
        <span class="font-mono text-[10px] text-gray-500 w-12">SEED</span>
        <input
          type="number"
          :value="composer.params.seed ?? ''"
          placeholder="[RANDOM]"
          class="flex-1 bg-gray-200 dark:bg-tactical-900 border border-tactical-700 text-gray-800 dark:text-elysia-100 font-mono text-xs px-2 py-1 clip-chamfer outline-none focus:border-elysia-400/50 placeholder-gray-400 dark:placeholder-gray-600"
          @input="composer.patchParams({ seed: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
        />
        <button class="bg-gray-200 dark:bg-tactical-900 border border-tactical-700 hover:border-elysia-400/50 hover:text-elysia-300 text-gray-500 font-mono text-xs px-3 py-1 clip-chamfer transition-colors" @click="randomSeed" title="GENERATE RANDOM">🎲</button>
        <button v-if="composer.params.seed != null" class="bg-gray-200 dark:bg-tactical-900 border border-tactical-700 hover:border-red-500/50 hover:text-red-400 text-gray-500 font-mono text-xs px-3 py-1 clip-chamfer transition-colors" @click="clearSeed" title="CLEAR">✕</button>
      </div>
    </div>
  </div>
</template>

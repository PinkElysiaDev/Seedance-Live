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
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <label v-if="!isCustom" class="flex flex-col gap-1">
      <span class="text-xs text-gray-500">模型</span>
      <select
        :value="composer.params.model"
        class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        @change="composer.setModel(($event.target as HTMLSelectElement).value as never)"
      >
        <option v-for="m in MODEL_LIST" :key="m.id" :value="m.id">{{ m.label }}</option>
      </select>
    </label>
    <div v-else class="flex flex-col gap-1">
      <span class="text-xs text-gray-500">模型</span>
      <span class="rounded-lg border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-400">{{ settings.activeProfile?.model || '（在设置中配置模型名）' }}</span>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-gray-500">比例</span>
      <select
        :value="composer.params.ratio"
        class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        @change="composer.patchParams({ ratio: ($event.target as HTMLSelectElement).value as never })"
      >
        <option v-for="r in ratios" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-gray-500">分辨率</span>
      <select
        :value="composer.params.resolution"
        class="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        @change="composer.patchParams({ resolution: ($event.target as HTMLSelectElement).value as never })"
      >
        <option v-for="r in resolutions" :key="r" :value="r">{{ r }}</option>
      </select>
    </label>

    <label class="col-span-2 flex flex-col gap-1 sm:col-span-1">
      <span class="text-xs text-gray-500">时长 {{ composer.params.duration }}s</span>
      <input
        type="range"
        :min="DURATION_MIN"
        :max="DURATION_MAX"
        :value="composer.params.duration"
        class="accent-blue-500"
        @input="composer.patchParams({ duration: Number(($event.target as HTMLInputElement).value) })"
      />
    </label>

    <label class="flex flex-col gap-1">
      <span class="text-xs text-gray-500">Seed</span>
      <div class="flex gap-1">
        <input
          type="number"
          :value="composer.params.seed ?? ''"
          placeholder="随机"
          class="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          @input="composer.patchParams({ seed: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : undefined })"
        />
        <button class="rounded-lg border border-gray-300 px-2 text-xs hover:bg-gray-50" @click="randomSeed" title="随机">🎲</button>
        <button v-if="composer.params.seed != null" class="rounded-lg border border-gray-300 px-2 text-xs hover:bg-gray-50" @click="clearSeed" title="清除">✕</button>
      </div>
    </label>

    <div class="col-span-2 flex flex-wrap items-center gap-4 sm:col-span-3">
      <label class="flex items-center gap-1.5 text-sm">
        <input type="checkbox" :checked="composer.params.generateAudio" class="accent-blue-500" @change="composer.patchParams({ generateAudio: ($event.target as HTMLInputElement).checked })" />
        生成音频
      </label>
      <label class="flex items-center gap-1.5 text-sm">
        <input type="checkbox" :checked="composer.params.returnLastFrame" class="accent-blue-500" @change="composer.patchParams({ returnLastFrame: ($event.target as HTMLInputElement).checked })" />
        返回末帧（续帧）
      </label>
      <label class="flex items-center gap-1.5 text-sm">
        <input type="checkbox" :checked="composer.params.webSearch" class="accent-blue-500" @change="composer.patchParams({ webSearch: ($event.target as HTMLInputElement).checked })" />
        联网搜索
      </label>
      <label class="flex items-center gap-1.5 text-sm">
        <input type="checkbox" :checked="composer.params.watermark" class="accent-blue-500" @change="composer.patchParams({ watermark: ($event.target as HTMLInputElement).checked })" />
        水印
      </label>
    </div>
  </div>
</template>

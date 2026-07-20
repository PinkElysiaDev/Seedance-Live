<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useI18nStore } from '@/stores/i18n'
import { SEAL_SETS, type SealSetId } from '@/config/themes'

const theme = useThemeStore()
const { t } = useI18nStore()

const SET_IDS: SealSetId[] = ['elysia', 'sigil-core', 'ember-glyphs', 'void-marks', 'all']

function labelKey(id: SealSetId): string {
  return `theme.sealSetLabel.${id}`
}

// 刻印缩略图样式：透明度与混合模式跟随主题（script 内字符串拓宽为 string，cast 合法）
const sealImgStyle = computed(() => ({
  opacity: 'var(--th-seal-opacity)',
  mixBlendMode: 'var(--th-seal-blend)' as 'multiply' | 'screen' | 'normal',
}))
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
    <button
      v-for="id in SET_IDS"
      :key="id"
      class="relative group overflow-hidden border transition-all duration-300 bg-th-bg-panel/50"
      :class="theme.sealSetId === id ? 'border-th-accent ring-1 ring-th-accent' : 'border-th-border hover:border-th-accent/50'"
      @click="theme.setSealSet(id)"
    >
      <!-- 代表刻印缩略图 -->
      <div class="h-16 flex items-center justify-center bg-th-bg-base p-2">
        <img :src="`/images/${SEAL_SETS[id][0]}`" class="h-full w-auto object-contain" :style="sealImgStyle" alt="" />
      </div>
      <!-- 名称 -->
      <div class="px-2 py-1.5 text-center">
        <div class="font-sans font-black text-[10px] tracking-widest uppercase text-th-text-primary leading-none">{{ t(labelKey(id)).split(' ')[0] }}</div>
      </div>
      <!-- 激活指示竖条 -->
      <div
        v-if="theme.sealSetId === id"
        class="absolute top-0 bottom-0 left-0 w-1 bg-th-accent"
      ></div>
    </button>
  </div>
</template>

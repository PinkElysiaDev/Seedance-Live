<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { useI18nStore } from '@/stores/i18n'
import { THEMES, type ThemeId } from '@/config/themes'

const theme = useThemeStore()
const { t } = useI18nStore()

function select(id: ThemeId) {
  theme.setTheme(id)
}

function nameKey(id: ThemeId): string {
  return `theme.${id}`
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <button
      v-for="thm in THEMES"
      :key="thm.id"
      class="relative group overflow-hidden border transition-all duration-300"
      :class="theme.themeId === thm.id ? 'border-th-accent ring-1 ring-th-accent' : 'border-th-border hover:border-th-accent/50'"
      :style="{
        backgroundColor: thm.light ? '#FAF6F8' : 'var(--th-bg-panel)',
      }"
      @click="select(thm.id)"
    >
      <!-- 主题预览色块条：强调色 + 背景 -->
      <div class="flex h-12">
        <div class="flex-1" :style="{ backgroundColor: thm.light ? '#FFFFFF' : '#111111' }"></div>
        <div class="flex-1" :style="{ backgroundColor: thm.accent }"></div>
        <div class="flex-1" :style="{ backgroundColor: thm.light ? '#F3EAEE' : '#1a1a1a' }"></div>
      </div>
      <!-- 名称 -->
      <div class="px-3 py-2 text-left" :style="{ color: thm.light ? '#2A1620' : 'var(--th-text-primary)' }">
        <div class="font-sans font-black text-[11px] tracking-widest uppercase leading-none">{{ thm.nameEn }}</div>
        <div class="font-sans text-[10px] tracking-wider mt-1" :style="{ color: thm.light ? '#7A5A6A' : 'var(--th-text-muted)' }">{{ t(nameKey(thm.id)) }}</div>
      </div>
      <!-- 激活指示竖条 -->
      <div
        v-if="theme.themeId === thm.id"
        class="absolute top-0 bottom-0 left-0 w-1"
        :style="{ backgroundColor: thm.accent }"
      ></div>
      <!-- 角标 -->
      <div class="absolute top-0 right-0 w-2 h-2" :style="{ backgroundColor: thm.accent }"></div>
    </button>
  </div>
</template>

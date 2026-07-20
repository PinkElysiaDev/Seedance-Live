<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useI18nStore } from '@/stores/i18n'
import { PROMPT_MAX, PROMPT_SUGGEST } from '@/config/options'

const composer = useComposerStore()
const { t } = useI18nStore()
const count = computed(() => composer.prompt.length)
const isOverSuggest = computed(() => count.value > PROMPT_SUGGEST)

const textareaRef = ref<HTMLTextAreaElement>()

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

function onInput(e: Event) {
  composer.setPrompt((e.target as HTMLTextAreaElement).value)
  autoResize()
}

onMounted(() => {
  nextTick(autoResize)
})
</script>

<template>
  <div class="relative w-full border-b-2 border-th-bg-base focus-within:border-th-accent transition-colors duration-300 group" :style="{ backgroundColor: 'color-mix(in srgb, var(--th-bg-panel) 50%, transparent)' }">
    <!-- Top-left tag -->
    <div class="absolute top-0 left-0 bg-th-accent text-th-on-accent font-sans font-bold text-[10px] px-2 py-0.5 flex items-center gap-1 z-10 tracking-widest">
      <div class="w-1.5 h-1.5 bg-th-on-accent"></div>
      {{ t('composer.promptInput') }}
    </div>

    <textarea
      ref="textareaRef"
      :value="composer.prompt"
      @input="onInput"
      :placeholder="t('composer.describeScene')"
      rows="3"
      class="w-full bg-transparent mt-6 p-4 text-th-text-primary font-sans text-sm outline-none resize-none placeholder-th-text-muted tracking-wider"
      style="min-height: 4.5rem; overflow-y: hidden;"
    />

    <div
      class="absolute bottom-2 right-2 font-mono text-[10px] transition-colors px-1 py-0.5"
      :style="{ backgroundColor: 'color-mix(in srgb, var(--th-bg-base) 80%, transparent)' }"
      :class="isOverSuggest ? 'text-th-error animate-pulse' : 'text-th-text-muted group-focus-within:text-th-accent'"
    >
      [ {{ count }} / {{ PROMPT_MAX }} ]
    </div>
  </div>
</template>

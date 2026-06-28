<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { PROMPT_MAX, PROMPT_SUGGEST } from '@/config/options'

const composer = useComposerStore()
const count = computed(() => composer.prompt.length)
const overSuggest = computed(() => count.value > PROMPT_SUGGEST)

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
  <div class="relative w-full clip-chamfer glass-elysia p-1 neon-glow-pink-focus transition-all duration-300 group">
    <!-- 左上角标识码 -->
    <div class="absolute top-0 left-0 bg-elysia-400 text-tactical-900 font-mono text-[10px] px-2 py-0.5 clip-chamfer-reverse font-bold flex items-center gap-1 z-10">
      <svg class="w-2 h-2" viewBox="0 0 10 10" fill="currentColor"><path d="M5 0L10 5L5 10L0 5Z"/></svg>
      ELY_DIRECTIVE
    </div>

    <textarea
      ref="textareaRef"
      :value="composer.prompt"
      @input="onInput"
      placeholder=">_ 嗨♪ 把你的奇思妙想告诉我吧..."
      rows="3"
      class="w-full bg-gray-100 dark:bg-tactical-800 mt-5 p-3 text-gray-800 dark:text-elysia-50 font-mono outline-none resize-none placeholder-elysia-400/40 clip-chamfer"
      style="min-height: 4.5rem; overflow-y: hidden;"
    />

    <div
      class="absolute bottom-2 right-3 font-mono text-xs transition-colors"
      :class="overSuggest ? 'text-red-400 animate-pulse' : 'text-elysia-400 group-hover:text-elysia-300'"
    >
      [ CHAR: {{ count }} / {{ PROMPT_MAX }} ]
    </div>
  </div>
</template>

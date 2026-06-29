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
  <div class="relative w-full border-b-2 border-ak-darker focus-within:border-ak-400 transition-colors duration-300 group bg-ak-dark/50">
    <!-- Top-left tag -->
    <div class="absolute top-0 left-0 bg-ak-400 text-ak-darker font-sans font-bold text-[10px] px-2 py-0.5 flex items-center gap-1 z-10 tracking-widest">
      <div class="w-1.5 h-1.5 bg-ak-darker"></div>
      PROMPT_INPUT
    </div>

    <textarea
      ref="textareaRef"
      :value="composer.prompt"
      @input="onInput"
      placeholder="DESCRIBE_SCENE..."
      rows="3"
      class="w-full bg-transparent mt-6 p-4 text-white font-sans text-sm outline-none resize-none placeholder-gray-600 tracking-wider"
      style="min-height: 4.5rem; overflow-y: hidden;"
    />

    <div
      class="absolute bottom-2 right-2 font-mono text-[10px] transition-colors bg-ak-darker/80 px-1 py-0.5"
      :class="overSuggest ? 'text-red-500 animate-pulse' : 'text-gray-500 group-focus-within:text-ak-400'"
    >
      [ {{ count }} / {{ PROMPT_MAX }} ]
    </div>
  </div>
</template>
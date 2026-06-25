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
  <div class="flex flex-col gap-1">
    <textarea
      ref="textareaRef"
      :value="composer.prompt"
      @input="onInput"
      placeholder="描述你想要生成的视频…（建议 500 字以内）"
      rows="3"
      class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      style="min-height: 4.5rem; overflow-y: hidden;"
    />
    <div class="flex justify-end text-xs" :class="overSuggest ? 'text-amber-600' : 'text-gray-400'">
      {{ count }} / {{ PROMPT_MAX }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import { useSettingsStore } from '@/stores/settings'
import PromptArea from './PromptArea.vue'
import { ingestFile } from '@/lib/asset'
import { validateTask } from '@/lib/validate'
import type { AssetRole } from '@/types'

const composer = useComposerStore()
const tasks = useTasksStore()
const toast = useToastStore()
const settings = useSettingsStore()

const validationErrors = computed(() => {
  if (!composer.prompt.trim() && composer.assets.length === 0) return []
  return validateTask(composer.params, composer.prompt, composer.assets)
})

async function submit() {
  if (!settings.activeProfile?.apiKey.trim()) {
    toast.show('请先在设置中填写 API Key', 'error')
    return
  }
  const res = await tasks.submitTask()
  if (!res.ok) {
    toast.show(res.error ?? '提交失败', 'error')
  } else {
    toast.show('已提交生成任务', 'success')
  }
}

function inferRole(file: File): AssetRole | null {
  const kind = roleKindFromMime(file.type)
  if (kind === 'image') return 'referenceImage'
  if (kind === 'video') return 'referenceVideo'
  if (kind === 'audio') return 'referenceAudio'
  return null
}

function roleKindFromMime(mime: string): 'image' | 'video' | 'audio' | null {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return null
}

async function onDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files || !files.length) return
  e.preventDefault()
  for (const file of Array.from(files)) {
    const role = inferRole(file)
    if (!role) continue
    try {
      const asset = await ingestFile(file, role)
      composer.addAsset(asset)
    } catch (err) {
      toast.show(`素材 ${file.name} 处理失败`, 'error')
    }
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}
</script>

<template>
  <div
    class="relative w-full flex flex-col gap-6"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <PromptArea />

    <div v-if="validationErrors.length" class="border-l-4 border-red-500 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-sans tracking-wider w-full">
      <div class="font-bold mb-1 uppercase">>> SYSTEM_CONFLICT_DETECTED</div>
      <div v-for="(e, i) in validationErrors" :key="i">ERR: {{ e }}</div>
    </div>

    <!-- Submit Button stylized like Arknights -->
    <button
      class="w-full relative h-16 bg-white text-ak-darker font-sans font-black text-xl tracking-[0.2em] uppercase hover:bg-ak-400 transition-colors group overflow-hidden disabled:opacity-50 disabled:grayscale flex items-center justify-between px-6"
      :disabled="validationErrors.length > 0 || tasks.tasks.some((t) => t.status === 'running')"
      @click="submit"
    >
      <div class="flex items-center gap-4 relative z-10">
        <!-- Progressing bars animation on hover -->
        <div class="flex gap-1 group-hover:gap-2 transition-all">
          <div class="w-1 h-6 bg-ak-darker"></div>
          <div class="w-2 h-6 bg-ak-darker"></div>
          <div class="w-4 h-6 bg-ak-darker"></div>
        </div>
        <span>INITIATE_RENDER</span>
      </div>
      <!-- Right side arrow indicator -->
      <div class="relative z-10 text-ak-darker font-mono font-light text-2xl group-hover:translate-x-2 transition-transform">
        -&gt;
      </div>
      <!-- Caution background striping -->
      <div class="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)]"></div>
    </button>
  </div>
</template>
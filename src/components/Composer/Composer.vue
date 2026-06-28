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

// 实时校验错误（仅在有输入时展示，避免空态刷屏）
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

// 拖拽上传：根据文件类型推断角色
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
    class="relative w-full flex flex-col"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <div class="w-full space-y-4 relative z-10 flex flex-col">
      <PromptArea />

      <div v-if="validationErrors.length" class="border border-red-500/50 bg-red-900/20 px-3 py-2 text-xs text-red-400 clip-chamfer font-mono w-full">
        <div class="font-bold mb-1">>> SYSTEM_CONFLICT_DETECTED <<</div>
        <div v-for="(e, i) in validationErrors" :key="i">ERR: {{ e }}</div>
      </div>

      <div class="w-full">
        <button
          class="w-full relative mt-2 h-14 bg-gradient-to-r from-elysia-600 to-elysia-400 text-white font-sans italic font-black text-xl tracking-widest clip-chamfer-lg hover:from-elysia-500 hover:to-elysia-300 transition-all neon-glow-pink group overflow-hidden disabled:opacity-50 disabled:grayscale"
          :disabled="validationErrors.length > 0 || tasks.tasks.some((t) => t.status === 'running')"
          @click="submit"
        >
          <!-- 隐约的警告斜条纹 -->
          <div class="absolute inset-0 bg-caution-dark opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span class="relative z-10 flex items-center justify-center gap-2 drop-shadow-md">
            > INITIATE_FLAWLESS_RENDER
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import { useSettingsStore } from '@/stores/settings'
import PromptArea from './PromptArea.vue'
import ParamPanel from './ParamPanel.vue'
import AssetSlots from './AssetSlots.vue'
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
    class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    @drop="onDrop"
    @dragover="onDragOver"
  >
    <div class="mb-3 flex items-center justify-between">
      <h1 class="text-lg font-semibold text-gray-900">Seedance 视频生成工作台</h1>
      <span class="text-xs text-gray-400">当前：{{ settings.activeProfile?.name ?? '未配置' }}</span>
    </div>

    <div class="space-y-3">
      <PromptArea />
      <AssetSlots />
      <ParamPanel />

      <div v-if="validationErrors.length" class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <div v-for="(e, i) in validationErrors" :key="i">• {{ e }}</div>
      </div>

      <div class="flex items-center justify-between border-t border-gray-100 pt-3">
        <span class="text-xs text-gray-400">提示词与素材就绪后点击生成</span>
        <button
          class="rounded-lg bg-blue-500 px-5 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
          :disabled="validationErrors.length > 0 || tasks.tasks.some((t) => t.status === 'running')"
          @click="submit"
        >
          生成视频
        </button>
      </div>
    </div>
  </div>
</template>

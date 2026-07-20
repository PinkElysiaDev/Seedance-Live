<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useTasksStore } from '@/stores/tasks'
import { useToastStore } from '@/stores/toast'
import { useSettingsStore } from '@/stores/settings'
import { useI18nStore } from '@/stores/i18n'
import PromptArea from './PromptArea.vue'
import { ingestFile, referenceRoleFromFile } from '@/lib/asset'
import { validateTask, validateAssets } from '@/lib/validate'
import type { AssetRole } from '@/types'

const composer = useComposerStore()
const tasks = useTasksStore()
const toast = useToastStore()
const settings = useSettingsStore()
const { t } = useI18nStore()

// 素材类错误（数量/体积/时长/互斥等）伴随素材状态，实时展示
const assetErrors = computed(() => validateAssets(composer.assets))
// 点击生成时才计算的错误（含提示词为空、超长、params 类）
const submitErrors = ref<string[]>([])

// 合并展示：素材实时错误 + 点击时错误（去重）
const validationErrors = computed(() => {
  const merged = [...assetErrors.value]
  for (const e of submitErrors.value) {
    if (!merged.includes(e)) merged.push(e)
  }
  return merged
})

// 提示词为空：按钮置灰（仍可点击，点击时给报错）
const isPromptEmpty = computed(() => !composer.prompt.trim())

// 用户修改提示词后清除点击时产生的错误，避免残留
watch(
  () => composer.prompt,
  () => { submitErrors.value = [] },
)

async function submit() {
  // 无提示词：弹 toast 警告 + 显示错误条，不提交
  if (isPromptEmpty.value) {
    toast.show(t('toast.promptEmpty'), 'error')
    submitErrors.value = validateTask(composer.params, composer.prompt, composer.assets)
    return
  }
  if (!settings.activeProfile?.apiKey.trim()) {
    toast.show(t('toast.apiKeyMissing'), 'error')
    return
  }
  // 点击生成时校验全部：有错误则显示且不提交
  const errors = validateTask(composer.params, composer.prompt, composer.assets)
  if (errors.length) {
    submitErrors.value = errors
    return
  }
  submitErrors.value = []
  const res = await tasks.submitTask()
  if (!res.ok) {
    toast.show(res.error ?? t('toast.submitFailed'), 'error')
  } else {
    toast.show(t('toast.submitted'), 'success')
  }
}

async function onDrop(e: DragEvent) {
  const files = e.dataTransfer?.files
  if (!files || !files.length) return
  e.preventDefault()
  for (const file of Array.from(files)) {
    const role: AssetRole | null = referenceRoleFromFile(file)
    if (!role) continue
    try {
      const asset = await ingestFile(file, role)
      composer.addAsset(asset)
    } catch (err) {
      toast.show(t('toast.assetFailed', { name: file.name }), 'error')
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

    <div v-if="validationErrors.length" class="border-l-4 border-th-error bg-th-error/10 px-4 py-3 text-xs text-th-error font-sans tracking-wider w-full">
      <div class="font-bold mb-1 uppercase">>> {{ t('composer.systemConflict') }}</div>
      <div v-for="(e, i) in validationErrors" :key="i">ERR: {{ e }}</div>
    </div>

    <!-- Submit Button stylized like Arknights -->
    <div class="relative">
      <button
        class="w-full relative h-16 bg-th-accent text-th-on-accent font-sans font-black text-xl tracking-[0.2em] uppercase hover:bg-th-accent-dim transition-colors group overflow-hidden disabled:opacity-50 disabled:grayscale flex items-center justify-between px-6"
        :class="isPromptEmpty ? 'opacity-50 grayscale' : ''"
        :disabled="tasks.tasks.some((t) => t.status === 'running')"
        @click="submit"
      >
        <div class="flex items-center gap-4 relative z-10">
          <!-- Progressing bars animation on hover -->
          <div class="flex gap-1 group-hover:gap-2 transition-[gap]">
            <div class="w-1 h-6 bg-th-on-accent"></div>
            <div class="w-2 h-6 bg-th-on-accent"></div>
            <div class="w-4 h-6 bg-th-on-accent"></div>
          </div>
          <span>INITIATE RENDER</span>
        </div>
        <!-- Right side arrow indicator -->
        <div class="relative z-10 text-th-on-accent font-mono font-light text-2xl group-hover:translate-x-2 transition-transform">
          -&gt;
        </div>
        <!-- Caution background striping -->
        <div class="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.05)_10px,rgba(0,0,0,0.05)_20px)]"></div>
      </button>
    </div>
  </div>
</template>
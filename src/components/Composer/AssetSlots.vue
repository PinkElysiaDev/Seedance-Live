<script setup lang="ts">
import { computed, ref } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useToastStore } from '@/stores/toast'
import { ingestFile, ingestUrl, fileMatchesRole } from '@/lib/asset'
import { SEEDANCE_REFERENCE_LIMITS, MODEL_META } from '@/config/models'
import type { AssetRole, StoredAsset } from '@/types'

const composer = useComposerStore()
const toast = useToastStore()

interface SlotDef {
  role: AssetRole
  label: string
  max: number
  accept: string
}

const slots: SlotDef[] = [
  { role: 'firstFrame', label: '首帧', max: 1, accept: 'image/*' },
  { role: 'lastFrame', label: '尾帧', max: 1, accept: 'image/*' },
  { role: 'referenceImage', label: '参考图', max: SEEDANCE_REFERENCE_LIMITS.images, accept: 'image/*' },
  { role: 'referenceVideo', label: '参考视频', max: SEEDANCE_REFERENCE_LIMITS.videos, accept: 'video/mp4,video/quicktime' },
  { role: 'referenceAudio', label: '参考音频', max: SEEDANCE_REFERENCE_LIMITS.audios, accept: 'audio/mpeg,audio/wav,.mp3,.wav' },
]

const fileInputs = ref<Record<string, HTMLInputElement | null>>({})
const urlInputs = ref<Record<string, string>>({})

// 首尾帧启用时禁用参考视频/音频
const hasFirstLast = computed(() =>
  composer.assets.some((a) => a.role === 'firstFrame' || a.role === 'lastFrame'),
)

function assetsOf(role: AssetRole): StoredAsset[] {
  return composer.assets.filter((a) => a.role === role)
}

function slotDisabled(role: AssetRole): boolean {
  if ((role === 'referenceVideo' || role === 'referenceAudio') && hasFirstLast.value) return true
  return false
}

async function handleFiles(role: AssetRole, files: FileList | null) {
  if (!files || !files.length) return
  if (slotDisabled(role)) {
    toast.show('首尾帧与参考视频/音频不能同时使用', 'error')
    return
  }
  const existing = assetsOf(role).length
  const slot = slots.find((s) => s.role === role)!
  const remaining = slot.max - existing
  const arr = Array.from(files).slice(0, remaining)
  for (const file of arr) {
    if (!fileMatchesRole(file, role)) {
      toast.show(`${file.name} 类型不匹配该槽位`, 'error')
      continue
    }
    try {
      const asset = await ingestFile(file, role)
      composer.addAsset(asset)
    } catch (err) {
      toast.show(`素材 ${file.name} 处理失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }
  // 重置 input 以便重复选同一文件
  if (fileInputs.value[role]) fileInputs.value[role]!.value = ''
}

async function addUrl(role: AssetRole) {
  const url = urlInputs.value[role]?.trim()
  if (!url) return
  if (slotDisabled(role)) {
    toast.show('首尾帧与参考视频/音频不能同时使用', 'error')
    return
  }
  try {
    const asset = await ingestUrl(url, role)
    composer.addAsset(asset)
    urlInputs.value[role] = ''
  } catch (err) {
    toast.show(`URL 添加失败：${err instanceof Error ? err.message : String(err)}`, 'error')
  }
}

function assetLabel(a: StoredAsset): string {
  if (a.width && a.height) return `${a.name} (${a.width}×${a.height})`
  if (a.durationMs) return `${a.name} (${(a.durationMs / 1000).toFixed(1)}s)`
  return a.name
}

const isFace = computed(() => MODEL_META[composer.params.model].face)
</script>

<template>
  <div class="space-y-2">
    <div v-if="hasFirstLast" class="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
      首尾帧已启用，参考视频/音频已禁用
    </div>
    <div v-if="isFace" class="rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
      Face 模型不支持 asset://，请使用公网 URL 或本地文件
    </div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div
        v-for="slot in slots"
        :key="slot.role"
        class="rounded-lg border border-gray-200 p-2"
        :class="{ 'opacity-40': slotDisabled(slot.role) }"
      >
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-medium text-gray-600">{{ slot.label }}</span>
          <span class="text-xs text-gray-400">{{ assetsOf(slot.role).length }}/{{ slot.max }}</span>
        </div>
        <div class="flex flex-col gap-1">
          <button
            class="rounded border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:border-violet-400 hover:text-violet-600"
            :disabled="slotDisabled(slot.role) || assetsOf(slot.role).length >= slot.max"
            @click="fileInputs[slot.role]?.click()"
          >
            + 上传 / 拖入
          </button>
          <input
            :ref="(el) => (fileInputs[slot.role] = el as HTMLInputElement | null)"
            type="file"
            :accept="slot.accept"
            :multiple="slot.max > 1"
            class="hidden"
            @change="handleFiles(slot.role, ($event.target as HTMLInputElement).files)"
          />
          <div class="flex gap-1">
            <input
              v-model="urlInputs[slot.role]"
              placeholder="粘贴公网 URL"
              class="w-full rounded border border-gray-300 px-1.5 py-1 text-xs"
              :disabled="slotDisabled(slot.role) || assetsOf(slot.role).length >= slot.max"
              @keydown.enter="addUrl(slot.role)"
            />
            <button
              class="rounded border border-gray-300 px-2 text-xs hover:bg-gray-50"
              :disabled="slotDisabled(slot.role) || assetsOf(slot.role).length >= slot.max"
              @click="addUrl(slot.role)"
            >+</button>
          </div>
          <div v-for="a in assetsOf(slot.role)" :key="a.id" class="flex items-center justify-between gap-1 text-xs text-gray-600">
            <span class="truncate" :title="a.name">{{ assetLabel(a) }}</span>
            <button class="text-gray-400 hover:text-red-500" @click="composer.removeAsset(a.id)">✕</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

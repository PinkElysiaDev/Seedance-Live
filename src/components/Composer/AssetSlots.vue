<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useToastStore } from '@/stores/toast'
import { useI18nStore } from '@/stores/i18n'
import { ingestFile, fileMatchesRole } from '@/lib/asset'
import { SEEDANCE_REFERENCE_LIMITS } from '@/config/models'
import { getBlob } from '@/db/repos'
import { arrayBufferToBlob, isDirectUrl } from '@/lib/blob'
import type { AssetRole, StoredAsset } from '@/types'

const composer = useComposerStore()
const toast = useToastStore()
const { t } = useI18nStore()

const props = defineProps<{
  mode: 'REF_MODE' | 'KEYFRAME_MODE'
}>()

const fileInputs = ref<Record<string, HTMLInputElement | null>>({})

function assetsOf(role: AssetRole): StoredAsset[] {
  return composer.assets.filter((a) => a.role === role)
}

// 跟随 assets 顺序（不按类型分组），使网格顺序 = payload 顺序，拖拽排序所见即所发
const refAssets = computed(() =>
  composer.assets.filter(
    (a) => a.role === 'referenceImage' || a.role === 'referenceVideo' || a.role === 'referenceAudio',
  ),
)

async function handleFiles(role: AssetRole, files: FileList | null, autoRole: boolean = false) {
  if (!files || !files.length) return

  for (const file of Array.from(files)) {
    let targetRole = role
    if (autoRole) {
      if (file.type.startsWith('video/')) targetRole = 'referenceVideo'
      else if (file.type.startsWith('audio/')) targetRole = 'referenceAudio'
      else targetRole = 'referenceImage'
    }

    if (!fileMatchesRole(file, targetRole)) {
      toast.show(t('toast.assetTypeMismatch', { name: file.name }), 'error')
      continue
    }

    let max = 1
    if (targetRole === 'referenceImage') max = SEEDANCE_REFERENCE_LIMITS.images
    if (targetRole === 'referenceVideo') max = SEEDANCE_REFERENCE_LIMITS.videos
    if (targetRole === 'referenceAudio') max = SEEDANCE_REFERENCE_LIMITS.audios

    if (assetsOf(targetRole).length >= max) {
      toast.show(t('toast.assetRoleMax', { role: targetRole }), 'error')
      continue
    }

    try {
      const asset = await ingestFile(file, targetRole)
      composer.addAsset(asset)
    } catch (err) {
      toast.show(t('toast.assetFailedDetailed', { name: file.name, msg: err instanceof Error ? err.message : String(err) }), 'error')
    }
  }

  if (fileInputs.value[role]) fileInputs.value[role]!.value = ''
}

function swapKeyframes() {
  const first = assetsOf('firstFrame')[0]
  const last = assetsOf('lastFrame')[0]
  // 交换首尾帧：各自移除后以对方角色重新加入（仅一帧存在时退化为单方向搬移）
  if (first) {
    composer.removeAsset(first.id)
    composer.addAsset({ ...first, role: 'lastFrame' })
  }
  if (last) {
    composer.removeAsset(last.id)
    composer.addAsset({ ...last, role: 'firstFrame' })
  }
}

// ===== 拖拽 / 粘贴上传 =====
// 各投放区高亮态
const isDragOver = ref<Record<string, boolean>>({})

// 参考图缩略图拖拽排序：draggingId 非空表示正在拖内部素材（排序），否则为外部文件拖入（上传）
const draggingId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

function onAssetDragStart(a: StoredAsset, e: DragEvent) {
  draggingId.value = a.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    // Firefox 需 setData 才能触发后续 dragover/drop
    e.dataTransfer.setData('text/plain', a.id)
  }
}
function onAssetDragEnd() {
  draggingId.value = null
  dropTargetId.value = null
}
function onAssetDragOver(a: StoredAsset, e: DragEvent) {
  // 仅内部拖拽时启用排序投放；外部文件交给框级 onDragOver
  if (!draggingId.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dropTargetId.value = a.id
}
function onAssetDragLeave(a: StoredAsset, e: DragEvent) {
  if (dropTargetId.value !== a.id) return
  // 仅当真正离开该缩略图（而非进入其子元素）时清除，避免子元素间闪烁
  const related = e.relatedTarget as Node | null
  const current = e.currentTarget as Element | null
  if (!related || !current || !current.contains(related)) dropTargetId.value = null
}
function onAssetDrop(a: StoredAsset, e: DragEvent) {
  // 外部文件落到缩略图上：不拦截，冒泡到框级 onDrop 入库
  if (!draggingId.value) return
  e.preventDefault()
  e.stopPropagation()
  if (draggingId.value !== a.id) composer.swapAssets(draggingId.value, a.id)
  draggingId.value = null
  dropTargetId.value = null
}

// 拖入文件（支持拖到参考图框或首尾帧框）
function onDrop(role: AssetRole, e: DragEvent, autoRole = false) {
  e.preventDefault()
  isDragOver.value[role] = false
  // 内部拖拽落到空白处：不做排序
  if (draggingId.value) {
    draggingId.value = null
    dropTargetId.value = null
    return
  }
  const files = e.dataTransfer?.files
  if (files && files.length) handleFiles(role, files, autoRole)
}

function onDragOver(role: AssetRole, e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = draggingId.value ? 'move' : 'copy'
  // 仅外部文件高亮整框；内部排序时由缩略图自身指示落点
  if (!draggingId.value) isDragOver.value[role] = true
}

function onDragLeave(role: AssetRole, e: DragEvent) {
  // 仅当离开该元素本身（而非进入子元素）时清除高亮
  if (e.currentTarget === e.target) isDragOver.value[role] = false
}

// 全局粘贴：页面任意处粘贴文件都能入当前模式的输入框
function isTextTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

// 首尾帧模式：按“先首帧后尾帧”顺序填空位（已有则跳过该栏）
async function fillKeyframesInOrder(files: FileList) {
  for (const file of Array.from(files)) {
    if (!fileMatchesRole(file, 'firstFrame')) {
      toast.show(t('toast.keyframeNotImage', { name: file.name }), 'error')
      continue
    }
    let targetRole: AssetRole | null = null
    if (assetsOf('firstFrame').length === 0) targetRole = 'firstFrame'
    else if (assetsOf('lastFrame').length === 0) targetRole = 'lastFrame'
    else break // 首尾帧都已填，停止
    try {
      const asset = await ingestFile(file, targetRole)
      composer.addAsset(asset)
    } catch (err) {
      toast.show(t('toast.assetFailedDetailed', { name: file.name, msg: err instanceof Error ? err.message : String(err) }), 'error')
    }
  }
}

function onDocPaste(e: ClipboardEvent) {
  // 焦点在文本输入框时，让文本正常粘贴，不拦截
  if (isTextTarget(e.target)) return
  const files = e.clipboardData?.files
  if (!files || !files.length) return
  e.preventDefault()
  if (props.mode === 'KEYFRAME_MODE') {
    fillKeyframesInOrder(files)
  } else {
    // 参考图模式：自动判定图/视/音
    handleFiles('referenceImage', files, true)
  }
}

onMounted(() => document.addEventListener('paste', onDocPaste))
onBeforeUnmount(() => document.removeEventListener('paste', onDocPaste))

// ===== 素材预览 URL 解析 =====
// sourceUrl 直传；否则从 db 取 blob 转 objectURL（适合视频/音频播放）
const previewUrls = ref<Record<string, string>>({})

async function resolveAssetUrl(asset: StoredAsset): Promise<string | null> {
  if (asset.sourceUrl && isDirectUrl(asset.sourceUrl)) return asset.sourceUrl
  if (!asset.blobId) return null
  const stored = await getBlob(asset.blobId)
  if (!stored) return null
  const blob = arrayBufferToBlob(stored.buffer, stored.mime)
  return URL.createObjectURL(blob)
}

// 当前所有需要预览的素材（首帧/尾帧/参考素材）
const previewableAssets = computed<StoredAsset[]>(() => [
  ...assetsOf('firstFrame'),
  ...assetsOf('lastFrame'),
  ...refAssets.value,
])

watch(
  previewableAssets,
  async (list) => {
    // 释放不再需要的 objectURL
    const validIds = new Set(list.map((a) => a.id))
    for (const [id, url] of Object.entries(previewUrls.value)) {
      if (!validIds.has(id) && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
        delete previewUrls.value[id]
      }
    }
    // 解析新增的
    for (const a of list) {
      if (!previewUrls.value[a.id]) {
        const url = await resolveAssetUrl(a)
        if (url) previewUrls.value[a.id] = url
      }
    }
  },
  { immediate: true, deep: true },
)

// ===== 放大预览 Lightbox =====
const lightboxAsset = ref<StoredAsset | null>(null)
const lightboxUrl = computed(() => (lightboxAsset.value ? previewUrls.value[lightboxAsset.value.id] : ''))
function openLightbox(a: StoredAsset) {
  if (!previewUrls.value[a.id]) return
  lightboxAsset.value = a
}
function closeLightbox() {
  lightboxAsset.value = null
}
</script>

<template>
  <div class="w-full relative">

    <!-- Mode A: Reference Mode -->
    <div v-if="props.mode === 'REF_MODE'" class="w-full">
      <!-- 添加框：无素材时显示占位；有素材时框内直接预览文件。整框可点击/拖拽/粘贴上传 -->
      <div
        class="w-full border border-gray-700 bg-ak-dark/80 p-4 flex flex-col gap-3 hover:border-ak-400/50 transition-colors relative min-h-[150px] cursor-pointer outline-none"
        :class="isDragOver['referenceImage'] ? 'border-ak-400 bg-ak-gray/40' : ''"
        tabindex="0"
        @click="fileInputs['refPool']?.click()"
        @dragover="onDragOver('referenceImage', $event as DragEvent)"
        @dragleave="onDragLeave('referenceImage', $event as DragEvent)"
        @drop="onDrop('referenceImage', $event as DragEvent, true)"
      >
        <!-- 无素材时的占位提示（点击触发选文件） -->
        <button
          v-if="refAssets.length === 0"
          class="w-full flex-1 flex flex-col items-center justify-center gap-1.5 cursor-pointer group"
          @click.stop="fileInputs['refPool']?.click()"
        >
          <div class="flex gap-1 mb-2 opacity-50 group-hover:opacity-100 transition-opacity">
            <div class="w-8 h-1 bg-ak-400"></div>
            <div class="w-2 h-1 bg-ak-400"></div>
          </div>
          <div class="text-white font-sans font-black tracking-[0.2em] uppercase text-sm">{{ t('asset.addReference') }}</div>
          <p class="text-gray-500 font-sans text-xs uppercase tracking-wider group-hover:text-ak-400 transition-colors">{{ t('asset.importHint') }}</p>
        </button>

        <!-- 有素材时：框内预览网格 -->
        <div v-else class="flex-1 flex flex-wrap gap-2 items-center">
          <div
            v-for="a in refAssets"
            :key="a.id"
            draggable="true"
            class="relative w-24 h-24 border border-gray-700 bg-ak-darker overflow-hidden group/asset cursor-grab transition"
            :class="{
              'opacity-40': draggingId === a.id,
              'ring-2 ring-ak-400': dropTargetId === a.id,
            }"
            @dragstart="onAssetDragStart(a, $event as DragEvent)"
            @dragend="onAssetDragEnd"
            @dragover="onAssetDragOver(a, $event as DragEvent)"
            @dragleave="onAssetDragLeave(a, $event as DragEvent)"
            @drop="onAssetDrop(a, $event as DragEvent)"
          >
            <!-- 预览内容 -->
            <button
              v-if="previewUrls[a.id]"
              class="w-full h-full flex items-center justify-center cursor-zoom-in"
              @click.stop="openLightbox(a)"
            >
              <img v-if="a.kind === 'image'" :src="previewUrls[a.id]" loading="lazy" draggable="false" class="w-full h-full object-cover" :alt="a.name" />
              <video v-else-if="a.kind === 'video'" :src="previewUrls[a.id]" draggable="false" class="w-full h-full object-cover" muted />
              <div v-else-if="a.kind === 'audio'" class="w-full h-full flex flex-col items-center justify-center gap-1 text-ak-400">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" /></svg>
                <span class="text-[9px] font-mono uppercase">AUDIO</span>
              </div>
            </button>
            <div v-else class="w-full h-full flex items-center justify-center text-gray-600 text-xs font-mono">...</div>

            <!-- 类型角标 -->
            <span class="absolute top-0 left-0 bg-ak-400/90 text-ak-darker font-sans font-bold text-[9px] px-1 py-0.5 tracking-widest uppercase z-10">{{ a.role.replace('reference', '').toUpperCase() }}</span>
            <!-- 删除按钮 -->
            <button
              class="absolute top-0 right-0 w-5 h-5 flex items-center justify-center bg-black/70 text-red-400 hover:bg-red-500 hover:text-white transition-colors z-20"
              @click.stop="composer.removeAsset(a.id)"
              :title="t('title.removeAsset')"
            >✕</button>
            <!-- 文件名 -->
            <span class="absolute bottom-0 left-0 right-0 bg-black/70 text-gray-300 text-[9px] font-mono px-1 py-0.5 truncate z-10" :title="a.name">{{ a.name }}</span>
          </div>

          <!-- 继续添加按钮（未达上限时） -->
          <button
            class="w-24 h-24 border border-dashed border-gray-600 hover:border-ak-400/50 hover:bg-ak-gray/40 transition-colors flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-ak-400 cursor-pointer"
            @click.stop="fileInputs['refPool']?.click()"
          >
            <span class="text-2xl font-light leading-none">+</span>
            <span class="text-[9px] font-sans tracking-widest uppercase">{{ t('asset.add') }}</span>
          </button>
        </div>

        <input
          :ref="(el) => (fileInputs['refPool'] = el as HTMLInputElement | null)"
          type="file"
          accept="image/*,video/mp4,video/quicktime,audio/mpeg,audio/wav,.mp3,.wav"
          multiple
          class="hidden"
          @change="handleFiles('referenceImage', ($event.target as HTMLInputElement).files, true)"
        />
      </div>
    </div>

    <!-- Mode B: Keyframe Mode（左右分栏，中间切换按钮） -->
    <div v-if="props.mode === 'KEYFRAME_MODE'" class="w-full flex items-stretch gap-6 relative">

      <!-- Start Frame Slot -->
      <div
        class="flex-1 border border-gray-700 bg-ak-dark/80 relative flex flex-col hover:border-ak-400/50 cursor-pointer group transition-colors overflow-hidden h-[150px] outline-none"
        :class="isDragOver['firstFrame'] ? 'border-ak-400 bg-ak-gray/40' : ''"
        tabindex="0"
        @click="fileInputs['firstFrame']?.click()"
        @dragover="onDragOver('firstFrame', $event as DragEvent)"
        @dragleave="onDragLeave('firstFrame', $event as DragEvent)"
        @drop="onDrop('firstFrame', $event as DragEvent)"
      >
        <div class="absolute top-0 left-0 bg-ak-400 text-ak-darker font-sans font-bold text-[10px] px-2 py-0.5 z-20 tracking-widest">{{ t('asset.startFrame') }}</div>

        <!-- 预览/占位 -->
        <div class="flex-1 flex items-center justify-center p-2">
          <div v-if="assetsOf('firstFrame')[0] && previewUrls[assetsOf('firstFrame')[0].id]" class="relative max-h-[120px] max-w-full">
            <img
              loading="lazy"
              :src="previewUrls[assetsOf('firstFrame')[0].id]"
              class="max-h-[120px] max-w-full object-contain cursor-zoom-in"
              :alt="assetsOf('firstFrame')[0].name"
              @click.stop="openLightbox(assetsOf('firstFrame')[0])"
            />
            <!-- 删除按钮（右上角） -->
            <button
              class="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center bg-black/70 text-red-400 hover:bg-red-500 hover:text-white transition-colors z-20 rounded-sm"
              @click.stop="composer.removeAsset(assetsOf('firstFrame')[0].id)"
              :title="t('title.removeAsset')"
            >✕</button>
            <!-- 文件名横幅（与参考图模式一致） -->
            <span class="absolute bottom-0 left-0 right-0 bg-black/70 text-gray-300 text-[9px] font-mono px-1 py-0.5 truncate z-10" :title="assetsOf('firstFrame')[0].name">{{ assetsOf('firstFrame')[0].name }}</span>
          </div>
          <div v-else-if="assetsOf('firstFrame')[0]" class="text-gray-500 text-xs font-mono">{{ t('placeholder.loading') }}</div>
          <div v-else class="flex flex-col items-center gap-1 text-gray-600 group-hover:text-ak-400 transition-colors">
            <span class="text-2xl font-light leading-none">+</span>
            <span class="text-[10px] font-sans uppercase tracking-widest">{{ t('asset.startImage') }}</span>
          </div>
        </div>

        <input
          :ref="(el) => (fileInputs['firstFrame'] = el as HTMLInputElement | null)"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFiles('firstFrame', ($event.target as HTMLInputElement).files)"
        />
      </div>

      <!-- 中间切换按钮：平时透明无外圈，hover 后出现圆形不透明底 -->
      <button
        class="self-center z-20 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full border border-transparent bg-transparent text-gray-500/70 hover:text-ak-400 hover:bg-ak-gray hover:border-ak-400 hover:shadow-lg hover:scale-110 transition duration-200"
        @click="swapKeyframes"
        title="Swap Frames"
      >
        <span class="font-sans font-bold text-xs">⇄</span>
      </button>

      <!-- End Frame Slot -->
      <div
        class="flex-1 border border-gray-700 bg-ak-dark/80 relative flex flex-col hover:border-ak-400/50 cursor-pointer group transition-colors overflow-hidden h-[150px] outline-none"
        :class="isDragOver['lastFrame'] ? 'border-ak-400 bg-ak-gray/40' : ''"
        tabindex="0"
        @click="fileInputs['lastFrame']?.click()"
        @dragover="onDragOver('lastFrame', $event as DragEvent)"
        @dragleave="onDragLeave('lastFrame', $event as DragEvent)"
        @drop="onDrop('lastFrame', $event as DragEvent)"
      >
        <div class="absolute top-0 right-0 bg-gray-600 text-white font-sans font-bold text-[10px] px-2 py-0.5 z-20 tracking-widest">{{ t('asset.endFrame') }}</div>

        <div class="flex-1 flex items-center justify-center p-2">
          <div v-if="assetsOf('lastFrame')[0] && previewUrls[assetsOf('lastFrame')[0].id]" class="relative max-h-[120px] max-w-full">
            <img
              loading="lazy"
              :src="previewUrls[assetsOf('lastFrame')[0].id]"
              class="max-h-[120px] max-w-full object-contain cursor-zoom-in"
              :alt="assetsOf('lastFrame')[0].name"
              @click.stop="openLightbox(assetsOf('lastFrame')[0])"
            />
            <!-- 删除按钮（左上角，避开右上角 END_FRAME 角标） -->
            <button
              class="absolute -top-1 -left-1 w-5 h-5 flex items-center justify-center bg-black/70 text-red-400 hover:bg-red-500 hover:text-white transition-colors z-20 rounded-sm"
              @click.stop="composer.removeAsset(assetsOf('lastFrame')[0].id)"
              :title="t('title.removeAsset')"
            >✕</button>
            <!-- 文件名横幅（与参考图模式一致） -->
            <span class="absolute bottom-0 left-0 right-0 bg-black/70 text-gray-300 text-[9px] font-mono px-1 py-0.5 truncate z-10" :title="assetsOf('lastFrame')[0].name">{{ assetsOf('lastFrame')[0].name }}</span>
          </div>
          <div v-else-if="assetsOf('lastFrame')[0]" class="text-gray-500 text-xs font-mono">{{ t('placeholder.loading') }}</div>
          <div v-else class="flex flex-col items-center gap-1 text-gray-600 group-hover:text-white transition-colors">
            <span class="text-2xl font-light leading-none">+</span>
            <span class="text-[10px] font-sans uppercase tracking-widest">{{ t('asset.endImage') }}</span>
          </div>
        </div>

        <input
          :ref="(el) => (fileInputs['lastFrame'] = el as HTMLInputElement | null)"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFiles('lastFrame', ($event.target as HTMLInputElement).files)"
        />
      </div>
    </div>

    <!-- 放大预览 Lightbox（ak 主题，图片/视频/音频） -->
    <Teleport to="body">
      <Transition name="modal-pop">
      <div v-if="lightboxAsset" class="fixed inset-0 z-50 flex items-center justify-center p-8" @click="closeLightbox">
        <div class="absolute inset-0 bg-black/85 backdrop-blur-sm"></div>
        <div class="relative z-10 max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" @click.stop>
          <div class="flex items-center justify-between w-full gap-4">
            <span class="font-mono text-xs text-ak-400 tracking-widest uppercase truncate">{{ lightboxAsset.role }} · {{ lightboxAsset.name }}</span>
            <button class="font-mono text-gray-400 hover:text-white text-lg px-2" @click="closeLightbox">[✕]</button>
          </div>
          <img
            v-if="lightboxAsset.kind === 'image'"
            :src="lightboxUrl"
            class="max-w-[90vw] max-h-[78vh] object-contain shadow-[0_0_40px_rgba(0,0,0,0.8)]"
            :alt="lightboxAsset.name"
          />
          <video
            v-else-if="lightboxAsset.kind === 'video'"
            :src="lightboxUrl"
            controls
            autoplay
            class="max-w-[90vw] max-h-[78vh] shadow-[0_0_40px_rgba(0,0,0,0.8)]"
          />
          <div v-else-if="lightboxAsset.kind === 'audio'" class="w-[480px] max-w-[90vw] bg-ak-dark/80 border border-gray-700 p-8 flex flex-col items-center gap-4">
            <svg class="w-16 h-16 text-ak-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm12-3c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3z" /></svg>
            <audio :src="lightboxUrl" controls autoplay class="w-full" />
          </div>
        </div>
      </div>
      </Transition>
    </Teleport>
  </div>
</template>

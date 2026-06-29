<script setup lang="ts">
import { computed, ref } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useToastStore } from '@/stores/toast'
import { ingestFile, fileMatchesRole } from '@/lib/asset'
import { SEEDANCE_REFERENCE_LIMITS } from '@/config/models'
import type { AssetRole, StoredAsset } from '@/types'

const composer = useComposerStore()
const toast = useToastStore()

// Note: Mode switching will be controlled by WorkbenchView and passed via props,
// but for now we keep it internal if we want to isolate logic.
// According to the plan, Mode Toggle is a button below the prompt box.
// We will export a way to bind it or just keep it simple here.
const props = defineProps<{
  mode: 'REF_MODE' | 'KEYFRAME_MODE'
}>()

const fileInputs = ref<Record<string, HTMLInputElement | null>>({})

function assetsOf(role: AssetRole): StoredAsset[] {
  return composer.assets.filter((a) => a.role === role)
}

const refAssets = computed(() => [
  ...assetsOf('referenceImage'),
  ...assetsOf('referenceVideo'),
  ...assetsOf('referenceAudio')
])

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
      toast.show(`${file.name} 类型不匹配`, 'error')
      continue
    }

    let max = 1
    if (targetRole === 'referenceImage') max = SEEDANCE_REFERENCE_LIMITS.images
    if (targetRole === 'referenceVideo') max = SEEDANCE_REFERENCE_LIMITS.videos
    if (targetRole === 'referenceAudio') max = SEEDANCE_REFERENCE_LIMITS.audios

    if (assetsOf(targetRole).length >= max) {
      toast.show(`${targetRole} 已达上限`, 'error')
      continue
    }

    try {
      const asset = await ingestFile(file, targetRole)
      composer.addAsset(asset)
    } catch (err) {
      toast.show(`素材 ${file.name} 处理失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  if (fileInputs.value[role]) fileInputs.value[role]!.value = ''
}

function assetLabel(a: StoredAsset): string {
  if (a.width && a.height) return `${a.name} (${a.width}×${a.height})`
  if (a.durationMs) return `${a.name} (${(a.durationMs / 1000).toFixed(1)}s)`
  return a.name
}

function swapKeyframes() {
  const first = assetsOf('firstFrame')[0]
  const last = assetsOf('lastFrame')[0]

  if (first) {
    composer.removeAsset(first.id)
    if (last) {
      composer.addAsset({ ...first, role: 'lastFrame' })
    } else {
      composer.addAsset({ ...first, role: 'lastFrame' })
    }
  }
  if (last) {
    composer.removeAsset(last.id)
    if (first) {
      composer.addAsset({ ...last, role: 'firstFrame' })
    } else {
      composer.addAsset({ ...last, role: 'firstFrame' })
    }
  }
}
</script>

<template>
  <div class="w-full relative">

    <!-- Mode A: Reference Mode ("File Stack" style) -->
    <div v-if="props.mode === 'REF_MODE'" class="w-full">
      <div
        class="w-full border border-gray-700 bg-ak-dark/80 p-6 flex flex-col items-center justify-center hover:bg-ak-gray hover:border-ak-400/50 transition-colors cursor-pointer group relative overflow-hidden"
        @click="fileInputs['refPool']?.click()"
      >
        <div class="relative z-10 flex flex-col items-center gap-2">
          <div class="flex gap-1 mb-2 opacity-50 group-hover:opacity-100 transition-opacity">
            <div class="w-8 h-1 bg-ak-400"></div>
            <div class="w-2 h-1 bg-ak-400"></div>
          </div>
          <div class="text-white font-sans font-black tracking-[0.2em] uppercase text-sm">ADD_REFERENCE</div>
          <p class="text-gray-500 font-sans text-xs uppercase tracking-wider group-hover:text-ak-400 transition-colors">Import Image / Video / Audio</p>
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

      <!-- File Pool Display -->
      <div v-if="refAssets.length > 0" class="mt-3 flex flex-col gap-1">
        <div v-for="a in refAssets" :key="a.id" class="flex items-center justify-between p-2 border-l-2 border-ak-400 bg-ak-gray group hover:bg-gray-800 transition-colors">
          <div class="flex items-center gap-3 truncate">
            <span class="text-[10px] font-sans font-bold px-1.5 py-0.5 bg-ak-400/10 text-ak-400">
              {{ a.role.replace('reference', '').toUpperCase() }}
            </span>
            <span class="text-xs font-sans text-gray-300 truncate tracking-wider" :title="a.name">{{ assetLabel(a) }}</span>
          </div>
          <button class="text-gray-600 hover:text-red-500 transition-colors font-mono text-sm px-2" @click="composer.removeAsset(a.id)">✕</button>
        </div>
      </div>
    </div>

    <!-- Mode B: Keyframe Mode (Stacked Vertical instead of horizontal for sleekness) -->
    <div v-if="props.mode === 'KEYFRAME_MODE'" class="w-full flex flex-col gap-2 relative">

      <!-- Swap Button Overlay -->
      <button
        class="absolute top-1/2 left-4 -translate-y-1/2 z-20 w-8 h-8 bg-ak-gray border border-gray-600 text-gray-400 hover:text-ak-400 hover:border-ak-400 flex items-center justify-center shadow-lg transition-all"
        @click="swapKeyframes"
        title="Swap Frames"
      >
        <span class="font-sans font-bold text-xs rotate-90">&lt;&gt;</span>
      </button>

      <!-- Start Frame Slot -->
      <div
        class="w-full border border-gray-700 bg-ak-dark/80 p-4 relative h-24 flex items-center justify-center hover:bg-ak-gray hover:border-ak-400/50 cursor-pointer group transition-colors overflow-hidden pl-16"
        @click="fileInputs['firstFrame']?.click()"
      >
        <div class="absolute top-0 right-0 bg-ak-400 text-ak-darker font-sans font-bold text-[10px] px-2 py-0.5 z-10 tracking-widest">START_FRAME</div>

        <div v-if="assetsOf('firstFrame')[0]" class="relative z-10 flex items-center justify-between w-full">
           <span class="text-white font-sans text-xs truncate max-w-[80%] tracking-wider">{{ assetsOf('firstFrame')[0].name }}</span>
           <button class="text-[10px] text-gray-500 hover:text-red-500 font-sans tracking-widest transition-colors uppercase" @click.stop="composer.removeAsset(assetsOf('firstFrame')[0].id)">REMOVE</button>
        </div>
        <span v-else class="text-gray-600 font-sans text-xs group-hover:text-ak-400 uppercase tracking-widest relative z-10 transition-colors">+ Select Start Image</span>

        <input
          :ref="(el) => (fileInputs['firstFrame'] = el as HTMLInputElement | null)"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFiles('firstFrame', ($event.target as HTMLInputElement).files)"
        />
      </div>

      <!-- End Frame Slot -->
      <div
        class="w-full border border-gray-700 bg-ak-dark/80 p-4 relative h-24 flex items-center justify-center hover:bg-ak-gray hover:border-ak-400/50 cursor-pointer group transition-colors overflow-hidden pl-16"
        @click="fileInputs['lastFrame']?.click()"
      >
        <div class="absolute bottom-0 right-0 bg-gray-600 text-white font-sans font-bold text-[10px] px-2 py-0.5 z-10 tracking-widest">END_FRAME</div>

        <div v-if="assetsOf('lastFrame')[0]" class="relative z-10 flex items-center justify-between w-full">
           <span class="text-white font-sans text-xs truncate max-w-[80%] tracking-wider">{{ assetsOf('lastFrame')[0].name }}</span>
           <button class="text-[10px] text-gray-500 hover:text-red-500 font-sans tracking-widest transition-colors uppercase" @click.stop="composer.removeAsset(assetsOf('lastFrame')[0].id)">REMOVE</button>
        </div>
        <span v-else class="text-gray-600 font-sans text-xs group-hover:text-white uppercase tracking-widest relative z-10 transition-colors">+ Select End Image</span>

        <input
          :ref="(el) => (fileInputs['lastFrame'] = el as HTMLInputElement | null)"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFiles('lastFrame', ($event.target as HTMLInputElement).files)"
        />
      </div>
    </div>
  </div>
</template>
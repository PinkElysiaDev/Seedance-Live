<script setup lang="ts">
import { computed, ref } from 'vue'
import { useComposerStore } from '@/stores/composer'
import { useToastStore } from '@/stores/toast'
import { ingestFile, fileMatchesRole } from '@/lib/asset'
import { SEEDANCE_REFERENCE_LIMITS } from '@/config/models'
import type { AssetRole, StoredAsset } from '@/types'

const composer = useComposerStore()
const toast = useToastStore()

// 仅用内部状态实现 Mode A(Reference) 和 Mode B(Keyframe)
const activeMode = ref<'REF_MODE' | 'KEYFRAME_MODE'>('REF_MODE')

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

  // 对于 REF_MODE 的大池子拖拽，我们自动推断角色
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

    // 检查限制
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
</script>

<template>
  <div class="space-y-4">
    <!-- Mode Switcher -->
    <div class="flex gap-1 bg-gray-200 dark:bg-tactical-700 p-1 clip-chamfer w-fit border border-elysia-400/30 dark:border-elysia-400/30 shadow-[inset_0_0_8px_rgba(20,17,20,0.1)] dark:shadow-[inset_0_0_8px_rgba(20,17,20,0.5)]">
      <button
        class="px-6 py-2 font-sans italic font-bold text-sm tracking-wide transition-all duration-300 clip-chamfer"
        :class="activeMode === 'REF_MODE' ? 'bg-elysia-400 text-tactical-900 shadow-[0_0_10px_rgba(255,135,178,0.5)]' : 'text-gray-600 dark:text-gray-400 hover:text-elysia-500 dark:hover:text-elysia-100'"
        @click="activeMode = 'REF_MODE'"
      >
        REF_MODE
      </button>
      <button
        class="px-6 py-2 font-sans italic font-bold text-sm tracking-wide transition-all duration-300 clip-chamfer"
        :class="activeMode === 'KEYFRAME_MODE' ? 'bg-elysia-400 text-tactical-900 shadow-[0_0_10px_rgba(255,135,178,0.5)]' : 'text-gray-600 dark:text-gray-400 hover:text-elysia-500 dark:hover:text-elysia-100'"
        @click="activeMode = 'KEYFRAME_MODE'"
      >
        KEYFRAME_MODE
      </button>
    </div>

    <!-- Mode A: Reference Mode -->
    <div v-if="activeMode === 'REF_MODE'" class="w-full">
      <div
        class="w-full border-2 border-dashed border-elysia-400/40 bg-gray-100/50 dark:bg-tactical-800/50 clip-chamfer-lg p-8 flex flex-col items-center justify-center hover:bg-elysia-400/10 hover:border-elysia-400 transition-colors cursor-pointer group relative overflow-hidden"
        @click="fileInputs['refPool']?.click()"
      >
        <div class="absolute inset-0 bg-sakura-pattern opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
        <div class="relative z-10 text-elysia-400 font-mono mb-2 group-hover:animate-pulse font-bold tracking-widest">>> INGEST_ASSETS <<</div>
        <p class="relative z-10 text-gray-500 font-mono text-xs group-hover:text-elysia-600 dark:group-hover:text-elysia-100 transition-colors">把图片、视频或音频交给我吧♪</p>
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
      <div v-if="refAssets.length > 0" class="mt-4 flex flex-col gap-2">
        <div v-for="a in refAssets" :key="a.id" class="flex items-center justify-between p-2 border border-gray-300 dark:border-tactical-700 bg-gray-100 dark:bg-tactical-800 clip-chamfer">
          <div class="flex items-center gap-3 truncate">
            <span class="text-[10px] font-mono px-1.5 py-0.5 clip-chamfer-reverse bg-elysia-400/20 text-elysia-300 border border-elysia-400/30 dark:border-elysia-400/30">
              {{ a.role.replace('reference', '').toUpperCase() }}
            </span>
            <span class="text-xs font-mono text-gray-800 dark:text-elysia-50 truncate" :title="a.name">{{ assetLabel(a) }}</span>
          </div>
          <button class="text-gray-500 hover:text-elysia-400 hover:scale-110 transition-all font-mono text-sm ml-2" @click="composer.removeAsset(a.id)">✕</button>
        </div>
      </div>
    </div>

    <!-- Mode B: Keyframe Mode -->
    <div v-if="activeMode === 'KEYFRAME_MODE'" class="flex items-center gap-4 w-full">
      <!-- Start Frame Slot -->
      <div
        class="flex-1 border border-elysia-400/50 bg-gray-100 dark:bg-tactical-800 clip-chamfer p-4 relative h-32 flex flex-col items-center justify-center hover:border-elysia-400 cursor-pointer group transition-colors overflow-hidden"
        @click="fileInputs['firstFrame']?.click()"
      >
        <span class="absolute top-0 left-0 bg-elysia-400 text-tactical-900 font-mono text-[10px] px-2 font-bold z-10">SYS_START</span>
        <div v-if="assetsOf('firstFrame')[0]" class="relative z-10 flex flex-col items-center w-full">
           <span class="text-elysia-50 font-mono text-xs truncate max-w-[90%] bg-white/80 dark:bg-tactical-900/80 px-2 py-1">{{ assetsOf('firstFrame')[0].name }}</span>
           <button class="mt-2 text-[10px] border border-elysia-400/50 text-elysia-400 hover:bg-elysia-400 hover:text-tactical-900 px-2 py-0.5 clip-chamfer transition-colors" @click.stop="composer.removeAsset(assetsOf('firstFrame')[0].id)">REMOVE</button>
        </div>
        <span v-else class="text-elysia-400/50 font-mono text-sm group-hover:text-elysia-300 relative z-10 transition-colors">+ 接入首帧 (START FRAME)</span>

        <input
          :ref="(el) => (fileInputs['firstFrame'] = el as HTMLInputElement | null)"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFiles('firstFrame', ($event.target as HTMLInputElement).files)"
        />
      </div>

      <!-- Visual Timeline 连线 (水晶光流) -->
      <div class="w-16 h-[2px] bg-gradient-to-r from-elysia-500 to-elysia-300 relative neon-glow-pink">
        <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full animate-ping shadow-[0_0_8px_#FFF]"></div>
      </div>

      <!-- End Frame Slot -->
      <div
        class="flex-1 border border-elysia-400/50 bg-gray-100 dark:bg-tactical-800 clip-chamfer p-4 relative h-32 flex flex-col items-center justify-center hover:border-elysia-400 cursor-pointer group transition-colors overflow-hidden"
        @click="fileInputs['lastFrame']?.click()"
      >
        <span class="absolute bottom-0 right-0 bg-elysia-500 text-white font-mono text-[10px] px-2 font-bold z-10">SYS_END</span>
        <div v-if="assetsOf('lastFrame')[0]" class="relative z-10 flex flex-col items-center w-full">
           <span class="text-elysia-50 font-mono text-xs truncate max-w-[90%] bg-white/80 dark:bg-tactical-900/80 px-2 py-1">{{ assetsOf('lastFrame')[0].name }}</span>
           <button class="mt-2 text-[10px] border border-elysia-400/50 text-elysia-400 hover:bg-elysia-400 hover:text-tactical-900 px-2 py-0.5 clip-chamfer transition-colors" @click.stop="composer.removeAsset(assetsOf('lastFrame')[0].id)">REMOVE</button>
        </div>
        <span v-else class="text-elysia-400/50 font-mono text-sm group-hover:text-elysia-300 relative z-10 transition-colors">+ 接入尾帧 (END FRAME)</span>

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

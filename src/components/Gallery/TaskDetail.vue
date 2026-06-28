<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { VideoTask } from '@/types'
import { useTasksStore } from '@/stores/tasks'
import { useComposerStore } from '@/stores/composer'
import { useToastStore } from '@/stores/toast'
import Modal from '@/components/common/Modal.vue'
import TaskChain from './TaskChain.vue'
import { MODEL_META } from '@/config/models'
import { saveUrl } from '@/lib/download'

const props = defineProps<{ show: boolean; taskId: string | null }>()
const emit = defineEmits<{ close: []; select: [id: string] }>()

const tasks = useTasksStore()
const composer = useComposerStore()
const toast = useToastStore()

const videoUrl = ref<string | null>(null)
const coverUrl = ref<string | null>(null)
const lastFrameUrl = ref<string | null>(null)

const task = computed<VideoTask | undefined>(() =>
  props.taskId ? tasks.tasks.find((t) => t.id === props.taskId) : undefined,
)

const chain = computed<VideoTask[]>(() =>
  props.taskId ? tasks.getTaskChain(props.taskId) : [],
)

const elapsedSec = computed(() => {
  if (!task.value) return 0
  const end = task.value.finishedAt ?? Date.now()
  return Math.max(0, Math.floor((end - task.value.createdAt) / 1000))
})

const modelLabel = computed(() => (task.value ? MODEL_META[task.value.params.model]?.label : ''))

async function loadMedia() {
  videoUrl.value = null
  coverUrl.value = null
  lastFrameUrl.value = null
  if (!task.value) return
  coverUrl.value = await tasks.resolveCoverUrl(task.value)
  if (task.value.status === 'succeeded') {
    videoUrl.value = await tasks.resolveVideoUrl(task.value)
  }
  if (task.value.lastFrameImageId) {
    lastFrameUrl.value = await tasks.resolveLastFrameUrl(task.value)
  }
}

watch(() => [props.taskId, task.value?.status, task.value?.videoBlobId], loadMedia, { immediate: true })

onUnmounted(() => {
  // 视频是 blob URL，离开时释放
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(videoUrl.value)
  }
})

async function download() {
  if (!task.value) return
  if (videoUrl.value && videoUrl.value.startsWith('blob:')) {
    const a = document.createElement('a')
    a.href = videoUrl.value
    a.download = `seedance-${task.value.id.slice(0, 8)}.mp4`
    a.click()
  } else if (task.value.videoUrl) {
    await saveUrl(task.value.videoUrl, `seedance-${task.value.id.slice(0, 8)}.mp4`)
  }
}

async function continueFrame() {
  if (!task.value) return
  const res = await tasks.continueFromTask(task.value.id)
  if (!res.ok) toast.show(res.error ?? '续帧失败', 'error')
  else toast.show('已创建续帧任务', 'success')
}

function reuseConfig() {
  if (!task.value) return
  composer.setPrompt(task.value.prompt)
  composer.patchParams({ ...task.value.params })
  toast.show('已载入配置到输入区', 'info')
  emit('close')
}

async function retry() {
  if (!task.value) return
  await tasks.retryTask(task.value.id)
  toast.show('已重新提交', 'success')
}

async function remove() {
  if (!task.value) return
  await tasks.removeTask(task.value.id)
  emit('close')
}

function onSelectChain(id: string) {
  emit('select', id)
}
</script>

<template>
  <Modal :show="props.show" title="SYS_DETAIL_VIEW //" width="820px" @close="emit('close')">
    <div v-if="task" class="space-y-4">
      <!-- 视频播放 -->
      <div class="aspect-video w-full overflow-hidden clip-chamfer border-2 border-elysia-400/30 bg-tactical-900 relative group">
        <div class="absolute inset-0 bg-sakura-pattern opacity-10 pointer-events-none"></div>
        <video v-if="videoUrl" :src="videoUrl" controls autoplay class="h-full w-full object-contain relative z-10" />
        <img v-else-if="coverUrl" :src="coverUrl" class="h-full w-full object-contain opacity-60 relative z-10" />
        <div v-else class="flex h-full items-center justify-center text-elysia-400/30 font-mono text-xl tracking-widest relative z-10">NO_VISUAL_DATA</div>

        <!-- 四角装饰 -->
        <div class="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-elysia-400 z-20"></div>
        <div class="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-elysia-400 z-20"></div>
        <div class="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-elysia-400 z-20"></div>
        <div class="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-elysia-400 z-20"></div>
      </div>

      <!-- 续帧链 -->
      <TaskChain :chain="chain" :active-id="task.id" @select="onSelectChain" />

      <!-- 提示词 -->
      <div class="glass-elysia p-3 clip-chamfer border border-tactical-border relative overflow-hidden">
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-elysia-400"></div>
        <div class="mb-1 text-[10px] font-mono font-bold text-elysia-500 uppercase ml-2">PROMPT_DATA //</div>
        <p class="text-sm text-elysia-50 whitespace-pre-wrap ml-2 font-sans">{{ task.prompt || 'NO_PROMPT_DATA' }}</p>
      </div>

      <!-- 参数表 -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 bg-tactical-800 p-3 clip-chamfer border border-tactical-700">
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">MODEL</span><span class="font-mono text-xs text-elysia-100">{{ modelLabel }}</span></div>
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">RATIO</span><span class="font-mono text-xs text-elysia-100">{{ task.params.ratio }}</span></div>
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">RES</span><span class="font-mono text-xs text-elysia-100">{{ task.params.resolution }}</span></div>
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">DURATION</span><span class="font-mono text-xs text-elysia-100">{{ task.params.duration }}s</span></div>
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">SEED</span><span class="font-mono text-xs text-elysia-100">{{ task.params.seed ?? 'RANDOM' }}</span></div>
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">AUDIO_GEN</span><span class="font-mono text-xs text-elysia-100">{{ task.params.generateAudio ? 'TRUE' : 'FALSE' }}</span></div>
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">LAST_FRAME</span><span class="font-mono text-xs text-elysia-100">{{ task.params.returnLastFrame ? 'TRUE' : 'FALSE' }}</span></div>
        <div><span class="text-[10px] font-mono text-gray-500 block mb-0.5">WEB_SEARCH</span><span class="font-mono text-xs text-elysia-100">{{ task.params.webSearch ? 'TRUE' : 'FALSE' }}</span></div>
      </div>

      <!-- 状态 -->
      <div class="flex flex-wrap gap-x-6 gap-y-1 text-[10px] font-mono text-gray-500 uppercase">
        <span>STATUS: <span class="text-elysia-400">{{ task.status }}</span></span>
        <span>ELAPSED: <span class="text-elysia-400">{{ elapsedSec }}s</span></span>
        <span>ASSETS: <span class="text-elysia-400">{{ task.assetIds.length }}</span></span>
        <span v-if="task.remoteTaskId">REMOTE_ID: <span class="text-elysia-400">{{ task.remoteTaskId.slice(0, 12) }}…</span></span>
      </div>

      <div v-if="task.error" class="border border-red-500/50 bg-red-900/20 p-2 text-xs text-red-400 clip-chamfer font-mono">
        >> ERR_MSG: {{ task.error }}
      </div>
      <div v-if="task.errorDetails && Object.keys(task.errorDetails).length" class="border border-tactical-600 bg-tactical-800 p-2 text-xs text-gray-400 clip-chamfer font-mono">
        <div class="mb-1 font-bold text-elysia-500">>> DIAGNOSTIC_DATA</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <template v-for="(val, key) in task.errorDetails" :key="key">
            <span class="text-gray-500">{{ key }}</span>
            <span class="break-all text-gray-300">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
          </template>
        </div>
      </div>

      <!-- 末帧预览 -->
      <div v-if="lastFrameUrl" class="flex items-center gap-3 border border-tactical-700 bg-tactical-800 p-2 clip-chamfer">
        <img :src="lastFrameUrl" class="h-16 w-24 object-cover border border-elysia-400/50" />
        <span class="text-[10px] font-mono text-elysia-400/80 uppercase">SYS_LAST_FRAME_SAVED<br/>> READY_FOR_CHAIN</span>
      </div>

      <!-- 操作 -->
      <div class="flex flex-wrap gap-2 pt-2 border-t border-elysia-400/20">
        <button v-if="task.status === 'succeeded'" class="bg-elysia-400 text-tactical-900 px-4 py-2 font-mono text-xs font-bold clip-chamfer hover:bg-elysia-300 transition-colors shadow-[0_0_10px_rgba(255,135,178,0.4)]" @click="download">> DOWNLOAD_VIDEO</button>
        <button v-if="task.status === 'succeeded' && task.lastFrameImageId" class="border border-teal-500/50 bg-teal-900/20 text-teal-400 px-4 py-2 font-mono text-xs clip-chamfer hover:bg-teal-400 hover:text-tactical-900 transition-colors" @click="continueFrame">> CHAIN_FRAME</button>
        <button class="border border-tactical-500 bg-tactical-800 text-gray-300 px-4 py-2 font-mono text-xs clip-chamfer hover:border-elysia-400 hover:text-elysia-300 transition-colors" @click="reuseConfig">> CLONE_CFG</button>
        <button v-if="task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired'" class="border border-tactical-500 bg-tactical-800 text-gray-300 px-4 py-2 font-mono text-xs clip-chamfer hover:border-elysia-400 hover:text-elysia-300 transition-colors" @click="retry">> RETRY_EXEC</button>
        <button class="border border-red-900/50 bg-tactical-800 text-red-500 px-4 py-2 font-mono text-xs clip-chamfer hover:bg-red-900/40 transition-colors ml-auto" @click="remove">> PURGE_RECORD</button>
      </div>
    </div>
  </Modal>
</template>

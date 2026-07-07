<script setup lang="ts">
import { computed } from 'vue'
import type { VideoTask } from '@/types'
import { useTasksStore } from '@/stores/tasks'
import Modal from '@/components/common/Modal.vue'
import TaskChain from './TaskChain.vue'
import { MODEL_META } from '@/config/models'
import { useTicker } from '@/composables/useTicker'
import { useTaskMedia, useTaskActions } from '@/composables/useTaskItem'

const props = defineProps<{ show: boolean; taskId: string | null }>()
const emit = defineEmits<{ close: []; select: [id: string] }>()

const tasks = useTasksStore()

const task = computed<VideoTask | undefined>(() =>
  props.taskId ? tasks.tasks.find((t) => t.id === props.taskId) : undefined,
)

const chain = computed<VideoTask[]>(() =>
  props.taskId ? tasks.getTaskChain(props.taskId) : [],
)

// 仅运行中时计时才跳动，避免弹窗常开时无意义轮询
const now = useTicker(() => task.value?.status === 'running')

const elapsedSec = computed(() => {
  if (!task.value) return 0
  const end = task.value.finishedAt ?? now.value
  return Math.max(0, Math.floor((end - task.value.createdAt) / 1000))
})

const modelLabel = computed(() => (task.value ? MODEL_META[task.value.params.model]?.label : ''))

const { videoUrl, coverUrl, lastFrameUrl } = useTaskMedia(() => task.value)
const actions = useTaskActions(() => task.value, videoUrl)
const { download, continueFrame, retry } = actions

// 复用配置 / 删除后需要关闭详情弹窗
function reuseConfig() {
  actions.reuseConfig()
  emit('close')
}

async function remove() {
  if (!task.value) return
  await actions.remove()
  emit('close')
}

function onSelectChain(id: string) {
  emit('select', id)
}
</script>

<template>
  <Modal :show="props.show" title="SYS_DETAIL_VIEW //" width="820px" @close="emit('close')">
    <div v-if="task" class="space-y-6">
      <!-- 视频播放 -->
      <div class="aspect-video w-full overflow-hidden border border-gray-700 bg-ak-darker relative group shadow-lg">
        <div class="absolute inset-0 bg-[url('/images/0045A6E438A50352E2AF924005AC8CD6.png')] bg-cover bg-center mix-blend-screen opacity-10 pointer-events-none"></div>
        <video v-if="videoUrl" :src="videoUrl" controls autoplay class="h-full w-full object-contain relative z-10" />
        <img v-else-if="coverUrl" :src="coverUrl" class="h-full w-full object-contain opacity-60 relative z-10" />
        <div v-else class="flex flex-col h-full items-center justify-center text-gray-700 font-sans font-black text-2xl tracking-widest relative z-10 uppercase">
          NO_VISUAL_DATA
        </div>

        <!-- 四角装饰 -->
        <div class="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-ak-400 z-20"></div>
        <div class="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-ak-400 z-20"></div>
      </div>

      <!-- 续帧链 -->
      <TaskChain :chain="chain" :active-id="task.id" @select="onSelectChain" />

      <!-- 提示词 -->
      <div class="bg-ak-gray p-4 border-l-4 border-ak-400 relative overflow-hidden">
        <div class="mb-2 text-xs font-sans font-bold tracking-widest text-gray-500 uppercase">PROMPT_DATA //</div>
        <p class="text-sm text-white whitespace-pre-wrap font-sans tracking-wide leading-relaxed">{{ task.prompt || 'NO_PROMPT_DATA' }}</p>
      </div>

      <!-- 参数表 -->
      <div class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4 bg-ak-dark/50 p-6 border border-gray-800">
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">MODEL</span><span class="font-mono text-xs text-white">{{ modelLabel }}</span></div>
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">RATIO</span><span class="font-mono text-xs text-white">{{ task.params.ratio }}</span></div>
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">RES</span><span class="font-mono text-xs text-white">{{ task.params.resolution }}</span></div>
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">DURATION</span><span class="font-mono text-xs text-white">{{ task.params.duration }}s</span></div>
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">SEED</span><span class="font-mono text-xs text-white">{{ task.params.seed ?? 'RANDOM' }}</span></div>
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">AUDIO_GEN</span><span class="font-mono text-xs" :class="task.params.generateAudio ? 'text-ak-400' : 'text-gray-500'">{{ task.params.generateAudio ? 'TRUE' : 'FALSE' }}</span></div>
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">LAST_FRAME</span><span class="font-mono text-xs" :class="task.params.returnLastFrame ? 'text-ak-400' : 'text-gray-500'">{{ task.params.returnLastFrame ? 'TRUE' : 'FALSE' }}</span></div>
        <div><span class="text-[10px] font-sans font-bold tracking-widest text-gray-600 block mb-1 uppercase">WEB_SEARCH</span><span class="font-mono text-xs" :class="task.params.webSearch ? 'text-ak-400' : 'text-gray-500'">{{ task.params.webSearch ? 'TRUE' : 'FALSE' }}</span></div>
      </div>

      <!-- 状态 -->
      <div class="flex flex-wrap gap-x-8 gap-y-2 text-xs font-sans font-bold tracking-widest text-gray-600 uppercase pt-2 border-t border-gray-800">
        <span>STATUS: <span class="text-white ml-2">{{ task.status }}</span></span>
        <span>ELAPSED: <span class="text-white ml-2">{{ elapsedSec }}s</span></span>
        <span>ASSETS: <span class="text-white ml-2">{{ task.assetIds.length }}</span></span>
        <span v-if="task.remoteTaskId">REMOTE_ID: <span class="text-white ml-2 font-mono font-normal">{{ task.remoteTaskId.slice(0, 12) }}…</span></span>
      </div>

      <div v-if="task.error" class="border border-red-500/50 bg-red-900/20 p-3 text-xs text-red-400 font-mono">
        >> ERR_MSG: {{ task.error }}
      </div>
      <div v-if="task.errorDetails && Object.keys(task.errorDetails).length" class="border border-gray-700 bg-ak-gray p-3 text-xs text-gray-400 font-mono">
        <div class="mb-2 font-bold text-ak-400">>> DIAGNOSTIC_DATA</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <template v-for="(val, key) in task.errorDetails" :key="key">
            <span class="text-gray-500">{{ key }}</span>
            <span class="break-all text-gray-300">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
          </template>
        </div>
      </div>

      <!-- 末帧预览 -->
      <div v-if="lastFrameUrl" class="flex items-center gap-4 border border-gray-700 bg-ak-dark/50 p-3">
        <img :src="lastFrameUrl" class="h-20 w-32 object-cover border border-ak-400" />
        <span class="text-xs font-sans font-bold tracking-widest text-ak-400 uppercase leading-relaxed">SYS_LAST_FRAME_SAVED<br/>> READY_FOR_CHAIN</span>
      </div>

      <!-- 操作 -->
      <div class="flex flex-wrap gap-3 pt-6">
        <button v-if="task.status === 'succeeded'" class="bg-white text-ak-darker px-6 py-3 font-sans text-xs font-black tracking-widest uppercase hover:bg-gray-200 transition-colors" @click="download">DOWNLOAD</button>
        <button v-if="task.status === 'succeeded' && task.lastFrameImageId" class="border border-ak-400 bg-ak-400/10 text-ak-400 px-6 py-3 font-sans text-xs font-black tracking-widest uppercase hover:bg-ak-400 hover:text-ak-darker transition-colors" @click="continueFrame">CHAIN_FRAME</button>
        <button class="bg-ak-gray text-white px-6 py-3 font-sans text-xs font-bold tracking-widest uppercase hover:text-ak-400 transition-colors" @click="reuseConfig">CLONE_CFG</button>
        <button v-if="task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired'" class="bg-ak-gray text-white px-6 py-3 font-sans text-xs font-bold tracking-widest uppercase hover:text-ak-400 transition-colors" @click="retry">RETRY_EXEC</button>
        <button class="border border-red-900 bg-transparent text-red-500 px-6 py-3 font-sans text-xs font-bold tracking-widest uppercase hover:bg-red-900/40 transition-colors ml-auto" @click="remove">PURGE</button>
      </div>
    </div>
  </Modal>
</template>
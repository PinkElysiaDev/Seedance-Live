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
  <Modal :show="props.show" title="任务详情" width="820px" @close="emit('close')">
    <div v-if="task" class="space-y-4">
      <!-- 视频播放 -->
      <div class="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <video v-if="videoUrl" :src="videoUrl" controls autoplay class="h-full w-full object-contain" />
        <img v-else-if="coverUrl" :src="coverUrl" class="h-full w-full object-contain opacity-80" />
        <div v-else class="flex h-full items-center justify-center text-gray-400">无预览</div>
      </div>

      <!-- 续帧链 -->
      <TaskChain :chain="chain" :active-id="task.id" @select="onSelectChain" />

      <!-- 提示词 -->
      <div>
        <div class="mb-1 text-xs font-medium text-gray-500">提示词</div>
        <p class="rounded-lg bg-gray-50 p-3 text-sm text-gray-800 whitespace-pre-wrap">{{ task.prompt || '（无）' }}</p>
      </div>

      <!-- 参数表 -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div><span class="text-gray-400">模型</span><br>{{ modelLabel }}</div>
        <div><span class="text-gray-400">比例</span><br>{{ task.params.ratio }}</div>
        <div><span class="text-gray-400">分辨率</span><br>{{ task.params.resolution }}</div>
        <div><span class="text-gray-400">时长</span><br>{{ task.params.duration }}s</div>
        <div><span class="text-gray-400">Seed</span><br>{{ task.params.seed ?? '随机' }}</div>
        <div><span class="text-gray-400">生成音频</span><br>{{ task.params.generateAudio ? '是' : '否' }}</div>
        <div><span class="text-gray-400">返回末帧</span><br>{{ task.params.returnLastFrame ? '是' : '否' }}</div>
        <div><span class="text-gray-400">联网搜索</span><br>{{ task.params.webSearch ? '是' : '否' }}</div>
      </div>

      <!-- 状态 -->
      <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500">
        <span>状态：{{ task.status }}</span>
        <span>耗时：{{ elapsedSec }}s</span>
        <span>素材：{{ task.assetIds.length }} 个</span>
        <span v-if="task.remoteTaskId">远程 ID：{{ task.remoteTaskId.slice(0, 12) }}…</span>
      </div>
      <p v-if="task.error" class="rounded-lg bg-red-50 p-2 text-xs text-red-600">{{ task.error }}</p>
      <div v-if="task.errorDetails && Object.keys(task.errorDetails).length" class="rounded-lg bg-gray-50 p-2 text-xs text-gray-600">
        <div class="mb-1 font-medium text-gray-500">诊断信息</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <template v-for="(val, key) in task.errorDetails" :key="key">
            <span class="text-gray-400">{{ key }}</span>
            <span class="break-all">{{ typeof val === 'object' ? JSON.stringify(val) : val }}</span>
          </template>
        </div>
      </div>

      <!-- 末帧预览 -->
      <div v-if="lastFrameUrl" class="flex items-center gap-3">
        <img :src="lastFrameUrl" class="h-16 w-24 rounded border border-gray-200 object-cover" />
        <span class="text-xs text-gray-500">末帧（可用于续帧）</span>
      </div>

      <!-- 操作 -->
      <div class="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button v-if="task.status === 'succeeded'" class="rounded-lg bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700" @click="download">下载视频</button>
        <button v-if="task.status === 'succeeded' && task.lastFrameImageId" class="rounded-lg border border-violet-300 px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50" @click="continueFrame">续帧</button>
        <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" @click="reuseConfig">复用配置</button>
        <button v-if="task.status === 'failed' || task.status === 'cancelled' || task.status === 'expired'" class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50" @click="retry">重试</button>
        <button class="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50" @click="remove">删除</button>
      </div>
    </div>
  </Modal>
</template>

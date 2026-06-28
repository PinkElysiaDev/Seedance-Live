<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import TaskCard from './TaskCard.vue'
import TaskDetail from './TaskDetail.vue'
import type { TaskStatus } from '@/types'

const tasks = useTasksStore()
const filter = ref<'all' | TaskStatus>('all')
const keyword = ref('')
const detailId = ref<string | null>(null)
const detailShow = ref(false)

const filtered = computed(() => {
  let list = tasks.tasks
  if (filter.value !== 'all') list = list.filter((t) => t.status === filter.value)
  const kw = keyword.value.trim().toLowerCase()
  if (kw) list = list.filter((t) => t.prompt.toLowerCase().includes(kw))
  return list
})

const filters: Array<{ value: 'all' | TaskStatus; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '生成中' },
  { value: 'succeeded', label: '完成' },
  { value: 'failed', label: '失败' },
]

function openDetail(id: string) {
  detailId.value = id
  detailShow.value = true
}
function closeDetail() {
  detailShow.value = false
}
// 续帧链内切换节点
function selectInChain(id: string) {
  detailId.value = id
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2 border-b border-elysia-400/20 pb-3">
      <div class="relative flex-1">
        <div class="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-elysia-400 clip-chamfer shadow-[0_0_5px_#FF87B2]"></div>
        <input
          v-model="keyword"
          placeholder="SEARCH_QUERY..."
          class="w-full bg-tactical-800 dark:bg-tactical-800 border border-tactical-700 dark:border-tactical-700 focus:border-elysia-400/50 pl-7 pr-3 py-1.5 text-sm text-gray-800 dark:text-elysia-50 font-mono outline-none clip-chamfer transition-colors placeholder-gray-500 dark:placeholder-gray-600"
        />
      </div>
      <div class="flex gap-1 bg-tactical-800 dark:bg-tactical-800 p-1 clip-chamfer border border-tactical-700 dark:border-tactical-700">
        <button
          v-for="f in filters"
          :key="f.value"
          class="px-3 py-1 text-xs font-mono clip-chamfer transition-all"
          :class="filter === f.value ? 'bg-elysia-400 text-white dark:text-tactical-900 font-bold shadow-[0_0_8px_rgba(255,135,178,0.4)]' : 'text-gray-600 dark:text-gray-500 hover:text-elysia-600 dark:hover:text-elysia-300'"
          @click="filter = f.value"
        >{{ f.label }}</button>
      </div>
    </div>

    <div v-if="filtered.length === 0" class="border-2 border-dashed border-gray-300 dark:border-tactical-700 py-20 flex flex-col items-center justify-center clip-chamfer-lg bg-gray-100/50 dark:bg-tactical-800/30">
      <div class="text-gray-500 dark:text-gray-600 font-mono mb-2 text-xl">[ DATA_VOID ]</div>
      <div class="text-gray-400 dark:text-gray-500 font-mono text-sm">NO TASKS FOUND IN ARCHIVE</div>
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <TaskCard v-for="task in filtered" :key="task.id" :task="task" @open="openDetail(task.id)" />
    </div>

    <TaskDetail
      :show="detailShow"
      :task-id="detailId"
      @close="closeDetail"
      @select="selectInChain"
    />
  </div>
</template>

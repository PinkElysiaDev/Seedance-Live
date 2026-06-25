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
  <div class="flex flex-col gap-3">
    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="keyword"
        placeholder="搜索提示词…"
        class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
      />
      <div class="flex gap-1">
        <button
          v-for="f in filters"
          :key="f.value"
          class="rounded-lg px-3 py-1.5 text-sm"
          :class="filter === f.value ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'"
          @click="filter = f.value"
        >{{ f.label }}</button>
      </div>
    </div>

    <div v-if="filtered.length === 0" class="rounded-xl border border-dashed border-gray-300 py-16 text-center text-sm text-gray-400">
      暂无任务，在上方输入提示词后点击生成
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

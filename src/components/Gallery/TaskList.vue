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

// 分成两列，实现插空排布
const leftColTasks = computed(() => filtered.value.filter((_, i) => i % 2 === 0))
const rightColTasks = computed(() => filtered.value.filter((_, i) => i % 2 === 1))

const filters: Array<{ value: 'all' | TaskStatus; label: string }> = [
  { value: 'all', label: '全部记录' },
  { value: 'running', label: '生成中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
]

function openDetail(id: string) {
  detailId.value = id
  detailShow.value = true
}
function closeDetail() {
  detailShow.value = false
}
function selectInChain(id: string) {
  detailId.value = id
}
</script>

<template>
  <div class="flex h-full gap-8">

    <!-- Left: Task Grid -->
    <div class="flex-1 flex flex-col gap-6 overflow-y-auto hide-scrollbar pb-12">
      <!-- Search Input Top -->
      <div class="relative w-[calc(50%-0.75rem)]">
        <input
          v-model="keyword"
          placeholder="SEARCH ARCHIVE..."
          class="w-full bg-ak-dark/50 border-b-2 border-gray-600 focus:border-ak-400 py-3 pl-4 pr-10 text-lg text-white font-sans outline-none transition-colors placeholder-gray-600"
        />
        <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <div class="w-2 h-2 bg-ak-400"></div>
        </div>
      </div>

      <div v-if="filtered.length === 0" class="flex-1 border border-dashed border-gray-700 py-20 flex flex-col items-center justify-center bg-ak-dark/30 relative">
        <div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-gray-600"></div>
        <div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-gray-600"></div>
        <div class="text-gray-500 font-sans font-black tracking-[0.3em] mb-2 text-2xl uppercase">DATA_VOID</div>
        <div class="text-gray-600 font-sans text-sm tracking-wider uppercase">No records found matching criteria</div>
      </div>

      <!-- Two-column masonry layout (插空排布) -->
      <div v-else class="flex gap-6 items-start w-full">
        <!-- Left Column -->
        <div class="flex-1 min-w-0 flex flex-col gap-6">
          <TaskCard v-for="task in leftColTasks" :key="task.id" :task="task" @open="openDetail(task.id)" />
        </div>

        <!-- Right Column (Offset downwards by half a card height roughly) -->
        <div class="flex-1 min-w-0 flex flex-col gap-6 mt-16">
          <TaskCard v-for="task in rightColTasks" :key="task.id" :task="task" @open="openDetail(task.id)" />
        </div>
      </div>
    </div>

    <!-- Right: Filter Column (re-placed here for tighter integration with TaskList) -->
    <div class="w-72 flex flex-col gap-3 relative overflow-hidden">
      <!-- 巨大竖排 ARCHIVE 背景装饰 -->
      <div class="pointer-events-none absolute -top-4 -right-8 text-[120px] leading-none font-sans font-black text-white/5 uppercase tracking-tighter select-none rotate-90 origin-top-right">
        ARCHIVE
      </div>

      <!-- VIDEO / 视频列表 标题，紧贴“全部记录”之上 -->
      <div class="relative text-right mb-8 pr-1 -mt-3.5">
        <div class="font-sans font-black text-ak-400 text-7xl tracking-tighter uppercase leading-none drop-shadow-[0_0_15px_rgba(0,229,255,0.4)]">
          VIDEO
        </div>
        <div class="font-sans text-white tracking-[0.45em] text-lg mt-3 opacity-50">
          视频列表
        </div>
      </div>

      <button
        v-for="f in filters"
        :key="f.value"
        class="group relative flex items-center justify-between w-full text-left py-3 px-4 transition-all duration-300 bg-ak-gray hover:bg-ak-400/20"
        @click="filter = f.value"
      >
        <span
          class="font-sans font-bold text-sm tracking-widest transition-colors z-10"
          :class="filter === f.value ? 'text-ak-400' : 'text-gray-400 group-hover:text-white'"
        >
          {{ f.label }}
        </span>
        <span
          v-if="filter === f.value"
          class="font-sans font-black text-ak-400 opacity-50 z-10"
        >&lt;</span>

        <!-- Active Background Highlight -->
        <div
          class="absolute inset-0 bg-ak-400/10 transition-opacity duration-300"
          :class="filter === f.value ? 'opacity-100 border-l-4 border-ak-400' : 'opacity-0 border-l-4 border-transparent'"
        ></div>
      </button>

      <!-- Back button style matching Arknights -->
      <button
        class="group relative flex items-center justify-between w-full text-left py-3 px-4 mt-auto transition-all duration-300 bg-white hover:bg-gray-200"
        @click="filter = 'all'; keyword = ''"
      >
        <div class="flex items-center gap-2">
          <div class="w-6 h-px bg-ak-darker"></div>
          <span class="font-sans font-black text-ak-darker tracking-widest uppercase text-sm">
            RESET
          </span>
        </div>
      </button>
    </div>

    <TaskDetail
      :show="detailShow"
      :task-id="detailId"
      @close="closeDetail"
      @select="selectInChain"
    />
  </div>
</template>
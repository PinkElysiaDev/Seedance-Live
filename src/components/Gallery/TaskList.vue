<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import { useI18nStore } from '@/stores/i18n'
import TaskCard from './TaskCard.vue'
import TaskDetail from './TaskDetail.vue'
import type { TaskStatus } from '@/types'

const tasks = useTasksStore()
const { t } = useI18nStore()
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

// 筛选项：label 在模板中按当前 locale 实时翻译
const filterValues: Array<'all' | TaskStatus> = ['all', 'running', 'succeeded', 'failed']
const filterLabelKey: Record<'all' | TaskStatus, string> = {
  all: 'filter.all',
  running: 'filter.running',
  succeeded: 'filter.succeeded',
  failed: 'filter.failed',
  cancelled: 'filter.failed',
  expired: 'filter.failed',
  queued: 'filter.running',
}

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
          class="w-full bg-th-bg-panel/50 border-b-2 border-th-border focus:border-th-accent py-3 pl-4 pr-10 text-lg text-th-text-primary font-sans outline-none transition-colors placeholder-th-text-muted"
        />
        <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <div class="w-2 h-2 bg-th-accent"></div>
        </div>
      </div>

      <div v-if="filtered.length === 0" class="flex-1 border border-dashed border-th-border py-20 flex flex-col items-center justify-center bg-th-bg-panel/30 relative">
        <div class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-th-border"></div>
        <div class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-th-border"></div>
        <div class="text-th-text-muted font-sans font-black tracking-[0.3em] mb-2 text-2xl uppercase">DATA_VOID</div>
        <div class="text-th-text-muted font-sans text-sm tracking-wider uppercase">No records found matching criteria</div>
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
      <div class="pointer-events-none absolute -top-4 -right-8 text-[120px] leading-none font-sans font-black text-th-text-primary/5 uppercase tracking-tighter select-none rotate-90 origin-top-right">
        ARCHIVE
      </div>

      <!-- VIDEO / 视频列表 标题，紧贴“全部记录”之上 -->
      <div class="relative text-right mb-8 pr-1 -mt-3.5">
        <div class="font-sans font-black text-th-accent text-7xl tracking-tighter uppercase leading-none" :style="{ filter: 'drop-shadow(0 0 15px var(--th-accent-glow))' }">
          VIDEO
        </div>
        <div class="font-sans text-th-text-primary tracking-[0.45em] text-lg mt-3 opacity-50">
          {{ t('gallery.videoList') }}
        </div>
      </div>

      <button
        v-for="f in filterValues"
        :key="f"
        class="group relative flex items-center justify-between w-full h-12 text-left px-4 transition-colors duration-300 bg-th-bg-elevated hover:bg-[rgba(var(--th-accent-rgb),0.2)] overflow-hidden"
        @click="filter = f"
      >
        <span
          class="font-sans font-bold text-sm tracking-widest transition-colors z-10"
          :class="filter === f ? 'text-th-accent' : 'text-th-text-secondary group-hover:text-th-text-primary'"
        >
          {{ t(filterLabelKey[f]) }}
        </span>
        <span
          class="font-sans font-black text-th-accent z-10 transition-opacity duration-300"
          :class="filter === f ? 'opacity-50' : 'opacity-0'"
        >&lt;</span>

        <!-- Active Background Highlight -->
        <div
          class="absolute inset-0 bg-[rgba(var(--th-accent-rgb),0.1)] transition-opacity duration-300"
          :class="filter === f ? 'opacity-100' : 'opacity-0'"
        ></div>

        <!-- 选中态竖条：从右向左出现并移动到最左侧 -->
        <div
          class="absolute top-0 bottom-0 w-1 bg-th-accent transition-[left,opacity] duration-300 ease-out z-20"
          :class="filter === f ? 'left-0 opacity-100' : 'left-full opacity-0'"
        ></div>
      </button>

      <!-- Back button style matching Arknights -->
      <button
        class="group relative flex items-center justify-between w-full text-left py-3 px-4 mt-auto transition-colors duration-300 bg-th-accent text-th-on-accent hover:bg-th-accent-dim overflow-hidden"
        @click="filter = 'all'; keyword = ''"
      >
        <!-- 左侧动态方块：方块造型，hover 时高度变化（保持上一版动效） -->
        <span class="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-th-on-accent group-hover:h-4 transition-[height] duration-300"></span>
        <div class="flex items-center gap-2 pl-6">
          <div class="w-6 h-px bg-th-on-accent"></div>
          <span class="font-sans font-black text-th-on-accent tracking-widest uppercase text-sm">
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
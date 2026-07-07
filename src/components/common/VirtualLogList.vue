<script setup lang="ts" generic="T extends { id: number | string }">
import { ref, computed } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'

/**
 * 通用虚拟列表：仅渲染视口内的行（+ overscan），行高动态测量。
 *
 * - 行由具名 slot `row` 渲染，slot prop `{ item, index }`。
 * - `gap` 以透明 paddingBottom 实现，保留行间缝隙视觉（替代原 mb / space-y）。
 * - 行节点挂载后交由虚拟器测量（含 gap），高度变化由内置 ResizeObserver 自动回流。
 * - `decorations` slot 渲染固定不滚动的装饰（如扫描线），`empty` slot 渲染空状态。
 */
const props = withDefaults(
  defineProps<{
    items: T[]
    estimateSize?: number
    overscan?: number
    gap?: number
  }>(),
  { estimateSize: 36, overscan: 6, gap: 0 },
)

const scrollRef = ref<HTMLElement | null>(null)

// 以 computed 传入选项，使 items 数量变化时虚拟器能重新 setOptions（plain object 不会触发）
const virtualizer = useVirtualizer<HTMLElement, HTMLElement>(
  computed(() => ({
    count: props.items.length,
    getScrollElement: () => scrollRef.value,
    estimateSize: () => props.estimateSize,
    overscan: props.overscan,
    getItemKey: (index: number) => props.items[index]?.id ?? index,
  })),
)

const virtualItems = computed(() => virtualizer.value.getVirtualItems())
const totalSize = computed(() => virtualizer.value.getTotalSize())

function measureEl(el: Element | unknown) {
  // 挂载时传元素测量；卸载时传 null 清理缓存
  virtualizer.value.measureElement(el instanceof HTMLElement ? el : null)
}
</script>

<template>
  <div ref="scrollRef" class="overflow-auto h-full">
    <slot name="decorations" />
    <div v-if="!items.length" class="h-full">
      <slot name="empty" />
    </div>
    <div v-else :style="{ height: `${totalSize}px`, position: 'relative', width: '100%' }">
      <div
        v-for="vi in virtualItems"
        :key="vi.key as string | number"
        :data-index="vi.index"
        :ref="measureEl"
        :style="{
          position: 'absolute',
          top: `${vi.start}px`,
          left: 0,
          right: 0,
          width: '100%',
          paddingBottom: `${gap}px`,
        }"
      >
        <slot name="row" :item="items[vi.index]" :index="vi.index" />
      </div>
    </div>
  </div>
</template>

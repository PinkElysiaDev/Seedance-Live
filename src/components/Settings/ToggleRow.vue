<script setup lang="ts">
/**
 * 设置页通用的开关行：左侧标题 + 副标题，右侧 ACTIVE/INACTIVE 文案与指示灯竖条。
 * 仅展示与触发 toggle，持久化由父组件通过 v-model 处理。
 */
defineProps<{
  label: string
  hint: string
  modelValue: boolean
  /** 标题字号等基础类，默认 text-sm */
  labelClass?: string
  /** 关闭态标题颜色，默认 text-gray-400 */
  inactiveClass?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <div
    class="flex items-center justify-between gap-3 p-4 md:p-6 cursor-pointer transition-colors duration-300 border border-th-border bg-th-bg-panel/50 hover:border-th-accent/50"
    @click="emit('update:modelValue', !modelValue)"
  >
    <!-- min-w-0 + break-words：长标签可换行/收缩，避免挤压右侧状态文案（item 10） -->
    <div class="flex flex-col gap-1 min-w-0">
      <span
        class="font-sans italic font-bold tracking-widest uppercase break-words"
        :class="[labelClass ?? 'text-sm', modelValue ? 'text-th-accent' : (inactiveClass ?? 'text-th-text-secondary')]"
      >{{ label }}</span>
      <span class="font-mono text-[10px] text-th-text-muted break-words">{{ hint }}</span>
    </div>
    <!-- flex-shrink-0 + whitespace-nowrap：[ ACTIVE ]/[[ INACTIVE ]] 始终单行，不再被挤成三行 -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <span class="font-sans text-xs tracking-wider font-bold whitespace-nowrap" :class="modelValue ? 'text-th-accent' : 'text-th-text-muted'">
        {{ modelValue ? '[ ACTIVE ]' : '[ INACTIVE ]' }}
      </span>
      <div class="w-1.5 h-4 bg-th-accent transition duration-300 flex-shrink-0" :class="modelValue ? 'opacity-100' : 'opacity-20'"></div>
    </div>
  </div>
</template>

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
    class="flex items-center justify-between p-4 md:p-6 cursor-pointer transition-colors duration-300 border border-gray-800 bg-ak-dark/50 hover:border-ak-400/50"
    @click="emit('update:modelValue', !modelValue)"
  >
    <div class="flex flex-col gap-1">
      <span
        class="font-sans italic font-bold tracking-widest uppercase"
        :class="[labelClass ?? 'text-sm', modelValue ? 'text-ak-400' : (inactiveClass ?? 'text-gray-400')]"
      >{{ label }}</span>
      <span class="font-mono text-[10px] text-gray-500">{{ hint }}</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="font-sans text-xs tracking-wider font-bold" :class="modelValue ? 'text-ak-400' : 'text-gray-500'">
        {{ modelValue ? '[ ACTIVE ]' : '[ INACTIVE ]' }}
      </span>
      <div class="w-1.5 h-4 bg-ak-400 transition duration-300" :class="modelValue ? 'opacity-100 shadow-[0_0_8px_#00E5FF]' : 'opacity-20'"></div>
    </div>
  </div>
</template>

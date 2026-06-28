<template>
  <div class="h-full flex overflow-hidden">
    <!-- Action Axis (Left) -->
    <div class="w-1/3 min-w-[320px] max-w-[480px] h-full flex flex-col border-r-2 border-elysia-400/30 bg-tactical-800/90 p-4 space-y-4 overflow-y-auto">
      <Composer />
      <AssetSlots />
      <ParamPanel />
    </div>

    <!-- Monitor Axis (Right) -->
    <div class="flex-1 h-full relative bg-tactical-900 overflow-hidden flex flex-col">
      <!-- 临时放 TaskList 占位 -->
      <div class="p-6 h-full overflow-y-auto">
        <TaskList />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Composer from '@/components/Composer/Composer.vue'
import AssetSlots from '@/components/Composer/AssetSlots.vue'
import ParamPanel from '@/components/Composer/ParamPanel.vue'
import TaskList from '@/components/Gallery/TaskList.vue'
</script>
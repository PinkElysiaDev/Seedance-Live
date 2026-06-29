<template>
  <div class="h-full relative overflow-hidden flex pt-8">

    <!-- Massive thumbnails / Task list (Left) -->
    <div class="flex-1 h-full px-8 overflow-hidden z-10 relative">
      <TaskList />
    </div>
  </div>
</template>

<script setup lang="ts">
import TaskList from '@/components/Gallery/TaskList.vue'
</script>
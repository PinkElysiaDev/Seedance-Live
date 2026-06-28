<template>
  <div class="h-full relative flex flex-col bg-tactical-900 overflow-hidden">
    <div class="absolute inset-0 bg-sakura-pattern opacity-10 pointer-events-none"></div>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-tactical-900/50 to-tactical-900 pointer-events-none z-0"></div>

    <div class="relative z-10 flex flex-col h-full p-4 md:p-6 gap-4">
      <div class="flex items-end justify-between border-b-2 border-elysia-400/30 pb-2">
        <h1 class="text-3xl md:text-4xl font-sans italic font-black text-elysia-400 drop-shadow-[0_0_12px_rgba(255,135,178,0.6)] uppercase tracking-wider flex items-center gap-3">
          <div class="h-8 w-4 bg-elysia-500 clip-chamfer-reverse shadow-[0_0_10px_#FF5090] animate-pulse"></div>
          SYSTEM_SETTINGS
        </h1>
        <div class="font-mono text-xs text-elysia-400/60 hidden md:block">
          [SYS.CORE.CFG.OVERRIDE]
        </div>
      </div>

      <div class="flex-1 min-h-0 relative">
        <!-- Pillars Layout -->
        <div v-if="!expandedPillar" class="h-full flex gap-4 md:gap-6 w-full items-stretch p-2 pb-8 overflow-x-auto snap-x snap-mandatory hide-scrollbar">

          <!-- Pillar 1: Provider -->
          <div class="flex-1 min-w-[280px] group cursor-pointer snap-center relative border border-tactical-700 bg-tactical-800/50 hover:bg-tactical-800 clip-chamfer hover:border-elysia-400 transition-all duration-500 flex flex-col" @click="expandPillar('provider')">
            <div class="absolute inset-0 bg-gradient-to-b from-elysia-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div class="p-6 flex-1 flex flex-col items-center justify-center gap-4 text-center z-10 relative group-hover:-translate-y-2 transition-transform duration-500">
              <div class="w-16 h-16 border border-elysia-400/50 flex items-center justify-center rotate-45 group-hover:shadow-[0_0_20px_rgba(255,135,178,0.4)] group-hover:border-elysia-400 transition-all duration-500 bg-tactical-900">
                 <div class="w-6 h-6 bg-elysia-400/30 group-hover:bg-elysia-400 transition-colors"></div>
              </div>
              <h2 class="text-xl font-sans italic font-bold text-gray-300 group-hover:text-elysia-300 transition-colors tracking-widest uppercase">PROVIDER</h2>
              <p class="text-xs font-mono text-gray-500 group-hover:text-elysia-400/80 transition-colors">&gt;&gt; API KEY &amp; ENDPOINT CFG</p>
            </div>
            <!-- Glow effect at bottom -->
            <div class="h-1 w-full bg-gradient-to-r from-transparent via-tactical-600 to-transparent group-hover:via-elysia-400 transition-colors duration-500"></div>
          </div>

          <!-- Pillar 2: Proxy -->
          <div class="flex-1 min-w-[280px] group cursor-pointer snap-center relative border border-tactical-700 bg-tactical-800/50 hover:bg-tactical-800 clip-chamfer hover:border-elysia-400 transition-all duration-500 flex flex-col" @click="expandPillar('proxy')">
             <div class="absolute inset-0 bg-gradient-to-b from-elysia-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             <div class="p-6 flex-1 flex flex-col items-center justify-center gap-4 text-center z-10 relative group-hover:-translate-y-2 transition-transform duration-500">
              <div class="w-16 h-16 border border-elysia-400/50 flex items-center justify-center rotate-45 group-hover:shadow-[0_0_20px_rgba(255,135,178,0.4)] group-hover:border-elysia-400 transition-all duration-500 bg-tactical-900">
                 <div class="w-10 h-[2px] bg-elysia-400/30 group-hover:bg-elysia-400 transition-colors -rotate-45"></div>
                 <div class="w-[2px] h-10 bg-elysia-400/30 group-hover:bg-elysia-400 transition-colors -rotate-45 absolute"></div>
              </div>
              <h2 class="text-xl font-sans italic font-bold text-gray-300 group-hover:text-elysia-300 transition-colors tracking-widest uppercase">PROXY_NET</h2>
              <p class="text-xs font-mono text-gray-500 group-hover:text-elysia-400/80 transition-colors">&gt;&gt; NETWORK ROUTING CFG</p>
            </div>
            <div class="h-1 w-full bg-gradient-to-r from-transparent via-tactical-600 to-transparent group-hover:via-elysia-400 transition-colors duration-500"></div>
          </div>

          <!-- Pillar 3: AI Assist -->
          <div class="flex-1 min-w-[280px] group cursor-pointer snap-center relative border border-tactical-700 bg-tactical-800/50 hover:bg-tactical-800 clip-chamfer hover:border-elysia-400 transition-all duration-500 flex flex-col" @click="expandPillar('ai')">
             <div class="absolute inset-0 bg-gradient-to-b from-elysia-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             <div class="p-6 flex-1 flex flex-col items-center justify-center gap-4 text-center z-10 relative group-hover:-translate-y-2 transition-transform duration-500">
              <div class="w-16 h-16 border border-elysia-400/50 flex items-center justify-center rotate-45 group-hover:shadow-[0_0_20px_rgba(255,135,178,0.4)] group-hover:border-elysia-400 transition-all duration-500 bg-tactical-900">
                 <div class="w-6 h-6 border-2 border-elysia-400/30 group-hover:border-elysia-400 rounded-full transition-colors"></div>
              </div>
              <h2 class="text-xl font-sans italic font-bold text-gray-300 group-hover:text-elysia-300 transition-colors tracking-widest uppercase">AI_ASSIST</h2>
              <p class="text-xs font-mono text-gray-500 group-hover:text-elysia-400/80 transition-colors">&gt;&gt; LLM PARSING ENGINE</p>
            </div>
            <div class="h-1 w-full bg-gradient-to-r from-transparent via-tactical-600 to-transparent group-hover:via-elysia-400 transition-colors duration-500"></div>
          </div>

          <!-- Pillar 4: General -->
          <div class="flex-1 min-w-[280px] group cursor-pointer snap-center relative border border-tactical-700 bg-tactical-800/50 hover:bg-tactical-800 clip-chamfer hover:border-elysia-400 transition-all duration-500 flex flex-col" @click="expandPillar('general')">
             <div class="absolute inset-0 bg-gradient-to-b from-elysia-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             <div class="p-6 flex-1 flex flex-col items-center justify-center gap-4 text-center z-10 relative group-hover:-translate-y-2 transition-transform duration-500">
              <div class="w-16 h-16 border border-elysia-400/50 flex items-center justify-center rotate-45 group-hover:shadow-[0_0_20px_rgba(255,135,178,0.4)] group-hover:border-elysia-400 transition-all duration-500 bg-tactical-900">
                  <div class="grid grid-cols-2 gap-1 -rotate-45">
                    <div class="w-2 h-2 bg-elysia-400/30 group-hover:bg-elysia-400 transition-colors"></div>
                    <div class="w-2 h-2 bg-elysia-400/30 group-hover:bg-elysia-400 transition-colors"></div>
                    <div class="w-2 h-2 bg-elysia-400/30 group-hover:bg-elysia-400 transition-colors"></div>
                    <div class="w-2 h-2 border border-elysia-400/30 group-hover:border-elysia-400 transition-colors"></div>
                  </div>
              </div>
              <h2 class="text-xl font-sans italic font-bold text-gray-300 group-hover:text-elysia-300 transition-colors tracking-widest uppercase">GENERAL</h2>
              <p class="text-xs font-mono text-gray-500 group-hover:text-elysia-400/80 transition-colors">&gt;&gt; BEHAVIOR &amp; DATA</p>
            </div>
            <div class="h-1 w-full bg-gradient-to-r from-transparent via-tactical-600 to-transparent group-hover:via-elysia-400 transition-colors duration-500"></div>
          </div>
        </div>

        <!-- Expanded Form View -->
        <div v-else class="absolute inset-0 animate-[fade-in_0.3s_ease-out] flex flex-col bg-tactical-900/90 backdrop-blur-sm border border-elysia-400/30 clip-chamfer-lg shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] overflow-hidden">

          <!-- Header Bar -->
          <div class="flex items-center justify-between p-4 border-b border-elysia-400/20 bg-tactical-800">
            <div class="flex items-center gap-3">
              <button class="flex items-center justify-center w-8 h-8 bg-tactical-900 border border-tactical-600 text-gray-400 hover:text-elysia-300 hover:border-elysia-400 clip-chamfer transition-colors" @click="closePillar">
                <span class="font-mono text-lg leading-none">&lt;</span>
              </button>
              <h3 class="font-sans italic font-bold text-elysia-300 tracking-widest text-lg uppercase">{{ getTabLabel(expandedPillar) }} //</h3>
            </div>
            <div class="font-mono text-xs text-gray-500 hidden sm:block">EDITING_MODE_ACTIVE</div>
          </div>

          <!-- Content Area -->
          <div class="flex-1 overflow-auto p-4 md:p-6 relative">
            <div class="absolute inset-0 bg-sakura-pattern opacity-5 pointer-events-none"></div>
            <!-- SettingsForm logic injected directly -->
            <div class="max-w-4xl mx-auto relative z-10 bg-tactical-800/50 p-4 md:p-6 clip-chamfer border border-tactical-700">

              <!-- Content injected from SettingsDialog -->
              <SettingsFormContent :tab="expandedPillar" @close="closePillar" />

            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SettingsFormContent from '@/components/Settings/SettingsFormContent.vue'

const expandedPillar = ref<'provider' | 'proxy' | 'ai' | 'general' | null>(null)

function expandPillar(pillar: 'provider' | 'proxy' | 'ai' | 'general') {
  expandedPillar.value = pillar
}

function closePillar() {
  expandedPillar.value = null
}

function getTabLabel(tab: string | null) {
  switch(tab) {
    case 'provider': return 'PROVIDER_CFG'
    case 'proxy': return 'PROXY_NET_CFG'
    case 'ai': return 'AI_ASSIST_CFG'
    case 'general': return 'GENERAL_CFG'
    default: return 'SETTINGS'
  }
}
</script>

<style scoped>
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
@keyframes fade-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>

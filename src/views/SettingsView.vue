<template>
  <div class="h-full relative flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="relative z-10 flex flex-col h-full gap-8 mt-4">
      <!-- Title -->
      <div class="flex items-end justify-between px-8">
        <h1 class="text-4xl md:text-6xl font-sans font-black text-white uppercase tracking-widest flex items-center gap-4">
          <span class="text-ak-400 font-light">SYS</span>SETTINGS
        </h1>
        <div class="font-sans text-sm tracking-[0.2em] text-gray-500 hidden md:flex items-center gap-2">
          <div class="w-12 h-px bg-gray-700"></div>
          [SYS.CORE.CFG.OVERRIDE]
        </div>
      </div>

      <div class="flex-1 min-h-0 relative px-8">
        <!-- Pillars Layout -->
        <div v-if="!expandedPillar" class="h-full flex gap-1 w-full items-stretch pb-12 overflow-x-auto snap-x snap-mandatory hide-scrollbar">

          <div
            v-for="p in PILLARS"
            :key="p.tab"
            class="flex-1 min-w-[280px] group cursor-pointer snap-center relative border-l border-r border-ak-darker hover:border-ak-400/50 transition-[background-color,border-color,transform,box-shadow] duration-700 flex flex-col bg-ak-dark/60 backdrop-blur-md hover:bg-ak-gray hover:-translate-y-2 overflow-hidden group-hover:shadow-[0_0_20px_#B2EBF2] animate-[pillar-in_0.6s_cubic-bezier(0.25,1,0.2,1)_both]"
            @click="expandPillar(p.tab)"
          >
            <!-- Stylized Image Background -->
            <div class="absolute inset-0 bg-cover bg-center opacity-[0.05] group-hover:opacity-40 group-hover:brightness-125 transition-[opacity,transform,filter] duration-700 ease-out mix-blend-screen scale-[1.08] group-hover:scale-100 filter" :style="{ backgroundImage: `url('/images/${p.img}')` }"></div>
            <!-- Cyan accent line -->
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ak-400/0 via-ak-400/80 to-ak-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div class="p-8 flex-1 flex flex-col justify-end z-10 relative">
              <div class="font-sans text-[10px] tracking-widest text-ak-400 mb-2 opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-500 ease-out translate-y-4 group-hover:translate-y-0">{{ p.num }} // {{ p.accent }}</div>
              <h2 class="text-3xl font-sans font-black text-gray-400 group-hover:text-white transition-colors tracking-widest uppercase mb-1 drop-shadow-md">{{ p.title }}</h2>
              <p class="text-sm font-sans tracking-wider text-gray-600 group-hover:text-gray-300 transition-colors uppercase">{{ p.subtitle }}</p>
            </div>
          </div>
        </div>

        <!-- Expanded Form View -->
        <div v-else class="absolute inset-0 animate-[fade-in_0.4s_cubic-bezier(0.25,1,0.2,1)] flex flex-col bg-ak-dark/95 backdrop-blur-md border border-ak-400/20 overflow-hidden mx-8">

          <!-- Large Decorative Background for Form -->
          <div class="absolute right-0 top-0 w-1/2 h-full bg-[url('/images/E2EDDC5F82A3F30CBEC89604BC9C5945.png')] bg-contain bg-right-bottom bg-no-repeat opacity-[0.02] pointer-events-none"></div>

          <!-- Header Bar -->
          <div class="flex items-center justify-between p-6 border-b border-ak-400/20">
            <div class="flex items-center gap-6">
              <button class="flex items-center justify-center w-12 h-12 bg-ak-gray text-white hover:bg-ak-400 hover:text-ak-darker transition-colors group" @click="closePillar">
                <span class="font-sans font-black text-xl leading-none group-hover:-translate-x-1 transition-transform">&lt;</span>
              </button>
              <h3 class="font-sans font-black text-white tracking-widest text-2xl uppercase">
                <span class="text-ak-400 font-light mr-2">CFG //</span>{{ getTabLabel(expandedPillar) }}
              </h3>
            </div>
          </div>

          <!-- Content Area -->
          <div class="flex-1 overflow-auto hide-scrollbar p-6 md:p-12 relative z-10">
            <div class="max-w-4xl">
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

type PillarTab = 'provider' | 'proxy' | 'ai' | 'general'

const PILLARS: Array<{ tab: PillarTab; img: string; num: string; accent: string; title: string; subtitle: string }> = [
  { tab: 'provider', img: '8D0EE95EEACC026829ACA09CFC2CBDA2.png', num: '01', accent: 'CONFIGURE', title: 'PROVIDER', subtitle: 'API Key & Endpoint' },
  { tab: 'proxy', img: '751D9D83F676527556FFD8943753D774.png', num: '02', accent: 'NETWORK', title: 'PROXY_NET', subtitle: 'Network Routing' },
  { tab: 'ai', img: '6C6896C912242C8931465D5AAE86C055.png', num: '03', accent: 'ENGINE', title: 'AI_ASSIST', subtitle: 'LLM Parsing Engine' },
  { tab: 'general', img: '8370D828038E08C64EBE4339BC8B2DCB.png', num: '04', accent: 'CORE', title: 'GENERAL', subtitle: 'Behavior & Data' },
]

const expandedPillar = ref<PillarTab | null>(null)

function expandPillar(pillar: PillarTab) {
  expandedPillar.value = pillar
}

function closePillar() {
  expandedPillar.value = null
}

function getTabLabel(tab: string | null) {
  const pillar = PILLARS.find((p) => p.tab === tab)
  return pillar?.title ?? 'SETTINGS'
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
  from { opacity: 0; transform: scale(0.98) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
/* 卡片入场：从下方淡入上移，配合不透明底色避免入场瞬间背景刻印透出 */
@keyframes pillar-in {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
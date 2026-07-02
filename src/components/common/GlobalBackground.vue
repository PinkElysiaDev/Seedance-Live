<template>
  <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-ak-darker">
    <!-- 外层：静态旋转，让网格倾斜 -->
    <div class="absolute inset-0" style="transform: rotate(-15deg)">
      <!-- 内层：粒子被钉在网格坐标上，共享全局平移，整体像网格匀速通过画面。整体虚焦（blur） -->
      <div
        v-for="seal in seals"
        :key="seal.key"
        class="absolute flex items-center justify-center p-4 blur-[3px]"
        :style="{
          left: `${seal.x}px`,
          top: `${seal.y}px`,
          width: `${cellPx}px`,
          height: `${cellPx}px`,
        }"
      >
        <img :src="`/images/${seal.file}`" class="w-full h-full object-contain opacity-[0.13]" alt="" />
      </div>
    </div>

    <!-- 四周暗、中心亮净的聚光蒙版（中心透出底色，四周压暗；中心亮区刻印几乎不可见） -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(10,10,10,0)_0%,_rgba(10,10,10,0.35)_35%,_rgba(10,10,10,0.85)_75%,_rgba(10,10,10,0.98)_100%)]"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const LOGO_FILES = [
  '0045A6E438A50352E2AF924005AC8CD6.png',
  '0DC1EC47FF0C98CB05C822117A8466E7.png',
  '0FFFD6CE6535DD94DDA65146AFFD4F1E.png',
  '44F6292244CA64CD0BBBE1A9AC0C1B14.png',
  '544F3C8B40DA985E49589B31161C2EB4.png',
  '5A6BAAD1513625C2967A532B43D68F13.png',
  '6C6896C912242C8931465D5AAE86C055.png',
  '751D9D83F676527556FFD8943753D774.png',
  '8370D828038E08C64EBE4339BC8B2DCB.png',
  '84FA97D8FCDCBFF1B44861AA86C5585A.png',
  '8D0EE95EEACC026829ACA09CFC2CBDA2.png',
  'A4268490D351FE94386990EAA38864E0.png',
  'E2EDDC5F82A3F30CBEC89604BC9C5945.png',
]

// 统一刻印尺寸
const cellPx = 220
// 全局平移速度（px/ms），斜向匀速
const SPEED_X = 0.018
const SPEED_Y = 0.012

interface Seal {
  key: string
  file: string
  x: number
  y: number
}

const seals = ref<Seal[]>([])
// 网格坐标 → logo 文件名 的虚拟无限映射
const grid = new Map<string, string>()
let offX = 0
let offY = 0
let rafId = 0
let lastTs = 0

function keyFor(gx: number, gy: number) {
  return `${gx},${gy}`
}

// 为某网格点选 logo：排除正左、正上邻居已用类型，保证相邻不同
function pickLogo(gx: number, gy: number): string {
  const left = grid.get(keyFor(gx - 1, gy))
  const up = grid.get(keyFor(gx, gy - 1))
  const forbidden = new Set<string>()
  if (left) forbidden.add(left)
  if (up) forbidden.add(up)
  const pool = LOGO_FILES.filter((f) => !forbidden.has(f))
  return pool[Math.floor(Math.random() * pool.length)]
}

function ensureLogo(gx: number, gy: number): string {
  const k = keyFor(gx, gy)
  let f = grid.get(k)
  if (!f) {
    f = pickLogo(gx, gy)
    grid.set(k, f)
  }
  return f
}

function tick(ts: number) {
  if (!lastTs) lastTs = ts
  // 钳制 dt：页面后台/切换标签时 rAF 被节流，恢复时 dt 可能极大，
  // 直接累加会导致刻印瞬移。限制单步最大前进量，丢弃被节流的积压时间。
  const dt = Math.min(ts - lastTs, 50)
  lastTs = ts
  offX += SPEED_X * dt
  offY += SPEED_Y * dt

  const viewW = window.innerWidth
  const viewH = window.innerHeight
  // 旋转 -15° 后视口对角扩大，留足余量避免角落露空
  const margin = cellPx * 2

  // 当前视口覆盖的网格坐标范围
  const gxMin = Math.floor((-offX - margin) / cellPx)
  const gxMax = Math.floor((viewW - offX + margin) / cellPx)
  const gyMin = Math.floor((-offY - margin) / cellPx)
  const gyMax = Math.floor((viewH - offY + margin) / cellPx)

  const next: Seal[] = []
  const seen = new Set<string>()
  for (let gy = gyMin; gy <= gyMax; gy++) {
    for (let gx = gxMin; gx <= gxMax; gx++) {
      const k = keyFor(gx, gy)
      seen.add(k)
      const file = ensureLogo(gx, gy)
      next.push({
        key: k,
        file,
        x: gx * cellPx + offX,
        y: gy * cellPx + offY,
      })
    }
  }
  // 回收视口外不再需要的网格点（限制 Map 无限增长）
  for (const k of grid.keys()) {
    if (!seen.has(k)) grid.delete(k)
  }
  seals.value = next

  rafId = requestAnimationFrame(tick)
}

// 页面切到后台/其他标签时 rAF 被节流，切回可见时重置时间基准，
// 避免恢复瞬间累积巨量 dt 造成刻印瞬移。
function onVisibility() {
  if (document.visibilityState === 'visible') {
    lastTs = 0
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  cancelAnimationFrame(rafId)
})
</script>

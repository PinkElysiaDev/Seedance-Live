<template>
  <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-ak-darker">
    <!-- 外层：静态旋转，让网格倾斜 -->
    <div class="absolute inset-0" style="transform: rotate(-15deg)">
      <!-- 平移层：rAF 每帧只更新这一个 transform，刻印本身静态布局在网格坐标上，
           避免每帧重建数组与逐元素 style 重算 -->
      <div ref="translateRef" class="absolute inset-0 will-change-transform">
        <div
          v-for="seal in seals"
          :key="seal.key"
          class="absolute flex items-center justify-center p-4 blur-[1px]"
          :style="{
            left: `${seal.left}px`,
            top: `${seal.top}px`,
            width: `${CELL_SIZE}px`,
            height: `${CELL_SIZE}px`,
          }"
        >
          <img :src="`/images/${seal.file}`" class="w-full h-full object-contain opacity-[0.13]" alt="" />
        </div>
      </div>
    </div>

    <!-- 四周暗、中心亮净的聚光蒙版（中心透出底色，四周压暗；中心亮区刻印几乎不可见） -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(10,10,10,0)_0%,_rgba(10,10,10,0.35)_35%,_rgba(10,10,10,0.85)_75%,_rgba(10,10,10,0.98)_100%)]"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'

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
const CELL_SIZE = 220
// 全局平移速度（px/ms），斜向匀速
const SPEED_X = 0.018
const SPEED_Y = 0.012

interface Seal {
  key: string
  file: string
  left: number
  top: number
}

interface Range {
  gxMin: number
  gxMax: number
  gyMin: number
  gyMax: number
}

// 刻印静态布局在网格坐标上，平移由 translateRef 的 transform 承担；
// 故 seals 列表仅在可见网格范围变化时重建（约每 12–18s 一次），而非每帧。
const seals = shallowRef<Seal[]>([])
const translateRef = ref<HTMLElement | null>(null)
// 网格坐标 → logo 文件名 的虚拟无限映射
const grid = new Map<string, string>()
let offsetX = 0
let offsetY = 0
let viewW = 0
let viewH = 0
let rafId = 0
let lastTs = 0
let lastRangeKey = ''

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

// 旋转 -15° 后视口对角扩大，留足余量避免角落露空
function computeRange(): Range {
  const margin = CELL_SIZE * 2
  return {
    gxMin: Math.floor((-offsetX - margin) / CELL_SIZE),
    gxMax: Math.floor((viewW - offsetX + margin) / CELL_SIZE),
    gyMin: Math.floor((-offsetY - margin) / CELL_SIZE),
    gyMax: Math.floor((viewH - offsetY + margin) / CELL_SIZE),
  }
}

function rebuildSeals(r: Range) {
  const next: Seal[] = []
  const seen = new Set<string>()
  for (let gy = r.gyMin; gy <= r.gyMax; gy++) {
    for (let gx = r.gxMin; gx <= r.gxMax; gx++) {
      const k = keyFor(gx, gy)
      seen.add(k)
      next.push({
        key: k,
        file: ensureLogo(gx, gy),
        left: gx * CELL_SIZE,
        top: gy * CELL_SIZE,
      })
    }
  }
  // 回收视口外不再需要的网格点（限制 Map 无限增长）
  for (const k of grid.keys()) {
    if (!seen.has(k)) grid.delete(k)
  }
  seals.value = next
}

function tick(ts: number) {
  if (!lastTs) lastTs = ts
  // 钳制 dt：页面后台/切换标签时 rAF 被节流，恢复时 dt 可能极大，
  // 直接累加会导致刻印瞬移。限制单步最大前进量，丢弃被节流的积压时间。
  const dt = Math.min(ts - lastTs, 50)
  lastTs = ts
  offsetX += SPEED_X * dt
  offsetY += SPEED_Y * dt

  // 单元素 transform：GPU 合成，不触发 Vue 重渲染与逐元素 style 重算
  if (translateRef.value) {
    translateRef.value.style.transform = `translate(${offsetX}px, ${offsetY}px)`
  }

  // 仅当可见网格范围变化时才重建刻印列表
  const r = computeRange()
  const rangeKey = `${r.gxMin},${r.gxMax},${r.gyMin},${r.gyMax}`
  if (rangeKey !== lastRangeKey) {
    lastRangeKey = rangeKey
    rebuildSeals(r)
  }

  rafId = requestAnimationFrame(tick)
}

// 页面切到后台/其他标签时 rAF 被节流，切回可见时重置时间基准，
// 避免恢复瞬间累积巨量 dt 造成刻印瞬移。
function onVisibility() {
  if (document.visibilityState === 'visible') {
    lastTs = 0
  }
}

function onResize() {
  viewW = window.innerWidth
  viewH = window.innerHeight
  // 视口变化导致可见范围改变，下次 tick 重建
  lastRangeKey = ''
}

onMounted(() => {
  viewW = window.innerWidth
  viewH = window.innerHeight
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('resize', onResize)
  const r = computeRange()
  lastRangeKey = `${r.gxMin},${r.gxMax},${r.gyMin},${r.gyMax}`
  rebuildSeals(r)
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(rafId)
})
</script>

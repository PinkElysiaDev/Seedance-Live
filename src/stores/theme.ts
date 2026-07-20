import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  THEME_MAP,
  CYCLE_ORDER,
  SEAL_SETS,
  DEFAULT_THEME,
  DEFAULT_SEAL_SET,
  type ThemeId,
  type SealSetId,
} from '@/config/themes'

const STORAGE_KEY = 'seedance-live:theme'

export interface ThemePrefs {
  themeId: ThemeId
  sealSetId: SealSetId
  /** 是否启用主题切换仪式动画 */
  transition: boolean
}

interface Persisted {
  themeId?: ThemeId
  sealSetId?: SealSetId
  transition?: boolean
}

function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && v in THEME_MAP
}
function isSealSetId(v: unknown): v is SealSetId {
  return typeof v === 'string' && v in SEAL_SETS
}

function loadPrefs(): ThemePrefs {
  const def: ThemePrefs = {
    themeId: DEFAULT_THEME,
    sealSetId: DEFAULT_SEAL_SET,
    transition: true,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return def
    const p = JSON.parse(raw) as Persisted
    return {
      themeId: isThemeId(p.themeId) ? p.themeId : def.themeId,
      sealSetId: isSealSetId(p.sealSetId) ? p.sealSetId : def.sealSetId,
      transition: typeof p.transition === 'boolean' ? p.transition : def.transition,
    }
  } catch {
    return def
  }
}

/** 把主题应用到 <html>：写 data-theme */
function applyToDom(prefs: ThemePrefs) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', prefs.themeId)
}

export const useThemeStore = defineStore('theme', () => {
  const prefs = ref<ThemePrefs>(loadPrefs())

  // 初始化即应用，避免首屏闪烁
  applyToDom(prefs.value)

  // 持久化
  watch(
    prefs,
    (val) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      } catch {
        // 隐私模式等忽略
      }
      applyToDom(val)
    },
    { deep: true },
  )

  const themeId = computed(() => prefs.value.themeId)
  const sealSetId = computed(() => prefs.value.sealSetId)
  const transition = computed(() => prefs.value.transition)
  const meta = computed(() => THEME_MAP[prefs.value.themeId])

  /** 当前生效刻印组文件列表 */
  const sealFiles = computed<string[]>(() => SEAL_SETS[prefs.value.sealSetId])
  /** Header Logo 刻印文件 */
  const logoFile = computed(() => meta.value.logoFile)
  /** 是否浅色主题 */
  const isLight = computed(() => meta.value.light)
  /** 当前强调色 */
  const accentColor = computed(() => meta.value.accent)

  function setTheme(id: ThemeId) {
    if (!isThemeId(id)) return
    prefs.value = { ...prefs.value, themeId: id }
  }

  function setSealSet(id: SealSetId) {
    if (!isSealSetId(id)) return
    prefs.value = { ...prefs.value, sealSetId: id }
  }

  function setTransition(on: boolean) {
    prefs.value = { ...prefs.value, transition: on }
  }

  /** Logo 点击循环切换主题，返回新主题 id（供 App.vue 触发动效） */
  function cycleTheme(): ThemeId {
    const idx = CYCLE_ORDER.indexOf(prefs.value.themeId)
    const next = CYCLE_ORDER[(idx + 1) % CYCLE_ORDER.length]
    setTheme(next)
    return next
  }

  return {
    prefs,
    themeId,
    sealSetId,
    transition,
    meta,
    sealFiles,
    logoFile,
    isLight,
    accentColor,
    setTheme,
    setSealSet,
    setTransition,
    cycleTheme,
  }
})

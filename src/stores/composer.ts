import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { StoredAsset, VideoParams } from '@/types'
import { defaultParams } from '@/config/options'
import { getAssets } from '@/db/repos'

const STORAGE_KEY = 'seedance-live:composer'

interface ComposerDraft {
  prompt: string
  params: VideoParams
  assetIds: string[]
  activeMode?: 'REF_MODE' | 'KEYFRAME_MODE'
}

function loadDraft(): ComposerDraft {
  // 顶级模块加载时可能 Pinia 未就绪，避免在此处调用 useSettingsStore()。
  // defaultModel 回退使用硬编码默认值 'doubao-seedance-2.0'
  const defaultDraft: ComposerDraft = {
    prompt: '',
    params: defaultParams('doubao-seedance-2.0'),
    assetIds: [],
    activeMode: 'REF_MODE',
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultDraft
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>
    return {
      prompt: parsed.prompt ?? '',
      params: { ...defaultDraft.params, ...(parsed.params ?? {}) },
      assetIds: Array.isArray(parsed.assetIds) ? parsed.assetIds : [],
      activeMode: parsed.activeMode === 'KEYFRAME_MODE' ? 'KEYFRAME_MODE' : 'REF_MODE',
    }
  } catch {
    return defaultDraft
  }
}

export const useComposerStore = defineStore('composer', () => {
  const prompt = ref('')
  const params = ref<VideoParams>(defaultParams())
  const assetIds = ref<string[]>([])
  // 已入库的素材对象缓存（id → asset），提交时用
  const assets = ref<StoredAsset[]>([])
  // 当前渲染模式（参考图 / 首尾帧），跨页面保留
  const activeMode = ref<'REF_MODE' | 'KEYFRAME_MODE'>('REF_MODE')

  // 恢复 localStorage 中的草稿
  const draft = loadDraft()
  prompt.value = draft.prompt
  params.value = draft.params
  assetIds.value = draft.assetIds
  activeMode.value = draft.activeMode ?? 'REF_MODE'

  // 草稿持久化：拖动 duration 滑块等高频改动会触发 deep watch，故 debounce 300ms，
  // 避免每次改动都同步写 localStorage；页面关闭前再立即落盘一次防止丢失。
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  function flushPersist() {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ prompt: prompt.value, params: params.value, assetIds: assetIds.value, activeMode: activeMode.value }),
      )
    } catch (err) {
      console.warn('草稿持久化失败', err)
    }
  }
  function schedulePersist() {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(flushPersist, 300)
  }

  watch(
    [prompt, params, assetIds, activeMode],
    schedulePersist,
    { deep: true },
  )

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushPersist)
  }

  // 刷新后从 IndexedDB 按 assetIds 水合 assets：localStorage 只存了 id，素材本体（含 blob）在 IDB
  let assetsHydrated = false
  async function initAssets() {
    if (assetsHydrated) return
    assetsHydrated = true
    if (!assetIds.value.length) return
    const stored = await getAssets(assetIds.value)
    const byId = new Map(stored.map((a) => [a.id, a]))
    // 按 assetIds 顺序恢复；DB 中已丢失的 id 顺带清理
    assets.value = assetIds.value
      .map((id) => byId.get(id))
      .filter((a): a is StoredAsset => !!a)
    assetIds.value = assets.value.map((a) => a.id)
  }

  function setPrompt(p: string) {
    prompt.value = p
  }

  function setActiveMode(mode: 'REF_MODE' | 'KEYFRAME_MODE') {
    activeMode.value = mode
  }

  function patchParams(patch: Partial<VideoParams>) {
    params.value = { ...params.value, ...patch }
  }

  // 切换模型时按模型能力钳制分辨率
  function setModel(model: VideoParams['model']) {
    const next = { ...params.value, model }
    const allowed = model.endsWith('fast') ? ['480p', '720p', '4K'] : ['480p', '720p', '1080p', '4K']
    if (!allowed.includes(next.resolution)) next.resolution = '720p'
    params.value = next
  }

  function addAsset(asset: StoredAsset) {
    assets.value.push(asset)
    assetIds.value.push(asset.id)
  }

  function removeAsset(id: string) {
    assets.value = assets.value.filter((a) => a.id !== id)
    assetIds.value = assetIds.value.filter((aid) => aid !== id)
  }

  // 拖拽排序：拖到谁身上就和谁交换位置（双向对称）；同步 assetIds 顺序
  function swapAssets(fromId: string, toId: string) {
    if (fromId === toId) return
    const list = [...assets.value]
    const fromIdx = list.findIndex((a) => a.id === fromId)
    const toIdx = list.findIndex((a) => a.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    ;[list[fromIdx], list[toIdx]] = [list[toIdx], list[fromIdx]]
    assets.value = list
    assetIds.value = list.map((a) => a.id)
  }

  function clearAssets() {
    assets.value = []
    assetIds.value = []
  }

  function clearAfterSubmit() {
    prompt.value = ''
    assets.value = []
    assetIds.value = []
  }

  // 续帧：用某 asset 作为首帧填充
  function setFirstFrame(asset: StoredAsset) {
    // 先记下旧首帧 id，再清 assets，否则 assets 一旦被过滤就再也无法对照清理 assetIds，留下孤儿 id
    const staleIds = new Set(assets.value.filter((a) => a.role === 'firstFrame').map((a) => a.id))
    assets.value = assets.value.filter((a) => a.role !== 'firstFrame')
    assetIds.value = assetIds.value.filter((id) => !staleIds.has(id))
    assets.value.push(asset)
    assetIds.value.push(asset.id)
    params.value = { ...params.value, returnLastFrame: true }
  }

  return {
    prompt,
    params,
    assetIds,
    assets,
    activeMode,
    initAssets,
    setPrompt,
    setActiveMode,
    patchParams,
    setModel,
    addAsset,
    removeAsset,
    swapAssets,
    clearAssets,
    clearAfterSubmit,
    setFirstFrame,
  }
})

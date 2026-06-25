import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { StoredAsset, VideoParams } from '@/types'
import { defaultParams } from '@/config/options'
import { useSettingsStore } from './settings'

const STORAGE_KEY = 'seedance-live:composer'

interface ComposerDraft {
  prompt: string
  params: VideoParams
  assetIds: string[]
}

function loadDraft(): ComposerDraft {
  const def: ComposerDraft = {
    prompt: '',
    params: defaultParams(useSettingsStore().settings.defaultModel),
    assetIds: [],
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return def
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>
    return {
      prompt: parsed.prompt ?? '',
      params: { ...def.params, ...(parsed.params ?? {}) },
      assetIds: Array.isArray(parsed.assetIds) ? parsed.assetIds : [],
    }
  } catch {
    return def
  }
}

export const useComposerStore = defineStore('composer', () => {
  const prompt = ref('')
  const params = ref<VideoParams>(defaultParams())
  const assetIds = ref<string[]>([])
  // 已入库的素材对象缓存（id → asset），提交时用
  const assets = ref<StoredAsset[]>([])

  // 恢复
  const draft = loadDraft()
  prompt.value = draft.prompt
  params.value = draft.params
  assetIds.value = draft.assetIds

  watch(
    [prompt, params, assetIds],
    () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ prompt: prompt.value, params: params.value, assetIds: assetIds.value }),
        )
      } catch (err) {
        console.warn('草稿持久化失败', err)
      }
    },
    { deep: true },
  )

  function setPrompt(p: string) {
    prompt.value = p
  }

  function patchParams(patch: Partial<VideoParams>) {
    params.value = { ...params.value, ...patch }
  }

  // 切换模型时按模型能力钳制分辨率
  function setModel(model: VideoParams['model']) {
    const next = { ...params.value, model }
    const allowed = model.endsWith('fast') ? ['480p', '720p'] : ['480p', '720p', '1080p']
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
    // 移除已有首帧
    assets.value = assets.value.filter((a) => a.role !== 'firstFrame')
    assetIds.value = assetIds.value.filter((id) => !assets.value.some((a) => a.id === id && a.role === 'firstFrame'))
    assets.value.push(asset)
    assetIds.value.push(asset.id)
    params.value = { ...params.value, returnLastFrame: true }
  }

  return {
    prompt,
    params,
    assetIds,
    assets,
    setPrompt,
    patchParams,
    setModel,
    addAsset,
    removeAsset,
    clearAssets,
    clearAfterSubmit,
    setFirstFrame,
  }
})

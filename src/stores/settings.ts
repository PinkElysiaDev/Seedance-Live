import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { AppSettings, CustomTemplate, ProviderProfile, ProxyConfig, SeedanceModel } from '@/types'
import { generateId } from '@/lib/id'
import { DEFAULT_POLL_INTERVAL_SEC } from '@/config/options'
import { DEFAULT_CUSTOM_BODY } from '@/lib/template'
import { DICTIONARY } from '@/i18n/dictionary'

const STORAGE_KEY = 'seedance-live:settings'

// 安全的静态翻译，不需要 Pinia 实例，避免在应用初始化前的顶级模块加载阶段抛出“no active Pinia”异常
function getStaticTranslation(key: string): string {
  let locale: 'zh' | 'en' = 'zh'
  try {
    const raw = localStorage.getItem('seedance-live:locale')
    if (raw === 'en') locale = 'en'
  } catch {}
  const entry = DICTIONARY[key]
  return entry ? entry[locale] : key
}

// 内置默认 seedance profile（名称按当前 locale 本地化）
export function createDefaultSeedanceProfile(): ProviderProfile {
  return {
    id: generateId(),
    name: getStaticTranslation('profile.defaultSeedance'),
    kind: 'seedance',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: '',
    timeout: 60,
  }
}

// 默认 custom profile：预置 3 字段 body 模板（名称按当前 locale 本地化）
export function createDefaultCustomProfile(): ProviderProfile {
  return {
    id: generateId(),
    name: getStaticTranslation('profile.defaultCustom'),
    kind: 'custom',
    baseUrl: '',
    apiKey: '',
    timeout: 60,
    model: '',
    custom: {
      submitUrl: '{{baseUrl}}/v2/videos/generations',
      submitMethod: 'POST',
      submitHeaders: { 'Content-Type': 'application/json', Authorization: 'Bearer {{apiKey}}' },
      submitBody: DEFAULT_CUSTOM_BODY,
      pollUrl: '{{baseUrl}}/v2/videos/generations/{{taskId}}',
      pollMethod: 'GET',
      pollHeaders: { Authorization: 'Bearer {{apiKey}}' },
      taskIdPath: 'task_id',
      statusPath: 'status',
      successValues: ['success'],
      failureValues: ['failure'],
      videoUrlPath: 'data.output',
      errorPath: 'fail_reason',
      progressPath: 'progress',
      pollIntervalSec: 3,
    },
  }
}

function defaultSettings(): AppSettings {
  const profile = createDefaultSeedanceProfile()
  return {
    profiles: [profile],
    activeProfileId: profile.id,
    proxy: { enabled: false, url: '', mode: 'query' },
    clearComposerAfterSubmit: true,
    defaultModel: 'doubao-seedance-2.0' as SeedanceModel,
    pollIntervalSec: DEFAULT_POLL_INTERVAL_SEC,
    notifyOnComplete: true,
    verboseLogs: true,
  }
}

// 迁移旧 CustomMapping（payloadStyle/submitPath/...）→ CustomTemplate；补全新字段
export function migrateProfile(p: ProviderProfile): ProviderProfile {
  const out: ProviderProfile = { ...p, model: p.model ?? '' }
  if (p.kind === 'custom') {
    const c = p.custom as unknown
    // 旧格式判定：有 submitPath/payloadStyle 等字段
    if (c && typeof c === 'object' && !('submitUrl' in (c as Record<string, unknown>))) {
      const old = c as Record<string, unknown>
      const submitPath = String(old.submitPath ?? '/v1/videos/generations')
      const pollPath = String(old.pollPath ?? '/v1/tasks/{task_id}').replace('{task_id}', '{{taskId}}')
      out.custom = {
        submitUrl: `{{baseUrl}}${submitPath.startsWith('/') ? submitPath : `/${submitPath}`}`,
        submitMethod: 'POST',
        submitHeaders: { 'Content-Type': 'application/json', Authorization: 'Bearer {{apiKey}}' },
        submitBody: DEFAULT_CUSTOM_BODY,
        pollUrl: `{{baseUrl}}${pollPath.startsWith('/') ? pollPath : `/${pollPath}`}`,
        pollMethod: 'GET',
        pollHeaders: { Authorization: 'Bearer {{apiKey}}' },
        taskIdPath: String(old.taskIdPath ?? 'task_id'),
        statusPath: String(old.statusPath ?? 'status'),
        successValues: (old.successValues as string[]) ?? ['succeeded', 'completed'],
        failureValues: (old.failureValues as string[]) ?? ['failed', 'cancelled'],
        videoUrlPath: String(old.videoUrlPath ?? 'data.output'),
        lastFrameUrlPath: old.lastFrameUrlPath ? String(old.lastFrameUrlPath) : undefined,
        errorPath: old.errorPath ? String(old.errorPath) : undefined,
        progressPath: old.progressPath ? String(old.progressPath) : undefined,
        pollIntervalSec: Number(old.pollIntervalSec ?? 5),
      }
    } else if (!p.custom) {
      out.custom = createDefaultCustomProfile().custom
    } else {
      out.custom = { ...(p.custom as CustomTemplate) }
    }
  }
  return out
}

// 从 localStorage 恢复并补全默认值
function normalizeSettings(raw: unknown): AppSettings {
  const def = defaultSettings()
  if (!raw || typeof raw !== 'object') return def
  const r = raw as Partial<AppSettings>
  const profiles = Array.isArray(r.profiles) && r.profiles.length ? r.profiles : def.profiles
  return {
    ...def,
    ...r,
    profiles: profiles.map((p) => migrateProfile(p)),
    proxy: { ...def.proxy, ...(r.proxy ?? {}) },
    verboseLogs: r.verboseLogs ?? true,
  }
}

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings()
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return defaultSettings()
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(load())

  const activeProfile = computed<ProviderProfile>(
    () => settings.value.profiles.find((p) => p.id === settings.value.activeProfileId) ?? settings.value.profiles[0],
  )
  const proxy = computed<ProxyConfig>(() => settings.value.proxy)

  // 持久化
  watch(settings, (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch (err) {
      console.warn('设置持久化失败', err)
    }
  }, { deep: true })

  function setActiveProfile(id: string) {
    settings.value.activeProfileId = id
  }

  function upsertProfile(profile: ProviderProfile) {
    const idx = settings.value.profiles.findIndex((p) => p.id === profile.id)
    if (idx >= 0) settings.value.profiles[idx] = profile
    else settings.value.profiles.push(profile)
  }

  function removeProfile(id: string) {
    if (settings.value.profiles.length <= 1) return
    settings.value.profiles = settings.value.profiles.filter((p) => p.id !== id)
    if (settings.value.activeProfileId === id) {
      settings.value.activeProfileId = settings.value.profiles[0].id
    }
  }

  function addProfile(kind: 'seedance' | 'custom'): ProviderProfile {
    // createDefault*Profile 已按当前 locale 命名，用户可在表单中改写
    const profile = kind === 'seedance' ? createDefaultSeedanceProfile() : createDefaultCustomProfile()
    settings.value.profiles.push(profile)
    settings.value.activeProfileId = profile.id
    return profile
  }

  function setProxy(patch: Partial<ProxyConfig>) {
    settings.value.proxy = { ...settings.value.proxy, ...patch }
  }

  function update(patch: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...patch }
  }

  return {
    settings,
    activeProfile,
    proxy,
    setActiveProfile,
    upsertProfile,
    removeProfile,
    addProfile,
    setProxy,
    update,
  }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DICTIONARY, type Locale } from '@/i18n/dictionary'

const STORAGE_KEY = 'seedance-live:locale'

/** 读取并校验持久化的语言偏好，非法值回退中文。 */
function loadLocale(): Locale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export const useI18nStore = defineStore('i18n', () => {
  const locale = ref<Locale>(loadLocale())

  /**
   * 翻译：按 key 查当前 locale 文案，未命中回退 key 本身。
   * 关键：求值时读取 locale.value，使 computed/模板能响应 locale 切换。
   * 变量用 {name} 占位，params 命中同名键即替换。
   */
  function t(key: string, params?: Record<string, string | number>): string {
    const entry = DICTIONARY[key]
    // 读取 locale.value 以建立响应式依赖
    let text = entry ? entry[locale.value] : key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return text
  }

  /**
   * 双语翻译：返回 "当前语言文本 // 另一种语言文本" 格式。
   * 用于需要同时展示中英文的场景（如表单标签）。
   */
  function tBilingual(key: string): string {
    const entry = DICTIONARY[key]
    if (!entry) return key
    const current = entry[locale.value]
    const other = entry[locale.value === 'zh' ? 'en' : 'zh']
    return `${current} // ${other}`
  }

  function setLocale(next: Locale) {
    if (next === locale.value) return
    locale.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 忽略隐私模式等写入失败
    }
    applyHtmlLang()
  }

  /** 在 zh/en 间切换。 */
  function toggleLocale() {
    setLocale(locale.value === 'zh' ? 'en' : 'zh')
  }

  /** 同步 <html lang>，便于辅助技术与浏览器拼写检查。 */
  function applyHtmlLang() {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale.value
    }
  }

  applyHtmlLang()

  return { locale, t, tBilingual, setLocale, toggleLocale, applyHtmlLang }
})

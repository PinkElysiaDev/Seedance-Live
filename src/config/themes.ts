// 主题系统配置：保留两套主题——白粉（浅，爱莉西雅刻印 logo）/ 刻印青（原有深色经典）。
// abyss-teal / frost-steel / custom 已删除：前者本质都是"深色底换强调色"缺乏差异感，后者冗余。
// 色板真值以 style.css 的 [data-theme=...] 为准；此处仅持 JS 元数据。

export type ThemeId = 'sakura-pearl' | 'ark-cyan'
export type SealSetId = 'elysia' | 'sigil-core' | 'ember-glyphs' | 'void-marks' | 'all'

export interface ThemeMeta {
  id: ThemeId
  /** 装饰性英文主名，硬编码大写，不随语言切换 */
  nameEn: string
  /** 中文副名 */
  nameZh: string
  /** 主题代表强调色（仅用于 JS 侧预览/派生；真值以 CSS 变量为准） */
  accent: string
  /** 是否浅色主题（影响背景、遮罩、刻印混合模式） */
  light: boolean
  /** 默认绑定的刻印组 */
  sealSet: SealSetId
  /** 用作 Header Logo 的刻印文件名 */
  logoFile: string
}

// 现有 13 张刻印文件
const ALL_SEALS = [
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

// 刻印分组：按视觉氛围聚类，复用现有 PNG。背景刻印默认沿用原本=全部 13 张（all）。
export const SEAL_SETS: Record<SealSetId, string[]> = {
  // 柔和、对称、典雅徽章 → 爱莉西雅
  elysia: [
    'E2EDDC5F82A3F30CBEC89604BC9C5945.png',
    '544F3C8B40DA985E49589B31161C2EB4.png',
    '44F6292244CA64CD0BBBE1A9AC0C1B14.png',
    'A4268490D351FE94386990EAA38864E0.png',
  ],
  // 中心对称、几何徽章
  'sigil-core': [
    'E2EDDC5F82A3F30CBEC89604BC9C5945.png',
    '0FFFD6CE6535DD94DDA65146AFFD4F1E.png',
    '544F3C8B40DA985E49589B31161C2EB4.png',
    '44F6292244CA64CD0BBBE1A9AC0C1B14.png',
    'A4268490D351FE94386990EAA38864E0.png',
  ],
  // 尖锐、火焰/刀刃感
  'ember-glyphs': [
    '5A6BAAD1513625C2967A532B43D68F13.png',
    '84FA97D8FCDCBFF1B44861AA86C5585A.png',
    '0DC1EC47FF0C98CB05C822117A8466E7.png',
    '6C6896C912242C8931465D5AAE86C055.png',
  ],
  // 细长、神秘
  'void-marks': [
    '751D9D83F676527556FFD8943753D774.png',
    '8370D828038E08C64EBE4339BC8B2DCB.png',
    '8D0EE95EEACC026829ACA09CFC2CBDA2.png',
    '0045A6E438A50352E2AF924005AC8CD6.png',
  ],
  // 全部混合随机（默认，沿用原本背景刻印效果）
  all: ALL_SEALS,
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'sakura-pearl',
    nameEn: 'SAKURA PEARL',
    nameZh: '樱粉协议',
    accent: '#FF7FB2',
    light: true,
    sealSet: 'all',
    // 白粉主题 logo = 你指定的爱莉西雅刻印
    logoFile: '0DC1EC47FF0C98CB05C822117A8466E7.png',
  },
  {
    id: 'ark-cyan',
    nameEn: 'ARK CYAN',
    nameZh: '刻印青',
    accent: '#00E5FF',
    light: false,
    sealSet: 'all',
    logoFile: 'E2EDDC5F82A3F30CBEC89604BC9C5945.png',
  },
]

export const THEME_MAP: Record<ThemeId, ThemeMeta> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
) as Record<ThemeId, ThemeMeta>

/** Logo 点击循环顺序 */
export const CYCLE_ORDER: ThemeId[] = ['sakura-pearl', 'ark-cyan']

export const DEFAULT_THEME: ThemeId = 'sakura-pearl'
export const DEFAULT_SEAL_SET: SealSetId = 'all'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        elysia: {
          50: '#FFF0F5', // 极浅的樱花粉
          100: '#FFB6C1', // Light pink
          300: '#FF94B8', // 水晶粉
          400: '#FF87B2', // Primary Elysia pink (主色调：无瑕粉)
          500: '#FF5090', // Deep accent (交互强调色)
          600: '#E6397D', // 暗部粉色
        },
        tactical: {
          900: '#0C090A', // 极深的紫黑色 (融合粉色调的暗底)
          800: '#151114', // Surface level 1 (模块底板)
          700: '#201A1E', // Surface level 2 (输入框/高亮底板)
          border: 'rgba(255, 135, 178, 0.3)', // 战术面板粉色描边
        }
      },
      fontFamily: {
        sans: ['"Exo 2"', 'system-ui', 'sans-serif'], // 推荐战术风倾斜字体
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'], // 必须用于数据/参数
      },
      backgroundImage: {
        'caution-pink': 'repeating-linear-gradient(45deg, #FF87B2, #FF87B2 10px, transparent 10px, transparent 20px)',
        'caution-dark': 'repeating-linear-gradient(45deg, rgba(255,135,178,0.1), rgba(255,135,178,0.1) 10px, transparent 10px, transparent 20px)',
        // 爱莉希雅专属水晶渐变底板
        'crystal-grad': 'linear-gradient(135deg, rgba(255,135,178,0.2) 0%, rgba(20,17,20,0.85) 50%, rgba(20,17,20,0.95) 100%)',
        // 樱花飘落的弱氛围纹理 (可作为伪元素背景)
        'sakura-pattern': 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M10 0 C12 5 15 5 15 10 C15 15 12 15 10 20 C8 15 5 15 5 10 C5 5 8 5 10 0 Z\' fill=\'rgba(255,182,193,0.05)\'/%3E%3C/svg%3E")',
      }
    },
  },
  plugins: [],
}

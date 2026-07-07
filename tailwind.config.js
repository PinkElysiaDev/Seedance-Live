/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ak: {
          50: '#E0F7FA',  // Very light cyan
          100: '#B2EBF2', // Light cyan
          300: '#4DD0E1', // Cyan bright
          400: '#00E5FF', // Primary Arknights Cyan (Main highlight)
          500: '#00B8D4', // Deep cyan
          600: '#0097A7', // Darker cyan
          dark: '#111111', // Almost black
          darker: '#0a0a0a', // True dark
          gray: '#2C2C2C', // Panel background
          lightgray: '#4A4A4A',
          border: 'rgba(0, 229, 255, 0.3)', // Cyan border
        },
        tactical: {
          900: '#0a0a0a',
          800: '#111111',
          700: '#222222',
          border: '#333333',
        }
      },
      fontFamily: {
        // Noto Sans SC 作为中文回退：浏览器按字形依次匹配，拉丁字符走 Exo 2 / JetBrains Mono，
        // 汉字回落到 Noto Sans SC，避免系统字体（雅黑/苹方）造成的风格漂移（item 6）。
        sans: ['"Exo 2"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Noto Sans SC"', '"Fira Code"', 'monospace'],
      },
      backgroundImage: {
        'caution-cyan': 'repeating-linear-gradient(45deg, #00E5FF, #00E5FF 10px, transparent 10px, transparent 20px)',
        'caution-dark': 'repeating-linear-gradient(45deg, rgba(0,229,255,0.1), rgba(0,229,255,0.1) 10px, transparent 10px, transparent 20px)',
        'crystal-grad': 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(17,17,17,0.85) 50%, rgba(10,10,10,0.95) 100%)',
      },
      keyframes: {
        flow: {
          '0%': { transform: 'translate(0, 0)' },
          '100%': { transform: 'translate(-400px, -400px)' },
        },
        // 刻印浮现：淡入 → 短暂停留 → 淡出，配合微缩放，形成“随机出现刻印”的无缝循环
        sealIn: {
          '0%': { opacity: '0', transform: 'scale(0.85)' },
          '15%': { opacity: '1', transform: 'scale(1)' },
          '75%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.05)' },
        }
      },
      animation: {
        flow: 'flow 45s linear infinite',
        sealIn: 'sealIn 14s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
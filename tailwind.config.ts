import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          dark: '#0F172A',
          DEFAULT: '#1E3A8A',
          light: '#0F3460',
        },
        azure: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
          dark: '#2563EB',
        },
        cyan: {
          DEFAULT: '#22D3EE',
          light: '#67E8F9',
          dark: '#06B6D4',
        },
        slate: {
          DEFAULT: '#1E293B',
          light: '#E2E8F0',
          lighter: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Los tres tokens de marca se resuelven por variable CSS (definidas en
      // globals.css). El sitio público usa la paleta del despacho; el panel de
      // administración conserva sus colores mediante la clase `tema-admin` en
      // su layout. Los canales van sueltos —"30 42 90"— para que sigan
      // funcionando las opacidades tipo `bg-cyan/20`.
      colors: {
        navy: {
          dark: 'rgb(var(--c-navy-dark) / <alpha-value>)',
          DEFAULT: 'rgb(var(--c-navy) / <alpha-value>)',
          light: 'rgb(var(--c-navy-light) / <alpha-value>)',
        },
        azure: {
          DEFAULT: 'rgb(var(--c-azure) / <alpha-value>)',
          light: 'rgb(var(--c-azure-light) / <alpha-value>)',
          dark: 'rgb(var(--c-azure-dark) / <alpha-value>)',
        },
        // `cyan` es el token de acento. En el sitio público vale dorado
        // #c2a05a; el nombre se conserva para no tocar 158 clases.
        cyan: {
          DEFAULT: 'rgb(var(--c-cyan) / <alpha-value>)',
          light: 'rgb(var(--c-cyan-light) / <alpha-value>)',
          dark: 'rgb(var(--c-cyan-dark) / <alpha-value>)',
        },
        slate: {
          DEFAULT: '#1E293B',
          light: '#E2E8F0',
          lighter: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
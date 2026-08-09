/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // `class` stratejisi: tema secimi `localStorage`'da ve kok elemanda.
  // `media` olsaydi kullanicinin secimi isletim sistemi ayarina yenilirdi.
  darkMode: 'class',
  theme: {
    extend: {
      // Iki ses: Archivo govde/gosterim, Plex Mono para-ve-makine.
      // `font-mono` boylece her kullanildigi yerde Plex'e duser.
      fontFamily: {
        sans: ['Archivo Variable', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      /*
       * SHADCN TOKEN ESLEMESI.
       *
       * `--x` degerleri index.css'te CIPLAK `H S% L%` govdesi olarak
       * tanimli (HER dort kapsamda -- vitrin acik/koyu, aqua acik/koyu --
       * ayri ayri). `<alpha-value>` yer tutucusu Tailwind'e `bg-primary/80`
       * gibi opaklik degistiricilerini DERLEME ANINDA `hsl(... / 0.8)`'e
       * cevirmesini soyluyor; bu yer tutucu olmadan opaklik modifikatoru
       * sessizce yok sayilirdi.
       */
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

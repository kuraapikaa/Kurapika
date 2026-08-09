const tremorRenkler = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    // Tremor kendi bilesenlerini bu klasordeki kaynaktan uretiyor;
    // JIT taramadigi surece o siniflar derlemede budanir.
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  // `class` stratejisi: tema secimi `localStorage`'da ve kok elemanda.
  // `media` olsaydi kullanicinin secimi isletim sistemi ayarina yenilirdi.
  //
  // Kok eleman `koyu` VE `dark` siniflarini BIRLIKTE tasiyor (bkz.
  // `lib/tema.ts`): `koyu` bizim CSS-degiskeni tabanli sistemimiz,
  // `dark` ise Tremor'un kendi bilesenlerinin ic taraflarda kullandigi
  // Tailwind `dark:` varyanti. Ikisi ayni anahtarla birlikte acilip
  // kapaniyor.
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
        /*
         * TREMOR YAPISAL TOKEN'LARI — resmi Tremor v3 baslangic
         * yapilandirmasi, degistirilmeden. Grafikler SADECE `.aqua`
         * kapsamindaki yonetim/ortak sayfalarinda kullaniliyor -- vitrin
         * degil. Marka rengi (`--vurgu`) `.aqua` icinde ZATEN mavi
         * (Apple aksani, index.css'teki "arac" kimligi) ve bu kasitli:
         * panel neon menekseyi tasimiyor. Veri rengi bu yuzden her
         * bilesende `color="blue"` olarak seciliyor, "violet" degil --
         * grafik, yanindaki dugme/kenar cubugundan farkli bir kimlik
         * gostermesin diye.
         */
        tremor: {
          brand: {
            faint: tremorRenkler.blue[50],
            muted: tremorRenkler.blue[200],
            subtle: tremorRenkler.blue[400],
            DEFAULT: tremorRenkler.blue[500],
            emphasis: tremorRenkler.blue[700],
            inverted: tremorRenkler.white,
          },
          background: {
            muted: tremorRenkler.gray[50],
            subtle: tremorRenkler.gray[100],
            DEFAULT: tremorRenkler.white,
            emphasis: tremorRenkler.gray[700],
          },
          border: { DEFAULT: tremorRenkler.gray[200] },
          ring: { DEFAULT: tremorRenkler.gray[200] },
          content: {
            subtle: tremorRenkler.gray[400],
            DEFAULT: tremorRenkler.gray[500],
            emphasis: tremorRenkler.gray[700],
            strong: tremorRenkler.gray[900],
            inverted: tremorRenkler.white,
          },
        },
        'dark-tremor': {
          brand: {
            faint: '#0B1229',
            muted: tremorRenkler.blue[950],
            subtle: tremorRenkler.blue[800],
            DEFAULT: tremorRenkler.blue[500],
            emphasis: tremorRenkler.blue[400],
            inverted: tremorRenkler.blue[950],
          },
          background: {
            muted: '#131A2B',
            subtle: tremorRenkler.gray[800],
            DEFAULT: tremorRenkler.gray[900],
            emphasis: tremorRenkler.gray[300],
          },
          border: { DEFAULT: tremorRenkler.gray[800] },
          ring: { DEFAULT: tremorRenkler.gray[800] },
          content: {
            subtle: tremorRenkler.gray[600],
            DEFAULT: tremorRenkler.gray[500],
            emphasis: tremorRenkler.gray[200],
            strong: tremorRenkler.gray[50],
            inverted: tremorRenkler.gray[950],
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'tremor-small': '0.375rem',
        'tremor-default': '0.5rem',
        'tremor-full': '9999px',
      },
      boxShadow: {
        'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'dark-tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'dark-tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'dark-tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
      fontSize: {
        'tremor-label': ['0.75rem'],
        'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
        'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
        'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  safelist: [
    {
      pattern: /^(bg|text|border|ring|stroke|fill)-(?:blue|rose|emerald|amber|gray)-(?:50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ['hover'],
    },
  ],
  plugins: [require('tailwindcss-animate')],
};

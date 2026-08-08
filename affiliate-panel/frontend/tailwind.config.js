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
    },
  },
  plugins: [],
};

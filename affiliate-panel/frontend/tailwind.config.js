/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // `class` stratejisi: tema secimi `localStorage`'da ve kok elemanda.
  // `media` olsaydi kullanicinin secimi isletim sistemi ayarina yenilirdi.
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};

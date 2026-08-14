import colors from 'tailwindcss/colors';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        // Yonetim panelinin govde yazisi. Inter yedekte: Plus Jakarta Sans
        // Google Fonts'tan gelmezse olculer kaymasin diye ayni x-yuksekligi
        // sinifindan bir font.
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        // Lobi ve alt sayfalarin gorsel dili; admin ekranlari Inter'de kaliyor.
        lobby: ['Archivo', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        slate: colors.slate,
        violet: colors.cyan,
      },
    },
  },
  plugins: [],
};

import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // vite.config.ts ile AYNI takma ad. Burada eksikti: hicbir test "@/..."
    // kullanmadigi icin fark edilmiyordu. Kaynak agaci artik bu takma adla
    // import ediyor, iki yapilandirma ayrisirsa test cozumlemesi kirilir.
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
});

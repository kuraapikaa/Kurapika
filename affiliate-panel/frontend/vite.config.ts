import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Derlenmiş arayüz backend'in `genel/` dizinine yazılıyor.
 *
 * Tek konteynerden servis etmek için: ayrı bir statik barındırma da
 * mümkün ama iki servis, iki alan adı ve çerez için `sameSite`
 * ayarlarıyla uğraşmak demek. Aynı köken, en az hareketli parça.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Yalnizca `import type` icin kullaniliyor; tipler derlemede silindigi
    // icin sunucu kodu pakete girmiyor. Takma ad yine de tanimli, ki
    // yanlislikla deger import edilirse sessizce kirilmak yerine
    // build'de patlasin.
    alias: { '@sunucu': fileURLToPath(new URL('../backend/src', import.meta.url)) },
  },
  build: {
    outDir: '../backend/genel',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: true },
      '/c': { target: 'http://localhost:4100', changeOrigin: true },
    },
  },
});

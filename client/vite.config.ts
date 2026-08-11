import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOT: process.env.PORT burada kullanılmaz — birçok host/araç PORT'u "bu sürecin
// kendi portu" anlamında set eder; client'a sızarsa proxy kendi kendine bağlanmaya
// çalışıp bağlantı fırtınasına (EMFILE) yol açar. API portu için sadece VITE_API_PORT kullanılır.
const apiPort = process.env.VITE_API_PORT || '3750';
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    // shadcn/magicui/aceternity CLI'larinin urettigi bilesenler "@/..."
    // import'u bekliyor; mevcut kod hala goreceli import kullaniyor, ikisi
    // birlikte calisir.
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      // Tek giris kaldi. Ortak paneli ayri bir giristi (ortak.html) ama
      // ortaklik Bugs Affiliate'e tasindi; /ortak.html artik sunucuda yeni
      // panele yonlendiriliyor.
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        /**
         * Saticı kodunu ayri parcalara bol.
         *
         * Hepsi tek `main` parcasindaydi: uygulama kodunda tek satir
         * degisince React dahil 828 kB'lik parcanin tamami yeniden
         * indiriliyordu. Satici kodu nadiren degisir; ayri parcada
         * tarayici onbelleginde kalir.
         */
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          return 'vendor';
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});

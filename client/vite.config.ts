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
  build: {
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      // Iki ayri giris: ana uygulama ve ortak paneli.
      //
      // Ortak, yonetim panelinin JS'ini indirmemeli; ayni pakette olsalardi
      // admin ekranlarinin kodu ortagin tarayicisina da inerdi.
      input: {
        main: resolve(__dirname, 'index.html'),
        ortak: resolve(__dirname, 'ortak.html'),
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

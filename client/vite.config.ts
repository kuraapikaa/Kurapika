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
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
});

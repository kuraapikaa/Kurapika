import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiPort = process.env.VITE_API_PORT || process.env.PORT || '3750';
const apiTarget = `http://localhost:${apiPort}`;

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

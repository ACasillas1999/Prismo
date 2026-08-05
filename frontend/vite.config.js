import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://192.168.60.117:3010',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://192.168.60.117:3010',
        changeOrigin: true,
      },
    },
  },
});

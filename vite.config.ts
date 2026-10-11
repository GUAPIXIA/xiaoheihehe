import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()], clearScreen: false,
  server: {
    strictPort: true, port: 5173,
    watch: { ignored: ['**/target/**', '**/data/**', '**/output/**', '**/research/**', '**/src-tauri/**'] },
    proxy: { '/api': { target: 'http://127.0.0.1:38741', changeOrigin: true } },
  },
});

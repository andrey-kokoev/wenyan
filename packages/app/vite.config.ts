import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  root: './client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/documents': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/__openhub2': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
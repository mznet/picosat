import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const isTauri = !!process.env.TAURI_PLATFORM

export default defineConfig(async () => ({
  plugins: [react()],

  clearScreen: false,
  server: {
    // Tauri dev 시에만 1420 사용, 일반 npm run dev 는 5173
    port: isTauri ? 1420 : 5173,
    strictPort: isTauri,
    watch: {
      ignore: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}))

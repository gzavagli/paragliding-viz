import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    proxy: {
      '/tiles/kk7': {
        target: 'https://thermal.kk7.ch/tiles',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/kk7/, '')
      }
    }
  }
})

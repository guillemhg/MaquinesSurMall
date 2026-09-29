import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/MaquinesSurMall/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Maquines Sur Mallorca',
        short_name: 'Maquines Sur',
        description: 'Gestión local de máquinas, averías y recaudaciones',
        theme_color: '#101828',
        background_color: '#eef2f6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/MaquinesSurMall/',
        scope: '/MaquinesSurMall/',
        icons: [
          {
            src: '/MaquinesSurMall/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,json}'],
      },
    }),
  ],
})

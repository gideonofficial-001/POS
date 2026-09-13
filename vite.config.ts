import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'generateSW',
      // ✅ Reference assets that actually exist in /public/
      includeAssets: [
        'android/launchericon-48x48.png',
        'android/launchericon-72x72.png',
        'android/launchericon-96x96.png',
        'android/launchericon-144x144.png',
        'android/launchericon-192x192.png',
        'android/launchericon-512x512.png',
      ],
      manifest: {
        name: 'Njugush POS',
        short_name: 'NjugushPOS',
        description: 'Point of Sale & Inventory Management System for Njugush Enterprises',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        categories: ['business', 'productivity'],
        lang: 'en',
        dir: 'ltr',
     screenshots: [
  {
    src: '/android/launchericon-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    form_factor: 'narrow',
    label: 'Njugush POS Home Screen',
  },
],
        // ✅ Paths now match actual files in /public/android/
        icons: [
          {
            src: '/android/launchericon-48x48.png',
            sizes: '48x48',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/android/launchericon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/android/launchericon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/android/launchericon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/android/launchericon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',         // Chrome install prompt requires this size
          },
          {
            src: '/android/launchericon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',    // Adaptive icon for Android
          },
          {
            src: '/android/launchericon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',         // Chrome install prompt requires this size
          },
          {
            src: '/android/launchericon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',    // Adaptive icon for Android
          },
        ],
        shortcuts: [
          {
            name: 'New Sale',
            short_name: 'Sale',
            description: 'Quickly create a new sale',
            url: '/branch/new-sale',
            icons: [{ src: '/android/launchericon-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Inventory',
            short_name: 'Stock',
            description: 'Check inventory levels',
            url: '/branch/inventory',
            icons: [{ src: '/android/launchericon-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui:     ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          charts: ['recharts'],
        },
      },
    },
  },
})

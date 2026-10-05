import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE: percorso di pubblicazione ('/' di solito, '/custode/' quando sta accanto all'app ristorante)
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // NO_PWA=1: build senza service worker (anteprime dove i service worker non sono permessi)
      disable: process.env.NO_PWA === '1',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'push-sw.js'],
      manifest: {
        name: 'Custode · Roma sicura',
        short_name: 'Custode',
        description: 'Viaggia sicuro a Roma: documenti cifrati, programma del giorno, gruppo sempre vicino.',
        lang: 'it',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF6EF',
        theme_color: '#B5502F',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: base + 'index.html',
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/[abc]?\.?tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            // Motore OCR e dati lingua di tesseract.js: scaricati la prima volta, poi disponibili offline
            urlPattern: /^https:\/\/(cdn\.jsdelivr\.net|tessdata\.projectnaptha\.com)\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'ocr', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 180 } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
});

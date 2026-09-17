import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this repo at https://<user>.github.io/Chromies_DataSet/.
// Override with BASE_PATH=/ when deploying to Cloudflare Pages or a custom domain.
const base = process.env.BASE_PATH ?? '/Chromies_DataSet/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // Scoring happens at a field that often has no signal. The service worker
    // precaches the shell and the fonts so the app opens offline; the scorebook
    // itself already lives in localStorage, and queued writes flush on reconnect.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['chromies-only-inline.svg', 'chromies-wordmark.svg', 'fonts.css'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: base + 'index.html',
        cleanupOutdatedCaches: true,
        // Never serve a cached API response: game state is the server's to answer for.
        navigateFallbackDenylist: [/^\/functions\//, /^\/rest\//],
      },
      manifest: {
        name: 'The Chromies Scorebook',
        short_name: 'Chromies',
        description: 'Slowpitch softball scorebook for The Chromies.',
        theme_color: '#111111',
        background_color: '#111111',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: { outDir: 'dist', sourcemap: true },
});

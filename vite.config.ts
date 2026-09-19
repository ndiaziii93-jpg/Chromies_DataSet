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
      // 'prompt' rather than 'autoUpdate': the app registers the worker itself
      // (src/state/updates.ts) so it can hold a reload back while a game is being
      // scored, instead of pulling the page out from under the scorer.
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['chromies-only-inline.svg', 'chromies-wordmark.svg', 'fonts.css'],
      workbox: {
        // Take control of the page on the first load, so a later deploy has a
        // controlled client to wait behind — that waiting worker is what tells
        // the app an update exists. Without it the new worker activates straight
        // away and nothing is ever signalled.
        clientsClaim: true,
        // But never swap under a running page on its own: updates.ts decides when.
        skipWaiting: false,
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

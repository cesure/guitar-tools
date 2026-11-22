// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { AstroPWAIntegration } from '@vite-pwa/astro';

// Gehostet auf GitHub Pages unter https://cesure.github.io/guitar-tools/
export default defineConfig({
  site: 'https://cesure.github.io',
  base: '/guitar-tools',
  trailingSlash: 'always',
  // Im Container kommen Dateiänderungen vom Mac nicht als Events an → Polling (siehe ./dc)
  vite: { server: { watch: { usePolling: process.env.GT_POLL === '1', interval: 300 } } },
  integrations: [
    svelte(),
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      injectRegister: false, // Registrierung in src/layouts/AppLayout.astro
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Guitar Tools',
        short_name: 'Guitar Tools',
        description: 'Tonfinder, Metronom und Skalen für die Gitarre',
        lang: 'de',
        start_url: '/guitar-tools/',
        scope: '/guitar-tools/',
        display: 'standalone',
        background_color: '#1c1d1f',
        theme_color: '#1c1d1f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      generateSW: {
        // Icons, Manifest und favicon nimmt das Plugin selbst mit (includeAssets/manifest)
        globPatterns: ['**/*.{html,js,css}'],
        navigateFallback: null,
      },
    }),
  ],
});

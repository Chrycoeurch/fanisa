import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // PWA principale — FANISA Web Pro
      VitePWA({
        registerType: 'autoUpdate',
        filename: 'sw.js',
        includeAssets: ['favicon.svg', 'favicon-collecte.svg', 'icon-collecte-192.png', 'icon-collecte-512.png'],
        manifest: {
          name: 'FANISA Web Pro',
          short_name: 'FANISA',
          description: 'Registre numérique du Fokontany Ambodisaina',
          theme_color: '#1e40af',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
          navigateFallback: '/',
          navigateFallbackDenylist: [/^\/collecte/],  // laisse /collecte à son propre SW
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          collecte: path.resolve(__dirname, 'collecte.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

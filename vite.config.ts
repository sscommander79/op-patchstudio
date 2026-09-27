/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'fs'
import { randomUUID } from 'node:crypto'
import type { Plugin } from 'vite'
import { devStaleWorkerGuard } from './scripts/dev-stale-worker-guard.ts'

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const pwaBuildId = `${process.env.OPSTUDIO_BUILD_ID ?? process.env.GITHUB_SHA ?? `v${packageJson.version}`}-${Date.now().toString(36)}-${randomUUID()}`
  .replace(/[^a-zA-Z0-9._-]/g, '-')
const lifecycleAsset = `assets/pwa-cache-lifecycle-${pwaBuildId}.js`
const lifecycleSource = readFileSync('./scripts/pwa-cache-lifecycle.js', 'utf-8')
  .replace('__OPSTUDIO_PWA_BUILD_ID__', pwaBuildId)
const pwaLifecycleAssetPlugin:Plugin = {
  name: 'op-patchstudio-pwa-lifecycle-asset',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: lifecycleAsset, source: lifecycleSource })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    pwaLifecycleAssetPlugin,
    // Development only: expose this server's build identity and retire a production worker left on the origin.
    devStaleWorkerGuard({
      buildId: pwaBuildId,
      version: packageJson.version,
      retireWorkers: process.env.OPSTUDIO_DEV_SW_GUARD !== '0',
      // Opt-in only: comma-separated non-loopback hostnames (for example a LAN name) that the guard may serve.
      extraHosts: (process.env.OPSTUDIO_DEV_SW_GUARD_HOSTS ?? '').split(',').map(host => host.trim()).filter(Boolean),
    }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false,
      workbox: {
        cacheId: `op-patchstudio-${pwaBuildId}`,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: false,
        importScripts: [lifecycleAsset],
        // Keep a content revision on public assets as well as Vite's hashed bundles.
        // Icon and preview filenames are stable across releases, so URL-only cache
        // keys could otherwise preserve stale pixels after an update.
        dontCacheBustURLsMatching: /^$/,
        runtimeCaching: [{
          urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/assets/'),
          handler: ({ request }) => (globalThis as typeof globalThis & {
            __OPSTUDIO_FETCH_ASSET__: (request: Request) => Promise<Response>;
          }).__OPSTUDIO_FETCH_ASSET__(request),
        }],
      },
      manifest: {
        name: 'OP-PatchStudio',
        short_name: 'OP-PatchStudio',
        description: 'Free & open source preset creator for OP synthesizers',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'assets/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: 'assets/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: 'assets/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'assets/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png'
          },
          {
            src: 'assets/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: 'assets/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: 'assets/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_BUILD_ID__: JSON.stringify(pwaBuildId),
  },
  // @ts-expect-error - Vitest extends Vite config with test options
  test: {
    globals: true,
    // Playwright suites live under tests/ and run through their own configs.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'tests/dev-origin/**', 'tests/visual/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/'
      ]
    }
  }
})

import { resolve } from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import manifest from './manifest.config'

const isFirefox = process.env.BROWSER_TARGET === 'firefox'

export default defineConfig({
  plugins: [preact(), tailwindcss(), crx({ manifest, browser: isFirefox ? 'firefox' : 'chrome' })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@ui': resolve(__dirname, 'src/ui'),
    },
  },
  build: {
    outDir: isFirefox ? 'dist-firefox' : 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        settings: resolve(__dirname, 'src/settings/index.html'),
        onboarding: resolve(__dirname, 'src/onboarding/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5174 },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
  },
})

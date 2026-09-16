import { viteCommonjs } from '@originjs/vite-plugin-commonjs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  // GitHub Pages: https://Fgu-YTC.github.io/MapMap/
  base: process.env.GITHUB_PAGES === 'true' ? '/MapMap/' : '/',
  plugins: [
    react(),
    viteCommonjs({
      include: ['bitcore-lib', 'lodash'],
    }),
    nodePolyfills({
      include: [
        'buffer',
        'process',
        'util',
        'stream',
        'events',
        'assert',
        'crypto',
        'url',
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      lodash: 'lodash-es',
      'lodash/debounce': 'lodash-es/debounce.js',
      'lodash/throttle': 'lodash-es/throttle.js',
    },
  },
  optimizeDeps: {
    include: [
      'bitcore-lib',
      '@particle-network/btc-connectkit',
      'lodash-es',
      'lodash-es/debounce',
    ],
  },
  build: {
    commonjsOptions: {
      include: [/bitcore-lib/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
})

import { defineConfig } from 'vite'
import { adex } from 'adex'
import { node } from 'adex-adapter-node'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [
    adex({
      islands: false,
      ssr: true,
      adapter: node(),
    }),
    preact(),
  ],
})

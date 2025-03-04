import { defineConfig } from 'vite'
import { adex } from 'adex'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [
    adex({
      islands: false,
      ssr: false,
    }),
    preact(),
  ],
})

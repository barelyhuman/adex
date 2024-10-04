import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { adex } from 'adex'
import { fonts, providers } from 'adex/fonts'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    adex(),
    fonts({
      providers: [providers.google()],
      families: [
        {
          name: 'Open Sans',
          weights: ['400', '600'],
          styles: ['normal'],
        },
      ],
    }),
    preact(),
  ],
})

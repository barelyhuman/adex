import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { adex } from 'adex'
import { providers } from 'adex/fonts'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    adex({
      islands: true,
      fonts: {
        providers: [providers.google()],
        families: [
          {
            name: 'Inter',
            weights: ['400', '600'],
            styles: ['normal'],
          },
        ],
      },
    }),
    preact(),
  ],
})
